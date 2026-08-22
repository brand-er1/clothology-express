import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.31.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ClosetSlot = "top" | "bottom" | "outer" | "shoes" | "accessory";
type CharacterGender = "male" | "female";
const validSlots = new Set<ClosetSlot>(["top", "bottom", "outer", "shoes", "accessory"]);
const supportedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

const slotDescriptionEn: Record<ClosetSlot, string> = {
  top: "top garment",
  bottom: "bottom garment",
  outer: "outer layer",
  shoes: "footwear",
  accessory: "accessory or hat",
};

interface GarmentInput {
  slot: ClosetSlot;
  label?: string;
  base64: string;
  mimeType: string;
}

interface GeneratedImage {
  base64: string;
  mimeType: string;
  textResponse: string;
}

interface PreservationEvaluation {
  score: number;
  characterMatch: boolean;
  garmentMatch: boolean;
  violations: string[];
}

const stripDataUrlPrefix = (value: string) => value.replace(/^data:image\/[^;]+;base64,/, "");
const extensionForMimeType = (mimeType: string) => mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
const decodeBase64Image = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const approved = (evaluation: PreservationEvaluation | null) => Boolean(
  evaluation && evaluation.score === 1 && evaluation.characterMatch && evaluation.garmentMatch && evaluation.violations.length === 0,
);

const generateDressedImage = async (
  apiKey: string,
  parts: Array<Record<string, unknown>>,
): Promise<GeneratedImage | null> => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0,
          responseModalities: ["IMAGE", "TEXT"],
          // Closet preview does not need 2K. 1K cuts generation and upload latency substantially.
          imageConfig: { aspectRatio: "3:4", imageSize: "1K" },
        },
      }),
    },
  );
  if (!response.ok) {
    console.error("dress-character Gemini error", response.status, await response.text());
    return null;
  }
  const data = await response.json();
  const responseParts = data?.candidates?.[0]?.content?.parts || [];
  let base64 = "";
  let mimeType = "image/png";
  let textResponse = "";
  for (const part of responseParts) {
    if (part.inlineData?.data && !base64) {
      base64 = part.inlineData.data;
      mimeType = part.inlineData.mimeType || "image/png";
    }
    if (part.text) textResponse += part.text;
  }
  return base64 ? { base64, mimeType, textResponse } : null;
};

