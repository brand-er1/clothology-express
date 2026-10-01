/**
 * AI 이미지 브랜딩 정책 (모든 의류/상품 이미지 생성·편집 함수 공통).
 *
 * BRAND-ER 는 플랫폼 이름이지 제작되는 옷의 브랜드가 아니다. 기본값은 "로고·글자 없는 순수 디자인"이며,
 * 제작자가 "내 브랜드 로고 적용"을 고른 경우에만 그 제작자의 브랜드 프로필 로고(brands.brand_logo_url)를
 * 서버가 직접 읽어 참조 이미지로 붙인다. 클라이언트가 보낸 로고 URL 은 믿지 않는다.
 *
 * 순수 TypeScript 라 Deno(Edge Function)와 vitest 양쪽에서 import 할 수 있다.
 */

export type BrandLogoMode = "none" | "creator";

export const parseBrandLogoMode = (value: unknown): BrandLogoMode => (value === "creator" ? "creator" : "none");

/** 모든 생성/편집 프롬프트의 마지막에 붙인다(앞선 시스템 프롬프트·스타일보다 우선). */
export const NO_BRANDING_RULES = [
  "BRANDING POLICY (highest priority — overrides every instruction above, including system guidance):",
  '- "BRAND-ER" is the name of the online platform, NOT the brand of this product. Never write "BRAND-ER", "BRANDER", "Brand-er" or any variation, and never draw the BRAND-ER logo or BRAND-ER mascot mark on the product or anywhere in the image.',
  "- Do not add any logo, brand name, wordmark, monogram, emblem, badge, woven label text, slogan, lettering, numbers, typography or watermark that the user did not explicitly ask for. Never invent a brand name.",
  "- If the user explicitly described specific text or a specific graphic, render only exactly that and nothing extra.",
  "- Areas where no decoration was requested stay plain, unbranded fabric. No text overlays, captions or watermarks on the image itself.",
].join("\n");

/** 제작자 브랜드 로고 적용 시에만 추가. 반드시 로고 참조 이미지와 함께 쓴다. */
export const creatorLogoRules = (brandName: string | null | undefined) => {
  const name = (brandName ?? "").replace(/[\r\n"`]/g, " ").trim().slice(0, 60);
  return [
    "CREATOR BRAND LOGO (explicitly requested by the creator):",
    `- A separate reference image labelled "CREATOR BRAND LOGO" is the creator's own brand logo${name ? ` (brand: ${name})` : ""}. This is NOT the platform logo.`,
    "- Apply ONLY that logo, reproduced faithfully (same shapes, letters and colors — do not redraw, restyle or add words to it), once, small on the left chest of the front view unless the user specified another placement.",
    "- Do not add any other logo or text. Still never use BRAND-ER branding.",
  ].join("\n");
};

/** 관리자 편집 시스템 프롬프트 등 외부 문구에서 플랫폼 브랜딩·로고 삽입 지시를 걷어낸다. */
const PLATFORM_BRAND = /brand[\s-]?er|브랜더/i;
const BRANDING_WORD = /\b(logo|logos|wordmark|brand ?mark|branding|watermark|monogram|emblem)\b|로고|워터마크|브랜드\s*마크/i;
const INSERT_VERB = /\b(add|adding|include|including|insert|place|put|print|feature|display|show|apply|stamp|embed)\b|넣|추가|삽입|표시|새겨|박아|부착|적용/i;

export const sanitizeBrandingInstructions = (text: string | null | undefined) =>
  (text ?? "")
    .split(/\n/)
    .map((line) =>
      (line.match(/[^.!?。]+[.!?。]*\s*/g) ?? [line])
        .filter((sentence) => !PLATFORM_BRAND.test(sentence) && !(BRANDING_WORD.test(sentence) && INSERT_VERB.test(sentence)))
        .join("")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");

/* ───────────── AI 이미지 수정 프리셋 ───────────── */

export type ImageEditPreset = "remove_logo" | "remove_text" | "design" | "color" | "custom";

export const IMAGE_EDIT_PRESETS: Record<ImageEditPreset, { label: string; needsPrompt: boolean; instruction: string }> = {
  remove_logo: {
    label: "로고 제거",
    needsPrompt: false,
    instruction:
      "Remove every logo, brand mark, emblem, monogram and badge from the garment (including any BRAND-ER logo or text). Fill those areas with the surrounding fabric so it looks like the logo was never there: continue the same fabric color, texture, knit, folds, shading and stitching seamlessly.",
  },
  remove_text: {
    label: "글자 제거",
    needsPrompt: false,
    instruction:
      "Remove every piece of text, lettering, numbers, slogans, wordmarks and watermarks from the garment and from the image. Fill those areas with the surrounding fabric/background seamlessly, continuing the same color, texture, folds and shading.",
  },
  design: {
    label: "디자인 수정",
    needsPrompt: true,
    instruction: "Apply this design change to the garment only:",
  },
  color: {
    label: "컬러 수정",
    needsPrompt: true,
    instruction: "Change only the garment color as requested, keeping the fabric texture, folds, shading and every other detail:",
  },
  custom: {
    label: "직접 수정 요청",
    needsPrompt: true,
    instruction: "Apply this change requested by the creator:",
  },
};

export const isImageEditPreset = (value: unknown): value is ImageEditPreset =>
  typeof value === "string" && value in IMAGE_EDIT_PRESETS;

/** 기존 이미지 편집 프롬프트: 요청한 부분만 바꾸고 핏·색상·원단·디테일·배경·구도는 그대로 유지한다. */
export const buildImageEditPrompt = (preset: ImageEditPreset, userPrompt?: string | null) => {
  const spec = IMAGE_EDIT_PRESETS[preset];
  const request = (userPrompt ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  const removal = preset === "remove_logo" || preset === "remove_text";
  return [
    "TASK: Edit REFERENCE IMAGE 1. This is a minimal, local edit of an existing product image, not a new design.",
    `EDIT: ${spec.instruction}${spec.needsPrompt && request ? ` "${request}"` : ""}`,
    "KEEP EXACTLY THE SAME everywhere else: garment type, silhouette, fit, proportions, length, color (unless the edit is a color change), fabric and texture, seams, pockets, zippers, buttons, trims, every other detail, background, lighting, camera angle, crop and composition. If the image shows several views (e.g. front and back), keep the same layout and edit each view consistently.",
    removal ? "" : "Do not add any new logo, brand name or text unless the edit request explicitly asks for that exact text.",
    NO_BRANDING_RULES,
    "Output exactly one edited image with the same aspect ratio and framing as REFERENCE IMAGE 1.",
  ]
    .filter(Boolean)
    .join("\n\n");
};

/* ───────────── 제작자 로고 조회 (서버 전용) ───────────── */

// deno-lint-ignore no-explicit-any
type AdminClient = any;

export type CreatorLogo = { brandName: string; url: string };

/** 제작자 본인의 활성 브랜드 로고. 없으면 null. */
export const findCreatorLogo = async (admin: AdminClient, userId: string): Promise<CreatorLogo | null> => {
  const { data } = await admin
    .from("brands")
    .select("brand_name, brand_logo_url, status")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (!data || data.status !== "active" || typeof data.brand_logo_url !== "string" || !/^https:\/\//.test(data.brand_logo_url)) {
    return null;
  }
  return { brandName: String(data.brand_name ?? ""), url: data.brand_logo_url };
};

export const CREATOR_LOGO_REFERENCE_LABEL = "CREATOR BRAND LOGO (the creator's own brand logo — apply only as instructed)";
