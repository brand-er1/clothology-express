
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { tryRemoveGarmentBackground } from "../_shared/removeGarmentBackground.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ArtworkType = "logo" | "photo" | "illustration";
type UploadDecorationKind =
  | "screen_print_1_color"
  | "screen_print_multi_color"
  | "dtf"
  | "dtg"
  | "patch";
type ArtworkLocation =
  | "front"
  | "back"
  | "left_sleeve"
  | "right_sleeve"
  | "neck"
  | "other";

const validArtworkTypes = new Set<ArtworkType>([
  "logo",
  "photo",
  "illustration",
]);
const validUploadDecorationKinds = new Set<UploadDecorationKind>([
  "screen_print_1_color",
  "screen_print_multi_color",
  "dtf",
  "dtg",
  "patch",
]);
const validArtworkLocations = new Set<ArtworkLocation>([
  "front",
  "back",
  "left_sleeve",
  "right_sleeve",
  "neck",
  "other",
]);
const artworkTypeLabels: Record<ArtworkType, string> = {
  logo: "로고형",
  photo: "사진형",
  illustration: "일러스트형",
};
const artworkLocationLabels: Record<ArtworkLocation, string> = {
  front: "앞면",
  back: "뒷면",
  left_sleeve: "왼쪽 소매",
  right_sleeve: "오른쪽 소매",
  neck: "목 부분",
  other: "기타 위치",
};
const parseJsonResponse = (text: string) => {
  const normalized = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "");
  return JSON.parse(normalized);
};

const supportedImageMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

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