const evaluatePreservation = async (
  apiKey: string,
  identity: { base64: string; mimeType: string },
  candidate: GeneratedImage,
  garments: GarmentInput[],
): Promise<PreservationEvaluation | null> => {
  try {
    const garmentParts: Array<Record<string, unknown>> = [];
    garments.forEach((garment) => garmentParts.push(
      { text: `GARMENT ${slotDescriptionEn[garment.slot]}` },
      { inlineData: { data: garment.base64, mimeType: garment.mimeType } },
    ));
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: "Strictly compare IMAGE A and IMAGE B. A is the immutable BRAND-ER character. B may differ ONLY where supplied garments cover the body. Face, eyes, expression, head, hair or existing head shape, skin/face color, body proportions, limb lengths, hands, feet, pose, camera, crop, background and render style must remain effectively exact. Each supplied garment must keep its color, silhouette, logo/graphic, pattern and construction. Return JSON only: {\"score\":1,\"characterMatch\":true,\"garmentMatch\":true,\"violations\":[]}. Use score 1 only when both locks pass without visible doubt." },
              { text: "IMAGE A — CANONICAL CHARACTER" },
              { inlineData: { data: identity.base64, mimeType: identity.mimeType } },
              ...garmentParts,
              { text: "IMAGE B — CANDIDATE" },
              { inlineData: { data: candidate.base64, mimeType: candidate.mimeType } },
            ],
          }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      },
    );
    if (!response.ok) return null;
    const data = await response.json();
    const text = (data?.candidates?.[0]?.content?.parts || []).map((part: { text?: string }) => part.text || "").join("")
      .trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(text);
    const score = Number(parsed?.score);
    if (!Number.isFinite(score)) return null;
    return {
      score: Math.min(1, Math.max(0, score)),
      characterMatch: parsed?.characterMatch === true,
      garmentMatch: parsed?.garmentMatch === true,
      violations: Array.isArray(parsed?.violations) ? parsed.violations.map(String).slice(0, 6) : [],
    };
  } catch (error) {
    console.warn("preservation evaluation failed", error);
    return null;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const requestData = await req.json();
    const gender: CharacterGender = requestData?.characterGender === "female" ? "female" : "male";

    const identityBase64 = stripDataUrlPrefix(String(requestData?.identityImage?.base64 || requestData?.characterImage?.base64 || ""));
    const identityMimeType = String(requestData?.identityImage?.mimeType || requestData?.characterImage?.mimeType || "");
    if (!identityBase64 || !supportedImageMimeTypes.has(identityMimeType)) {
      return new Response(JSON.stringify({ error: "캐릭터 원본 기준 이미지가 필요합니다." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const garments: GarmentInput[] = Array.isArray(requestData?.garments)
      ? requestData.garments.map((item: Record<string, unknown>) => ({
          slot: validSlots.has(item.slot as ClosetSlot) ? item.slot as ClosetSlot : "top",
          label: typeof item.label === "string" ? item.label : undefined,
          base64: stripDataUrlPrefix(String((item.image as Record<string, unknown>)?.base64 || item.base64 || "")),
          mimeType: String((item.image as Record<string, unknown>)?.mimeType || item.mimeType || ""),
        })).filter((item: GarmentInput) => item.base64 && supportedImageMimeTypes.has(item.mimeType))
      : [];
    if (!garments.length) {
      return new Response(JSON.stringify({ error: "입힐 의류 이미지가 필요합니다." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (new Set(garments.map((item) => item.slot)).size !== garments.length) {
      return new Response(JSON.stringify({ error: "같은 슬롯에는 하나의 의류만 선택할 수 있습니다." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const identityDescription = gender === "female"
      ? "FEMALE BRAND-ER mascot. Preserve her exact black face, large round white eyes, eyelashes, head/hair, body, hands, feet and proportions."
      : "MALE BRAND-ER mascot. Preserve his exact black face, large round white eyes, head shape, body, hands, feet and proportions.";
    const hasHat = garments.some((item) => item.slot === "accessory" && /hat|cap|beanie|모자|캡|비니/i.test(item.label || ""));

    const prompt = `CLOTHING-ONLY EDIT. Reference Image 1 is an immutable identity anchor, not inspiration. ${identityDescription}\n\nABSOLUTE CHARACTER LOCK: keep face, eyes, expression, head outline, hair, skin/face color, torso proportions, arm/leg length and thickness, hands, feet, pose, camera, crop, scale, background, lighting and rendering style unchanged. Do not redraw or reinterpret the character. Adapt clothing to the character, never the character to clothing.\n\nWARDROBE LOCK: preserve every supplied garment's exact color, silhouette, length, logo/graphic, pattern, seams, pockets, zipper, buttons, hood/collar, sleeves and material appearance. A garment in a slot replaces the previous item in that slot.\n\n${hasHat ? "HEADWEAR RULE: the accessory is a hat. Put that exact hat onto the canonical head without changing head size/shape, face, eyes, hairline, body or pose. The hat must conform to the existing head; never regenerate a different head." : "Do not add or remove headwear unless an accessory reference explicitly requests it."}\n\nReturn ONE full-body edited image. No text, no comparison layout, no extra subject. Everything outside clothing/headwear coverage must remain as close to the canonical image as possible.`;

    const parts: Array<Record<string, unknown>> = [
      { text: prompt },
      { text: "Reference Image 1 — CANONICAL IMMUTABLE CHARACTER" },
      { inlineData: { data: identityBase64, mimeType: identityMimeType } },
    ];
    garments.forEach((garment, index) => parts.push(
      { text: `Reference Image ${index + 2} — exact ${slotDescriptionEn[garment.slot]} garment identity${garment.label ? ` (${garment.label})` : ""}` },
      { inlineData: { data: garment.base64, mimeType: garment.mimeType } },
    ));
    parts.push({ text: "FINAL LOCK: change wardrobe only; preserve the canonical character and scene." });

    const generated = await generateDressedImage(apiKey, parts);
    if (!generated) throw new Error("Gemini did not return an image");

    // One fast validation pass only. The former retry path could invoke image generation twice plus validation twice.
    const evaluation = await evaluatePreservation(apiKey, { base64: identityBase64, mimeType: identityMimeType }, generated, garments);
    if (!approved(evaluation)) {
      console.error("dress-character discarded by preservation gate", evaluation);
      return new Response(JSON.stringify({ error: "캐릭터 또는 의류 원본이 달라져 결과를 적용하지 않았습니다." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const bytes = decodeBase64Image(generated.base64);
    const fileName = `${requestData?.userId || "anon"}/closet/${Date.now()}_${crypto.randomUUID()}.${extensionForMimeType(generated.mimeType)}`;
    const { data: uploadData, error: uploadError } = await supabase.storage.from("generated_images").upload(fileName, bytes, { contentType: generated.mimeType, upsert: false });
    if (uploadError) throw uploadError;
    const { data: publicData } = supabase.storage.from("generated_images").getPublicUrl(uploadData?.path || fileName);

    return new Response(JSON.stringify({
      success: true,
      textResponse: generated.textResponse,
      renderedImageUrl: publicData?.publicUrl,
      renderedImagePath: uploadData?.path || fileName,
      identityScore: evaluation?.score ?? 0,
      preservationPassed: true,
      identityRetryApplied: false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Unexpected error in dress-character", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
