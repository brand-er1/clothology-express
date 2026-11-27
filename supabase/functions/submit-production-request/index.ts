import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { assertPublicUrl, assertResolvesPublic } from "../_shared/article-meta.ts";
import {
  decodeBase64Image, detectProductionImageType, isUuid, parseOwnStorageUrl, PRODUCTION_IMAGE_EXTENSION,
  PRODUCTION_REQUEST_CONSENT_VERSION, PRODUCTION_REQUEST_LIMITS, validateProductionRequest,
} from "../_shared/productionRequest.ts";

/**
 * AI 이미지 생성 결과 → 제작의뢰 접수 (회원 · 비회원 모두 가능)
 *
 * 요청: application/json
 *   { submissionKey, contactName, phone, quantity, quantityUndecided, budget?, request?, privacyConsent, privacyConsentVersion,
 *     image: { url?: string, base64?: string },          // 고객이 보고 있던 생성 이미지 (자동 첨부)
 *     design: { clothType, material, aiPrompt, designBrief, designId }, entryPoint, entryPath }
 *
 * 1) 같은 submissionKey 가 이미 접수되었으면 기존 접수 결과를 돌려준다(더블 클릭 · 재시도 중복 방지).
 * 2) 입력을 서버에서 다시 검증한다(이름 · 010 전화번호 · 수량/미정 · 동의).
 * 3) 이미지를 받아(우리 Storage → 직접 복사 / 외부 임시 URL → 안전 검사 후 다운로드 / 편집본 → base64)
 *    generated_images/production-requests/ 에 영구 저장한다. 임시 URL 이 만료돼도 관리자가 볼 수 있다.
 * 4) create_ai_production_request 로 orders + 접수 정보 + 진행 상태를 한 트랜잭션에 저장한다.
 *    DB 저장에 실패하면 올린 이미지를 지우고 실패를 돌려준다(ok:false → 화면은 접수 완료를 띄우지 않는다).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "generated_images";
const MAX_REQUEST_BYTES = Math.ceil(PRODUCTION_REQUEST_LIMITS.imageMaxBytes * 1.4) + 256 * 1024;
const FETCH_TIMEOUT_MS = 20_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const fail = (status: number, code: string, error: string, fields?: Record<string, string>) =>
  json({ ok: false, code, error, ...(fields ? { fields } : {}) }, status);

const sha256Hex = async (value: string | Uint8Array) => {
  const data = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const clientIp = (req: Request) =>
  req.headers.get("cf-connecting-ip")
  ?? req.headers.get("x-real-ip")
  ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  ?? null;

const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

const DB_ERROR_STATUS: Record<string, number> = { PR_INVALID: 400, PR_CONSENT: 400, PR_IMAGE: 400, PR_DUPLICATE: 409, PR_RATE_LIMITED: 429 };

class ImageError extends Error {}

/** 외부(생성 서비스의 임시) URL 에서 이미지를 받는다. 내부 주소 · 비이미지 · 과대 용량은 거부한다. */
const downloadRemoteImage = async (raw: string): Promise<Uint8Array> => {
  let url: URL;
  try {
    url = assertPublicUrl(raw);
  } catch {
    throw new ImageError("이미지 주소가 올바르지 않습니다.");
  }
  if (url.protocol !== "https:") throw new ImageError("이미지 주소가 올바르지 않습니다.");
  const resolver = (Deno as unknown as { resolveDns?: (host: string, type: "A" | "AAAA") => Promise<string[]> }).resolveDns;
  try {
    await assertResolvesPublic(url.hostname, resolver);
  } catch {
    throw new ImageError("이미지 주소가 올바르지 않습니다.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "error" });
    if (!response.ok || !response.body) throw new ImageError("생성 이미지의 임시 주소가 만료되었습니다. 이미지를 다시 생성한 뒤 의뢰해주세요.");
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > PRODUCTION_REQUEST_LIMITS.imageMaxBytes) throw new ImageError("이미지 용량이 너무 큽니다.");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > PRODUCTION_REQUEST_LIMITS.imageMaxBytes) {
        await reader.cancel();
        throw new ImageError("이미지 용량이 너무 큽니다.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } catch (error) {
    if (error instanceof ImageError) throw error;
    throw new ImageError("생성 이미지를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
  } finally {
    clearTimeout(timer);
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "METHOD", "허용되지 않은 요청입니다.");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return fail(500, "CONFIG", "접수 서버 설정이 완료되지 않았습니다. 잠시 후 다시 시도해주세요.");
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_REQUEST_BYTES) return fail(413, "TOO_LARGE", "의뢰 이미지 용량이 너무 큽니다.");

  let payload: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("payload");
    payload = parsed as Record<string, unknown>;
  } catch {
    return fail(400, "BAD_REQUEST", "의뢰서 형식이 올바르지 않습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.");
  }

  // 로그인한 회원이면 계정과 연결한다. 비회원(anon 키 토큰)은 사용자가 없으므로 이름 · 전화번호만으로 접수한다.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: authData } = token
    ? await admin.auth.getUser(token).catch(() => ({ data: { user: null } }))
    : { data: { user: null } };
  const userId = authData?.user?.id ?? null;

  const submissionKey = payload.submissionKey;
  if (!isUuid(submissionKey)) return fail(400, "BAD_REQUEST", "접수 식별값이 올바르지 않습니다. 페이지를 새로고침해주세요.");

  const { data: existing, error: existingError } = await admin
    .from("production_request_details").select("order_id, created_at").eq("submission_key", submissionKey).maybeSingle();
  if (existingError) {
    console.error("production-request: lookup failed", existingError.message);
    return fail(500, "SAVE_FAILED", "제작의뢰를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
  }
  if (existing) return json({ ok: true, duplicate: true, orderId: existing.order_id, createdAt: existing.created_at });

  const validation = validateProductionRequest(payload);
  if (!validation.ok) return fail(400, "INVALID", Object.values(validation.errors)[0] ?? "입력 내용을 다시 확인해주세요.", validation.errors as Record<string, string>);
  if (payload.privacyConsentVersion !== PRODUCTION_REQUEST_CONSENT_VERSION) {
    return fail(400, "CONSENT", "개인정보 수집 · 이용 안내가 변경되었습니다. 페이지를 새로고침한 뒤 다시 동의해주세요.");
  }

  // ── 이미지 확보 ─────────────────────────────────────────────────────────
  const image = (payload.image && typeof payload.image === "object" ? payload.image : {}) as Record<string, unknown>;
  const imageUrl = str(image.url, 4000);
  const imageBase64 = typeof image.base64 === "string" ? image.base64 : "";
  let bytes: Uint8Array;
  try {
    if (imageBase64) {
      try {
        bytes = decodeBase64Image(imageBase64);
      } catch {
        throw new ImageError("의뢰 이미지를 읽지 못했습니다.");
      }
    } else if (imageUrl.startsWith("data:image/")) {
      try {
        bytes = decodeBase64Image(imageUrl);
      } catch {
        throw new ImageError("의뢰 이미지를 읽지 못했습니다.");
      }
    } else if (imageUrl) {
      const own = parseOwnStorageUrl(imageUrl, supabaseUrl);
      if (own) {
        const { data, error } = await admin.storage.from(own.bucket).download(own.path);
        if (error || !data) throw new ImageError("저장된 생성 이미지를 찾지 못했습니다. 이미지를 다시 생성한 뒤 의뢰해주세요.");
        bytes = new Uint8Array(await data.arrayBuffer());
      } else {
        bytes = await downloadRemoteImage(imageUrl);
      }
    } else {
      throw new ImageError("의뢰할 생성 이미지가 없습니다. 이미지를 생성한 뒤 다시 시도해주세요.");
    }
  } catch (error) {
    const message = error instanceof ImageError ? error.message : "의뢰 이미지를 불러오지 못했습니다.";
    if (!(error instanceof ImageError)) console.error("production-request: image fetch failed", error);
    return fail(400, "IMAGE", message);
  }

  if (bytes.byteLength === 0 || bytes.byteLength > PRODUCTION_REQUEST_LIMITS.imageMaxBytes) return fail(400, "IMAGE", "의뢰 이미지 용량이 올바르지 않습니다.");
  const mimeType = detectProductionImageType(bytes);
  if (!mimeType) return fail(400, "IMAGE", "PNG · JPG · WEBP 이미지만 의뢰할 수 있습니다.");

  const fingerprint = (await sha256Hex(bytes)).slice(0, 40);
  const ip = clientIp(req);
  const ipHash = ip ? await sha256Hex(`${Deno.env.get("PRODUCTION_REQUEST_IP_SALT") ?? serviceKey.slice(-24)}:${ip}`) : null;
  const month = new Date().toISOString().slice(0, 7);
  const path = `production-requests/${month}/${submissionKey}-${crypto.randomUUID().slice(0, 8)}.${PRODUCTION_IMAGE_EXTENSION[mimeType]}`;

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: mimeType, upsert: false, cacheControl: "31536000" });
  if (uploadError) {
    console.error("production-request: upload failed", uploadError.message);
    return fail(500, "IMAGE_SAVE_FAILED", "의뢰 이미지를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
  }
  const storedUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const cleanup = async () => {
    const { error } = await admin.storage.from(BUCKET).remove([path]);
    if (error) console.error("production-request: image cleanup failed", error.message, path);
  };

  // ── DB 저장 (한 트랜잭션) ────────────────────────────────────────────────
  const design = (payload.design && typeof payload.design === "object" ? payload.design : {}) as Record<string, unknown>;
  const { value } = validation;
  try {
    const { data, error } = await admin.rpc("create_ai_production_request", {
      p_payload: {
        submissionKey,
        contactName: value.contactName,
        phone: value.phone,
        quantity: value.quantity,
        quantityUndecided: value.quantityUndecided,
        budget: value.budget,
        request: value.request,
        privacyConsent: true,
        privacyConsentVersion: PRODUCTION_REQUEST_CONSENT_VERSION,
        clothType: str(design.clothType, 200),
        material: str(design.material, 200),
        aiPrompt: str(design.aiPrompt, PRODUCTION_REQUEST_LIMITS.promptMax),
        designBrief: str(design.designBrief, PRODUCTION_REQUEST_LIMITS.briefMax),
        designId: isUuid(design.designId) ? design.designId : null,
        imagePath: path,
        imageUrl: storedUrl,
        imageSourceUrl: imageUrl && !imageUrl.startsWith("data:") ? imageUrl.slice(0, 2000) : null,
        imageFingerprint: fingerprint,
        entryPoint: str(payload.entryPoint, 60) || "ai_image_generator",
        entryPath: str(payload.entryPath, 300) || null,
      },
      p_user_id: userId,
      p_ip_hash: ipHash,
      p_user_agent: (req.headers.get("user-agent") ?? "").slice(0, 500) || null,
    });

    if (error) {
      await cleanup();
      const match = error.message.match(/^(PR_[A-Z_]+):\s*(.+)$/s);
      if (match && DB_ERROR_STATUS[match[1]]) return fail(DB_ERROR_STATUS[match[1]], match[1].replace(/^PR_/, ""), match[2]);
      console.error("production-request: rpc failed", error.message);
      return fail(500, "SAVE_FAILED", "제작의뢰를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
    }

    const result = data as { order_id?: string; created_at?: string; duplicate?: boolean } | null;
    if (!result?.order_id) {
      await cleanup();
      return fail(500, "SAVE_FAILED", "제작의뢰를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
    // 동시에 같은 키로 두 번 들어와 먼저 저장된 건을 돌려받은 경우, 이번에 올린 이미지는 쓰지 않는다.
    if (result.duplicate) await cleanup();
    return json({ ok: true, duplicate: Boolean(result.duplicate), orderId: result.order_id, createdAt: result.created_at });
  } catch (error) {
    await cleanup();
    console.error("production-request: unexpected", error);
    return fail(500, "SAVE_FAILED", "제작의뢰를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
  }
});
