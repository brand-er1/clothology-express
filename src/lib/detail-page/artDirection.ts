import type {
  DetailArtDirection,
  DetailConceptRecommendation,
  DetailImageType,
  DetailPageSource,
  DetailPageTemplateId,
  DetailPalette,
  DetailPart,
  DetailProductAnalysis,
  DetailSectionBackground,
  DetailSectionType,
  DetailTypeFace,
} from "@/types/detailPage";
import { DETAIL_PARTS } from "@/lib/detail-page/analysis";
import { isDetailTemplateId } from "@/lib/detail-page/templates";

/**
 * Art direction engine.
 *
 * A concept is not a skin: it decides the section order, which layout variant each section uses,
 * the palette/typography, the vertical rhythm, which extra photos are shot and in which aspect
 * ratio. A per-product seed then picks between each concept's preferred variants, so two
 * products with the same concept still get different pages. Everything here is deterministic
 * (testable, works without AI); the AI only ranks concepts and writes copy.
 */

type Palette = Omit<DetailPalette, "accent"> & { accent: string };

export type ConceptDef = {
  id: DetailPageTemplateId;
  name: string;
  label: string;
  /** One-line description shown on the concept card. */
  tagline: string;
  palette: Palette;
  display: DetailTypeFace;
  uppercase: boolean;
  italic?: boolean;
  spacing: DetailArtDirection["spacing"];
  align: DetailArtDirection["align"];
  grain: boolean;
  order: DetailSectionType[];
  /** Preferred layout variants per section (seed picks among the first two). */
  variants: Partial<Record<DetailSectionType, string[]>>;
  backgrounds: Partial<Record<DetailSectionType, DetailSectionBackground>>;
  heroRatio: string;
  lookbookRatio: string;
  /** Extra shots this concept favours. */
  shots: { fit: "mannequin" | "lifestyle"; laid: "flat_lay" | "folded"; mood: boolean };
  /** Words in the product data/analysis that make this concept a good fit. */
  keywords: RegExp;
  /** Diversity group: recommendations try to cover different groups. */
  group: "clean" | "bold" | "editorial" | "field";
};

const ORDER_STANDARD: DetailSectionType[] = ["hero", "story", "design", "detail", "fabric", "fit", "lookbook", "color", "size", "production", "funding", "brand", "notice"];
const ORDER_IMAGE_LED: DetailSectionType[] = ["hero", "lookbook", "story", "design", "detail", "fabric", "fit", "color", "size", "production", "funding", "brand", "notice"];
const ORDER_PRODUCT_LED: DetailSectionType[] = ["hero", "design", "detail", "story", "lookbook", "fit", "fabric", "color", "size", "production", "funding", "brand", "notice"];
const ORDER_SPEC_LED: DetailSectionType[] = ["hero", "design", "fabric", "detail", "fit", "lookbook", "story", "size", "color", "production", "funding", "brand", "notice"];

