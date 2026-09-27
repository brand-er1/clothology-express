import { guessColorHex } from "@/lib/funding-colors";
import { buildVerifiedCorpus, stripUnverifiedClaims } from "@/lib/detail-page/safety";
import type {
  DetailColorInfo,
  DetailImageType,
  DetailPageSource,
  DetailPart,
  DetailProductAnalysis,
} from "@/types/detailPage";

/**
 * AI 상품 분석 (client side).
 *
 * The edge function (`generate-detail-page`, mode "analyze") looks at the design image and the
 * creator's data. Its answer is only a proposal: this module validates it, never lets it carry
 * composition / weight / functionality claims, and always keeps the parts that the creator's
 * own data proves (printing/embroidery from the estimate). When the AI is unavailable,
 * `buildFallbackAnalysis` derives the same structure from the creator's data alone.
 */

export type DetailPartMeta = {
  label: string;
  /** English caption used by editorial layouts. */
  caption: string;
  /** AI close-up image type that shows this part. */
  imageType: DetailImageType;
};

export const DETAIL_PARTS: Record<DetailPart, DetailPartMeta> = {
  collar: { label: "카라", caption: "COLLAR", imageType: "detail_neck" },
  hood: { label: "후드", caption: "HOOD", imageType: "detail_neck" },
  neckline: { label: "넥라인", caption: "NECKLINE", imageType: "detail_neck" },
  print: { label: "프린팅", caption: "PRINT", imageType: "detail_print" },
  embroidery: { label: "자수", caption: "EMBROIDERY", imageType: "detail_embroidery" },
  pocket: { label: "포켓", caption: "POCKET", imageType: "detail" },
  zipper: { label: "지퍼", caption: "ZIPPER", imageType: "detail" },
  button: { label: "버튼", caption: "BUTTON", imageType: "detail" },
  stitch: { label: "봉제", caption: "STITCH", imageType: "detail_stitch" },
  cuff: { label: "소매 · 커프스", caption: "CUFF", imageType: "detail_cuff" },
  hem: { label: "밑단", caption: "HEM", imageType: "detail_cuff" },
  drawstring: { label: "스트링", caption: "DRAWSTRING", imageType: "detail" },
  label: { label: "라벨", caption: "LABEL", imageType: "detail" },
  patch: { label: "패치", caption: "PATCH", imageType: "detail" },
};

export const ALL_DETAIL_PARTS = Object.keys(DETAIL_PARTS) as DetailPart[];

export const isDetailPart = (value: unknown): value is DetailPart =>
  typeof value === "string" && (ALL_DETAIL_PARTS as string[]).includes(value);

/** Keywords in the creator's data that prove a part exists. */
const PART_KEYWORDS: Array<[DetailPart, RegExp]> = [
  ["hood", /후드|hood/i],
  ["collar", /카라|칼라|collar|셔츠|폴로|polo/i],
  ["pocket", /포켓|주머니|pocket/i],
  ["zipper", /지퍼|집업|zip/i],
  ["button", /단추|버튼|button/i],
  ["drawstring", /스트링|끈|drawstring|drawcord/i],
  ["cuff", /커프스|시보리|립\s*조직|cuff|rib/i],
  ["label", /라벨|label|태그/i],
  ["patch", /패치|와펜|patch/i],
];

const unique = <T,>(values: T[]) => Array.from(new Set(values));

const colorInfo = (name: string): DetailColorInfo => {
  const trimmed = name.trim();
  const hex = guessColorHex(trimmed) ?? undefined;
  return hex ? { name: trimmed, hex } : { name: trimmed };
};

/** Parts proven by the creator's own data (estimate decorations, construction, accessories, brief). */
export const partsFromSource = (source: DetailPageSource): DetailPart[] => {
  const parts: DetailPart[] = [];
  for (const decoration of source.decorations) {
    if (decoration.kind === "print") parts.push("print");
    else if (decoration.kind === "embroidery") parts.push("embroidery");
    else if (decoration.kind === "patch") parts.push("patch");
  }
  const text = [
    source.clothType,
    source.designDescription,
    ...source.constructionFeatures,
    ...source.accessories,
    ...source.styleOptions,
    source.userProvided.details ?? "",
    source.userProvided.highlights ?? "",
  ].join(" ");
  for (const [part, pattern] of PART_KEYWORDS) if (pattern.test(text)) parts.push(part);
  if (/프린트|프린팅|그래픽|print/i.test(text)) parts.push("print");
  if (/자수|embroider/i.test(text)) parts.push("embroidery");
  return unique(parts);
};

const TOP_KEYWORDS = /티셔츠|맨투맨|후드|셔츠|니트|스웨트|탑|블라우스|자켓|재킷|코트|바람막이|조끼|베스트/;

/** What the creator must supply because an image can never prove it. */
export const buildUnknowns = (source: DetailPageSource): string[] => {
  const provided = source.userProvided;
  return [
    !provided.composition && "원단 혼용률",
    !source.material && "원단명",
    !provided.fabricWeight && "원단 중량",
    !source.fit && !provided.fitNote && "핏 (오버핏 · 레귤러 · 슬림)",
    !source.sizeOptions.length && "사이즈 구성",
    !provided.careNote && "세탁 · 관리 방법",
  ].filter(Boolean) as string[];
};

