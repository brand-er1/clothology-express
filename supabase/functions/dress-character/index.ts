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
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
};
const extensionForMimeType = (mimeType: string) => mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
const stripDataUrlPrefix = (value: string) => value.replace(/^data:image\/[^;]+;base64,/, "");

interface GarmentInput { slot: ClosetSlot; label?: string; base64: string; mimeType: string; }
interface GeneratedImage { base64: string; mimeType: string; textResponse: string; }
interface PreservationEvaluation { score: number; characterMatch: boolean; garmentMatch: boolean; violations: string[]; }
const isPreservationApproved = (evaluation: PreservationEvaluation | null) => Boolean(evaluation && evaluation.score === 1 && evaluation.characterMatch && evaluation.garmentMatch && evaluation.violations.length === 0);

const generateDressedImage = async (geminiApiKey: string, parts: Array<Record<string, unknown>>): Promise<GeneratedImage | null> => {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${geminiApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0, responseModalities: ["IMAGE", "TEXT"], imageConfig: { aspectRatio: "3:4", imageSize: "1K" } },
    }),
  });
  if (!response.ok) { console.error("dress-character Gemini error", response.status, await response.text()); return null; }
  const data = await response.json();
  const responseParts = data?.candidates?.[0]?.content?.parts || [];
  let base64 = ""; let mimeType = "image/png"; let textResponse = "";
  for (const part of responseParts) {
    if (part.inlineData?.data && !base64) { base64 = part.inlineData.data; mimeType = part.inlineData.mimeType || "image/png"; }
    if (part.text) textResponse += part.text;
  }
  return base64 ? { base64, mimeType, textResponse } : null;
};