export const CONCEPTS: Record<DetailPageTemplateId, ConceptDef> = {
  minimal: {
    id: "minimal",
    name: "MINIMAL",
    label: "미니멀",
    tagline: "넓은 여백과 정돈된 그리드. 제품 자체에 집중하는 현대적인 브랜드 스타일.",
    palette: { bg: "#fafaf8", ink: "#161616", muted: "#6f6f6b", rule: "#e2e1dc", alt: "#f0efeb", inverse: "#161616", inverseInk: "#f4f3ef", accent: "#161616" },
    display: "grotesk",
    uppercase: false,
    spacing: "airy",
    align: "left",
    grain: false,
    order: ORDER_STANDARD,
    variants: {
      hero: ["split", "fullbleed"], story: ["column", "quote"], design: ["pair", "single"], detail: ["strip", "mosaic"],
      fabric: ["split", "wide"], fit: ["views", "portrait"], lookbook: ["grid", "offset"], color: ["swatch"],
      production: ["list", "timeline"], funding: ["ledger"], brand: ["signature"],
    },
    backgrounds: { fabric: "light", size: "light" },
    heroRatio: "4:5",
    lookbookRatio: "3:4",
    shots: { fit: "mannequin", laid: "folded", mood: false },
    keywords: /베이직|basic|미니멀|minimal|심플|무지|데일리|클린|솔리드|티셔츠|셔츠|슬랙스/i,
    group: "clean",
  },
  street: {
    id: "street",
    name: "STREET",
    label: "스트리트",
    tagline: "강한 타이포그래피, 비대칭 레이아웃, 크게 확대한 제품 컷의 스트릿웨어 무드.",
    palette: { bg: "#111111", ink: "#f0efe9", muted: "#9b9a94", rule: "#2e2d2a", alt: "#1c1c1a", inverse: "#ecebe5", inverseInk: "#111111", accent: "#e9e6dc" },
    display: "condensed",
    uppercase: true,
    spacing: "tight",
    align: "left",
    grain: true,
    order: ORDER_PRODUCT_LED,
    variants: {
      hero: ["typefirst", "fullbleed"], story: ["quote", "split"], design: ["stagger", "single"], detail: ["mosaic", "annotated"],
      fabric: ["wide", "split"], fit: ["portrait", "views"], lookbook: ["full", "offset"], color: ["gallery", "swatch"],
      production: ["timeline"], funding: ["bar", "ledger"], brand: ["signature"],
    },
    backgrounds: { detail: "light", size: "light" },
    heroRatio: "4:5",
    lookbookRatio: "2:3",
    shots: { fit: "lifestyle", laid: "flat_lay", mood: true },
    keywords: /후드|hood|스웨트|맨투맨|그래픽|graphic|프린트|print|오버|over|스트릿|street|로고|logo|스케이트|힙합/i,
    group: "bold",
  },
  editorial: {
    id: "editorial",
    name: "EDITORIAL",
    label: "에디토리얼",
    tagline: "패션 매거진과 룩북처럼 이미지가 이끄는 구성. 세리프 헤드라인과 세로형 컷.",
    palette: { bg: "#f3efe8", ink: "#1d1b18", muted: "#7a7268", rule: "#d8d0c4", alt: "#e9e3d8", inverse: "#25221e", inverseInk: "#efe9df", accent: "#8c6f55" },
    display: "serif",
    uppercase: false,
    spacing: "airy",
    align: "left",
    grain: true,
    order: ORDER_IMAGE_LED,
    variants: {
      hero: ["fullbleed", "centered"], story: ["split", "column"], design: ["stagger", "triptych"], detail: ["annotated", "mosaic"],
      fabric: ["wide", "split"], fit: ["portrait", "views"], lookbook: ["offset", "full"], color: ["gallery", "swatch"],
      production: ["list", "timeline"], funding: ["ledger"], brand: ["centered", "signature"],
    },
    backgrounds: { fabric: "light", funding: "dark" },
    heroRatio: "16:9",
    lookbookRatio: "2:3",
    shots: { fit: "lifestyle", laid: "folded", mood: true },
    keywords: /에디토리얼|editorial|룩북|lookbook|무드|컬렉션|collection|시즌|아트|감도/i,
    group: "editorial",
  },
  luxury: {
    id: "luxury",
    name: "LUXURY",
    label: "럭셔리",
    tagline: "조용한 톤과 절제된 세리프, 느린 호흡의 여백. 소재와 마감에 시선을 두는 구성.",
    palette: { bg: "#f7f4ef", ink: "#26221f", muted: "#857b72", rule: "#e0d8ce", alt: "#eee8df", inverse: "#1f1c1a", inverseInk: "#eee7dc", accent: "#7b6247" },
    display: "serif",
    uppercase: true,
    spacing: "airy",
    align: "center",
    grain: false,
    order: ["hero", "story", "lookbook", "design", "detail", "fabric", "fit", "color", "size", "production", "funding", "brand", "notice"],
    variants: {
      hero: ["centered", "split"], story: ["quote", "column"], design: ["single", "stagger"], detail: ["annotated", "strip"],
      fabric: ["split", "wide"], fit: ["portrait"], lookbook: ["offset", "full"], color: ["swatch"],
      production: ["list"], funding: ["ledger"], brand: ["centered"],
    },
    backgrounds: { fabric: "light", size: "light" },
    heroRatio: "4:5",
    lookbookRatio: "2:3",
    shots: { fit: "mannequin", laid: "folded", mood: true },
    keywords: /니트|knit|코트|coat|캐시미어|울|wool|실크|silk|셔츠|블라우스|럭셔리|luxury|고급|테일러/i,
    group: "editorial",
  },
  vintage: {
    id: "vintage",
    name: "VINTAGE",
    label: "빈티지",
    tagline: "바랜 필름 톤과 따뜻한 종이 질감. 시간이 쌓인 듯한 아카이브 무드.",
    palette: { bg: "#ede4d3", ink: "#3a2e24", muted: "#86705b", rule: "#d4c4a9", alt: "#e3d7c1", inverse: "#3a2e24", inverseInk: "#efe5d2", accent: "#9c5b2e" },
    display: "serif",
    uppercase: false,
    italic: true,
    spacing: "regular",
    align: "left",
    grain: true,
    order: ORDER_STANDARD,
    variants: {
      hero: ["centered", "fullbleed"], story: ["split", "quote"], design: ["pair", "stagger"], detail: ["mosaic", "strip"],
      fabric: ["split", "wide"], fit: ["portrait", "views"], lookbook: ["offset", "grid"], color: ["swatch"],
      production: ["list"], funding: ["ledger"], brand: ["signature"],
    },
    backgrounds: { story: "light", size: "light" },
    heroRatio: "4:5",
    lookbookRatio: "3:4",
    shots: { fit: "lifestyle", laid: "folded", mood: true },
    keywords: /빈티지|vintage|워싱|washing|피그먼트|pigment|레트로|retro|데님|denim|코듀로이|아카이브/i,
    group: "editorial",
  },
  sports: {
    id: "sports",
    name: "SPORTS",
    label: "스포츠",
    tagline: "속도감 있는 컨덴스드 타이포와 스펙 중심 그리드. 움직임을 강조하는 구성.",
    palette: { bg: "#eef0f2", ink: "#101418", muted: "#5f6873", rule: "#d3d8de", alt: "#ffffff", inverse: "#101418", inverseInk: "#eef0f2", accent: "#101418" },
    display: "condensed",
    uppercase: true,
    italic: true,
    spacing: "tight",
    align: "left",
    grain: false,
    order: ORDER_SPEC_LED,
    variants: {
      hero: ["typefirst", "split"], story: ["column"], design: ["triptych", "pair"], detail: ["strip", "mosaic"],
      fabric: ["split", "wide"], fit: ["views"], lookbook: ["grid", "full"], color: ["swatch", "gallery"],
      production: ["timeline"], funding: ["bar"], brand: ["signature"],
    },
    backgrounds: { fabric: "light", size: "light" },
    heroRatio: "4:5",
    lookbookRatio: "3:4",
    shots: { fit: "lifestyle", laid: "flat_lay", mood: false },
    keywords: /레깅스|트레이닝|저지|jersey|운동|스포츠|sport|러닝|요가|기능|팀|유니폼|축구|농구/i,
    group: "bold",
  },
  outdoor: {
    id: "outdoor",
    name: "OUTDOOR",
    label: "아웃도어",
    tagline: "자연광 필드 무드와 기술 문서처럼 정리된 스펙. 와이드 컷과 차분한 어스 톤.",
    palette: { bg: "#e8e7e0", ink: "#1f2420", muted: "#69705f", rule: "#cdccc1", alt: "#f3f2ec", inverse: "#2a3027", inverseInk: "#e8e7e0", accent: "#5d6b4f" },
    display: "grotesk",
    uppercase: true,
    spacing: "regular",
    align: "left",
    grain: true,
    order: ORDER_SPEC_LED,
    variants: {
      hero: ["fullbleed", "split"], story: ["column", "split"], design: ["pair", "triptych"], detail: ["strip", "annotated"],
      fabric: ["wide", "split"], fit: ["views", "portrait"], lookbook: ["full", "grid"], color: ["swatch"],
      production: ["timeline"], funding: ["ledger"], brand: ["signature"],
    },
    backgrounds: { fabric: "light", production: "dark" },
    heroRatio: "16:9",
    lookbookRatio: "3:4",
    shots: { fit: "lifestyle", laid: "flat_lay", mood: true },
    keywords: /바람막이|윈드|아노락|자켓|재킷|jacket|플리스|fleece|등산|캠핑|아웃도어|outdoor|워크|work|카고|베스트|조끼/i,
    group: "field",
  },
  casual: {
    id: "casual",
    name: "CASUAL",
    label: "캐주얼",
    tagline: "밝은 자연광과 편안한 리듬. 매일 입는 옷의 온도를 담은 구성.",
    palette: { bg: "#faf7f1", ink: "#2b2824", muted: "#7b736a", rule: "#e6ded2", alt: "#f2ece2", inverse: "#2b2824", inverseInk: "#faf7f1", accent: "#b8683a" },
    display: "rounded",
    uppercase: false,
    spacing: "regular",
    align: "left",
    grain: false,
    order: ORDER_STANDARD,
    variants: {
      hero: ["split", "centered"], story: ["column", "split"], design: ["pair", "single"], detail: ["strip", "mosaic"],
      fabric: ["split"], fit: ["views", "portrait"], lookbook: ["grid", "offset"], color: ["gallery", "swatch"],
      production: ["list"], funding: ["bar"], brand: ["signature"],
    },
    backgrounds: { fit: "light", size: "light" },
    heroRatio: "4:5",
    lookbookRatio: "3:4",
    shots: { fit: "lifestyle", laid: "flat_lay", mood: false },
    keywords: /데일리|daily|캐주얼|casual|편한|티셔츠|맨투맨|반팔|커플|단체|캠퍼스/i,
    group: "clean",
  },
  y2k: {
    id: "y2k",
    name: "Y2K",
    label: "Y2K",
    tagline: "2000년대 팝 무드의 경쾌한 대비. 굵은 타이포와 과감한 크롭.",
    palette: { bg: "#f4f1f8", ink: "#17121f", muted: "#6d6479", rule: "#dcd4e6", alt: "#ffffff", inverse: "#17121f", inverseInk: "#f4f1f8", accent: "#7a4dff" },
    display: "condensed",
    uppercase: true,
    spacing: "tight",
    align: "left",
    grain: false,
    order: ORDER_PRODUCT_LED,
    variants: {
      hero: ["typefirst", "split"], story: ["quote"], design: ["stagger", "triptych"], detail: ["mosaic"],
      fabric: ["split"], fit: ["portrait"], lookbook: ["grid", "offset"], color: ["gallery"],
      production: ["timeline"], funding: ["bar"], brand: ["signature"],
    },
    backgrounds: { detail: "dark", size: "light" },
    heroRatio: "4:5",
    lookbookRatio: "3:4",
    shots: { fit: "lifestyle", laid: "flat_lay", mood: true },
    keywords: /y2k|크롭|crop|베이비|baby|팝|pop|하트|글리터|레트로\s*팝/i,
    group: "bold",
  },
  emotional: {
    id: "emotional",
    name: "EMOTIONAL",
    label: "감성",
    tagline: "부드러운 창가 빛과 에세이처럼 읽히는 문장. 조용하고 따뜻한 무드.",
    palette: { bg: "#f6f1f0", ink: "#3a3234", muted: "#8a7b7e", rule: "#e4d9d8", alt: "#efe6e5", inverse: "#3a3234", inverseInk: "#f6f1f0", accent: "#a27583" },
    display: "serif",
    uppercase: false,
    spacing: "airy",
    align: "center",
    grain: true,
    order: ["hero", "story", "lookbook", "design", "detail", "fabric", "fit", "color", "size", "production", "funding", "brand", "notice"],
    variants: {
      hero: ["centered", "split"], story: ["quote", "column"], design: ["single", "pair"], detail: ["strip"],
      fabric: ["split"], fit: ["portrait"], lookbook: ["offset", "full"], color: ["swatch"],
      production: ["list"], funding: ["ledger"], brand: ["centered"],
    },
    backgrounds: { story: "light" },
    heroRatio: "4:5",
    lookbookRatio: "2:3",
    shots: { fit: "lifestyle", laid: "folded", mood: true },
    keywords: /감성|파스텔|pastel|로맨틱|포근|잠옷|라운지|lounge|니트/i,
    group: "clean",
  },
  lookbook: {
    id: "lookbook",
    name: "LOOKBOOK",
    label: "룩북",
    tagline: "시즌 룩북처럼 큰 이미지가 연속되는 구성. 캡션은 작고 절제되게.",
    palette: { bg: "#f2f1ee", ink: "#141414", muted: "#74726d", rule: "#dad8d3", alt: "#e8e6e1", inverse: "#141414", inverseInk: "#f2f1ee", accent: "#141414" },
    display: "grotesk",
    uppercase: true,
    spacing: "regular",
    align: "left",
    grain: true,
    order: ORDER_IMAGE_LED,
    variants: {
      hero: ["fullbleed", "split"], story: ["column"], design: ["stagger", "pair"], detail: ["mosaic", "strip"],
      fabric: ["wide"], fit: ["portrait", "views"], lookbook: ["full", "offset"], color: ["gallery"],
      production: ["list"], funding: ["ledger"], brand: ["signature"],
    },
    backgrounds: { size: "light" },
    heroRatio: "3:2",
    lookbookRatio: "2:3",
    shots: { fit: "lifestyle", laid: "flat_lay", mood: true },
    keywords: /룩북|lookbook|컬렉션|시즌|캠페인/i,
    group: "editorial",
  },
};

