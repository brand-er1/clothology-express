import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { fetchReferenceImage, getImageProvider, ImageProviderConfigError } from "../_shared/imageProviders.ts";
import { logAiUsage, precheckAiUsage } from "../_shared/aiUsage.ts";
import { buildImageEditPrompt, IMAGE_EDIT_PRESETS, isImageEditPreset } from "../_shared/brandingPolicy.ts";

/**
 * "AI 이미지 수정": 이미 만든 AI 이미지(의류 디자인 · 상세페이지 · 컬러 이미지)를 최소 편집한다.
 * 프리셋 — 로고 제거 / 글자 제거 / 디자인 수정 / 컬러 수정 / 직접 수정 요청.
 * 원본의 핏·색상·원단·디테일·배경·구도는 유지하고 요청한 부분만 바꾼다. 결과는 새 파일로 저장하며
 * 원본은 지우지 않는다(되돌리기 가능). 로그인 필요, 프로젝트 Storage 이미지만 입력으로 받는다.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ASPECT_RATIOS = new Set(["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9"]);

const fromBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const extensionFor = (mime: string) => (mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png");

const isProjectStorageUrl = (value: string, supabaseUrl: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === new URL(supabaseUrl).origin && url.pathname.startsWith("/storage/v1/object/");
  } catch {
    return false;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST만 지원합니다." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  let provider;
  try {
    provider = getImageProvider();
  } catch (error) {
    return json({ error: error instanceof ImageProviderConfigError ? error.message : "이미지 생성 설정 오류" }, 503);
  }

  let userId: string | null = null;
  let detailPageId: string | null = null;
  let preset = "";
  const startedAt = Date.now();

  try {
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "로그인이 필요합니다." }, 401);
    userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : "";
    preset = String(body.preset ?? "");
    const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 300) : "";
    const aspectRatio = ASPECT_RATIOS.has(body.aspectRatio) ? body.aspectRatio : "1:1";

    if (!isImageEditPreset(preset)) return json({ error: "지원하지 않는 수정 유형입니다." }, 400);
    if (IMAGE_EDIT_PRESETS[preset].needsPrompt && !prompt) return json({ error: "어떻게 수정할지 입력해주세요." }, 400);
    if (!isProjectStorageUrl(imageUrl, supabaseUrl)) return json({ error: "BRAND-ER 에 저장된 이미지만 수정할 수 있습니다." }, 400);

    // 상세페이지 이미지면 본인 페이지인지 확인하고 페이지 한도에도 함께 집계한다.
    if (typeof body.detailPageId === "string") {
      const { data: page } = await admin.from("product_detail_pages").select("id, user_id").eq("id", body.detailPageId).maybeSingle();
      if (!page || page.user_id !== userId) return json({ error: "상세페이지를 찾을 수 없습니다." }, 404);
      detailPageId = page.id as string;
    }

    const quota = await precheckAiUsage(admin, userId, "detail_image", detailPageId);
    if (!quota.allowed) return json({ error: quota.reason ?? "AI 이미지 생성 한도를 초과했습니다.", quotaExceeded: true }, 429);

    const source = await fetchReferenceImage(imageUrl, "REFERENCE IMAGE 1: the existing product image to edit", true);
    const editPrompt = buildImageEditPrompt(preset, prompt);
    const generated = await provider.generate({ prompt: editPrompt, references: [source!], aspectRatio });

    const path = `edits/${userId}/${Date.now()}-${crypto.randomUUID()}.${extensionFor(generated.mimeType)}`;
    const { error: uploadError } = await admin.storage
      .from("generated_images")
      .upload(path, fromBase64(generated.base64), { contentType: generated.mimeType, upsert: false, cacheControl: "31536000" });
    if (uploadError) throw uploadError;
    const url = admin.storage.from("generated_images").getPublicUrl(path).data.publicUrl;

    await logAiUsage(admin, {
      userId, feature: "detail_image", status: "success", provider: generated.provider, model: generated.model,
      detailPageId, imageType: null, latencyMs: Date.now() - startedAt,
      metadata: { edit: preset, aspectRatio, hasPrompt: Boolean(prompt) },
    });

    return json({ url, path, preset, model: generated.model });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("edit-ai-image error:", message);
    if (userId) {
      await logAiUsage(admin, {
        userId, feature: "detail_image", status: "failed", provider: provider?.name, detailPageId,
        imageType: null, latencyMs: Date.now() - startedAt, error: message, metadata: { edit: preset },
      });
    }
    return json({ error: message }, 502);
  }
});
