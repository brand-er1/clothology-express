import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';

// AI Virtual Fitting — BRAND-ER's human-shaped mannequin try-on pipeline. This is the successor to
// dress-character: instead of dressing a cartoon mascot, it composites a user's garment reference(s)
// onto a fixed gender+body-size mannequin preset, so a visitor can compare how the SAME garment
// actually fits across every Korean apparel size before committing to production. dress-character is
// left in place for any caller that still depends on it; all new closet/virtual-fitting UI calls this
// function instead.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ClosetSlot = "top" | "outer" | "bottom" | "skirt" | "dress" | "shoes" | "accessory";
type Gender = "male" | "female";
type FitType = "oversize" | "semi_oversize" | "regular" | "slim";

const validSlots = new Set<ClosetSlot>(["top", "outer", "bottom", "skirt", "dress", "shoes", "accessory"]);
const supportedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const validFitTypes = new Set<FitType>(["oversize", "semi_oversize", "regular", "slim"]);

const slotDescriptionEn: Record<ClosetSlot, string> = {
  top: "top garment (shirt, hoodie, sweatshirt, knit, or similar upper-body clothing)",
  outer: "outer layer (jacket or coat, worn over the top garment)",
  bottom: "bottom garment (pants, leggings, or similar lower-body clothing)",
  skirt: "skirt",
  dress: "one-piece dress (covers torso and legs in a single garment)",
  shoes: "footwear",
  accessory: "accessory or other worn item (bag, hat, or similar)",
};

// Reviewed, fixed body-shape descriptions per gender+size preset — duplicated here (not trusted from
// the client) so the AI prompt's identity/body-shape lock can never be altered by a tampered request.
// Keep in sync with src/lib/mannequin-presets.ts.
const bodyDescriptionByKey: Record<string, string> = {
  "female-44": "the slimmest female body preset: narrow shoulders, slim chest/waist/hip, slender arms and legs",
  "female-55": "a slim-to-standard female body preset: close to the average reference silhouette",
  "female-66": "a standard-to-fuller female body preset: slightly more volume through chest, waist, hip, arms and legs than the 55 preset",
  "female-77": "a fuller female body preset: noticeably more volume through shoulders, chest, waist, hip, arms and legs than the 66 preset, still a natural, realistic body — never exaggerated or unrealistic",
  "male-l": "a standard male body preset: average shoulder, chest, waist, arm and leg proportions",
  "male-xl": "a slightly fuller male body preset: somewhat broader shoulders, chest, waist, arms and legs than the L preset",
  "male-2xl": "a fuller male body preset: noticeably broader upper and lower body volume than the XL preset, still a natural, realistic body — never exaggerated or unrealistic",
};

const femaleSizes = new Set(["44", "55", "66", "77"]);
const maleSizes = new Set(["l", "xl", "2xl"]);

const fitTypeGuidance: Record<FitType, string> = {
  oversize: "OVERFIT: generous ease through chest/shoulder/waist, a roomy relaxed drape, sleeves/legs sitting loose around the limb, longer relaxed hem.",
  semi_oversize: "SEMI-OVERFIT: modest extra ease beyond the body line — relaxed but not baggy, a soft (not tight) drape.",
  regular: "REGULAR FIT: follows the body's natural line with balanced, even ease — neither tight nor loose.",
  slim: "SLIM FIT: close-fitting silhouette that follows the body closely, minimal ease, fitted sleeves/legs.",
};

