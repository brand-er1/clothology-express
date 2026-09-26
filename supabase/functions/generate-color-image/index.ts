import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildColorVariantPrompt, COLOR_VARIANT_ASPECT_RATIO, type ColorVariantView } from "../_shared/colorVariantPrompt.ts";
import { fetchReferenceImage, getImageProvider, ImageProviderConfigError } from "../_shared/imageProviders.ts";
import { logAiUsage, precheckAiUsage } from "../_shared/aiUsage.ts";

/**
 * 컬러 옵션별 상품 이미지 생성 (AI 이미지 편집)
 *
 *   제작자/관리자 → 권한·한도 확인 → 기준 컬러 이미지(또는 원본 디자인) 참조
 *   → ImageProvider(Gemini 기본)로 "같은 옷, 컬러만 변경" 편집 → Storage 저장
 *   → funding_color_images(status=preview) → 제작자가 승인해야 고객에게 노출
 *
 * Body: { colorId: string, view: "front" | "back" }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const fromBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const extensionFor = (mimeType: string) =>
  mimeType.includes("webp") ? "webp" : mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";

type ColorRow = { id: string; funding_id: string; name: string; hex: string | null; is_base: boolean; status: string };
type ImageRow = { view: string; source: string; image_url: string | null; color_id: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST만 지원합니다." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  let provider;
  try {
    provider = getImageProvider();
  } catch (error) {
    return json({ error: error instanceof ImageProviderConfigError ? error.message : "이미지 생성 설정 오류" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const startedAt = Date.now();
  let imageId: string | null = null;
  let userId: string | null = null;
  let fundingId: string | null = null;
  let view: ColorVariantView = "front";

  try {
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "로그인이 필요합니다." }, 401);
    userId = user.id;

    const body = await req.json().catch(() => ({}));
    if (typeof body.colorId !== "string" || (body.view !== "front" && body.view !== "back")) {
      return json({ error: "잘못된 요청입니다." }, 400);
    }
    view = body.view;

    const { data: color } = await admin
      .from("funding_colors")
      .select("id, funding_id, name, hex, is_base, status")
      .eq("id", body.colorId)
      .maybeSingle<ColorRow>();
    if (!color || color.status !== "active") return json({ error: "컬러를 찾을 수 없습니다." }, 404);
    fundingId = color.funding_id;

    // 제작자 본인 또는 fundings.manage 관리자만
    const { data: allowed } = await admin.rpc("_can_manage_funding_user", { p_user_id: user.id, p_funding_id: color.funding_id });
    if (allowed !== true) return json({ error: "이 펀딩의 컬러 이미지를 만들 권한이 없습니다." }, 403);

    const quota = await precheckAiUsage(admin, user.id, "color_image");
    if (!quota.allowed) return json({ error: quota.reason ?? "AI 이미지 생성 한도를 초과했습니다.", quotaExceeded: true }, 429);

    const { data: funding } = await admin
      .from("fundings")
      .select("id, image_url, cloth_type")
      .eq("id", color.funding_id)
      .single();
    const { data: page } = await admin
      .from("product_detail_pages")
      .select("source")
      .eq("funding_id", color.funding_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 참조 이미지: 기준 컬러의 해당 면 단독 이미지(AI/업로드) → 없으면 원본 디자인(앞|뒤 합성)
    const { data: base } = await admin
      .from("funding_colors")
      .select("id, name")
      .eq("funding_id", color.funding_id)
      .eq("status", "active")
      .eq("is_base", true)
      .maybeSingle<{ id: string; name: string }>();
    let referenceUrl = funding?.image_url as string;
    let referenceLayout: "composite" | "single" =
      (page?.source as { isFrontBackComposite?: boolean } | null)?.isFrontBackComposite === false ? "single" : "composite";
    if (base) {
      const { data: baseImages } = await admin
        .from("funding_color_images")
        .select("view, source, image_url, color_id")
        .eq("color_id", base.id)
        .eq("status", "approved");
      const sameView = ((baseImages ?? []) as ImageRow[]).find((image) => image.view === view && image.source !== "original" && image.image_url);
      if (sameView?.image_url) {
        referenceUrl = sameView.image_url;
        referenceLayout = "single";
      }
    }
    if (!/^https:\/\//.test(referenceUrl ?? "")) return json({ error: "참조할 상품 이미지가 없습니다." }, 400);

    const prompt = buildColorVariantPrompt({
      targetColorName: color.name,
      targetHex: color.hex,
      baseColorName: base?.name,
      view,
      referenceLayout,
      clothType: funding?.cloth_type,
    });

    const { data: row, error: insertError } = await admin
      .from("funding_color_images")
      .insert({ color_id: color.id, funding_id: color.funding_id, view, status: "generating", source: "ai", prompt, provider: provider.name, created_by: user.id })
      .select("id")
      .single();
    if (insertError) throw insertError;
    imageId = row.id as string;

    const reference = await fetchReferenceImage(referenceUrl, referenceLayout === "composite" ? "garment design, front (left) and back (right)" : `garment ${view} view`, true);
    const generated = await provider.generate({ prompt, references: [reference!], aspectRatio: COLOR_VARIANT_ASPECT_RATIO });

    const path = `funding-colors/${color.funding_id}/${color.id}/${view}-${Date.now()}.${extensionFor(generated.mimeType)}`;
    const { error: uploadError } = await admin.storage
      .from("generated_images")
      .upload(path, fromBase64(generated.base64), { contentType: generated.mimeType, upsert: false, cacheControl: "31536000" });
    if (uploadError) throw uploadError;
    const url = admin.storage.from("generated_images").getPublicUrl(path).data.publicUrl;

    await admin
      .from("funding_color_images")
      .update({ status: "preview", image_url: url, storage_path: path, provider: generated.provider, model: generated.model })
      .eq("id", imageId);

    await logAiUsage(admin, {
      userId: user.id, feature: "color_image", status: "success", provider: generated.provider, model: generated.model,
      fundingId: color.funding_id, imageType: `color_${view}`, latencyMs: Date.now() - startedAt,
      metadata: { colorId: color.id, color: color.name, referenceLayout },
    });

    return json({ imageId, url, status: "preview", colorId: color.id, view });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("generate-color-image error:", message);
    if (imageId) {
      await admin.from("funding_color_images").update({ status: "failed", error_message: message.slice(0, 1000) }).eq("id", imageId);
    }
    if (userId) {
      await logAiUsage(admin, {
        userId, feature: "color_image", status: "failed", provider: provider?.name, fundingId,
        imageType: `color_${view}`, latencyMs: Date.now() - startedAt, error: message,
      });
    }
    return json({ error: message, imageId }, 502);
  }
});
