import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ClosetSlot = "top" | "bottom" | "outer" | "shoes" | "accessory";
type CharacterGender = "male" | "female";

const validSlots = new Set<ClosetSlot>(["top", "bottom", "outer", "shoes", "accessory"]);
const supportedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

const slotDescriptionEn: Record<ClosetSlot, string> = {
  top: "top garment (shirt, hoodie, sweatshirt, knit, or similar upper-body clothing)",
  bottom: "bottom garment (pants, leggings, skirt, or similar lower-body clothing)",
  outer: "outer layer (jacket or coat, worn over the top garment)",
  shoes: "footwear",
  accessory: "accessory (bag, hat, or similar item)",
};

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

const stripDataUrlPrefix = (value: string) => value.replace(/^data:image\/[^;]+;base64,/, "");

interface GarmentInput {
  slot: ClosetSlot;
  label?: string;
  base64: string;
  mimeType: string;
}

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
    const {
      characterGender,
      characterImage,
      garments: rawGarments,
      userId,
    } = requestData || {};

    const gender: CharacterGender = characterGender === "female" ? "female" : "male";

    const characterBase64 = stripDataUrlPrefix(String(characterImage?.base64 || ""));
    const characterMimeType = String(characterImage?.mimeType || "");
    if (!characterBase64 || !supportedImageMimeTypes.has(characterMimeType)) {
      return new Response(
        JSON.stringify({ error: "캐릭터 참조 이미지가 필요합니다." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const garments: GarmentInput[] = Array.isArray(rawGarments)
      ? rawGarments
        .filter((item: unknown) => item && typeof item === "object")
        .map((item: Record<string, unknown>) => ({
          slot: validSlots.has(item.slot as ClosetSlot) ? (item.slot as ClosetSlot) : "top",
          label: typeof item.label === "string" ? item.label : undefined,
          base64: stripDataUrlPrefix(String((item.image as Record<string, unknown>)?.base64 || item.base64 || "")),
          mimeType: String((item.image as Record<string, unknown>)?.mimeType || item.mimeType || ""),
        }))
        .filter((item) => item.base64 && supportedImageMimeTypes.has(item.mimeType))
      : [];

    if (garments.length === 0) {
      return new Response(
        JSON.stringify({ error: "입힐 의류 이미지가 최소 1개 필요합니다." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }
    if (garments.length > 5) {
      return new Response(
        JSON.stringify({ error: "한 번에 입힐 수 있는 의류는 최대 5개입니다." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const totalBytes = characterBase64.length + garments.reduce((sum, g) => sum + g.base64.length, 0);
    if (totalBytes > 30 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "이미지 용량이 너무 큽니다." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const characterIdentityRules = gender === "female"
      ? "This is the FEMALE BRAND-ER mascot: solid black face, large round white eyes, visible eyelashes (her signature distinguishing feature), her existing hair, and her existing body proportions and hand shape."
      : "This is the MALE BRAND-ER mascot: solid black face, large round white eyes, and his existing body proportions and hand shape.";

    const garmentList = garments
      .map((garment, index) => {
        const ordinal = index + 2;
        return `Reference Image ${ordinal} (${slotDescriptionEn[garment.slot]}${garment.label ? `, "${garment.label}"` : ""}): garment to render on the character in the ${garment.slot} slot.`;
      })
      .join("\n");

    const slotsInThisRequest = Array.from(new Set(garments.map((g) => g.slot)));
    const slotsSentence = slotsInThisRequest
      .map((slot) => slotDescriptionEn[slot])
      .join(", ");

    const prompt = `
You are performing an AI virtual try-on / character re-render, not a photo edit or overlay.

Reference Image 1 is the BRAND-ER mascot character. ${characterIdentityRules} Keep the character's identity, face, eyes, head shape, body proportions, hand shape, and overall 3D render style completely unchanged. Do not redesign the character.

${garmentList}

TASK: Generate ONE new image of the exact same character from Reference Image 1, now actually wearing the garment(s) shown in the other reference image(s) (${slotsSentence}), rendered naturally on the character's body with correct fit, drape, and proportions for a 3D character illustration.

Clothing identity lock — for every garment reference image, preserve exactly:
- garment type and silhouette
- exact color (do not shift, tint, or reinterpret the color)
- logo/graphic position and content (do not move, resize, remove, or add any logo or graphic)
- pattern, prints, pockets, zippers, hood, sleeves, and hem details
- fabric texture

Do not invent new design details that are not present in the garment reference image (for example: do not add a zipper if there isn't one, do not add graphics that aren't there, do not change a plain garment into a patterned one).

${slotsInThisRequest.includes("top") || slotsInThisRequest.includes("bottom") || slotsInThisRequest.includes("outer")
  ? "If the character was previously wearing a different garment in the same slot as one of the reference garments above, REPLACE it entirely — the old garment must not remain visible, layered, or peeking out. Only garments provided as reference images in this request, plus any body parts/clothing not covered by those slots (face, hair, and any other slot not being changed), should appear in the final image."
  : ""}

Keep the character isolated on a clean, simple, neutral studio background consistent with a 3D mascot character render (no busy scene, no other people, no text overlays). Full-body character view, front-facing pose, matching the framing and render style of Reference Image 1.
`.trim();

    const generationParts: Array<Record<string, unknown>> = [
      { text: prompt },
      { text: "Reference Image 1: the character." },
      { inlineData: { data: characterBase64, mimeType: characterMimeType } },
    ];
    garments.forEach((garment, index) => {
      generationParts.push(
        { text: `Reference Image ${index + 2}: ${slotDescriptionEn[garment.slot]}.` },
        { inlineData: { data: garment.base64, mimeType: garment.mimeType } },
      );
    });

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: generationParts }],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
            imageConfig: { aspectRatio: "3:4", imageSize: "2K" },
          },
        }),
      },
    );

    if (!geminiResp.ok) {
      const bodyText = await geminiResp.text();
      throw new Error(`Gemini API error: ${geminiResp.status} ${geminiResp.statusText} - ${bodyText}`);
    }

    const geminiData = await geminiResp.json();
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
    const fileName = `${userId || "anon"}/closet/${Date.now()}_${crypto.randomUUID()}.${extension}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('generated_images')
      .upload(fileName, bytes, { contentType: mimeType, upsert: false });

    if (uploadError) {
      console.error("Error uploading dressed character image:", uploadError);
      throw uploadError;
    }

    const { data: publicUrlData } = await supabase.storage
      .from('generated_images')
      .getPublicUrl(uploadData?.path || fileName);

    return new Response(
      JSON.stringify({
        success: true,
        textResponse: responseText,
        renderedImageUrl: publicUrlData?.publicUrl,
        renderedImagePath: uploadData?.path || fileName,
        hasImage: Boolean(publicUrlData?.publicUrl),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Unexpected error in dress-character:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