serve(async (req) => {
  // Handle CORS preflight requests
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
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Get request body
    const requestData = await req.json();
    console.log("Received modify-generated-image request", {
      hasImageUrl: Boolean(requestData?.imageUrl),
      hasReferenceImage: Boolean(requestData?.referenceImage?.base64),
      hasCompositedImage: Boolean(requestData?.compositedImage?.base64),
      clothType: requestData?.clothType,
      artworkLocation: requestData?.artworkLocation,
      artworkSize: requestData?.artworkSize,
      artworkPosition: requestData?.artworkPosition,
    });

    // Extract required data
    const { 
      imageUrl, 
      modificationPrompt,
      userId,
      clothType,
      originalPrompt,
      referenceImage,
      compositedImage,
      artworkLocation,
      artworkPosition,
    } = requestData;
    const isKnit = /니트|knit/i.test(String(clothType || ""));

    // Validate inputs
    if (!imageUrl || !modificationPrompt) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: imageUrl or modificationPrompt" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const referenceBase64 = String(referenceImage?.base64 || "")
      .replace(/^data:image\/[^;]+;base64,/, "");
    const referenceMimeType = String(referenceImage?.mimeType || "");
    const hasReferenceImage = Boolean(referenceBase64);
    if (
      hasReferenceImage &&
      !supportedImageMimeTypes.has(referenceMimeType)
    ) {
      return new Response(
        JSON.stringify({ error: "지원하지 않는 업로드 이미지 형식입니다." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const compositedBase64 = String(compositedImage?.base64 || "")
      .replace(/^data:image\/[^;]+;base64,/, "");
    const compositedMimeType = String(compositedImage?.mimeType || "");
    const hasCompositedImage = Boolean(compositedBase64);
    if (
      hasCompositedImage &&
      !supportedImageMimeTypes.has(compositedMimeType)
    ) {
      return new Response(
        JSON.stringify({ error: "지원하지 않는 합성 이미지 형식입니다." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }
    if (compositedBase64.length > 12 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "합성 이미지 용량이 너무 큽니다." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }
    if (referenceBase64.length > 8 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "업로드 이미지는 6MB 이하로 압축해주세요." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    let base64Image = "";
    let sourceMimeType = "image/jpeg";
    if (!hasCompositedImage) {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
      }

      const imageBlob = await imageResponse.blob();
      sourceMimeType =
        imageResponse.headers.get("content-type") || "image/jpeg";
      const sourceBytes = new Uint8Array(await imageBlob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < sourceBytes.length; i++) {
        binary += String.fromCharCode(sourceBytes[i]);
      }
      base64Image = btoa(binary);
    }

    const safeArtworkLocation = validArtworkLocations.has(artworkLocation)
      ? artworkLocation as ArtworkLocation
      : "front";
    const rawXPercent = Number(artworkPosition?.xPercent);
    const rawYPercent = Number(artworkPosition?.yPercent);
    const rawWidthPercent = Number(artworkPosition?.widthPercent);
    const xPercent = Number.isFinite(rawXPercent)
      ? Math.min(100, Math.max(0, rawXPercent))
      : 50;
    const yPercent = Number.isFinite(rawYPercent)
      ? Math.min(100, Math.max(0, rawYPercent))
      : 45;
    const widthPercent = Number.isFinite(rawWidthPercent)
      ? Math.min(60, Math.max(0.1, rawWidthPercent))
      : 25;
    let artworkAnalysis: Record<string, unknown> | null = null;

    if (hasReferenceImage) {
      const classificationPrompt = `
You are a Korean apparel printing specialist. Analyze only the uploaded
artwork image and return JSON only:
{
  "artworkType": "logo | photo | illustration",
  "recommendedKind": "screen_print_1_color | screen_print_multi_color | dtf | dtg | patch",
  "confidence": 0.0,
  "reason": "short Korean explanation"
}

Classification:
- logo: brand mark, wordmark, emblem, or simple symbol.
- photo: photorealistic or continuous-tone photographic image.
- illustration: drawing, character, artwork, or graphic that is not primarily a logo.

Printing recommendation:
- One-color flat logo/illustration: screen_print_1_color.
- Flat artwork using two to four spot colors: screen_print_multi_color.
- Photos, gradients, detailed full-color artwork, or more than four colors: dtf.
- Use dtg only when direct-to-garment is clearly more appropriate than DTF.
- Do not choose embroidery, patch, PU, or silicone from appearance alone.
${isKnit
  ? "- The garment is knitwear. Always return patch, never printing or direct embroidery."
  : ""}
`.trim();
      const classificationBody = JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: classificationPrompt },
              {
                inlineData: {
                  data: referenceBase64,
                  mimeType: referenceMimeType,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });
      const classificationModels = [
        "gemini-3-flash-preview",
        "gemini-3-pro-preview",
      ];
      let rawClassification: Record<string, unknown> | null = null;

      for (const model of classificationModels) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: classificationBody,
          },
        );
        if (!response.ok) continue;

        const responseData = await response.json();
        const responseText = (responseData?.candidates?.[0]?.content?.parts || [])
          .map((part: { text?: string }) => part.text || "")
          .join("")
          .trim();
        if (!responseText) continue;

        try {
          rawClassification = parseJsonResponse(responseText);
          break;
        } catch (error) {
          console.warn("Artwork classification JSON parse failed", error);
        }
      }

      const rawArtworkType = String(rawClassification?.artworkType || "");
      const rawRecommendedKind = String(
        rawClassification?.recommendedKind || "",
      );
      const resolvedArtworkType = validArtworkTypes.has(
          rawArtworkType as ArtworkType,
        )
        ? rawArtworkType as ArtworkType
        : "illustration";
      const resolvedRecommendedKind = isKnit
        ? "patch"
        : validUploadDecorationKinds.has(
          rawRecommendedKind as UploadDecorationKind,
        )
        ? rawRecommendedKind as UploadDecorationKind
        : "dtf";
      const confidenceValue = Number(rawClassification?.confidence);
      const confidence = Number.isFinite(confidenceValue)
        ? Math.min(1, Math.max(0, confidenceValue))
        : 0.5;
      const reason = isKnit
        ? "니트 조직 보호를 위해 프린팅·직자수 대신 패치(와펜) 부착 방식으로 계산했습니다."
        : String(rawClassification?.reason || "").trim() ||
          "세부 색상과 그라데이션을 안전하게 구현할 수 있는 인쇄 방식으로 계산했습니다.";

      const { data: priceRows, error: priceError } = await supabase
        .from("quote_decoration_prices")
        .select(
          "price_label, analysis_kinds, unit_min, unit_max, is_starting_from, pricing_note",
        )
        .eq("active", true);
      if (priceError) {
        console.warn("Artwork price lookup failed", priceError);
      }
      const matchedPrice = (priceRows || []).find(
        (row: { analysis_kinds?: string[] }) =>
          row.analysis_kinds?.includes(resolvedRecommendedKind),
      );

      artworkAnalysis = {
        artworkType: resolvedArtworkType,
        artworkTypeLabel: artworkTypeLabels[resolvedArtworkType],
        recommendedKind: resolvedRecommendedKind,
        location: safeArtworkLocation,
        locationLabel: artworkLocationLabels[safeArtworkLocation],
        confidence,
        reason,
        priceLabel: matchedPrice?.price_label || null,
        unitMin: matchedPrice?.unit_min ?? null,
        unitMax: matchedPrice?.unit_max ?? null,
        isStartingFrom: Boolean(matchedPrice?.is_starting_from),
        pricingNote: matchedPrice?.pricing_note || null,
      };
    }

    if (hasCompositedImage) {
      if (!hasReferenceImage) {
        return new Response(
          JSON.stringify({ error: "합성 이미지에는 업로드 원본이 필요합니다." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
        );
      }

      const extension = extensionForMimeType(compositedMimeType);
      const fileName =
        `${userId || "anon"}/${Date.now()}_${crypto.randomUUID()}.${extension}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("generated_images")
        .upload(fileName, decodeBase64Image(compositedBase64), {
          contentType: compositedMimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error("Error uploading exact composite:", uploadError);
        throw uploadError;
      }

      const { data: publicUrlData } = await supabase.storage
        .from("generated_images")
        .getPublicUrl(uploadData?.path || fileName);
      const modifiedImageUrl = publicUrlData?.publicUrl;
      const textResponse = artworkAnalysis
        ? `${artworkAnalysis.artworkTypeLabel} 이미지를 미리보기에서 지정한 ${artworkAnalysis.locationLabel} 위치와 크기 그대로 적용했습니다. ${artworkAnalysis.priceLabel || "추천 후가공"} 장당 공임을 자동견적에 반영합니다.`
        : "미리보기에서 지정한 위치와 크기 그대로 이미지를 적용했습니다.";

      return new Response(
        JSON.stringify({
          success: true,
          textResponse,
          modifiedImageUrl,
          modifiedImagePath: uploadData?.path || fileName,
          hasImage: Boolean(modifiedImageUrl),
          placementMode: "exact",
          artworkAnalysis,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    
    // Create a detailed prompt for the AI
    const fullPrompt = `
    You are a professional fashion designer. Modify this clothing design based on the following instructions:
    
    Original design concept: ${originalPrompt || clothType}
    
    Modification requested: ${modificationPrompt}
    
    Please maintain the general style and type of clothing while applying these specific modifications.
    ${hasReferenceImage
      ? `The second supplied image is the customer's exact artwork. Preserve its composition, colors, lettering, and proportions. The customer dragged it to a precise target centered ${xPercent.toFixed(1)}% from the left edge and ${yPercent.toFixed(1)}% from the top edge of the source image, and resized it to span approximately ${widthPercent.toFixed(1)}% of the source image width. Apply it only to that dragged position on the ${artworkLocationLabels[safeArtworkLocation]}. The coordinates and width are authoritative. Do not invent, redraw, replace, or add any other logo or graphic.${isKnit ? " Render it as a visibly sewn fabric patch with a subtle stitched edge, never as ink printing or direct embroidery." : ""}`
      : ""}
    Preserve the premium photorealistic 3D garment-render style. Keep convincing
    three-dimensional volume, realistic fabric thickness, natural drape and
    folds, precise seams and material texture, soft studio lighting, and subtle
    contact shadows. Keep the large front and back garment views on a clean
    white background. Generate a high-resolution ecommerce product image of the
    modified design, not a flat illustration.
    `;
    
    console.log("Sending prompt to Gemini:", fullPrompt);
    
    const generationParts: Array<Record<string, unknown>> = [
      { text: fullPrompt },
      { text: "First image: source garment design." },
      {
        inlineData: {
          data: base64Image,
          mimeType: sourceMimeType,
        },
      },
    ];
    if (hasReferenceImage) {
      generationParts.push(
        { text: "Second image: exact customer-uploaded artwork to place on the garment." },
        {
          inlineData: {
            data: referenceBase64,
            mimeType: referenceMimeType,
          },
        },
      );
    }

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
                parts: generationParts,
              },
            ],
            generationConfig: {
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
      const reason = responseText ? `Gemini did not return an image. Text response: ${responseText}` : "Gemini did not return an image";
      throw new Error(reason);
    }

    // Store the image in Supabase Storage. The modification prompt always asks
    // Gemini to keep the "clean white background" style, so strip it to
    // transparent before storing (falls back to the original bytes if the
    // background can't be confidently detected).
    const rawBytes = decodeBase64Image(generatedImageBase64);
    const { bytes, mimeType: uploadMimeType } = await tryRemoveGarmentBackground(rawBytes, mimeType);

    const extension = extensionForMimeType(uploadMimeType);
    const fileName =
      `${userId || "anon"}/${Date.now()}_${crypto.randomUUID()}.${extension}`;
    // Use generated_images bucket (ensure it exists in Supabase project)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('generated_images')
      .upload(fileName, bytes, {
        contentType: uploadMimeType,
        upsert: false
      });
    
    if (uploadError) {
      console.error("Error uploading generated image:", uploadError);
      throw uploadError;
    }

    const { data: publicUrlData } = await supabase.storage
      .from('generated_images')
      .getPublicUrl(uploadData?.path || fileName);
    
    const generatedImageUrl = publicUrlData?.publicUrl;
    const resolvedTextResponse = artworkAnalysis
      ? `${artworkAnalysis.artworkTypeLabel} 이미지로 분석해 ${artworkAnalysis.locationLabel}에 적용했습니다. ${artworkAnalysis.priceLabel || "추천 후가공"} 장당 공임을 자동견적에 반영합니다.`
      : responseText;
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        textResponse: resolvedTextResponse,
        modifiedImageUrl: generatedImageUrl,
        modifiedImagePath: uploadData?.path || fileName,
        hasImage: !!generatedImageUrl,
        artworkAnalysis,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
