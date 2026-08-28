
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supportedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

const stripDataUrlPrefix = (value: string) => value.replace(/^data:image\/[^;]+;base64,/, "");

const decodeBase64Image = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const extensionForMimeType = (mimeType: string) => {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
};

/**
 * EDIT GARMENT (pipeline step B): existing garment reference + a user modification instruction
 * -> a modified garment image. This never touches a character — dressing the character (step C)
 * always happens in a separate call (dress-character) against whichever garment image this
 * produces. Keeping these steps apart is what stops "the user only asked to resize a logo" from
 * accidentally re-rolling the whole garment, or the character, along with it.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
      );
    }

    const requestData = await req.json();
    const { baseImage, modificationPrompt, garmentLabel, userId } = requestData || {};

    const baseBase64 = stripDataUrlPrefix(String(baseImage?.base64 || ""));
    const baseMimeType = String(baseImage?.mimeType || "");
    if (!baseBase64 || !supportedImageMimeTypes.has(baseMimeType)) {
      return new Response(
        JSON.stringify({ error: "수정할 의류 이미지가 필요합니다." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }
    if (baseBase64.length > 12 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "이미지 용량이 너무 큽니다." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const trimmedPrompt = String(modificationPrompt || "").trim();
    if (!trimmedPrompt) {
      return new Response(
        JSON.stringify({ error: "어떻게 수정할지 알려주세요." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const prompt = `
EDIT the supplied garment product image. This is a constrained, minimal image edit — not a new design.

PRESERVE EVERYTHING EXCEPT THE EXPLICITLY REQUESTED MODIFICATION.

Modification requested by the customer: "${trimmedPrompt}"
${garmentLabel ? `Garment: ${garmentLabel}` : ""}

Apply ONLY the change described above. Every other element of the garment must remain exactly as it is in the source image, including:
- overall garment type and silhouette
- fit (oversized, slim, regular, cropped, etc.) and proportions
- length and hem
- color (unless the color itself is what was asked to change)
- fabric texture and material
- logo/graphic content and position (unless the logo/graphic itself is what was asked to change)
- prints, patterns, and their placement
- pockets, zippers, buttons, stitching/seams
- hood, collar, and sleeve shape
- overall composition, camera angle, framing, lighting, and background style of the source image

Do not redesign, restyle, or reinterpret the garment. Do not "improve" or add details that were not requested. If the request only touches one detail (for example, logo size or a single color), every other pixel-level design choice must stay as close as possible to the source image.

Preserve the premium photorealistic 3D garment-render style: convincing three-dimensional volume, realistic fabric thickness, natural drape and folds, precise seams and material texture, soft studio lighting, and subtle contact shadows, on a clean background matching the source image.

OUTPUT: Return exactly ONE edited product image of the garment alone (no person, no character, no mannequin unless the source image already has one). No before/after split, comparison layout, caption, watermark, or text overlay.
`.trim();

    // "gemini-3-pro-image-preview" was retired by Google — fall back through the same working
    // models generate-optimized-image already uses, instead of always failing on the dead name.
    const imageModelCandidates = ["gemini-3.1-flash-image", "gemini-3-pro-image", "gemini-2.5-flash-image"];
    let geminiData: any = null;
    let lastGeminiError = "";

    for (const model of imageModelCandidates) {
      const geminiResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  { text: "Source garment image to edit:" },
                  { inlineData: { data: baseBase64, mimeType: baseMimeType } },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              responseModalities: ["IMAGE", "TEXT"],
              imageConfig: {
                aspectRatio: "4:3",
                imageSize: model === "gemini-2.5-flash-image" ? undefined : "2K",
              },
            },
          }),
        },
      );

      if (geminiResp.ok) {
        geminiData = await geminiResp.json();
        break;
      }

      const bodyText = await geminiResp.text();
      lastGeminiError = `Gemini API error: ${geminiResp.status} ${geminiResp.statusText} model=${model} - ${bodyText}`;
      console.error(lastGeminiError);
      const retryWithFallback = geminiResp.status === 404 || geminiResp.status >= 500;
      if (!retryWithFallback) throw new Error(lastGeminiError);
    }

    if (!geminiData) {
      throw new Error(lastGeminiError || "Gemini image generation failed for all configured models");
    }
    const parts = geminiData?.candidates?.[0]?.content?.parts || [];
    let generatedImageBase64 = "";
    let mimeType = "image/png";
    let responseText = "";

    for (const part of parts) {
      if (part.inlineData?.data && !generatedImageBase64) {
        generatedImageBase64 = part.inlineData.data;
        mimeType = part.inlineData.mimeType || "image/png";
      }
      if (part.text) {
        responseText += part.text;
      }
    }

    if (!generatedImageBase64) {
      const reason = responseText
        ? `Gemini did not return an image. Text response: ${responseText}`
        : "Gemini did not return an image";
      throw new Error(reason);
    }

    const bytes = decodeBase64Image(generatedImageBase64);
    const extension = extensionForMimeType(mimeType);
    const fileName = `${userId || "anon"}/closet-edits/${Date.now()}_${crypto.randomUUID()}.${extension}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('generated_images')
      .upload(fileName, bytes, { contentType: mimeType, upsert: false });

    if (uploadError) {
      console.error("Error uploading edited garment image:", uploadError);
      throw uploadError;
    }

    const { data: publicUrlData } = await supabase.storage
      .from('generated_images')
      .getPublicUrl(uploadData?.path || fileName);

    return new Response(
      JSON.stringify({
        success: true,
        textResponse: responseText,
        editedImageUrl: publicUrlData?.publicUrl,
        editedImagePath: uploadData?.path || fileName,
        hasImage: Boolean(publicUrlData?.publicUrl),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Unexpected error in edit-closet-garment:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
