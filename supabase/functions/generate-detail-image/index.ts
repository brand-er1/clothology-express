import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  buildProductImagePrompt,
  IMAGE_ASPECT_RATIO,
  isDetailImageType,
  isDetailPageStyle,
  type PromptProduct,
} from "../_shared/detailImagePrompt.ts";

/**
 * Generates ONE AI detail-page image from the creator's design (reference image).
 *
 *   frontend → this function → Gemini image model (reference inline) → Supabase Storage
 *   (generated_images/detail-pages/{user}/{page}/...) → generated_assets row → URL
 *
 * Reuses BRAND-ER's existing image stack: the GEMINI_API_KEY secret, the same Gemini image
 * model fallback chain as generate-multi-angle / modify-generated-image, and the existing
 * public `generated_images` bucket. The prompt and the reference image are resolved here from
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

const IMAGE_MODELS = ["gemini-3.1-flash-image", "gemini-3-pro-image", "gemini-2.5-flash-image"];
const MAX_REFERENCE_BYTES = 12 * 1024 * 1024;

const toBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
};

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
    designDescription: str(source.designDescription),
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

const callGemini = async (apiKey: string, prompt: string, reference: { data: string; mimeType: string }, aspectRatio: string) => {
  let lastError = "no_image_returned";
  for (const model of IMAGE_MODELS) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: "REFERENCE IMAGE — the creator's garment design (immutable product identity):" },
              { inlineData: reference },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: model === "gemini-2.5-flash-image" ? { aspectRatio } : { aspectRatio, imageSize: "2K" },
        },
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      lastError = `model=${model} status=${response.status}: ${body.slice(0, 400)}`;
      console.error("generate-detail-image Gemini error", lastError);
      if (![403, 404, 429].includes(response.status) && response.status < 500) break;
      continue;
    }
    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part: { inlineData?: { data?: string } }) => part?.inlineData?.data);
    if (imagePart) {
      return {
        base64: imagePart.inlineData.data as string,
        mimeType: (imagePart.inlineData.mimeType || "image/png") as string,
        model,
      };
    }
    const text = parts.map((part: { text?: string }) => part.text || "").join(" ").trim();
    lastError = `model=${model} returned no image${text ? `: ${text.slice(0, 200)}` : ""}`;
  }
  throw new Error(lastError);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST만 지원합니다." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!geminiApiKey) return json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, 503);

  const admin = createClient(supabaseUrl, serviceKey);
  let assetId: string | null = null;

  try {
    const authorization = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ error: "로그인이 필요합니다." }, 401);

    const { detailPageId, imageType, style, userInstruction } = await req.json();
    if (typeof detailPageId !== "string" || !isDetailImageType(imageType)) {
      return json({ error: "잘못된 요청입니다." }, 400);
    }

    const { data: page, error: pageError } = await admin
      .from("product_detail_pages")
      .select("id, user_id, template, source")
      .eq("id", detailPageId)
      .maybeSingle();
    if (pageError) throw pageError;
    if (!page || page.user_id !== user.id) return json({ error: "상세페이지를 찾을 수 없습니다." }, 404);

    const source = (page.source ?? {}) as Record<string, unknown>;
    const referenceUrl = str(source.imageUrl);
    if (!/^https:\/\//.test(referenceUrl)) return json({ error: "참조할 디자인 이미지가 없습니다." }, 400);

    const detailPageStyle = isDetailPageStyle(style) ? style : isDetailPageStyle(page.template) ? page.template : "minimal";
    const product = toPromptProduct(source);
    const instruction = typeof userInstruction === "string" ? userInstruction.trim().slice(0, 500) : "";
    const prompt = buildProductImagePrompt({
      product,
      referenceImages: [product.isFrontBackComposite ? "garment design, front (left) and back (right)" : "garment design"],
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
        provider: "gemini",
        generation_status: "generating",
      })
      .select("id")
      .single();
    if (assetError) throw assetError;
    assetId = asset.id as string;

    const referenceResponse = await fetch(referenceUrl);
    if (!referenceResponse.ok) throw new Error(`참조 이미지를 불러오지 못했습니다 (${referenceResponse.status})`);
    const referenceBuffer = await referenceResponse.arrayBuffer();
    if (referenceBuffer.byteLength > MAX_REFERENCE_BYTES) throw new Error("참조 이미지가 너무 큽니다.");
    const reference = {
      data: toBase64(referenceBuffer),
      mimeType: (referenceResponse.headers.get("content-type") || "image/png").split(";")[0],
    };

    const generated = await callGemini(geminiApiKey, prompt, reference, IMAGE_ASPECT_RATIO[imageType]);

    // Persist in our own storage so the page never depends on a provider's temporary URL.
    const path = `detail-pages/${user.id}/${page.id}/${imageType}-${Date.now()}.${extensionFor(generated.mimeType)}`;
    const { error: uploadError } = await admin.storage
      .from("generated_images")
      .upload(path, fromBase64(generated.base64), { contentType: generated.mimeType, upsert: false, cacheControl: "31536000" });
    if (uploadError) throw uploadError;
    const url = admin.storage.from("generated_images").getPublicUrl(path).data.publicUrl;

    await admin
      .from("generated_assets")
      .update({ generation_status: "completed", generated_image: url, storage_path: path, model: generated.model })
      .eq("id", assetId);

    return json({ assetId, imageType, url, model: generated.model, style: detailPageStyle });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("generate-detail-image error:", message);
    if (assetId) {
      await admin
        .from("generated_assets")
        .update({ generation_status: "failed", error_message: message.slice(0, 1000) })
        .eq("id", assetId);
    }
    return json({ error: message, assetId }, 502);
  }
});