const fabricStretchGuidance: Record<string, string> = {
  none: "no stretch — the fabric holds its cut rigidly and shows pulling/strain lines wherever the body pushes against it",
  low: "low stretch — the fabric flexes only slightly with the body",
  medium: "medium stretch — the fabric moves naturally with the body without visible strain",
  high: "high stretch — the fabric hugs and moves with the body smoothly, minimal pulling even where fitted",
};
const fabricThicknessGuidance: Record<string, string> = {
  thin: "thin fabric — soft, light folds, closely follows the body's contour",
  medium: "medium-weight fabric — moderate structure and fold depth",
  thick: "thick fabric — visible structure and bulk, fewer/larger folds",
};
const fabricDrapeGuidance: Record<string, string> = {
  stiff: "stiff drape — holds its shape with sharp, angular folds",
  medium: "medium drape — natural, moderate folds",
  fluid: "fluid drape — soft, flowing folds that move with the body",
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

interface Measurements {
  totalLength?: number;
  shoulderWidth?: number;
  chestWidth?: number;
  waistWidth?: number;
  hemWidth?: number;
  sleeveLength?: number;
  bottomWaist?: number;
  bottomHip?: number;
  bottomRise?: number;
  bottomThigh?: number;
  bottomHem?: number;
  bottomLength?: number;
}

interface FitInfo {
  baseSize?: string;
  fitType?: FitType;
  measurements?: Measurements;
  fabricStretch?: string;
  fabricThickness?: string;
  fabricDrape?: string;
  hasMeasurements: boolean;
}

interface GarmentInput {
  slot: ClosetSlot;
  label?: string;
  base64: string;
  mimeType: string;
  backBase64?: string;
  backMimeType?: string;
  fitInfo: FitInfo;
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
  sceneMatch: boolean;
  violations: string[];
}

const PRESERVATION_SCORE_THRESHOLD = 0.9;

const isPreservationApproved = (evaluation: PreservationEvaluation | null) =>
  Boolean(
    evaluation &&
      evaluation.score >= PRESERVATION_SCORE_THRESHOLD &&
      evaluation.faceMatch &&
      evaluation.garmentMatch &&
      evaluation.garmentApplied &&
      evaluation.sceneMatch,
  );

const measurementsSentence = (slot: ClosetSlot, m: Measurements): string => {
  const parts: string[] = [];
  const push = (label: string, value: number | undefined, unit = "cm") => {
    if (typeof value === "number" && Number.isFinite(value)) parts.push(`${label} ${value}${unit}`);
  };
  push("total length", m.totalLength);
  push("shoulder width", m.shoulderWidth);
  push("chest width", m.chestWidth);
  push("waist width", m.waistWidth);
  push("hem width", m.hemWidth);
  push("sleeve length", m.sleeveLength);
  push("waist", m.bottomWaist);
  push("hip", m.bottomHip);
  push("rise", m.bottomRise);
  push("thigh width", m.bottomThigh);
  push("leg opening/hem", m.bottomHem);
  push("length", m.bottomLength);
  if (parts.length === 0) return "";
  return `Real measurements for this ${slotDescriptionEn[slot]} (highest priority — reflect these exactly over any general fit-type assumption): ${parts.join(", ")}.`;
};

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
    console.error("virtual-fitting Gemini error", response.status, bodyText);
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
              text: `Compare IMAGE A (the Mannequin/Face Identity Reference — the fixed BRAND-ER mannequin in its base pose) and IMAGE B (the candidate wearing a different, deliberately requested set of garments). This is a clothing swap on a fixed-identity mannequin — the garments and how they drape are SUPPOSED to differ; only specific things below count as violations.

faceMatch: judge ONLY the face — face shape, features, eyes, expression, hairstyle, skin tone. false only for a genuinely different face/identity (a different person), not for minor rendering noise.

sceneMatch: judge pose, camera angle/distance, background, and lighting — false only if any of these visibly changed from IMAGE A. Body-shape volume changing to fit the garment is fine; the mannequin's stance, the framing, backdrop and light direction/color should not change.

garmentApplied: for EVERY garment reference image supplied below, confirm it is actually, visibly worn on the mannequin in IMAGE B, on the correct body region, replacing whatever previously occupied that slot. False if IMAGE B looks like the untouched reference, a garment is missing, or the wrong slot was rendered.

garmentMatch: judge design fidelity separately from whether it was applied — preserve each garment's exact color, silhouette, logo, graphic, print, pattern, seams, pockets, zipper, buttons, hood, collar, sleeve/leg shape, and material. Natural folds/occlusion from being worn are fine; redesigning the garment is not.

Return JSON only: {"score":0.0,"faceMatch":false,"garmentMatch":false,"garmentApplied":false,"sceneMatch":false,"violations":["short concrete difference"]}. Score 1.0 when identity, pose/camera/background/lighting, and every supplied garment (applied + faithfully rendered) are all preserved.`,
            },
            { text: "IMAGE A — MANNEQUIN / FACE IDENTITY REFERENCE" },
            { inlineData: { data: identityAnchor.base64, mimeType: identityAnchor.mimeType } },
            ...garmentReferenceParts,
            { text: "IMAGE B — FINAL VIRTUAL FITTING RESULT TO CHECK" },
            { inlineData: { data: candidate.base64, mimeType: candidate.mimeType } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    });

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
        console.warn("virtual-fitting preservation model failed", model, response.status, await response.text());
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
          sceneMatch: parsed?.sceneMatch === true,
          violations: Array.isArray(parsed?.violations)
            ? parsed.violations.map((item: unknown) => String(item)).slice(0, 6)
            : [],
        };
      } catch (parseError) {
        console.warn("virtual-fitting preservation JSON parse failed", model, parseError);
        continue;
      }
    }
    return null;
  } catch (error) {
    console.warn("virtual-fitting preservation evaluation failed", error);
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
      requestId: rawRequestId,
      gender: rawGender,
      mannequinSize: rawMannequinSize,
      identityImage,
      garments: rawGarments,
      changedSlots: rawChangedSlots,
      userId,
    } = requestData || {};

    const requestId = typeof rawRequestId === "string" && rawRequestId.trim() ? rawRequestId.trim().slice(0, 128) : null;

    // --- Idempotency: claim the request id before doing any generation work. A second call with the
    // same request id (double-click, retry-after-timeout) either returns the cached result or a
    // "already processing" response — it never runs the expensive pipeline twice. ---
    if (requestId) {
      const { data: existing } = await supabase
        .from("virtual_fitting_requests")
        .select("status, result")
        .eq("request_id", requestId)
        .maybeSingle();
      if (existing?.status === "done" && existing.result) {
        return new Response(
          JSON.stringify({ ...existing.result, duplicate: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (existing?.status === "processing") {
        return new Response(
          JSON.stringify({ error: "이미 같은 요청을 처리하고 있어요. 잠시 후 다시 시도해주세요.", processing: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 },
        );
      }
      const { error: claimError } = await supabase
        .from("virtual_fitting_requests")
        .insert({ request_id: requestId, status: "processing" });
      if (claimError) {
        // Unique-violation race: someone else claimed it a moment ago — treat as "already processing".
        return new Response(
          JSON.stringify({ error: "이미 같은 요청을 처리하고 있어요. 잠시 후 다시 시도해주세요.", processing: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 },
        );
      }
    }

    const failRequest = async (body: Record<string, unknown>, status: number) => {
      if (requestId) {
        await supabase.from("virtual_fitting_requests").delete().eq("request_id", requestId);
      }
      return new Response(JSON.stringify(body), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      });
    };

    const gender: Gender = rawGender === "female" ? "female" : "male";
    const mannequinSize = String(rawMannequinSize || "").toLowerCase();
    const validSize = gender === "female" ? femaleSizes.has(mannequinSize) : maleSizes.has(mannequinSize);
    if (!validSize) {
      return failRequest({ error: "유효하지 않은 마네킹 사이즈입니다." }, 400);
    }
    const presetKey = `${gender}-${mannequinSize}`;
    const bodyDescription = bodyDescriptionByKey[presetKey];

    const identityBase64 = stripDataUrlPrefix(String(identityImage?.base64 || ""));
    const identityMimeType = String(identityImage?.mimeType || "");
    if (!identityBase64 || !supportedImageMimeTypes.has(identityMimeType)) {
      return failRequest({ error: "마네킹/얼굴 기준 이미지가 필요합니다." }, 400);
    }

    const garments: GarmentInput[] = Array.isArray(rawGarments)
      ? rawGarments
        .filter((item: unknown) => item && typeof item === "object")
        .map((item: Record<string, unknown>) => {
          const image = item.image as Record<string, unknown> | undefined;
          const backImage = item.backImage as Record<string, unknown> | undefined;
          const rawFit = (item.fitInfo as Record<string, unknown>) || {};
          const rawMeasurements = (rawFit.measurements as Record<string, unknown>) || {};
          const num = (value: unknown) => {
            const n = Number(value);
            return Number.isFinite(n) ? n : undefined;
          };
          const measurements: Measurements = {
            totalLength: num(rawMeasurements.totalLength),
            shoulderWidth: num(rawMeasurements.shoulderWidth),
            chestWidth: num(rawMeasurements.chestWidth),
            waistWidth: num(rawMeasurements.waistWidth),
            hemWidth: num(rawMeasurements.hemWidth),
            sleeveLength: num(rawMeasurements.sleeveLength),
            bottomWaist: num(rawMeasurements.bottomWaist),
            bottomHip: num(rawMeasurements.bottomHip),
            bottomRise: num(rawMeasurements.bottomRise),
            bottomThigh: num(rawMeasurements.bottomThigh),
            bottomHem: num(rawMeasurements.bottomHem),
            bottomLength: num(rawMeasurements.bottomLength),
          };
          const hasMeasurements = Object.values(measurements).some((value) => typeof value === "number");
          return {
            slot: validSlots.has(item.slot as ClosetSlot) ? (item.slot as ClosetSlot) : "top",
            label: typeof item.label === "string" ? item.label.slice(0, 120) : undefined,
            base64: stripDataUrlPrefix(String(image?.base64 || "")),
            mimeType: String(image?.mimeType || ""),
            backBase64: backImage?.base64 ? stripDataUrlPrefix(String(backImage.base64)) : undefined,
            backMimeType: backImage?.mimeType ? String(backImage.mimeType) : undefined,
            fitInfo: {
              baseSize: typeof rawFit.baseSize === "string" ? rawFit.baseSize.slice(0, 40) : undefined,
              fitType: validFitTypes.has(rawFit.fitType as FitType) ? (rawFit.fitType as FitType) : "regular",
              measurements,
              fabricStretch: typeof rawFit.fabricStretch === "string" ? rawFit.fabricStretch : undefined,
              fabricThickness: typeof rawFit.fabricThickness === "string" ? rawFit.fabricThickness : undefined,
              fabricDrape: typeof rawFit.fabricDrape === "string" ? rawFit.fabricDrape : undefined,
              hasMeasurements,
            },
          };
        })
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
      return failRequest({ error: "변경할 의류 슬롯이나 의류 이미지가 필요합니다." }, 400);
    }
    if (garments.length > 6) {
      return failRequest({ error: "한 번에 입힐 수 있는 의류는 최대 6개입니다." }, 400);
    }
    if (new Set(garments.map((garment) => garment.slot)).size !== garments.length) {
      return failRequest({ error: "같은 슬롯에는 하나의 의류만 선택할 수 있습니다." }, 400);
    }

    const totalBytes = identityBase64.length + garments.reduce((sum, g) => sum + g.base64.length + (g.backBase64?.length || 0), 0);
    if (totalBytes > 40 * 1024 * 1024) {
      return failRequest({ error: "이미지 용량이 너무 큽니다." }, 400);
    }

    const isSimulated = garments.length === 0 || !garments.some((g) => g.fitInfo.hasMeasurements);

    const garmentList = garments
      .map((garment, index) => {
        const ordinal = index + 2;
        const fit = garment.fitInfo;
        const measurementLine = fit.measurements ? measurementsSentence(garment.slot, fit.measurements) : "";
        const fitLine = fit.hasMeasurements
          ? measurementLine
          : `Fit type: ${fitTypeGuidance[fit.fitType || "regular"]}${fit.baseSize ? ` Base size label: "${fit.baseSize}".` : ""}`;
        const fabricLine = [
          fit.fabricStretch ? fabricStretchGuidance[fit.fabricStretch] : null,
          fit.fabricThickness ? fabricThicknessGuidance[fit.fabricThickness] : null,
          fit.fabricDrape ? fabricDrapeGuidance[fit.fabricDrape] : null,
        ].filter(Boolean).join("; ");
        return `Reference Image ${ordinal} (${slotDescriptionEn[garment.slot]}${garment.label ? `, "${garment.label}"` : ""}): garment to render on the mannequin in the ${garment.slot} slot.\n${fitLine}${fabricLine ? ` Fabric: ${fabricLine}.` : ""}`;
      })
      .join("\n\n");

    const slotsSentence = slotsInThisRequest.map((slot) => slotDescriptionEn[slot]).join(", ");
    const clearedSlots = slotsInThisRequest.filter((slot) => !garments.some((garment) => garment.slot === slot));
    const clearedSlotsInstruction = clearedSlots.length > 0
      ? `Leave these empty slots bare exactly as they appear on the base mannequin (${clearedSlots.map((slot) => slotDescriptionEn[slot]).join(", ")}). Do not retain or invent an item in them.`
      : "";
    const replacedSlotsInstruction = garments.length > 0
      ? garments.map((garment) =>
          `REMOVE THE CURRENT ${garment.slot.toUpperCase()} GARMENT AND REPLACE IT WITH THE PROVIDED ${garment.slot.toUpperCase()} GARMENT REFERENCE. Do not leave the old ${garment.slot} in place, and do not layer the new one on top of it.`)
        .join("\n")
      : "";

    const prompt = `
EDIT Reference Image 1. This is a constrained image edit for an AI VIRTUAL FITTING tool: dress the fixed BRAND-ER mannequin in the supplied garment reference(s), on ${bodyDescription}, while keeping identity, pose, camera, background and lighting identical.

Reference Image 1 is both the Mannequin Body Reference for ${gender} size ${mannequinSize.toUpperCase()} and the Face Identity Reference — the highest-priority identity anchor.

THE 8 RULES OF THIS PIPELINE (apply all of them together — none excuses skipping another):
1. Do not change the face or the mannequin's identity in any way.
2. Preserve exactly the body shape for the selected size (${bodyDescription}) — do not slim it down, exaggerate it, or drift toward a different size.
3. Do not change pose, background, camera angle/distance, or lighting.
4. Do not redesign any garment — color, material, logo, graphic, print, pattern, seams, pockets, zipper, buttons, collar, sleeves, hood, hem, and overall construction must stay exactly as supplied.
5. Modify ONLY the slot(s) listed as changed in this request: ${slotsSentence || "(none)"}.
6. Keep every other currently worn garment (any slot not part of this request) exactly as it was.
7. Show only realistic tension/ease/wrinkles/silhouette that would actually result from this garment on this body and fit type — never invent damage, never distort the body to force a look.
8. Return one full-body image, same aspect ratio as Reference Image 1, with nothing cropped (full body and full garments visible).

DO NOT REFUSE TO APPLY THE GARMENT. DO NOT RETURN THE MANNEQUIN WITHOUT THE NEW GARMENT. A render that keeps identity perfect but fails to show the new garment is a FAILED result.

IDENTITY + BODY-SIZE LOCK — HIGHEST PRIORITY:
- Preserve exactly from Reference Image 1: face shape, features, expression, hairstyle, skin tone.
- Preserve the body proportions of this exact size preset: ${bodyDescription}. Never enlarge/shrink height or head size — only the body volume already present in Reference Image 1 matters, and it must not drift toward a slimmer or fuller preset than the one shown.
- Preserve pose (standing, arms and legs in the same position), camera framing/distance/angle, background, and lighting exactly.

GARMENT FIT RENDERING — how the fit-type/measurement info below must show up visually:
- Looser fit types (oversize/semi-oversize) or a smaller/slimmer body relative to the garment's physical size → more visible ease, drape, and looseness around chest/waist/hip/sleeve/leg, a fuller silhouette, less pulling.
- Tighter fit types (slim/regular) or a larger/fuller body relative to the garment's physical size → the garment reads closer to the body, with natural tension lines where it meets a fuller area, less spare fabric.
- The garment's own absolute cut/measurements never change — only how it drapes, pulls, or hangs on THIS specific mannequin body changes. Never simply scale the garment image up or down.

WARDROBE COMPOSITION LOCK:
- Build the complete outfit only from the garment references supplied in this request: ${slotsSentence}.
- References in the same slot are replacements, never stacked. OUTER may layer naturally over TOP; DRESS replaces TOP+BOTTOM+SKIRT entirely; no other implicit layering.
- Never carry clothing forward from a previous generated result and never invent clothing for an empty slot.

${garmentList || "No garment reference is supplied."}
${replacedSlotsInstruction}
${clearedSlotsInstruction}

TASK: Starting only from Reference Image 1, make the mannequin naturally wear every supplied garment reference at once, with fit/drape/tension appropriate to this body size and the garment's stated fit type or real measurements. Garment realism comes from adapting to THIS body, never from changing identity, pose, scene, or the garment's own design.

OUTPUT: Return exactly ONE edited full-body image, same 3:4 aspect ratio, full body visible (no cropping at head/hands/feet), no before/after split, no caption, no watermark, no extra person or prop. Returning Reference Image 1 unchanged, or with the garment missing/only partially applied, is not acceptable.
`.trim();

    const garmentParts: Array<Record<string, unknown>> = [];
    garments.forEach((garment, index) => {
      garmentParts.push(
        { text: `Reference Image ${index + 2}: EXACT GARMENT IDENTITY for ${slotDescriptionEn[garment.slot]} (front view).` },
        { inlineData: { data: garment.base64, mimeType: garment.mimeType } },
      );
      if (garment.backBase64 && garment.backMimeType) {
        garmentParts.push(
          { text: `Back view of the same ${slotDescriptionEn[garment.slot]} — keep logo/pocket/graphic placement on the correct side, not mirrored.` },
          { inlineData: { data: garment.backBase64, mimeType: garment.backMimeType } },
        );
      }
    });

    const generationParts: Array<Record<string, unknown>> = [
      { text: prompt },
      { text: "Reference Image 1: MANNEQUIN + FACE IDENTITY REFERENCE. Always the sole source of identity, body size, pose, scene and lighting." },
      { inlineData: { data: identityBase64, mimeType: identityMimeType } },
      ...garmentParts,
      { text: "FINAL LOCK: exact same identity/body-size/pose/scene as Reference Image 1, and exact garment design from every garment reference, ACTUALLY WORN with realistic fit for this body. Do not solve identity preservation by skipping the clothing change." },
    ];

    const firstImage = await generateDressedImage(geminiApiKey, generationParts);
    if (!firstImage) {
      return failRequest({ error: "이미지를 생성하지 못했습니다. 다시 시도해주세요." }, 502);
    }

    const identityAnchor = { base64: identityBase64, mimeType: identityMimeType };

    interface Attempt {
      image: GeneratedImage;
      evaluation: PreservationEvaluation | null;
    }

    const attempts: Attempt[] = [
      { image: firstImage, evaluation: await evaluatePreservation(geminiApiKey, identityAnchor, firstImage, garments) },
    ];
    let identityRetryApplied = false;

    const maxRetries = 3;
    const escalationNote = [
      "CORRECTION PASS 1: Discard the rejected draft and rebuild from the Mannequin/Face Identity Reference plus all original garment references.",
      "CORRECTION PASS 2 (stronger): The previous attempt still did not preserve identity/body-size/scene AND actually show every garment worn. Re-anchor harder on Reference Image 1 while making sure every supplied garment is rendered on the body in its correct slot.",
      "CORRECTION PASS 3 (final, strongest): This is the last automatic attempt. Prioritize BOTH constraints simultaneously — keep identity/body-size/pose/scene identical to Reference Image 1 AND make the mannequin visibly wear every supplied garment reference, replacing the requested slot(s).",
    ];
    for (
      let attempt = 0;
      attempt < maxRetries && !isPreservationApproved(attempts[attempts.length - 1].evaluation);
      attempt++
    ) {
      identityRetryApplied = true;
      const previous = attempts[attempts.length - 1];
      console.warn("virtual-fitting preservation retry", attempt + 1, previous.evaluation);
      const retryParts: Array<Record<string, unknown>> = [
        {
          text: `${prompt}\n\n${escalationNote[Math.min(attempt, escalationNote.length - 1)]} Detected differences: ${previous.evaluation?.violations.join("; ") || "the strict preservation check was unavailable or found a difference"}.`,
        },
        { text: "Reference Image 1: MANNEQUIN + FACE IDENTITY REFERENCE. This exact identity/body-size/pose/scene must survive unchanged." },
        { inlineData: { data: identityBase64, mimeType: identityMimeType } },
        { text: "PREVIOUS DRAFT: use only as an example of what to fix." },
        { inlineData: { data: previous.image.base64, mimeType: previous.image.mimeType } },
        ...garmentParts,
        { text: "FINAL CHECK: exact identity/body-size/pose/scene AND every garment reference actually worn with realistic fit." },
      ];
      const retryImage = await generateDressedImage(geminiApiKey, retryParts);
      if (!retryImage) continue;
      const retryEvaluation = await evaluatePreservation(geminiApiKey, identityAnchor, retryImage, garments);
      attempts.push({ image: retryImage, evaluation: retryEvaluation });
    }

    const approvedAttempt = attempts.find((attempt) => isPreservationApproved(attempt.evaluation));
    const bestAttempt = approvedAttempt ?? attempts.reduce((best, current) => {
      const bestScore = best.evaluation?.score ?? -1;
      const currentScore = current.evaluation?.score ?? -1;
      return currentScore > bestScore ? current : best;
    }, attempts[0]);

    const chosenImage = bestAttempt.image;
    const preservationEvaluation = bestAttempt.evaluation;

    const generatedImageBase64 = chosenImage.base64;
    const mimeType = chosenImage.mimeType;
    const responseText = chosenImage.textResponse;

    const bytes = decodeBase64Image(generatedImageBase64);
    const extension = extensionForMimeType(mimeType);
    const fileName = `${userId || "anon"}/virtual-fitting/${Date.now()}_${crypto.randomUUID()}.${extension}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('generated_images')
      .upload(fileName, bytes, { contentType: mimeType, upsert: false });

    if (uploadError) {
      console.error("Error uploading virtual fitting image:", uploadError);
      if (requestId) await supabase.from("virtual_fitting_requests").delete().eq("request_id", requestId);
      throw uploadError;
    }

    const { data: publicUrlData } = await supabase.storage
      .from('generated_images')
      .getPublicUrl(uploadData?.path || fileName);

    const responseBody = {
      success: true,
      textResponse: responseText,
      renderedImageUrl: publicUrlData?.publicUrl,
      renderedImagePath: uploadData?.path || fileName,
      hasImage: Boolean(publicUrlData?.publicUrl),
      gender,
      mannequinSize,
      isSimulated,
      requestId,
      faceScore: preservationEvaluation?.score ?? null,
      preservationApproved: isPreservationApproved(preservationEvaluation),
      garmentApplied: preservationEvaluation?.garmentApplied ?? null,
      identityRetryApplied,
    };

    if (requestId) {
      await supabase
        .from("virtual_fitting_requests")
        .update({ status: "done", result: responseBody })
        .eq("request_id", requestId);
    }

    return new Response(
      JSON.stringify(responseBody),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Unexpected error in virtual-fitting:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
