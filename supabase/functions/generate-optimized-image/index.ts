import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  CREATOR_LOGO_REFERENCE_LABEL,
  NO_BRANDING_RULES,
  creatorLogoRules,
  findCreatorLogo,
  parseBrandLogoMode,
  sanitizeBrandingInstructions,
} from "../_shared/brandingPolicy.ts";
import { fetchReferenceImage } from "../_shared/imageProviders.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_SYSTEM_PROMPT = `Produce one concise, production-ready prompt that captures garment type, material, color, fit, key design details, seasonality, and styling cues from the user request. Keep it ecommerce-focused, photorealistic, and avoid adding models, text overlays, logos, brand names, or props. Keep language consistent with the user input.`;

const classifyGeminiError = (status: number) => {
  if (status === 429) return "quota_or_rate_limit";
  if (status === 401) return "invalid_api_key";
  if (status === 403) return "billing_permission_or_api_restriction";
  if (status === 404) return "model_not_found";
  if (status >= 500) return "gemini_server_error";
  return "gemini_api_error";
};

const decodeBase64 = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const extensionForMime = (mime: string) => mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured", code: "missing_api_key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt, brandLogo } = await req.json();
    // 기본값은 로고 없음. "내 브랜드 로고 적용" 은 로그인한 제작자 본인의 브랜드 로고만 서버에서 읽어 쓴다.
    const brandLogoMode = parseBrandLogoMode(brandLogo);
    const userPrompt = String(prompt || "").trim();
    if (!userPrompt) {
      return new Response(JSON.stringify({ error: "prompt is required", code: "missing_prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: promptRows } = await supabase
      .from("system_prompts")
      .select("prompt")
      .order("created_at", { ascending: false })
      .limit(1);
    // 관리자 편집 시스템 프롬프트에 플랫폼 로고/브랜딩 삽입 지시가 있어도 걷어낸다.
    const systemPrompt = sanitizeBrandingInstructions(promptRows?.[0]?.prompt) || DEFAULT_SYSTEM_PROMPT;

    const logoParts: Array<Record<string, unknown>> = [];
    let logoRules = "";
    if (brandLogoMode === "creator") {
      const userClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) {
        return new Response(JSON.stringify({ error: "내 브랜드 로고를 적용하려면 로그인이 필요합니다.", code: "login_required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const logo = await findCreatorLogo(supabase, userData.user.id);
      const logoImage = logo ? await fetchReferenceImage(logo.url, CREATOR_LOGO_REFERENCE_LABEL).catch(() => null) : null;
      if (!logo || !logoImage) {
        return new Response(JSON.stringify({ error: "내 브랜드에 등록된 로고가 없습니다. 마이페이지 > 내 브랜드에서 로고를 등록해주세요.", code: "brand_logo_missing" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      logoRules = creatorLogoRules(logo.brandName);
      logoParts.push({ text: logoImage.label }, { inlineData: { data: logoImage.data, mimeType: logoImage.mimeType } });
    }

    const stylePrimer = `White background, premium photorealistic 3D garment visualization like a high-end fashion ecommerce product render. The garment must have convincing three-dimensional volume, realistic fabric thickness, natural drape and folds, precise seams, hems, stitching, collars, cuffs, and material texture. Use soft studio lighting and subtle contact shadows to reveal depth without hiding design details. No models or mannequins. Show two large views in one frame: left = garment front, right = garment back. Make both garments fill most of the canvas with minimal empty margins while keeping every edge visible. No props, text overlays, or flat illustration styling. High resolution, production-ready and ecommerce ready.`;
    const optimizedPrompt = [
      stylePrimer,
      `System guidance:\n${systemPrompt}`,
      `User request:\n${userPrompt}`,
      logoRules,
      NO_BRANDING_RULES,
    ].filter(Boolean).join("\n\n");

    const models = ["gemini-3.1-flash-image", "gemini-3-pro-image", "gemini-2.5-flash-image"];
    let base64Image = "";
    let mimeType = "image/png";
    let selectedModel = "";
    let textResponse = "";
    let lastErrorCode = "generation_failed";
    let lastStatus = 500;

    for (const model of models) {
      const generationConfig: Record<string, unknown> = {
        responseModalities: ["IMAGE", "TEXT"],
        imageConfig: model === "gemini-2.5-flash-image"
          ? { aspectRatio: "4:3" }
          : { aspectRatio: "4:3", imageSize: "1K" },
      };

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: optimizedPrompt }, ...logoParts] }],
            generationConfig,
          }),
        },
      );

      if (!resp.ok) {
        const bodyText = await resp.text();
        lastStatus = resp.status;
        lastErrorCode = classifyGeminiError(resp.status);
        console.error(`generate-optimized-image Gemini failure model=${model} status=${resp.status} code=${lastErrorCode} body=${bodyText.slice(0, 1000)}`);
        if (![403, 404, 429].includes(resp.status) && resp.status < 500) break;
        continue;
      }

      const data = await resp.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data && !base64Image) {
          base64Image = part.inlineData.data;
          mimeType = part.inlineData.mimeType || "image/png";
        }
        if (part.text) textResponse += part.text;
      }
      if (base64Image) {
        selectedModel = model;
        break;
      }
      lastErrorCode = "no_image_returned";
      lastStatus = 502;
      console.error(`generate-optimized-image model=${model} returned no image: ${textResponse.slice(0, 500)}`);
    }

    if (!base64Image) {
      const friendly = lastErrorCode === "quota_or_rate_limit"
        ? "AI 이미지 생성 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요."
        : lastErrorCode === "billing_permission_or_api_restriction"
          ? "AI 이미지 생성 결제 또는 API 권한 설정을 확인해주세요."
          : lastErrorCode === "invalid_api_key"
            ? "AI 이미지 생성 API 키가 유효하지 않습니다."
            : "AI 이미지 생성 서버에서 이미지를 받지 못했습니다.";
      return new Response(JSON.stringify({ error: friendly, code: lastErrorCode }), {
        status: lastErrorCode === "quota_or_rate_limit" ? 429 : lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bytes = decodeBase64(base64Image);
    const fileName = `${crypto.randomUUID()}.${extensionForMime(mimeType)}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("generated_images")
      .upload(fileName, bytes, { contentType: mimeType, upsert: false });
    if (uploadError) {
      console.error("generated_images upload failed", uploadError);
      return new Response(JSON.stringify({ error: "생성 이미지를 저장하지 못했습니다.", code: "storage_upload_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: publicData } = supabase.storage.from("generated_images").getPublicUrl(uploadData.path);
    const publicUrl = publicData.publicUrl;

    return new Response(JSON.stringify({
      optimizedPrompt,
      imageUrls: [publicUrl],
      imagePaths: [uploadData.path],
      storedImageUrls: [publicUrl],
      alreadyStored: true,
      model: selectedModel,
      textResponse,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-optimized-image unexpected error", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Internal server error",
      code: "unexpected_error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