export const getConcept = (id: DetailPageTemplateId) => CONCEPTS[id] ?? CONCEPTS.minimal;

/* ───────────── Layout variants (editor "레이아웃 변경") ───────────── */

export const EDITORIAL_VARIANTS: Partial<Record<DetailSectionType, Array<{ id: string; label: string }>>> = {
  hero: [
    { id: "split", label: "이미지 · 텍스트 분할" },
    { id: "fullbleed", label: "풀블리드 이미지" },
    { id: "typefirst", label: "타이포 우선" },
    { id: "centered", label: "가운데 정렬" },
  ],
  story: [
    { id: "column", label: "좁은 단" },
    { id: "split", label: "이미지와 분할" },
    { id: "quote", label: "인용형" },
  ],
  design: [
    { id: "pair", label: "2단 나란히" },
    { id: "stagger", label: "엇갈린 배치" },
    { id: "single", label: "대형 1컷" },
    { id: "triptych", label: "3단" },
  ],
  detail: [
    { id: "mosaic", label: "비대칭 모자이크" },
    { id: "strip", label: "가로 스트립" },
    { id: "annotated", label: "번호 주석" },
  ],
  fabric: [
    { id: "wide", label: "와이드 텍스처" },
    { id: "split", label: "이미지 · 스펙 분할" },
  ],
  fit: [
    { id: "views", label: "정면 · 후면 · 착용" },
    { id: "portrait", label: "세로 1컷" },
  ],
  lookbook: [
    { id: "offset", label: "엇갈린 세로 컷" },
    { id: "full", label: "풀블리드 연속" },
    { id: "grid", label: "3단 그리드" },
  ],
  color: [
    { id: "swatch", label: "스와치" },
    { id: "gallery", label: "컬러별 이미지" },
  ],
  production: [
    { id: "timeline", label: "가로 타임라인" },
    { id: "list", label: "세로 목록" },
  ],
  funding: [
    { id: "ledger", label: "수치 목록" },
    { id: "bar", label: "대형 달성률" },
  ],
  brand: [
    { id: "signature", label: "좌측 정렬" },
    { id: "centered", label: "가운데 정렬" },
  ],
  custom_text: [
    { id: "column", label: "좁은 단" },
    { id: "quote", label: "인용형" },
  ],
  custom_image: [
    { id: "full", label: "풀블리드" },
    { id: "pair", label: "2단" },
  ],
};

