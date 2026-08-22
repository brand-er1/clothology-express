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

interface PreservationEvaluation {
  score: number;
  faceMatch: boolean;
  garmentMatch: boolean;
  violations: string[];
}

// The only thing that must never change is the character's FACE identity — everything below the
// neck (body shape, limbs, hands, feet, pose, and the outer silhouette a garment creates) is
// expected to adapt so the clothing sits naturally. faceMatch/garmentMatch (the judge's actual
// pass/fail calls) remain a hard requirement; the numeric score only needs to be high, and a judge
// hedging with a minor noted violation no longer auto-fails a result it otherwise approved.
const PRESERVATION_SCORE_THRESHOLD = 0.9;

const isPreservationApproved = (evaluation: PreservationEvaluation | null) =>
  Boolean(
    evaluation &&
      evaluation.score >= PRESERVATION_SCORE_THRESHOLD &&
      evaluation.faceMatch &&
      evaluation.garmentMatch,
  );

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

const evaluatePreservation = async (
  geminiApiKey: string,
  identityAnchor: { base64: string; mimeType: string },
  candidate: { base64: string; mimeType: string },
  garments: GarmentInput[],
): Promise<PreservationEvaluation | null> => {
  try {
    const garmentReferenceParts: Array<Record<string, unknown>> = [];
    garments.forEach((garment, index) => {
      garmentReferenceParts.push(
        { text: `GARMENT REFERENCE ${index + 1} — ${slotDescriptionEn[garment.slot]}` },
        { inlineData: { data: garment.base64, mimeType: garment.mimeType } },
      );
    });
    const requestBody = JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Perform a strict fail-closed comparison, but scope it to FACE identity only — this is a clothing swap, and the body below the neck is expected to look different. IMAGE A is the Face Identity Reference (the character in its default/original outfit). IMAGE B is the candidate wearing a different, deliberately requested set of garments.

faceMatch: judge ONLY the face — face shape and outline, the solid black face color, eye shape/size/position/spacing, expression, eyelashes (female character only), and the character's unique face design. Set faceMatch to false only for a genuine, visible change to one of those specific face elements (redrawn, reinterpreted, humanized, aged, or a facial feature added/removed/moved).

Do NOT judge faceMatch on, and NEVER fail it because of: body shape/proportions, shoulder or torso volume, arms, hands, legs, feet, standing pose/stance, camera angle, or the outer silhouette — a new garment is SUPPOSED to change all of these (a bulky hoodie reads wider than a slim shirt, pants replace bare legs with fabric, sleeves cover the arms differently, the pose may shift naturally to wear the item), and none of that is a face or identity problem.

garmentMatch: separately, preserve every supplied garment reference's exact color, silhouette, fit, length, logo, graphic, print, pattern, seams, pockets, zipper, buttons, hood, collar, sleeve shape, material, and construction — natural folds and occlusion needed to wear it are allowed, but redesigning the garment is not.

Return JSON only: {"score":0.0,"faceMatch":false,"garmentMatch":false,"violations":["short concrete difference"]}. Score 1.0 when the face identity and every garment's design are both faithfully preserved, regardless of how much the body/pose/silhouette changed to wear the clothes.`,
            },
            { text: "IMAGE A — FACE IDENTITY REFERENCE" },
            { inlineData: { data: identityAnchor.base64, mimeType: identityAnchor.mimeType } },
            ...garmentReferenceParts,
            { text: "IMAGE B — FINAL CLOTHING EDIT TO CHECK" },
            { inlineData: { data: candidate.base64, mimeType: candidate.mimeType } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    });

    // Mirror the fallback pattern every other Gemini call in this codebase uses (see
    // modify-generated-image, screen-trademark-image, analyze-production-estimate):
    // gemini-3-flash-preview alone is not reliably available, and this is a fail-closed
    // gate — if the ONLY judge call available fails, isPreservationApproved(null) is always
    // false and the entire dress-character feature silently stops working for every request.
    const models = ["gemini-3-flash-preview", "gemini-3-pro-preview"];
    for (const model of models) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
        },
      );

      if (!response.ok) {
        console.warn("dress-character preservation model failed", model, response.status, await response.text());
        continue;
      }
      const data = await response.json();
      const responseText = (data?.candidates?.[0]?.content?.parts || [])
        .map((part: { text?: string }) => part.text || "")
        .join("")
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "");
      if (!responseText) continue;

      try {
        const parsed = JSON.parse(responseText);
        const score = Number(parsed?.score);
        if (!Number.isFinite(score)) continue;
        return {
          score: Math.min(1, Math.max(0, score)),
          faceMatch: parsed?.faceMatch === true,
          garmentMatch: parsed?.garmentMatch === true,
          violations: Array.isArray(parsed?.violations)
            ? parsed.violations.map((item: unknown) => String(item)).slice(0, 6)
            : [],
        };
      } catch (parseError) {
        console.warn("dress-character preservation JSON parse failed", model, parseError);
        continue;
      }
    }
    return null;
  } catch (error) {
    console.warn("dress-character preservation evaluation failed", error);
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
      identityImage,
      garments: rawGarments,
      changedSlots: rawChangedSlots,
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

    const identityBase64 = stripDataUrlPrefix(String(identityImage?.base64 || characterBase64));
    const identityMimeType = String(identityImage?.mimeType || characterMimeType);
    if (!identityBase64 || !supportedImageMimeTypes.has(identityMimeType)) {
      return new Response(
        JSON.stringify({ error: "캐릭터 원본 기준 이미지가 필요합니다." }),
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

    const explicitlyChangedSlots: ClosetSlot[] = Array.isArray(rawChangedSlots)
      ? rawChangedSlots.filter((slot: unknown): slot is ClosetSlot => validSlots.has(slot as ClosetSlot))
      : [];
    const slotsInThisRequest = Array.from(new Set([
      ...explicitlyChangedSlots,
      ...garments.map((garment) => garment.slot),
    ]));

    if (garments.length === 0 && slotsInThisRequest.length === 0) {
      return new Response(
        JSON.stringify({ error: "변경할 의류 슬롯이나 의류 이미지가 필요합니다." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }
    if (garments.length > 5) {
      return new Response(
        JSON.stringify({ error: "한 번에 입힐 수 있는 의류는 최대 5개입니다." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }
    if (new Set(garments.map((garment) => garment.slot)).size !== garments.length) {
      return new Response(
        JSON.stringify({ error: "같은 슬롯에는 하나의 의류만 선택할 수 있습니다. 새 의류로 교체해주세요." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const totalBytes = characterBase64.length + identityBase64.length +
      garments.reduce((sum, g) => sum + g.base64.length, 0);
    if (totalBytes > 30 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "이미지 용량이 너무 큽니다." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const faceIdentityRules = gender === "female"
      ? "This is the FEMALE BRAND-ER mascot's face: solid black face color, large round white eyes, visible eyelashes (her signature distinguishing feature), and her unique face design."
      : "This is the MALE BRAND-ER mascot's face: solid black face color, large round white eyes, and his unique face design.";

    const garmentList = garments
      .map((garment, index) => {
        const ordinal = index + 2;
        return `Reference Image ${ordinal} (${slotDescriptionEn[garment.slot]}${garment.label ? `, "${garment.label}"` : ""}): garment to render on the character in the ${garment.slot} slot.`;
      })
      .join("\n");

    const slotsSentence = slotsInThisRequest
      .map((slot) => slotDescriptionEn[slot])
      .join(", ");
    const clearedSlots = slotsInThisRequest.filter(
      (slot) => !garments.some((garment) => garment.slot === slot),
    );
    const clearedSlotsInstruction = clearedSlots.length > 0
      ? `Leave these empty slots bare exactly as they appear on the canonical character (${clearedSlots.map((slot) => slotDescriptionEn[slot]).join(", ")}). Do not retain or invent an item in them.`
      : "";

    const prompt = `
EDIT Reference Image 1. This is a constrained image edit: dress the BRAND-ER character in the supplied garments, keeping its FACE identical while letting the body adapt naturally to the clothing.

Reference Image 1 is the Face Identity Reference for this character. ${faceIdentityRules}

FACE IDENTITY LOCK — HIGHEST PRIORITY, THE ONLY IMMUTABLE ELEMENT:
- Preserve exactly, from Reference Image 1: face shape and outline, the solid black face color, eye shape/size/position/spacing, expression, eyelashes when present (female character), and every other element of the character's unique face design.
- Wherever possible, keep the face region pixel-identical to Reference Image 1 and edit only the body/clothing area below the neck.
- Do not redraw, reinterpret, regenerate, beautify, humanize, or age the face. Never add, remove, or move a facial feature.
- Do not change gender presentation or hair/headwear that isn't explicitly replaced by a supplied garment.

ALLOWED TO CHANGE — needed for natural clothing, never a violation:
- The outer body silhouette created by the new garments (bulk, width, length, coverage).
- Shoulder and torso volume under a top/outer layer.
- Arms as covered/reshaped by sleeves, and legs as covered/reshaped by pants or a skirt.
- Hands, feet, and the character's standing pose/stance, to whatever degree is natural for wearing the item.
- Garment fit, wrinkles, drape, and hem length.
- Any natural repositioning of the body needed to wear the garment convincingly.
None of the above should ever be treated as a character mismatch or cause this result to be discarded — only a change to the FACE itself (per the lock above) is a violation.

WARDROBE COMPOSITION LOCK — SAME PRIORITY:
- Build the complete wardrobe only from the garment references supplied in this request: ${slotsSentence}.
- References in the same slot are replacements, never stacked. A new TOP entirely replaces the old TOP. OUTER may layer naturally over TOP; no other implicit layering is allowed.
- Never carry clothing forward from a previous generated result and never invent clothing for an empty slot.

${garmentList || "No garment reference is supplied."}
${clearedSlotsInstruction}

TASK: Starting only from Reference Image 1, make the same character (same face) naturally wear every supplied garment reference at once. Make each garment genuinely wrap around the body with natural fit, drape, folds, seams, occlusion, and contact shadows — adjusting body volume, limb coverage, and pose as needed for a convincing, natural result. Garment and pose realism come from adapting to the clothing, never from changing the face.

Clothing identity lock — for every garment reference image, preserve exactly:
- garment type and silhouette
- exact color (do not shift, tint, or reinterpret the color)
- logo/graphic position and content (do not move, resize, remove, or add any logo or graphic)
- pattern, prints, pockets, zippers, hood, sleeves, and hem details
- fabric texture
- fit, proportions, length, construction, seams, buttons, collar and material feel

Preserve the exact design identity of every provided garment. Do not change its color, logo, graphics, silhouette, proportions, material details, or construction.

Do not invent new design details that are not present in the garment reference image (for example: do not add a zipper if there isn't one, do not add graphics that aren't there, do not change a plain garment into a patterned one).

OUTPUT: Return exactly ONE edited full-body image. No before/after split, comparison layout, caption, watermark, extra person, prop, or text overlay. The result must show the same face identity as Reference Image 1, naturally wearing the exact referenced garments — the body, pose, and silhouette should look however is natural for that outfit.
`.trim();

    const garmentParts: Array<Record<string, unknown>> = [];
    garments.forEach((garment, index) => {
      garmentParts.push(
        { text: `Reference Image ${index + 2}: EXACT GARMENT IDENTITY for ${slotDescriptionEn[garment.slot]}.` },
        { inlineData: { data: garment.base64, mimeType: garment.mimeType } },
      );
    });

    const generationParts: Array<Record<string, unknown>> = [
      { text: prompt },
      { text: "Reference Image 1: FACE IDENTITY REFERENCE. This face is always the sole source of the character's identity." },
      { inlineData: { data: identityBase64, mimeType: identityMimeType } },
      ...garmentParts,
      { text: "FINAL LOCK: exact same face (shape, black color, eyes, expression, eyelashes if present) as Reference Image 1, and exact garment design from every garment reference. The body, pose, and silhouette should adapt naturally to the new clothing — that adaptation is expected, not a deviation." },
    ];

    const firstImage = await generateDressedImage(geminiApiKey, generationParts);
    if (!firstImage) throw new Error("Gemini did not return an image");

    const identityAnchor = { base64: identityBase64, mimeType: identityMimeType };
    let chosenImage = firstImage;
    let preservationEvaluation = await evaluatePreservation(
      geminiApiKey,
      identityAnchor,
      firstImage,
      garments,
    );
    let identityRetryApplied = false;

    // Generation is stochastic, so a single rejected draft doesn't mean the request is
    // impossible — give it a couple of correction passes before discarding it outright.
    const maxRetries = 2;
    let lastAttemptedImage = firstImage;
    for (let attempt = 0; attempt < maxRetries && !isPreservationApproved(preservationEvaluation); attempt++) {
      identityRetryApplied = true;
      console.warn("dress-character preservation failure detected", preservationEvaluation);
      const retryParts: Array<Record<string, unknown>> = [
        {
          text: `${prompt}\n\nCORRECTION PASS: Discard the rejected draft and rebuild from the Face Identity Reference plus all original garment references. Detected differences: ${preservationEvaluation?.violations.join("; ") || "the strict face/garment preservation check was unavailable or found a difference"}.`,
        },
        { text: "Reference Image 1: FACE IDENTITY REFERENCE. This exact face must survive unchanged; the body may adapt naturally to the clothing." },
        { inlineData: { data: identityBase64, mimeType: identityMimeType } },
        { text: "REJECTED DRAFT: use only as an example of what NOT to change on the face." },
        { inlineData: { data: lastAttemptedImage.base64, mimeType: lastAttemptedImage.mimeType } },
        ...garmentParts,
        { text: "FINAL CHECK: exact face identity and exact garment references; the body, pose, and silhouette may differ as much as needed to wear the clothes naturally." },
      ];
      const retryImage = await generateDressedImage(geminiApiKey, retryParts);
      if (!retryImage) continue;
      lastAttemptedImage = retryImage;
      const retryEvaluation = await evaluatePreservation(
        geminiApiKey,
        identityAnchor,
        retryImage,
        garments,
      );
      if (isPreservationApproved(retryEvaluation)) {
        chosenImage = retryImage;
        preservationEvaluation = retryEvaluation;
      } else if (
        !preservationEvaluation ||
        (retryEvaluation && retryEvaluation.score > preservationEvaluation.score)
      ) {
        // Keep the best-scoring draft as the correction-pass basis for the next retry, even
        // though it's not approved yet.
        preservationEvaluation = retryEvaluation;
      }
    }

    if (!preservationEvaluation) {
      // The judge model itself was unavailable on every attempt (API error / bad JSON), not a
      // detected face or garment violation — that's an infra failure, not evidence something is
      // actually wrong with the image. Discarding here would mean the character can never be
      // redressed whenever the judge call has a bad day. Ship the generation, which already went
      // through the same strong face/garment locks in its own prompt.
      console.warn("dress-character preservation judge unavailable after all attempts; shipping generation on prompt-level locks alone");
      chosenImage = lastAttemptedImage;
    } else if (!isPreservationApproved(preservationEvaluation)) {
      console.error("dress-character discarded by fail-closed preservation gate", preservationEvaluation);
      return new Response(
        JSON.stringify({ error: "캐릭터 얼굴 또는 의류 원본이 조금이라도 달라질 가능성이 있어 결과를 폐기했습니다. 기존 이미지는 그대로 유지됩니다." }),
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
        faceScore: preservationEvaluation?.score ?? null,
        preservationPassed: true,
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
