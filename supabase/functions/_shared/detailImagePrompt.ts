/**
 * Prompt engine for AI detail-page images (상세페이지 이미지).
 *
 * Every prompt = image-type template + detail-page style direction + product identity lock
 * (+ optional user instruction). The identity lock is always appended so each generated shot
 * shows the SAME garment as the creator's design; styles only change the photography, never
 * the product. Prompts are built server-side only; the frontend sends the image type, style
 * and instruction, never a prompt string.
 */

export type DetailImageType =
  | "hero"
  | "product_front"
  | "product_back"
  | "detail"
  | "editorial"
  | "lifestyle"
  | "fabric"
  | "mood"
  | "flat_lay"
  | "detail_print"
  | "detail_embroidery"
  | "detail_neck"
  | "detail_cuff"
  | "detail_stitch"
  | "folded"
  | "mannequin"
  | "texture_wide";

export type DetailPageStyle =
  | "minimal"
  | "street"
  | "luxury"
  | "sports"
  | "casual"
  | "vintage"
  | "y2k"
  | "emotional"
  | "lookbook"
  | "editorial"
  | "outdoor";

export const DETAIL_PAGE_STYLES: DetailPageStyle[] = [
  "minimal", "street", "luxury", "sports", "casual", "vintage", "y2k", "emotional", "lookbook", "editorial", "outdoor",
];

export const DETAIL_IMAGE_TYPES: DetailImageType[] = [
  "hero",
  "product_front",
  "product_back",
  "detail",
  "editorial",
  "lifestyle",
  "fabric",
  "mood",
  "flat_lay",
  "detail_print",
  "detail_embroidery",
  "detail_neck",
  "detail_cuff",
  "detail_stitch",
  "folded",
  "mannequin",
  "texture_wide",
];

/** Aspect ratios the image models accept; the client may request one per shot (art direction). */
export const SUPPORTED_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];

export const isSupportedAspectRatio = (value: unknown): value is string =>
  typeof value === "string" && SUPPORTED_ASPECT_RATIOS.includes(value);

export const isDetailImageType = (value: unknown): value is DetailImageType =>
  typeof value === "string" && (DETAIL_IMAGE_TYPES as string[]).includes(value);

export const isDetailPageStyle = (value: unknown): value is DetailPageStyle =>
  typeof value === "string" && (DETAIL_PAGE_STYLES as string[]).includes(value);

/** Product facts the prompt may use (all creator-entered or measured). */
export type PromptProduct = {
  clothType: string;
  color: string;
  material: string;
  fit: string;
  designDescription: string;
  decorations: Array<{ kind: string; label: string; location: string }>;
  accessories: string[];
  constructionFeatures: string[];
  isFrontBackComposite: boolean;
  /** Parts confirmed by the creator in the product analysis (collar, hood, print...). */
  parts: string[];
};

export type BuildProductImagePromptInput = {
  product: PromptProduct;
  /** Labels of the reference images, in the order they are attached to the request. */
  referenceImages: string[];
  imageType: DetailImageType;
  detailPageStyle: DetailPageStyle;
  userInstruction?: string | null;
  aspectRatio?: string;
};

const STYLE_DIRECTION: Record<DetailPageStyle, string> = {
  minimal:
    "Visual direction: clean studio, white and warm-neutral tones, soft diffused daylight, generous negative space, minimal fashion e-commerce editorial.",
  street:
    "Visual direction: urban street editorial — raw concrete, city textures, direct on-camera flash or hard light, high contrast, candid youth-culture energy.",
  luxury:
    "Visual direction: premium fashion editorial — controlled sculpted lighting, muted refined palette, minimal composition, calm and expensive atmosphere.",
  sports:
    "Visual direction: active technical sports campaign — dynamic angles, crisp high-shutter light, athletic movement and energy, clean graphic backgrounds.",
  casual:
    "Visual direction: natural daylight everyday lifestyle — warm soft tones, relaxed real-life settings, approachable warm editorial feel.",
  vintage:
    "Visual direction: vintage film photography — warm faded tones, subtle film grain, retro interiors or aged textures, nostalgic analog mood. Grade the scene, never the garment's own colors.",
  y2k:
    "Visual direction: Y2K fashion editorial — glossy early-2000s pop aesthetic, bold saturated backdrops, chrome/iridescent accents in props or set, playful flash photography.",
  emotional:
    "Visual direction: emotional, poetic mood — soft window light, gentle shadows, quiet intimate settings, muted pastel palette, calm and tender atmosphere.",
  lookbook:
    "Visual direction: seasonal brand lookbook — consistent editorial series look, clean location or studio sets, full-body styling focus, cohesive art direction like a brand campaign book.",
  editorial:
    "Visual direction: independent fashion magazine editorial — considered asymmetric composition, natural window or single-source studio light, muted warm neutrals, quiet confident mood.",
  outdoor:
    "Visual direction: outdoor field campaign — overcast natural daylight, rock, grass, gravel or forest-edge settings, earthy muted palette, honest documentary feel.",
};