/** Stable 32-bit hash (FNV-1a) used as the per-product variation seed. */
export const hashSeed = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/** The variant a section uses when none was stored (seeded pick among the concept's first two). */
export const pickVariant = (type: DetailSectionType, direction: Pick<DetailArtDirection, "concept" | "seed">, salt = 0) => {
  const preferred = getConcept(direction.concept).variants[type] ?? EDITORIAL_VARIANTS[type]?.map((variant) => variant.id) ?? [];
  if (!preferred.length) return "default";
  const pool = preferred.slice(0, 2);
  return pool[(direction.seed + hashSeed(type) + salt) % pool.length];
};

export const nextVariant = (type: DetailSectionType, current: string | undefined) => {
  const list = EDITORIAL_VARIANTS[type];
  if (!list?.length) return current;
  const index = list.findIndex((variant) => variant.id === current);
  return list[(index + 1) % list.length].id;
};

/* ───────────── Palette ───────────── */

const hexToRgb = (hex: string) => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
};

export const relativeLuminance = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrastRatio = (a: string, b: string) => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * The accent follows the product's own color (the page serves the product, not BRAND-ER),
 * unless that color is too close to the page background to read.
 */
export const accentFor = (palette: Palette, productHex?: string) =>
  productHex && hexToRgb(productHex) && contrastRatio(productHex, palette.bg) >= 3 ? productHex : palette.accent;

