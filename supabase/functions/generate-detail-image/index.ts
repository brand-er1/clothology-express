import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  buildProductImagePrompt,
  IMAGE_ASPECT_RATIO,
  isDetailImageType,
  isDetailPageStyle,
  type DetailImageType,
  type PromptProduct,
} from "../_shared/detailImagePrompt.ts";
import { fetchReferenceImage, getImageProvider, ImageProviderConfigError, type ReferenceImage } from "../_shared/imageProviders.ts";
import { logAiUsage, precheckAiUsage } from "../_shared/aiUsage.ts";

/**
 * Generates ONE AI detail-page image from the creator's design (reference image).
 *
 *   frontend → quota check → this function → ImageProvider (../_shared/imageProviders.ts,
 *   Gemini by default; design + up to 2 creator reference photos) → Supabase Storage
 *   (generated_images/detail-pages/{user}/{page}/...) → generated_assets row → usage log → URL
 *
 * The vendor is behind the ImageProvider interface (DETAIL_IMAGE_PROVIDER / DETAIL_IMAGE_MODELS
 * secrets), and results are always copied into the existing public `generated_images` bucket. The prompt and the reference image are resolved here from
 * the detail page row, so a client can only generate images of its own page's design.
 *
 * Body: { detailPageId, imageType, style?, userInstruction? }
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

const str = (value: unknown) => (typeof value === "string" ? value : "");
const strList = (value: unknown) => (Array.isArray(value) ? value.map(str).filter(Boolean) : []);

const toPromptProduct = (source: Record<string, unknown>): PromptProduct => {
  const provided = (source.userProvided ?? {}) as Record<string, unknown>;
  return {
    clothType: str(source.clothType),
    color: str(provided.colorName) || str(source.color),
    material: str(source.material),
    fit: str(source.fit) || str(provided.fitNote),
    designDescription: [str(source.designDescription), str(provided.details)].filter(Boolean).join(" / "),
    decorations: Array.isArray(source.decorations)
      ? source.decorations.map((entry) => {
          const decoration = (entry ?? {}) as Record<string, unknown>;
          return { kind: str(decoration.kind), label: str(decoration.label), location: str(decoration.location) };
        })
      : [],
    accessories: strList(source.accessories),
    constructionFeatures: strList(source.constructionFeatures),
    isFrontBackComposite: source.isFrontBackComposite !== false,
  };
};

/** Which creator reference photos help which image type (max 2 extra references per call). */
const REFERENCE_KINDS: Record<DetailImageType, string[]> = {
  hero: ["sample", "logo"],
  product_front: ["sample", "logo"],
  product_back: ["sample"],
  detail: ["detail", "logo", "sample"],
  fabric: ["fabric", "sample"],
  editorial: ["wearing", "reference", "brand"],
  lifestyle: ["wearing", "sample"],
  mood: ["brand", "reference"],
  flat_lay: ["sample", "fabric"],
};

const REFERENCE_LABEL: Record<string, string> = {
  sample: "creator's real sample photo of this product",
  fabric: "creator's photo of the actual fabric",
  detail: "creator's close-up of a real product detail",
  wearing: "creator's photo of the product being worn",
  reference: "creator's mood/styling reference (not the product)",
  logo: "creator's brand logo artwork as printed on the product",
  brand: "creator's brand image (mood only)",
};