/** Aspect ratios supported by the Gemini image models. */
export const IMAGE_ASPECT_RATIO: Record<DetailImageType, string> = {
  hero: "4:5",
  product_front: "4:5",
  product_back: "4:5",
  detail: "1:1",
  editorial: "4:5",
  lifestyle: "3:4",
  fabric: "1:1",
  mood: "16:9",
  flat_lay: "4:5",
  detail_print: "1:1",
  detail_embroidery: "1:1",
  detail_neck: "1:1",
  detail_cuff: "1:1",
  detail_stitch: "1:1",
  folded: "4:5",
  mannequin: "3:4",
  texture_wide: "21:9",
};

const view = (product: PromptProduct, side: "front" | "back") =>
  product.isFrontBackComposite
    ? `The reference is ONE image showing the garment ${side === "front" ? "FRONT on the LEFT half" : "BACK on the RIGHT half"} (the other half shows the ${side === "front" ? "back" : "front"}).`
    : "The reference shows the garment.";

const decorationText = (product: PromptProduct, pattern: RegExp) => {
  const matches = product.decorations.filter((decoration) => pattern.test(`${decoration.kind} ${decoration.label}`));
  return matches.length
    ? ` (${matches.map((decoration) => [decoration.location, decoration.label].filter(Boolean).join(" ")).join(", ")})`
    : "";
};

