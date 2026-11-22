import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  detectLabImageType, isUuid, LAB_IMAGE_EXTENSION, LAB_LIMITS, validateLabApplication, validateLabConsents,
} from "../_shared/labApplication.ts";

/**
 * BRAND-ER LAB 무료 샘플 제작 신청 접수 (로그인한 회원만 가능).
 *
 * 요청: multipart/form-data
 *   payload : JSON 문자열 { submissionKey, applicantName, phone, email, instagramId?, garmentTypes, garmentTypeOther,
 *             designDescription, size?, sizeOther?, purpose, reason?, futureProduction?, filmingAvailability, consents: [{ key, version, agreed }] }
 *   images  : 참고 이미지 0~5개 (JPG · PNG · WEBP, 각 10MB 이하)
 *
 * 1) 입력 · 동의 · 이미지를 서버에서 다시 검증한다(파일 형식은 내용으로 판별).
 * 2) 같은 submissionKey 가 이미 접수되었으면 기존 접수 번호를 돌려준다(중복 제출 방지).
 * 3) 이미지를 비공개 버킷 lab-applications/{submissionKey}/ 에 저장하고 lab_create_application 으로 한 번에 저장한다.
 *    저장에 실패하면 올린 이미지를 지운다.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "lab-applications";
// 이미지 5장 × 10MB + 본문 여유
const MAX_REQUEST_BYTES = LAB_LIMITS.maxImages * LAB_LIMITS.maxImageBytes + 1024 * 1024;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const fail = (status: number, code: string, error: string, fields?: Record<string, string>) =>
  json({ ok: false, code, error, ...(fields ? { fields } : {}) }, status);

const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const clientIp = (req: Request) =>
  req.headers.get("cf-connecting-ip")
  ?? req.headers.get("x-real-ip")
  ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  ?? null;

// lab_create_application 의 'LAB_<CODE>: 안내 문구' 오류를 HTTP 응답으로 바꾼다.
const DB_ERROR_STATUS: Record<string, number> = { LAB_RATE_LIMITED: 429, LAB_DUPLICATE: 409, LAB_CONSENT: 400, LAB_INVALID: 400, LAB_LOGIN_REQUIRED: 401 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "METHOD", "허용되지 않은 요청입니다.");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return fail(500, "CONFIG", "신청 서버 설정이 완료되지 않았습니다. 잠시 후 다시 시도해주세요.");
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // 로그인한 회원만 신청할 수 있다. 비로그인 요청은 anon 키 토큰이라 사용자가 없다 → 401.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: authData } = token
    ? await admin.auth.getUser(token).catch(() => ({ data: { user: null } }))
    : { data: { user: null } };
  const userId = authData?.user?.id ?? null;
  if (!userId) return fail(401, "LOGIN_REQUIRED", "로그인한 회원만 신청할 수 있습니다. 로그인 후 다시 신청해주세요.");

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_REQUEST_BYTES) return fail(413, "TOO_LARGE", "첨부한 이미지 용량이 너무 큽니다. 이미지당 10MB, 최대 5장까지 올릴 수 있습니다.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "BAD_REQUEST", "신청서를 읽지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.");
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(form.get("payload") ?? ""));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("payload");
    payload = parsed as Record<string, unknown>;
  } catch {
    return fail(400, "BAD_REQUEST", "신청서 형식이 올바르지 않습니다.");
  }

  const submissionKey = payload.submissionKey;
  if (!isUuid(submissionKey)) return fail(400, "BAD_REQUEST", "신청서 식별값이 올바르지 않습니다. 페이지를 새로고침해주세요.");

  // 이미 접수된 신청서(더블 클릭 · 응답 유실 후 재시도)는 이미지를 다시 올리지 않고 기존 결과를 돌려준다.
  const { data: existing, error: existingError } = await admin
    .from("lab_applications").select("application_no, created_at").eq("submission_key", submissionKey).eq("user_id", userId).maybeSingle();
  if (existingError) {
    console.error("lab: lookup failed", existingError.message);
    return fail(500, "SAVE_FAILED", "신청을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
  }
  if (existing) return json({ ok: true, duplicate: true, applicationNo: existing.application_no, createdAt: existing.created_at });

  const validation = validateLabApplication(payload);
  if (!validation.ok) return fail(400, "INVALID", "입력 내용을 다시 확인해주세요.", validation.errors as Record<string, string>);
  const consents = validateLabConsents(payload.consents);
  if (!consents.ok) return fail(400, "CONSENT", consents.error);

  const files = form.getAll("images").filter((item): item is File => item instanceof File);
  if (files.length > LAB_LIMITS.maxImages) return fail(400, "IMAGES", `참고 이미지는 최대 ${LAB_LIMITS.maxImages}장까지 올릴 수 있습니다.`);

  const images: { bytes: Uint8Array; type: keyof typeof LAB_IMAGE_EXTENSION }[] = [];
  for (const file of files) {
    if (file.size <= 0 || file.size > LAB_LIMITS.maxImageBytes) {
      return fail(400, "IMAGES", "이미지당 10MB 이하만 올릴 수 있습니다.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = detectLabImageType(bytes);
    if (!type) return fail(400, "IMAGES", "JPG · PNG · WEBP 이미지만 올릴 수 있습니다.");
    images.push({ bytes, type });
  }

  const ip = clientIp(req);
  const ipHash = ip ? await sha256Hex(`${Deno.env.get("LAB_IP_HASH_SALT") ?? serviceKey.slice(-24)}:${ip}`) : null;

  const uploaded: string[] = [];
  const cleanup = async () => {
    if (uploaded.length === 0) return;
    const { error } = await admin.storage.from(BUCKET).remove(uploaded);
    if (error) console.error("lab: image cleanup failed", error.message, uploaded);
  };

  try {
    for (const [index, image] of images.entries()) {
      const path = `${submissionKey}/${index + 1}-${crypto.randomUUID().slice(0, 8)}.${LAB_IMAGE_EXTENSION[image.type]}`;
      const { error } = await admin.storage.from(BUCKET).upload(path, image.bytes, { contentType: image.type, upsert: false });
      if (error) throw new Error(`upload: ${error.message}`);
      uploaded.push(path);
    }

    const { value } = validation;
    const { data, error } = await admin.rpc("lab_create_application", {
      p_payload: { ...value, submissionKey, consents: consents.value },
      p_image_paths: uploaded,
      p_ip_hash: ipHash,
      p_user_agent: (req.headers.get("user-agent") ?? "").slice(0, 500) || null,
      p_user_id: userId,
    });

    if (error) {
      await cleanup();
      const match = error.message.match(/^(LAB_[A-Z_]+):\s*(.+)$/s);
      if (match && DB_ERROR_STATUS[match[1]]) {
        const message = match[1] === "LAB_INVALID" ? match[2].replace(/\s*\(.*\)$/s, "") : match[2];
        return fail(DB_ERROR_STATUS[match[1]], match[1].replace(/^LAB_/, ""), message);
      }
      console.error("lab: save failed", error.message);
      return fail(500, "SAVE_FAILED", "신청을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
    }

    const result = data as { application_no: string; created_at: string; duplicate: boolean };
    // 동시에 들어온 같은 신청서가 먼저 저장된 경우: 이번에 올린 이미지는 쓰이지 않으므로 지운다.
    if (result.duplicate) await cleanup();
    return json({ ok: true, duplicate: result.duplicate, applicationNo: result.application_no, createdAt: result.created_at }, result.duplicate ? 200 : 201);
  } catch (error) {
    await cleanup();
    console.error("lab: unexpected failure", error instanceof Error ? error.message : error);
    return fail(500, "SAVE_FAILED", "신청을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
  }
});