/* ───────────── Direction ───────────── */

export const buildDirection = (
  conceptId: DetailPageTemplateId,
  analysis: DetailProductAnalysis | null | undefined,
  seedKey: string,
): DetailArtDirection => {
  const concept = getConcept(conceptId);
  return {
    concept: concept.id,
    palette: { ...concept.palette, accent: accentFor(concept.palette, analysis?.mainColor.hex) },
    typography: { display: concept.display, uppercase: concept.uppercase, scale: "compact", italic: concept.italic },
    spacing: concept.spacing,
    align: concept.align,
    grain: concept.grain,
    seed: hashSeed(seedKey || conceptId),
  };
};

export const seedKeyFor = (source: DetailPageSource) => source.designId || source.imageUrl || `${source.clothType}-${source.color}`;

/* ───────────── Concept recommendation ───────────── */

const CONCEPT_ORDER: DetailPageTemplateId[] = ["minimal", "street", "editorial", "luxury", "vintage", "sports", "outdoor", "casual", "y2k", "emotional", "lookbook"];

const REASON: Record<DetailPageTemplateId, string> = {
  minimal: "제품 형태가 또렷해 여백 중심 구성에서 디자인이 가장 잘 읽혀요.",
  street: "그래픽·실루엣이 강해 큰 타이포와 확대 컷이 어울려요.",
  editorial: "룩북형 이미지 흐름으로 제품의 분위기를 전달하기 좋아요.",
  luxury: "소재와 마감에 시선을 두는 절제된 구성이 어울려요.",
  vintage: "워싱·레트로 요소가 있어 필름 톤 아카이브 무드와 맞아요.",
  sports: "활동성이 중요한 제품이라 스펙 중심 그리드가 명확해요.",
  outdoor: "필드에서 입는 제품이라 자연광 와이드 컷과 스펙 정리가 어울려요.",
  casual: "매일 입는 제품이라 편안하고 밝은 구성이 자연스러워요.",
  y2k: "경쾌한 컬러·크롭 요소가 팝 무드와 잘 맞아요.",
  emotional: "부드러운 무드를 문장과 빛으로 전달하기 좋아요.",
  lookbook: "시즌 캠페인처럼 큰 이미지가 연속되는 구성이 어울려요.",
};

