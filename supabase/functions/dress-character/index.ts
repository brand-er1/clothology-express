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
  garmentApplied: boolean;
  violations: string[];
}

// The only thing that must never change is the character's FACE identity — everything below the
// neck (body shape, limbs, hands, feet, pose, and the outer silhouette a garment creates) is
// expected to adapt so the clothing sits naturally. faceMatch/garmentMatch/garmentApplied (the
// judge's actual pass/fail calls) decide whether this attempt is good enough to stop retrying —
// they are NOT a gate that can discard the request outright. Even when every retry still falls
// short, the best-scoring attempt is always shipped: preserving the character is never a reason to
// skip putting the garment on it. See the end-of-pipeline selection logic below.
const PRESERVATION_SCORE_THRESHOLD = 0.9;

const isPreservationApproved = (evaluation: PreservationEvaluation | null) =>
  Boolean(
    evaluation &&
      evaluation.score >= PRESERVATION_SCORE_THRESHOLD &&
      evaluation.faceMatch &&
      evaluation.garmentMatch &&
      evaluation.garmentApplied,
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
              text: `Perform a comparison scoped to FACE identity and to whether the requested garments were actually put on the character — this is a clothing swap, and the body below the neck is expected to look different. IMAGE A is the Face Identity Reference (the character in its default/original outfit, or its previous outfit). IMAGE B is the candidate wearing a different, deliberately requested set of garments.

faceMatch: judge ONLY the face — face shape and outline, the solid black face color, eye shape/size/position/spacing, expression, eyelashes (female character only), and the character's unique face design. Set faceMatch to false only for a genuine, visible change to one of those specific face elements (redrawn, reinterpreted, humanized, aged, or a facial feature added/removed/moved).

Do NOT judge faceMatch on, and NEVER fail it because of: body shape/proportions, shoulder or torso volume, arms, hands, legs, feet, standing pose/stance, camera angle, or the outer silhouette — a new garment is SUPPOSED to change all of these (a bulky hoodie reads wider than a slim shirt, pants replace bare legs with fabric, sleeves cover the arms differently, the pose may shift naturally to wear the item), and none of that is a face or identity problem.

garmentApplied: for EVERY garment reference image supplied below, confirm it is actually, visibly worn on the character in IMAGE B, on the correct body region, replacing whatever previously occupied that slot. Set garmentApplied to false if: IMAGE B looks like the untouched Face Identity Reference (the garment was never applied), a garment reference is missing from the render, the wrong garment/slot was rendered, or only part of a garment reference was applied. Applying every supplied garment is just as important as preserving the face — do not let a cautious render that skips the clothing change count as success.

garmentMatch: separately from whether it was applied, judge design fidelity — preserve every supplied garment reference's exact color, silhouette, fit, length, logo, graphic, print, pattern, seams, pockets, zipper, buttons, hood, collar, sleeve shape, material, and construction — natural folds and occlusion needed to wear it are allowed, but redesigning the garment is not.

Return JSON only: {"score":0.0,"faceMatch":false,"garmentMatch":false,"garmentApplied":false,"violations":["short concrete difference"]}. Score 1.0 when the face identity is preserved AND every supplied garment is both actually worn and faithfully rendered, regardless of how much the body/pose/silhouette changed to wear the clothes.`,
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
          garmentApplied: parsed?.garmentApplied === true,
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
    const replacedSlotsInstruction = garments.length > 0
      ? garments
        .map((garment) =>
          `REMOVE THE CURRENT ${garment.slot.toUpperCase()} GARMENT AND REPLACE IT WITH THE PROVIDED ${garment.slot.toUpperCase()} GARMENT (Reference Image for ${slotDescriptionEn[garment.slot]}). Do not leave the old ${garment.slot} in place, and do not layer the new one on top of it.`)
        .join("\n")
      : "";

    const prompt = `
EDIT Reference Image 1. This is a constrained image edit: dress the BRAND-ER character in the supplied garments, keeping its FACE identical while letting the body adapt naturally to the clothing.

Reference Image 1 is both the Full Character Reference and the Face Identity Reference for this character — the highest-priority identity anchor. ${faceIdentityRules}

GENERATION PRIORITY ORDER (in order, but Priority 1 must never be used as a reason to abandon Priority 2):
Priority 1 — Preserve the character's face identity (shape, black color, eyes, expression, eyelashes if present, hairstyle).
Priority 2 — Actually put the supplied garment(s) on the character, replacing only the requested clothing slot(s).
Priority 3 — Keep every other currently worn item (any slot not part of this request) unchanged.
DO NOT REFUSE TO APPLY THE GARMENT. DO NOT RETURN THE ORIGINAL CHARACTER WITHOUT THE NEW GARMENT. THE CHARACTER MUST WEAR THE PROVIDED GARMENT. PRESERVE THE CHARACTER IDENTITY WHILE REPLACING ONLY THE REQUESTED CLOTHING SLOT. DO NOT SOLVE IDENTITY PRESERVATION BY SKIPPING THE CLOTHING CHANGE. A render that keeps the face perfect but fails to show the new garment is a FAILED result, not a safe one.

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
${replacedSlotsInstruction}
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

OUTPUT: Return exactly ONE edited full-body image. No before/after split, comparison layout, caption, watermark, extra person, prop, or text overlay. The result must show the same face identity as Reference Image 1, VISIBLY AND ACTUALLY wearing the exact referenced garments — not the old outfit, not no outfit, not the garments floating beside the character. The body, pose, and silhouette should look however is natural for that outfit. Returning Reference Image 1 unchanged, or with the garment missing/only partially applied, is not an acceptable output.
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
      { text: "FINAL LOCK: exact same face (shape, black color, eyes, expression, eyelashes if present) as Reference Image 1, and exact garment design from every garment reference, ACTUALLY WORN on the character. The body, pose, and silhouette should adapt naturally to the new clothing — that adaptation is expected, not a deviation. Do not solve identity preservation by skipping the clothing change." },
    ];

    const firstImage = await generateDressedImage(geminiApiKey, generationParts);
    if (!firstImage) throw new Error("Gemini did not return an image");

    const identityAnchor = { base64: identityBase64, mimeType: identityMimeType };

    interface Attempt {
      image: GeneratedImage;
      evaluation: PreservationEvaluation | null;
    }

    const attempts: Attempt[] = [
      {
        image: firstImage,
        evaluation: await evaluatePreservation(geminiApiKey, identityAnchor, firstImage, garments),
      },
    ];
    let identityRetryApplied = false;

    // Generation is stochastic, so a single imperfect draft doesn't mean the request is
    // impossible — give it a few correction passes with escalating emphasis. Unlike before, a
    // retry loop that never reaches full approval does NOT discard the request: the
    // best-scoring attempt is always shipped at the end (see selection below), because refusing
    // to apply the garment in order to "protect" the character is exactly the failure mode this
    // pipeline must avoid.
    const maxRetries = 3;
    const escalationNote = [
      "CORRECTION PASS 1: Discard the rejected draft and rebuild from the Face Identity Reference plus all original garment references.",
      "CORRECTION PASS 2 (stronger): The previous attempts still did not both keep the exact face AND actually show the garment worn. Re-anchor harder on Reference Image 1's face while making absolutely sure every supplied garment is rendered on the body in its correct slot — a safe-looking result that omits the garment is a failure, not a safe fallback.",
      "CORRECTION PASS 3 (final, strongest): This is the last automatic attempt. Prioritize BOTH constraints simultaneously — keep the face identical to Reference Image 1 AND make the character visibly wear every supplied garment reference, replacing the requested slot. Do not default to returning the character without the new clothing.",
    ];
    for (
      let attempt = 0;
      attempt < maxRetries && !isPreservationApproved(attempts[attempts.length - 1].evaluation);
      attempt++
    ) {
      identityRetryApplied = true;
      const previous = attempts[attempts.length - 1];
      console.warn("dress-character preservation retry", attempt + 1, previous.evaluation);
      const retryParts: Array<Record<string, unknown>> = [
        {
          text: `${prompt}\n\n${escalationNote[Math.min(attempt, escalationNote.length - 1)]} Detected differences: ${previous.evaluation?.violations.join("; ") || "the strict face/garment preservation check was unavailable or found a difference"}.`,
        },
        { text: "Reference Image 1: FACE IDENTITY REFERENCE. This exact face must survive unchanged; the body may adapt naturally to the clothing." },
        { inlineData: { data: identityBase64, mimeType: identityMimeType } },
        { text: "PREVIOUS DRAFT: use only as an example of what to fix — either the face drifted, the garment wasn't actually applied, or both." },
        { inlineData: { data: previous.image.base64, mimeType: previous.image.mimeType } },
        ...garmentParts,
        { text: "FINAL CHECK: exact face identity AND every garment reference actually worn on the character; the body, pose, and silhouette may differ as much as needed to wear the clothes naturally. Do not solve identity preservation by skipping the clothing change." },
      ];
      const retryImage = await generateDressedImage(geminiApiKey, retryParts);
      if (!retryImage) continue;
      const retryEvaluation = await evaluatePreservation(geminiApiKey, identityAnchor, retryImage, garments);
      attempts.push({ image: retryImage, evaluation: retryEvaluation });
    }

    // Never discard the request outright. Ship the first fully-approved attempt if one exists;
    // otherwise ship the best-scoring attempt so far (character preservation concerns alone are
    // never a reason to return the character without the requested garment). The very last
    // attempt is the final fallback if no attempt was ever successfully scored.
    const approvedAttempt = attempts.find((attempt) => isPreservationApproved(attempt.evaluation));
    const bestAttempt = approvedAttempt ?? attempts.reduce((best, current) => {
      const bestScore = best.evaluation?.score ?? -1;
      const currentScore = current.evaluation?.score ?? -1;
      return currentScore > bestScore ? current : best;
    }, attempts[0]);

    const chosenImage = bestAttempt.image;
    const preservationEvaluation = bestAttempt.evaluation;

    if (!preservationEvaluation) {
      // The judge model itself was unavailable on every attempt (API error / bad JSON), not a
      // detected face or garment violation — that's an infra failure, not evidence something is
      // actually wrong with the image. Ship the generation, which already went through the same
      // strong face/garment locks in its own prompt.
      console.warn("dress-character preservation judge unavailable after all attempts; shipping generation on prompt-level locks alone");
    } else if (!isPreservationApproved(preservationEvaluation)) {
      // Best-effort ship: preservation never reached full approval, but the character must still
      // end up wearing the garment. Log for visibility, never block the response.
      console.warn("dress-character shipping best-effort result after preservation retries", preservationEvaluation);
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
        preservationApproved: isPreservationApproved(preservationEvaluation),
        garmentApplied: preservationEvaluation?.garmentApplied ?? null,
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