const evaluatePreservation = async (geminiApiKey: string, identityAnchor: { base64: string; mimeType: string }, candidate: { base64: string; mimeType: string }, garments: GarmentInput[]): Promise<PreservationEvaluation | null> => {
  try {
    const garmentReferenceParts: Array<Record<string, unknown>> = [];
    garments.forEach((garment, index) => garmentReferenceParts.push({ text: `GARMENT REFERENCE ${index + 1} — ${slotDescriptionEn[garment.slot]}` }, { inlineData: { data: garment.base64, mimeType: garment.mimeType } }));
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [
        { text: `Perform a strict fail-closed identity comparison. IMAGE A is the canonical immutable character. IMAGE B is the candidate wearing the supplied garment references. The candidate must preserve A's exact face, eyes, expression, head, hair, skin/face color, body proportions, limb lengths, hands, feet, pose, camera, crop, background, lighting, and render style. It must also preserve every supplied garment's exact color, silhouette, fit, length, logo, graphic, print, pattern, seams, pockets, zipper, buttons, hood, collar, sleeve shape, material, and construction. Natural folds and occlusion needed to wear it are allowed, but redesign is not. Set characterMatch or garmentMatch to false if there is any visible doubt. Return JSON only: {"score":0.0,"characterMatch":false,"garmentMatch":false,"violations":["short concrete difference"]}. Score 1.0 only when both the character identity and every garment identity are effectively exact.` },
        { text: "IMAGE A — CANONICAL IMMUTABLE CHARACTER IDENTITY" }, { inlineData: { data: identityAnchor.base64, mimeType: identityAnchor.mimeType } }, ...garmentReferenceParts,
        { text: "IMAGE B — FINAL CLOTHING EDIT TO CHECK" }, { inlineData: { data: candidate.base64, mimeType: candidate.mimeType } },
      ] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const responseText = (data?.candidates?.[0]?.content?.parts || []).map((part: { text?: string }) => part.text || "").join("").trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(responseText); const score = Number(parsed?.score); if (!Number.isFinite(score)) return null;
    return { score: Math.min(1, Math.max(0, score)), characterMatch: parsed?.characterMatch === true, garmentMatch: parsed?.garmentMatch === true, violations: Array.isArray(parsed?.violations) ? parsed.violations.map((item: unknown) => String(item)).slice(0, 6) : [] };
  } catch (error) { console.warn("dress-character preservation evaluation failed", error); return null; }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
    const requestData = await req.json();
    const { characterGender, characterImage, identityImage, garments: rawGarments, changedSlots: rawChangedSlots, userId } = requestData || {};
    const gender: CharacterGender = characterGender === "female" ? "female" : "male";
    const characterBase64 = stripDataUrlPrefix(String(characterImage?.base64 || "")); const characterMimeType = String(characterImage?.mimeType || "");
    if (!characterBase64 || !supportedImageMimeTypes.has(characterMimeType)) return new Response(JSON.stringify({ error: "캐릭터 참조 이미지가 필요합니다." }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    const identityBase64 = stripDataUrlPrefix(String(identityImage?.base64 || characterBase64)); const identityMimeType = String(identityImage?.mimeType || characterMimeType);
    if (!identityBase64 || !supportedImageMimeTypes.has(identityMimeType)) return new Response(JSON.stringify({ error: "캐릭터 원본 기준 이미지가 필요합니다." }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    const garments: GarmentInput[] = Array.isArray(rawGarments) ? rawGarments.filter((item: unknown) => item && typeof item === "object").map((item: Record<string, unknown>) => ({ slot: validSlots.has(item.slot as ClosetSlot) ? item.slot as ClosetSlot : "top", label: typeof item.label === "string" ? item.label : undefined, base64: stripDataUrlPrefix(String((item.image as Record<string, unknown>)?.base64 || item.base64 || "")), mimeType: String((item.image as Record<string, unknown>)?.mimeType || item.mimeType || "") })).filter((item) => item.base64 && supportedImageMimeTypes.has(item.mimeType)) : [];
    const explicitlyChangedSlots: ClosetSlot[] = Array.isArray(rawChangedSlots) ? rawChangedSlots.filter((slot: unknown): slot is ClosetSlot => validSlots.has(slot as ClosetSlot)) : [];
    const slotsInThisRequest = Array.from(new Set([...explicitlyChangedSlots, ...garments.map((garment) => garment.slot)]));
    if (garments.length === 0 && slotsInThisRequest.length === 0) return new Response(JSON.stringify({ error: "변경할 의류 슬롯이나 의류 이미지가 필요합니다." }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    if (garments.length > 5) return new Response(JSON.stringify({ error: "한 번에 입힐 수 있는 의류는 최대 5개입니다." }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    if (new Set(garments.map((garment) => garment.slot)).size !== garments.length) return new Response(JSON.stringify({ error: "같은 슬롯에는 하나의 의류만 선택할 수 있습니다. 새 의류로 교체해주세요." }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    const totalBytes = characterBase64.length + identityBase64.length + garments.reduce((sum, g) => sum + g.base64.length, 0);
    if (totalBytes > 30 * 1024 * 1024) return new Response(JSON.stringify({ error: "이미지 용량이 너무 큽니다." }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });

    const characterIdentityRules = gender === "female" ? "This is the FEMALE BRAND-ER mascot: solid black face, large round white eyes, visible eyelashes (her signature distinguishing feature), her existing hair, and her existing body proportions and hand shape." : "This is the MALE BRAND-ER mascot: solid black face, large round white eyes, and his existing body proportions and hand shape.";
    const hasHat = garments.some((garment) => garment.slot === "accessory" && /hat|cap|beanie|bucket|모자|캡|비니|버킷/i.test(garment.label || ""));
    const garmentList = garments.map((garment, index) => `Reference Image ${index + 2} (${slotDescriptionEn[garment.slot]}${garment.label ? `, "${garment.label}"` : ""}): garment to render on the character in the ${garment.slot} slot.`).join("\n");
    const slotsSentence = slotsInThisRequest.map((slot) => slotDescriptionEn[slot]).join(", ");
    const clearedSlots = slotsInThisRequest.filter((slot) => !garments.some((garment) => garment.slot === slot));
    const clearedSlotsInstruction = clearedSlots.length ? `Leave these empty slots bare exactly as they appear on the canonical character (${clearedSlots.map((slot) => slotDescriptionEn[slot]).join(", ")}). Do not retain or invent an item in them.` : "";
    const prompt = `EDIT Reference Image 1. This is a tightly constrained CLOTHING-ONLY image edit, not a request to create, redraw, or reinterpret the scene.\n\nReference Image 1 is the one and only canonical immutable BRAND-ER character identity anchor. ${characterIdentityRules}\n\nIMMUTABLE CHARACTER LOCK — HIGHEST PRIORITY:\n- Preserve the exact identity of the provided character. The output must visibly be Reference Image 1 with only the requested wardrobe applied, never a new character inspired by it.\n- Preserve exactly: black face color, eyes, eye spacing and shape, eyelashes when present, expression, head outline, hair/headwear not explicitly replaced, neck, body proportions, limb length and thickness, hands, fingers, feet, pose, gender presentation, camera angle, crop, scale, framing, lighting, background, and overall 3D render style.\n- Keep all visible uncovered character regions as close to pixel-identical to Reference Image 1 as generatively possible.\n- Do not redesign, reinterpret, regenerate, beautify, humanize, age, recolor, reshape, rotate, mirror, or replace the character. Never add or remove a facial feature or limb.\n- Do not change the character to fit a garment. If proportions conflict, tailor and drape the GARMENT to the unchanged character body.\n${hasHat ? "- HEADWEAR: place the exact referenced hat on the existing canonical head. Never change head size/shape, face, eyes, hairline, body, pose, or character identity to fit the hat." : ""}\n\nWARDROBE COMPOSITION LOCK — SAME PRIORITY:\n- Build the complete wardrobe only from the garment references supplied in this request: ${slotsSentence}.\n- References in the same slot are replacements, never stacked. A new TOP entirely replaces the old TOP. OUTER may layer naturally over TOP; no other implicit layering is allowed.\n- Never carry clothing forward from a previous generated result and never invent clothing for an empty slot.\n\n${garmentList || "No garment reference is supplied."}\n${clearedSlotsInstruction}\n\nTASK: Starting only from canonical Reference Image 1, make the exact same character naturally wear every supplied garment reference at once. Make each garment genuinely wrap around the locked body with natural fit, drape, folds, seams, occlusion, and contact shadows. Garment realism must come from adapting the clothing, never from changing the character.\n\nClothing identity lock: preserve every garment's exact type, silhouette, color, logo/graphic, pattern, pockets, zippers, hood, sleeves, hem, fabric texture, fit, proportions, length, construction, seams, buttons, collar and material feel. Do not invent new design details.\n\nOUTPUT: Return exactly ONE edited full-body image. No before/after split, comparison layout, caption, watermark, extra person, prop, or text overlay. Preserve Reference Image 1's background, camera, pose, framing, and character identity.`;
    const garmentParts: Array<Record<string, unknown>> = [];
    garments.forEach((garment, index) => garmentParts.push({ text: `Reference Image ${index + 2}: EXACT GARMENT IDENTITY for ${slotDescriptionEn[garment.slot]}.` }, { inlineData: { data: garment.base64, mimeType: garment.mimeType } }));
    const generationParts: Array<Record<string, unknown>> = [{ text: prompt }, { text: "Reference Image 1: CANONICAL IMMUTABLE CHARACTER. This is always the sole character source." }, { inlineData: { data: identityBase64, mimeType: identityMimeType } }, ...garmentParts, { text: "FINAL LOCK: exact same face, eyes, head, body, pose, hands, feet, style, camera, framing, lighting, and background as Reference Image 1; exact garment design from every garment reference. Change clothing only." }];
    const chosenImage = await generateDressedImage(geminiApiKey, generationParts);
    if (!chosenImage) throw new Error("Gemini did not return an image");
    const preservationEvaluation = await evaluatePreservation(geminiApiKey, { base64: identityBase64, mimeType: identityMimeType }, chosenImage, garments);
    if (!isPreservationApproved(preservationEvaluation)) return new Response(JSON.stringify({ error: "캐릭터 또는 의류 원본이 조금이라도 달라질 가능성이 있어 결과를 폐기했습니다. 기존 이미지는 그대로 유지됩니다." }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 422 });
    const bytes = decodeBase64Image(chosenImage.base64); const extension = extensionForMimeType(chosenImage.mimeType); const fileName = `${userId || "anon"}/closet/${Date.now()}_${crypto.randomUUID()}.${extension}`;
    const { data: uploadData, error: uploadError } = await supabase.storage.from('generated_images').upload(fileName, bytes, { contentType: chosenImage.mimeType, upsert: false }); if (uploadError) throw uploadError;
    const { data: publicUrlData } = supabase.storage.from('generated_images').getPublicUrl(uploadData?.path || fileName);
    return new Response(JSON.stringify({ success: true, textResponse: chosenImage.textResponse, renderedImageUrl: publicUrlData?.publicUrl, renderedImagePath: uploadData?.path || fileName, hasImage: Boolean(publicUrlData?.publicUrl), identityScore: preservationEvaluation.score, preservationPassed: true, identityRetryApplied: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Unexpected error in dress-character:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});
