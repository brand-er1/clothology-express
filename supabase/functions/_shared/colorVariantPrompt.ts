/**
 * Prompt for a color variant of an existing garment image (컬러 옵션별 상품 이미지).
 * The model edits the creator's own garment image: only the base fabric color changes —
 * design, construction, artwork placement/size and fabric realism stay identical.
 */

export type ColorVariantView = "front" | "back";

export type ColorVariantPromptInput = {
  targetColorName: string;
  targetHex?: string | null;
  baseColorName?: string | null;
  view: ColorVariantView;
  /** composite = reference shows front (left) + back (right) in one frame; single = only the requested view. */
  referenceLayout: "composite" | "single";
  clothType?: string | null;
};

export const COLOR_VARIANT_ASPECT_RATIO = "4:5";

const clean = (value: string | null | undefined, max = 40) => (value ?? "").replace(/[\r\n"`]/g, " ").trim().slice(0, max);

export const buildColorVariantPrompt = (input: ColorVariantPromptInput) => {
  const target = clean(input.targetColorName) || "the requested color";
  const hex = input.targetHex && /^#[0-9A-Fa-f]{6}$/.test(input.targetHex) ? ` (approximately ${input.targetHex.toUpperCase()})` : "";
  const base = clean(input.baseColorName);
  const garment = clean(input.clothType, 30) || "garment";
  const side = input.view === "front" ? "FRONT" : "BACK";
  const half = input.view === "front" ? "LEFT" : "RIGHT";

  return [
    `TASK: Produce a realistic product photo of the SAME ${garment} shown in REFERENCE IMAGE 1, recolored to ${target}${hex}.`,
    base ? `The reference garment's current main fabric color is ${base}.` : "",
    input.referenceLayout === "composite"
      ? `VIEW: REFERENCE IMAGE 1 shows the garment front on the LEFT and the back on the RIGHT. Use the ${half} half as the source and output ONLY the ${side} view, as a single garment.`
      : `VIEW: REFERENCE IMAGE 1 is the ${side} view. Output the same ${side} view.`,
    "KEEP EXACTLY THE SAME: silhouette, fit, proportions, length, neckline/collar, sleeves, cuffs, hem, pockets, zippers, buttons, drawstrings, panels, seams, stitching lines and ribbing.",
    "KEEP EVERY logo, graphic, print, embroidery, patch and label in the same position, size, shape and in its own original colors. Do not add, remove, move, resize or redraw any artwork or text.",
    `CHANGE ONLY the base fabric color to ${target}. Trims that match the fabric color (ribbing, drawcords, zipper tape, lining edges) follow the new color; contrast trims keep their original color.`,
    "REALISM: keep the fabric texture/knit, folds, wrinkles, shadows, highlights and sheen. It must look like the garment was actually dyed in the new color — never a flat color overlay or tint.",
    "PRESENTATION: same camera angle and framing as the reference view, full garment visible and centered, plain light neutral studio background, soft even lighting. No model, no mannequin, no props, no added text, no watermark, no color swatches.",
    `Output exactly one image, aspect ratio ${COLOR_VARIANT_ASPECT_RATIO}.`,
  ]
    .filter(Boolean)
    .join("\n");
};
