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

interface GeneratedImage {
  base64: string;
  mimeType: string;
  textResponse: string;
}

interface IdentityEvaluation {
  score: number;
  violations: string[];
}

const generateDressedImage = async (
  geminiApiKey: string,
  parts: Array<Record<string, unknown>>,
): Promise<GeneratedImage | null> => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.1,
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: { aspectRatio: "3:4", imageSize: "2K" },
        },
      }),
    },
  );

  if (!response.ok) {
    const bodyText = await response.text();
    console.error("dress-character Gemini error", response.status, bodyText);
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

const evaluateCharacterIdentity = async (
  geminiApiKey: string,
  baseCharacter: { base64: string; mimeType: string },
  candidate: { base64: string; mimeType: string },
  changedSlots: ClosetSlot[],
): Promise<IdentityEvaluation | null> => {
  try {
    const changedSlotNames = changedSlots
      .map((slot) => slotDescriptionEn[slot])
      .join(", ");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Compare IMAGE A (immutable source) and IMAGE B (restricted clothing edit). The ONLY clothing slots allowed to change are: ${changedSlotNames}. Ignore differences inside those changed slots and body areas legitimately covered by them. Every UNSUPPLIED clothing slot must remain exactly as in IMAGE A, including garment type, silhouette, color, length, fit, folds, hood/collar, sleeves, logo, print, texture, and layering. Also check that the SAME character is preserved: exact face color, eyes, eye spacing, eyelashes, head outline, visible body proportions, pose, limbs, hands, feet, rendering style, camera angle, scale, and framing. Return JSON only: {"score":0.0,"violations":["short concrete difference"]}. Score 1.0 only when the character and every unchanged clothing slot are effectively identical.`,
                },
                { text: "IMAGE A — IMMUTABLE BASE CHARACTER" },
                { inlineData: { data: baseCharacter.base64, mimeType: baseCharacter.mimeType } },
                { text: "IMAGE B — CLOTHING EDIT TO CHECK" },
                { inlineData: { data: candidate.base64, mimeType: candidate.mimeType } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) return null;
    const data = await response.json();
    const responseText = (data?.candidates?.[0]?.content?.parts || [])
      .map((part: { text?: string }) => part.text || "")
      .join("")
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "");
    const parsed = JSON.parse(responseText);
    const score = Number(parsed?.score);
    if (!Number.isFinite(score)) return null;
    return {
      score: Math.min(1, Math.max(0, score)),
      violations: Array.isArray(parsed?.violations)
        ? parsed.violations.map((item: unknown) => String(item)).slice(0, 6)
        : [],
    };
  } catch (error) {
    console.warn("dress-character identity evaluation failed", error);
    return null;
  }
};

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
    const unchangedSlots = Array.from(validSlots).filter(
      (slot) => !slotsInThisRequest.includes(slot),
    );
    const unchangedSlotsSentence = unchangedSlots
      .map((slot) => slotDescriptionEn[slot])
      .join(", ") || "none (every clothing slot was supplied)";

    const prompt = `
EDIT Reference Image 1. This is a tightly constrained CLOTHING-ONLY image edit, not a request to create, redraw, or reinterpret a character.

Reference Image 1 is the immutable BRAND-ER mascot source. ${characterIdentityRules}

IMMUTABLE CHARACTER LOCK — HIGHEST PRIORITY:
- The output must visibly be the exact same source character with only a wardrobe change, never a new character inspired by it.
- Preserve exactly: black face color, eyes, eye spacing and shape, eyelashes when present, expression, head outline, hair/headwear not explicitly replaced, neck, body proportions, limb length and thickness, hands, fingers, feet, pose, gender presentation, camera angle, crop, scale, framing, lighting, background, and overall 3D render style.
- Keep all visible uncovered character regions as close to pixel-identical to Reference Image 1 as generatively possible.
- Never redesign, beautify, humanize, age, recolor, reshape, rotate, mirror, or replace the character. Never add or remove a facial feature or limb.
- Do not change the character to fit a garment. If proportions conflict, tailor and drape the GARMENT to the unchanged character body.

UNCHANGED OUTFIT LOCK — SAME PRIORITY:
- The ONLY editable clothing slots are: ${slotsSentence}.
- Preserve every original item in all unsupplied slots (${unchangedSlotsSentence}) exactly as it appears in Reference Image 1.
- For each unchanged item, preserve its exact garment type, color, silhouette, length, fit, looseness/tightness, folds, drape, layering, hood/collar, sleeves, cuffs, pockets, logo, print, pattern, texture, and visible details.
- Never regenerate, restyle, resize, recolor, tighten, loosen, lengthen, shorten, cover, or remove an unchanged garment.
- Example: if only the bottom slot is supplied, replace only the bottom. The original top must keep the exact same fit, length, folds, sleeves, hood/collar, color, and graphics from Reference Image 1.

${garmentList}

TASK: Change only the supplied clothing slot(s) (${slotsSentence}) in Reference Image 1. Make each garment genuinely wrap around the locked body with natural fit, drape, folds, seams, occlusion, and contact shadows. Garment realism must come from adapting the clothing, never from changing the character.

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

OUTPUT: Return exactly ONE edited full-body image. No before/after split, comparison layout, caption, watermark, extra person, prop, or text overlay. The final result must look like Reference Image 1 was edited only inside the supplied clothing regions. Preserve its original background, camera, pose, framing, and character identity.
`.trim();

    const garmentParts: Array<Record<string, unknown>> = [];
    garments.forEach((garment, index) => {
      garmentParts.push(
        { text: `Reference Image ${index + 2}: ${slotDescriptionEn[garment.slot]}.` },
        { inlineData: { data: garment.base64, mimeType: garment.mimeType } },
      );
    });

    const generationParts: Array<Record<string, unknown>> = [
      { text: prompt },
      { text: "Reference Image 1: IMMUTABLE BASE CHARACTER. Copy this exact character and edit clothing only." },
      { inlineData: { data: characterBase64, mimeType: characterMimeType } },
      ...garmentParts,
      { text: "FINAL LOCK: exact same face, eyes, head, body, pose, hands, feet, style, camera, framing, lighting, and background as Reference Image 1. Only supplied clothing slots may change." },
    ];

    const firstImage = await generateDressedImage(geminiApiKey, generationParts);
    if (!firstImage) throw new Error("Gemini did not return an image");

    const baseCharacter = { base64: characterBase64, mimeType: characterMimeType };
    let chosenImage = firstImage;
    let identityEvaluation = await evaluateCharacterIdentity(
      geminiApiKey,
      baseCharacter,
      firstImage,
      slotsInThisRequest,
    );
    let identityRetryApplied = false;

    if (identityEvaluation && identityEvaluation.score < 0.9) {
      identityRetryApplied = true;
      console.warn("dress-character identity drift detected", identityEvaluation);
      const retryParts: Array<Record<string, unknown>> = [
        {
          text: `${prompt}\n\nCORRECTION PASS: The rejected draft changed the locked character. Discard every character change and redo the clothing-only edit from Reference Image 1. Detected differences: ${identityEvaluation.violations.join("; ") || "character identity or proportions changed"}.`,
        },
        { text: "Reference Image 1: IMMUTABLE BASE CHARACTER. This exact character must survive unchanged." },
        { inlineData: { data: characterBase64, mimeType: characterMimeType } },
        { text: "REJECTED DRAFT: use only as an example of what NOT to change outside clothing." },
        { inlineData: { data: firstImage.base64, mimeType: firstImage.mimeType } },
        ...garmentParts,
        { text: "FINAL CHECK: exact same base face, eyes, head, body proportions, pose, hands, feet, style, camera, framing, lighting, and background; only clothing changes." },
      ];
      const retryImage = await generateDressedImage(geminiApiKey, retryParts);
      if (retryImage) {
        const retryEvaluation = await evaluateCharacterIdentity(
          geminiApiKey,
          baseCharacter,
          retryImage,
          slotsInThisRequest,
        );
        if (!retryEvaluation || retryEvaluation.score >= identityEvaluation.score) {
          chosenImage = retryImage;
          identityEvaluation = retryEvaluation || identityEvaluation;
        }
      }
    }

    if (identityEvaluation && identityEvaluation.score < 0.82) {
      console.error("dress-character discarded for identity drift", identityEvaluation);
      return new Response(
        JSON.stringify({ error: "캐릭터 정체성을 충분히 유지하지 못해 결과를 폐기했습니다. 다시 시도해주세요." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 422 },
      );
    }

    const generatedImageBase64 = chosenImage.base64;
    const mimeType = chosenImage.mimeType;
    const responseText = chosenImage.textResponse;

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
        identityScore: identityEvaluation?.score ?? null,
        identityRetryApplied,
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