const scoreConcept = (concept: ConceptDef, text: string, analysis: DetailProductAnalysis) => {
  let score = 0;
  const hits = text.match(new RegExp(concept.keywords.source, "gi"));
  score += Math.min(3, hits?.length ?? 0) * 2;
  // Every page can be minimal/editorial; they are the safe defaults.
  if (concept.id === "minimal") score += 1.5;
  if (concept.id === "editorial") score += 1.2;
  if (concept.id === "street" && (analysis.hasPrint || analysis.hasEmbroidery)) score += 1.5;
  if (concept.id === "luxury" && analysis.parts.includes("collar")) score += 0.5;
  // Very light or very dark garments read well on the contrasting street / minimal pages.
  const lum = analysis.mainColor.hex ? relativeLuminance(analysis.mainColor.hex) : 0.5;
  if (concept.id === "street" && lum > 0.6) score += 0.5;
  if (concept.id === "minimal" && lum < 0.1) score += 0.5;
  return score;
};

/**
 * Three concepts, best first. Valid AI suggestions (if any) come first; the rest are scored from
 * the product data and cover different visual groups so the choice is meaningful.
 */
export const recommendConcepts = (
  analysis: DetailProductAnalysis,
  source: DetailPageSource,
  aiSuggestions?: unknown,
): DetailConceptRecommendation[] => {
  const text = [
    source.clothType,
    source.material,
    source.designDescription,
    source.styleOptions.join(" "),
    source.userProvided.mood ?? "",
    source.userProvided.targetCustomer,
    analysis.mood.join(" "),
    analysis.brandMoods.join(" "),
    analysis.designFeatures.join(" "),
    analysis.silhouette,
  ].join(" ");
  const ai = Array.isArray(aiSuggestions) ? aiSuggestions : [];
  const aiReason = new Map<DetailPageTemplateId, string>();
  ai.forEach((entry) => {
    const value = (entry && typeof entry === "object" ? entry : { id: entry }) as Record<string, unknown>;
    if (isDetailTemplateId(value.id) && !aiReason.has(value.id)) {
      aiReason.set(value.id, typeof value.reason === "string" ? value.reason.trim().slice(0, 90) : "");
    }
  });
  const scored = CONCEPT_ORDER.map((id) => ({ id, score: scoreConcept(CONCEPTS[id], text, analysis) })).sort(
    (a, b) => b.score - a.score || CONCEPT_ORDER.indexOf(a.id) - CONCEPT_ORDER.indexOf(b.id),
  );

  // The AI saw the image: its (validated) picks lead; rule-based scoring fills the rest,
  // preferring visual groups not covered yet.
  const picked: DetailPageTemplateId[] = Array.from(aiReason.keys()).slice(0, 3);
  const groups = new Set<ConceptDef["group"]>(picked.map((id) => CONCEPTS[id].group));
  for (const entry of scored) {
    if (picked.length === 3) break;
    if (picked.includes(entry.id) || groups.has(CONCEPTS[entry.id].group)) continue;
    picked.push(entry.id);
    groups.add(CONCEPTS[entry.id].group);
  }
  for (const entry of scored) {
    if (picked.length === 3) break;
    if (!picked.includes(entry.id)) picked.push(entry.id);
  }
  return picked.map((id) => ({ id, reason: aiReason.get(id) || REASON[id] }));
};