const TYPE_TEMPLATE: Record<DetailImageType, (product: PromptProduct) => string> = {
  hero: (product) =>
    `Create the HERO key visual of a fashion brand product detail page: a striking campaign-quality image of this ${product.clothType || "garment"} as the single clear subject, like the main visual of a premium online fashion store. The garment's front design must be clearly readable. ${view(product, "front")}`,
  product_front: (product) =>
    `Create a CLEAN PRODUCT SHOT of the garment FRONT: only the garment, neatly laid out or on an invisible ghost mannequin, centered and fully inside the frame, on a clean seamless background with soft even light and a subtle contact shadow. No person, no props, no text. ${view(product, "front")}`,
  product_back: (product) =>
    `Create a CLEAN PRODUCT SHOT of the garment BACK: only the garment seen from behind, neatly laid out or on an invisible ghost mannequin, centered and fully inside the frame, on a clean seamless background with soft even light. Reproduce the back design exactly. No person, no props, no text. ${view(product, "back")}`,
  detail: (product) =>
    `Create a close-up DETAIL SHOT of this garment focusing on its most distinctive visible design element${product.decorations.length ? ` (${product.decorations.map((decoration) => [decoration.location, decoration.label].filter(Boolean).join(" ")).join(", ")})` : " (graphic, neckline, cuff or hem)"}. Macro fashion photography with shallow depth of field. Only show construction, stitching and surface texture that are visible in the reference; do not invent seams, trims, labels, hardware or fabric finishes. ${view(product, "front")}`,
  editorial: (product) =>
    `Create a fashion LOOKBOOK / EDITORIAL image featuring this exact ${product.clothType || "garment"}, styled as a magazine editorial page with considered composition. The garment is the hero of the image and stays fully recognizable. ${view(product, "front")}`,
  lifestyle: (product) =>
    `Create a LIFESTYLE MODEL SHOT: a person naturally wearing this exact ${product.clothType || "garment"} in a real setting, ${product.fit ? `with a ${product.fit} fit, ` : ""}three-quarter or full-length framing so the whole garment is visible. The worn garment must be the same product, not a similar one: same color, graphics and their placement, logos, pockets, hood, zipper, sleeves and length. No visible brand names other than those in the reference. ${view(product, "front")}`,
  fabric: (product) =>
    `Create a FABRIC TEXTURE close-up of this garment's material${product.material ? ` (${product.material})` : ""}, filling the frame with the fabric surface in the garment's exact color, soft raking light to show texture. Show only texture plausible from the reference; do not depict technical features (coatings, membranes, perforations) that are not stated.`,
  flat_lay: (product) =>
    `Create a FLAT LAY image: this exact ${product.clothType || "garment"} laid flat and neatly arranged on a floor or studio surface, shot from directly above, whole garment visible with natural folds and a soft realistic shadow. Minimal styling props are allowed at the edges only; the garment stays the clear subject. ${view(product, "front")}`,
  detail_print: (product) =>
    `Create a MACRO CLOSE-UP of the PRINTED GRAPHIC on this garment${decorationText(product, /print|프린/i)}: fill most of the frame with the print, shot at a slight angle so the ink sits naturally on the knit/weave with visible fabric texture through and around it. Reproduce the artwork exactly (shapes, colors, text) — do not redraw, restyle or add graphics. ${view(product, "front")}`,
  detail_embroidery: (product) =>
    `Create a MACRO CLOSE-UP of the EMBROIDERY on this garment${decorationText(product, /embroider|자수/i)}: raking side light showing raised thread texture and individual stitches, fabric weave around it. Reproduce the embroidered design exactly; do not add or change any stitched element. ${view(product, "front")}`,
  detail_neck: (product) =>
    `Create a CLOSE-UP of the ${product.parts.includes("hood") ? "HOOD opening and neckline" : product.parts.includes("collar") ? "COLLAR" : "NECKLINE"} of this garment, cropped tightly around that area with natural folds, showing its real construction as it appears in the reference (rib, binding, drawcords only if visible). ${view(product, "front")}`,
  detail_cuff: (product) =>
    `Create a CLOSE-UP of the ${product.parts.includes("cuff") ? "SLEEVE CUFF" : "HEM"} of this garment, laid naturally with a soft fold, showing the real edge finish and fabric texture as it appears in the reference. ${view(product, "front")}`,
  detail_stitch: (product) =>
    `Create a MACRO CLOSE-UP of a SEAM of this garment (e.g. shoulder or side seam) showing realistic, slightly imperfect stitching and fabric grain. Show only seam types visible in the reference — no decorative topstitching, piping or contrast thread that is not there. ${view(product, "front")}`,
  folded: (product) =>
    `Create a FOLDED PRODUCT image: this exact ${product.clothType || "garment"} neatly folded in a retail fold on a clean surface, front graphic or key design element visible on the top panel, soft natural shadow, slight top-down angle. ${view(product, "front")}`,
  mannequin: (product) =>
    `Create a MANNEQUIN SHOT: this exact ${product.clothType || "garment"} on a plain matte dress form / headless mannequin in a studio, full garment visible from shoulders to hem, ${product.fit ? `showing a ${product.fit} fit, ` : ""}natural drape and gravity folds. No person, no face. ${view(product, "front")}`,
  texture_wide: (product) =>
    `Create a WIDE FABRIC TEXTURE crop: a panoramic close-up across the surface of this garment's fabric${product.material ? ` (${product.material})` : ""} in its exact color, gentle folds and raking light revealing the weave or knit, shallow depth of field at the edges. Only texture plausible from the reference; no coatings, membranes or technical features.`,
  mood: (product) =>
    `Create a BRAND MOOD image expressing the concept of this ${product.clothType || "garment"}: atmospheric, wide composition where the garment appears naturally (folded, hanging or worn) and stays recognizable. Evoke the product's attitude through setting, light and color, without adding text or logos. ${view(product, "front")}`,
};