/** Deterministic analysis from the creator's data only (used when the AI call fails). */
export const buildFallbackAnalysis = (source: DetailPageSource): DetailProductAnalysis => {
  const colorName = source.userProvided.colorName || source.color;
  const colors = colorName
    .split(/[,/]/)
    .map((value) => value.trim())
    .filter(Boolean);
  const parts = partsFromSource(source);
  const fit = source.fit || source.userProvided.fitNote || "";
  const isTop = TOP_KEYWORDS.test(source.clothType);
  return {
    category: source.clothType || "의류",
    mainColor: colorInfo(colors[0] ?? ""),
    subColors: colors.slice(1, 4).map(colorInfo),
    materialGuess: source.material ? "" : "이미지로는 소재를 확인할 수 없어요",
    silhouette: "",
    fit,
    designFeatures: unique(
      [
        ...source.decorations.map((decoration) => [decoration.location, decoration.label].filter(Boolean).join(" ")),
        ...source.constructionFeatures,
      ].filter(Boolean),
    ).slice(0, 6),
    hasPrint: parts.includes("print"),
    hasEmbroidery: parts.includes("embroidery"),
    // Every top has a neckline and hem; stitching is visible on every garment.
    parts: unique([...parts, ...(isTop && !parts.includes("hood") && !parts.includes("collar") ? (["neckline"] as DetailPart[]) : [])]),
    target: source.userProvided.targetCustomer || "",
    mood: source.userProvided.mood ? [source.userProvided.mood] : [],
    brandMoods: [],
    emphasis: unique(
      [source.userProvided.highlights ?? "", ...source.decorations.map((decoration) => decoration.label)].filter(Boolean),
    ).slice(0, 4),
    unknowns: buildUnknowns(source),
    provider: "fallback",
    analyzedAt: new Date().toISOString(),
  };
};

const str = (value: unknown, max = 120) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const strList = (value: unknown, maxItems = 6, max = 80) =>
  Array.isArray(value) ? unique(value.map((entry) => str(entry, max)).filter(Boolean)).slice(0, maxItems) : [];

const parseColor = (value: unknown): DetailColorInfo | null => {
  if (typeof value === "string") return value.trim() ? colorInfo(value) : null;
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  const name = str(entry.name, 30);
  if (!name) return null;
  const hex = str(entry.hex, 7);
  return /^#[0-9a-f]{6}$/i.test(hex) ? { name, hex } : colorInfo(name);
};

/**
 * Validates the AI analysis. Material is only a *guess*; any composition / weight /
 * functionality wording is removed, and the creator's own data always wins (color, fit,
 * category, proven parts).
 */
export const sanitizeAnalysis = (raw: unknown, source: DetailPageSource): DetailProductAnalysis => {
  const fallback = buildFallbackAnalysis(source);
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const corpus = buildVerifiedCorpus(source.material, source.designDescription, source.userProvided.composition);
  const clean = (text: string) => stripUnverifiedClaims(text, corpus);
  const aiParts = (Array.isArray(value.parts) ? value.parts : []).filter(isDetailPart);
  const proven = partsFromSource(source);
  const mainColor = fallback.mainColor.name ? fallback.mainColor : parseColor(value.mainColor) ?? fallback.mainColor;
  const subColors = (Array.isArray(value.subColors) ? value.subColors : [])
    .map(parseColor)
    .filter((entry): entry is DetailColorInfo => Boolean(entry && entry.name !== mainColor.name))
    .slice(0, 3);
  const parts = unique([...proven, ...aiParts]);
  return {
    category: source.clothType || str(value.category, 30) || fallback.category,
    mainColor,
    subColors: fallback.subColors.length ? fallback.subColors : subColors,
    materialGuess: source.material ? "" : clean(str(value.materialGuess, 60)),
    silhouette: clean(str(value.silhouette, 60)) || fallback.silhouette,
    fit: source.fit || source.userProvided.fitNote || clean(str(value.fit, 40)),
    designFeatures: strList(value.designFeatures).map(clean).filter(Boolean).length
      ? strList(value.designFeatures).map(clean).filter(Boolean)
      : fallback.designFeatures,
    hasPrint: parts.includes("print"),
    hasEmbroidery: parts.includes("embroidery"),
    parts,
    target: source.userProvided.targetCustomer || clean(str(value.target, 80)),
    mood: strList(value.mood, 4, 30).length ? strList(value.mood, 4, 30) : fallback.mood,
    brandMoods: strList(value.brandMoods, 4, 30),
    emphasis: strList(value.emphasis, 4).map(clean).filter(Boolean).length
      ? strList(value.emphasis, 4).map(clean).filter(Boolean)
      : fallback.emphasis,
    unknowns: buildUnknowns(source),
    provider: "ai",
    analyzedAt: new Date().toISOString(),
  };
};