serve(async (req) => {
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
  let assetId: string | null = null;
  let userId: string | null = null;
  let pageId: string | null = null;
  let requestedType: string | null = null;
  const startedAt = Date.now();

  try {
    const authorization = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ error: "로그인이 필요합니다." }, 401);
    userId = user.id;

    const { detailPageId, imageType, style, userInstruction } = await req.json();
    if (typeof detailPageId !== "string" || !isDetailImageType(imageType)) {
      return json({ error: "잘못된 요청입니다." }, 400);
    }
    requestedType = imageType;

    // 본인 상세페이지만 생성 가능(다른 제작자의 펀딩/상세페이지 접근 차단)
    const { data: page, error: pageError } = await admin
      .from("product_detail_pages")
      .select("id, user_id, template, source")
      .eq("id", detailPageId)
      .maybeSingle();
    if (pageError) throw pageError;
    if (!page || page.user_id !== user.id) return json({ error: "상세페이지를 찾을 수 없습니다." }, 404);
    pageId = page.id as string;

    const quota = await precheckAiUsage(admin, user.id, "detail_image", page.id);
    if (!quota.allowed) return json({ error: quota.reason ?? "AI 이미지 생성 한도를 초과했습니다.", quotaExceeded: true }, 429);

    const source = (page.source ?? {}) as Record<string, unknown>;
    const referenceUrl = str(source.imageUrl);
    if (!/^https:\/\//.test(referenceUrl)) return json({ error: "참조할 디자인 이미지가 없습니다." }, 400);

    const detailPageStyle = isDetailPageStyle(style) ? style : isDetailPageStyle(page.template) ? page.template : "minimal";
    const product = toPromptProduct(source);
    const instruction = typeof userInstruction === "string" ? userInstruction.trim().slice(0, 500) : "";

    // 제작자가 올린 참고자료 중 이 이미지 유형에 도움이 되는 사진(최대 2장)
    const wantedKinds = REFERENCE_KINDS[imageType as DetailImageType];
    const { data: referenceRows } = await admin
      .from("detail_page_references")
      .select("kind, url, mime_type")
      .eq("detail_page_id", page.id)
      .eq("use_for_generation", true)
      .in("kind", wantedKinds)
      .order("created_at", { ascending: true })
      .limit(10);
    const orderedRefs = ((referenceRows ?? []) as Array<{ kind: string; url: string }>)
      .sort((a, b) => wantedKinds.indexOf(a.kind) - wantedKinds.indexOf(b.kind))
      .slice(0, 2);

    const designLabel = product.isFrontBackComposite ? "garment design, front (left) and back (right)" : "garment design";
    const prompt = buildProductImagePrompt({
      product,
      referenceImages: [designLabel, ...orderedRefs.map((ref) => REFERENCE_LABEL[ref.kind] ?? ref.kind)],
      imageType,
      detailPageStyle,
      userInstruction: instruction,
    });

    const { data: asset, error: assetError } = await admin
      .from("generated_assets")
      .insert({
        user_id: user.id,
        detail_page_id: page.id,
        image_type: imageType,
        style: detailPageStyle,
        reference_image: referenceUrl,
        prompt,
        user_instruction: instruction || null,
        provider: provider.name,
        generation_status: "generating",
      })
      .select("id")
      .single();
    if (assetError) throw assetError;
    assetId = asset.id as string;

    const references: ReferenceImage[] = [(await fetchReferenceImage(referenceUrl, designLabel, true))!];
    for (const ref of orderedRefs) {
      const extra = await fetchReferenceImage(ref.url, REFERENCE_LABEL[ref.kind] ?? ref.kind).catch(() => null);
      if (extra) references.push(extra);
    }

    const generated = await provider.generate({ prompt, references, aspectRatio: IMAGE_ASPECT_RATIO[imageType as DetailImageType] });

    // Persist in our own storage so the page never depends on a provider's temporary URL.
    const path = `detail-pages/${user.id}/${page.id}/${imageType}-${Date.now()}.${extensionFor(generated.mimeType)}`;
    const { error: uploadError } = await admin.storage
      .from("generated_images")
      .upload(path, fromBase64(generated.base64), { contentType: generated.mimeType, upsert: false, cacheControl: "31536000" });
    if (uploadError) throw uploadError;
    const url = admin.storage.from("generated_images").getPublicUrl(path).data.publicUrl;

    await admin
      .from("generated_assets")
      .update({ generation_status: "completed", generated_image: url, storage_path: path, model: generated.model, provider: generated.provider })
      .eq("id", assetId);

    await logAiUsage(admin, {
      userId: user.id, feature: "detail_image", status: "success", provider: generated.provider, model: generated.model,
      detailPageId: page.id, imageType, latencyMs: Date.now() - startedAt,
      metadata: { references: references.length, style: detailPageStyle, instruction: Boolean(instruction) },
    });

    return json({ assetId, imageType, url, model: generated.model, style: detailPageStyle, references: references.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("generate-detail-image error:", message);
    if (assetId) {
      await admin
        .from("generated_assets")
        .update({ generation_status: "failed", error_message: message.slice(0, 1000) })
        .eq("id", assetId);
    }
    if (userId && pageId) {
      await logAiUsage(admin, {
        userId, feature: "detail_image", status: "failed", provider: provider?.name, detailPageId: pageId,
        imageType: requestedType, latencyMs: Date.now() - startedAt, error: message,
      });
    }
    return json({ error: message, assetId }, 502);
  }
});