/**
 * Real-photography rules: what separates a brand's product shoot from a typical AI render.
 * Applied to every shot.
 */
export const PHOTO_REALISM = [
  "PHOTOGRAPHIC REALISM (must look like a real fashion brand photo shoot, not a 3D or AI render):",
  "- natural fabric behaviour: real gravity folds and soft wrinkles where fabric bends, no vacuum-smooth surfaces",
  "- true fabric texture: visible knit or weave, slight fibre fuzz on cotton/fleece, matte finish",
  "- realistic seams: straight but human stitching, seam allowances and rib transitions that match the reference",
  "- real studio or daylight lighting with soft natural shadows and a believable contact shadow",
  "- subtle natural film/sensor grain, true-to-life color, moderate contrast",
  "- NO HDR look, NO glossy or plastic-looking fabric, NO waxy sheen, NO over-sharpening, NO CGI perfection",
  "- minimal props; nothing that competes with the garment; no text overlays",
].join("\n");

const identityLock = (product: PromptProduct) => {
  const facts = [
    product.clothType && `garment type: ${product.clothType}`,
    product.color && `color: ${product.color}`,
    product.material && `fabric (name only, do not add properties): ${product.material}`,
    product.fit && `fit: ${product.fit}`,
    product.decorations.length &&
      `decorations: ${product.decorations.map((decoration) => `${decoration.label} at ${decoration.location}`).join("; ")}`,
    product.accessories.length && `hardware/trims: ${product.accessories.join(", ")}`,
    product.constructionFeatures.length && `construction: ${product.constructionFeatures.join(", ")}`,
    product.designDescription && `designer's description: ${product.designDescription.slice(0, 600)}`,
  ].filter(Boolean);
  return [
    "PRODUCT IDENTITY LOCK (highest priority, overrides style and instructions):",
    "The reference image is the immutable product. Reproduce the EXACT SAME garment — do not redesign it.",
    "Keep identical: garment color and color blocking, silhouette and proportions, every graphic/print/embroidery/logo and its exact position and scale, pocket positions, zipper, buttons, hood, collar, sleeve length and shape, cuffs, hem and overall length, and the front vs. back design.",
    "Do not add, remove, move or recolor any design element. Do not add text, watermarks, extra logos or brand names. Do not change the garment type.",
    "NEVER invent construction that is not in the reference: no extra zippers, pockets, buttons, drawcords, seams, panels, embroidery, patches or labels.",
    product.parts.length ? `Details confirmed to exist on this garment: ${product.parts.join(", ")}. Anything else must not appear.` : "",
    "Photorealistic, high-resolution, professional fashion photography.",
    facts.length ? `Known product facts: ${facts.join(" | ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

export const buildProductImagePrompt = ({
  product,
  referenceImages,
  imageType,
  detailPageStyle,
  userInstruction,
  aspectRatio,
}: BuildProductImagePromptInput) => {
  const instruction = userInstruction?.trim().slice(0, 500);
  return [
    TYPE_TEMPLATE[imageType](product),
    STYLE_DIRECTION[detailPageStyle],
    referenceImages.length ? `Attached reference images: ${referenceImages.join("; ")}.` : "",
    referenceImages.length > 1
      ? "Reference image 1 is the product design and always wins. Additional references are the creator's real photos (sample, fabric, details, worn shots, logo): use them only to match real texture, construction details, logo/print rendering and proportions of this same product — never copy other garments, people's faces or unrelated items from them."
      : "",
    instruction
      ? `Creator's change request for this image (apply it only to background, setting, composition, lighting, model or mood — never to the garment design): "${instruction}"`
      : "",
    PHOTO_REALISM,
    identityLock(product),
    `Output exactly one image, aspect ratio ${aspectRatio && isSupportedAspectRatio(aspectRatio) ? aspectRatio : IMAGE_ASPECT_RATIO[imageType]}. Keep the whole garment (or the chosen detail) inside the frame with breathing room at the edges so it is never cut off.`,
  ]
    .filter(Boolean)
    .join("\n\n");
};