/* ───────────── Image plan ───────────── */

export type PlannedImage = { type: DetailImageType; ratio: string; label: string };

/** Default ratio of each image type (mirrors IMAGE_ASPECT_RATIO in the edge function). */
export const DEFAULT_IMAGE_RATIO: Record<DetailImageType, string> = {
  hero: "4:5",
  product_front: "4:5",
  product_back: "4:5",
  detail: "1:1",
  editorial: "2:3",
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

const DETAIL_PRIORITY: DetailPart[] = ["print", "embroidery", "hood", "collar", "neckline", "pocket", "zipper", "cuff", "hem", "stitch", "patch", "button", "drawstring", "label"];

/** Distinct close-up shots for the parts that exist (max 3, most telling first). */
export const detailShotsFor = (parts: DetailPart[]) => {
  const shots: Array<{ type: DetailImageType; part: DetailPart }> = [];
  for (const part of DETAIL_PRIORITY) {
    if (!parts.includes(part)) continue;
    const type = DETAIL_PARTS[part].imageType;
    if (shots.some((shot) => shot.type === type)) continue;
    shots.push({ type, part });
    if (shots.length === 3) break;
  }
  return shots;
};

const hasFabricInfo = (source: DetailPageSource) =>
  Boolean(source.material || source.userProvided.composition || source.userProvided.fabricWeight || source.userProvided.fabricHand);

/**
 * Which extra photos this page gets, in which ratio (hero ratio follows the hero layout). Never the same shot twice; detail shots
 * only for parts that exist; texture only when fabric information exists. `limit` respects the
 * creator's remaining daily quota (most important shots first).
 */
export const planImages = (
  direction: Pick<DetailArtDirection, "concept" | "seed">,
  analysis: DetailProductAnalysis,
  source: DetailPageSource,
  limit = 10,
): PlannedImage[] => {
  const concept = getConcept(direction.concept);
  // The hero is shot for the layout it will sit in: wide for full-bleed, portrait otherwise.
  const heroWide = pickVariant("hero", direction, 0) === "fullbleed";
  const heroRatio = heroWide ? (concept.heroRatio === "4:5" ? "3:2" : concept.heroRatio) : "4:5";
  const plan: Array<[DetailImageType, string]> = [
    ["hero", heroRatio],
    ["product_front", "4:5"],
  ];
  if (source.isFrontBackComposite) plan.push(["product_back", "4:5"]);
  const details = detailShotsFor(analysis.parts);
  details.slice(0, 2).forEach((shot) => plan.push([shot.type, "1:1"]));
  plan.push(["editorial", concept.lookbookRatio]);
  plan.push([concept.shots.fit, "3:4"]);
  if (hasFabricInfo(source)) plan.push(["texture_wide", "21:9"]);
  plan.push([concept.shots.laid, "4:5"]);
  if (details[2]) plan.push([details[2].type, "1:1"]);
  if (concept.shots.mood) plan.push(["mood", "16:9"]);
  const labels: Partial<Record<DetailImageType, string>> = {};
  details.forEach((shot) => (labels[shot.type] = DETAIL_PARTS[shot.part].caption));
  return plan.slice(0, Math.max(0, limit)).map(([type, ratio]) => ({ type, ratio, label: labels[type] ?? "" }));
};
