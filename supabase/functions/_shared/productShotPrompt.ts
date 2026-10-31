/**
 * 상세 컷 · 디테일 컷 생성 (원본 AI 의류 디자인을 다른 각도에서 촬영하거나 특정 부위를 확대한 이미지).
 *
 * 새 디자인을 만드는 기능이 아니다. 원본 이미지를 REFERENCE IMAGE 1 로 넘기고, 같은 옷을 다른 각도 · 거리에서
 * 찍은 것처럼 만들도록 지시한다. 원본에서 확인되지 않는 부자재 · 디테일(지퍼, 자수, 포켓 등)은 만들지 않는다.
 *
 * 순수 TypeScript 라 Edge Function(Deno) · 화면(vite) · vitest 가 모두 import 한다(외부 import 금지).
 */

export type ShotCategory = "angle" | "detail" | "custom";

export type AngleShotType = "front" | "back" | "side" | "three_quarter" | "flat_lay" | "hanger" | "mannequin";
export type DetailShotType =
  | "fabric"
  | "stitching"
  | "neckline"
  | "sleeve"
  | "hem"
  | "print"
  | "embroidery"
  | "closure"
  | "pocket"
  | "design_detail";
export type ProductShotType = AngleShotType | DetailShotType | "custom_region";

/** 원본 이미지 분석에서 존재 여부를 확인하는 디자인 요소. */
export type DesignElementKey = "neckline" | "sleeve" | "hem" | "print" | "embroidery" | "closure" | "pocket" | "logo";

/** [ymin, xmin, ymax, xmax], 0~1000 (Gemini 박스 형식). */
export type Box = [number, number, number, number];

export type DesignElement = { present: boolean; box: Box | null; description: string };

export type DesignAnalysis = {
  garmentType: string;
  /** front_back: 한 장에 앞(왼쪽)·뒤(오른쪽)가 함께 있는 원본(BRAND-ER 기본 생성 형식). */
  layout: "front_back" | "single";
  frontBox: Box | null;
  backBox: Box | null;
  backVisible: boolean;
  elements: Record<DesignElementKey, DesignElement>;
  /** 로고 · 프린팅 · 자수 등 이 옷의 대표 디자인 포인트(없으면 present=false). */
  mainDesignDetail: DesignElement & { kind: "print" | "embroidery" | "logo" | "other" | "none" };
  colors: string[];
  fabric: string;
  /** 바꾸면 안 되는 디자인 요약(색 · 배색 · 그래픽 위치 등) — 모든 컷 프롬프트에 그대로 들어간다. */
  summary: string;
};

export type ShotSpec = {
  type: ProductShotType;
  category: ShotCategory;
  label: string;
  description: string;
  /** 이 요소가 원본에 있어야 만들 수 있다(없으면 만들지 않는다). */
  requires?: DesignElementKey | "main_design";
  aspectRatio: string;
  /** 원본에서 보이지 않는 면을 AI 가 추정하는 컷(참고 이미지 표시). back 은 분석 결과로 결정. */
  inferred: boolean | "when_back_hidden";
  /** 결과 검수 범위(전체 디자인 비교 / 부분 확대). */
  qaScope: "full" | "partial";
};

export const ANGLE_SHOTS: ShotSpec[] = [
  { type: "front", category: "angle", label: "정면 컷", description: "의류 전체 정면", aspectRatio: "4:5", inferred: false, qaScope: "full" },
  { type: "back", category: "angle", label: "후면 컷", description: "의류 전체 뒷면", aspectRatio: "4:5", inferred: "when_back_hidden", qaScope: "full" },
  { type: "side", category: "angle", label: "측면 컷", description: "왼쪽 측면 실루엣", aspectRatio: "4:5", inferred: true, qaScope: "full" },
  { type: "three_quarter", category: "angle", label: "45도 컷", description: "입체적인 사선 각도", aspectRatio: "4:5", inferred: true, qaScope: "full" },
  { type: "flat_lay", category: "angle", label: "플랫레이 컷", description: "바닥에 펼쳐놓은 제품 사진", aspectRatio: "4:5", inferred: false, qaScope: "full" },
  { type: "hanger", category: "angle", label: "행거 컷", description: "옷걸이에 걸린 제품 사진", aspectRatio: "4:5", inferred: false, qaScope: "full" },
  { type: "mannequin", category: "angle", label: "마네킹 컷", description: "마네킹에 착용한 제품 사진", aspectRatio: "4:5", inferred: false, qaScope: "full" },
];

export const DETAIL_SHOTS: ShotSpec[] = [
  { type: "fabric", category: "detail", label: "원단 확대 컷", description: "원단 표면과 질감", aspectRatio: "1:1", inferred: false, qaScope: "partial" },
  { type: "stitching", category: "detail", label: "봉제 디테일", description: "스티치, 봉제선, 마감", aspectRatio: "1:1", inferred: false, qaScope: "partial" },
  { type: "neckline", category: "detail", label: "넥라인", description: "목 부분과 시보리", requires: "neckline", aspectRatio: "1:1", inferred: false, qaScope: "partial" },
  { type: "sleeve", category: "detail", label: "소매", description: "소매 끝과 커프스", requires: "sleeve", aspectRatio: "1:1", inferred: false, qaScope: "partial" },
  { type: "hem", category: "detail", label: "밑단", description: "밑단 봉제와 마감", requires: "hem", aspectRatio: "1:1", inferred: false, qaScope: "partial" },
  { type: "print", category: "detail", label: "프린팅", description: "나염 및 그래픽 확대", requires: "print", aspectRatio: "1:1", inferred: false, qaScope: "partial" },
  { type: "embroidery", category: "detail", label: "자수", description: "자수 로고 및 실 질감 확대", requires: "embroidery", aspectRatio: "1:1", inferred: false, qaScope: "partial" },
  { type: "closure", category: "detail", label: "지퍼·단추", description: "디자인에 있는 부자재 확대", requires: "closure", aspectRatio: "1:1", inferred: false, qaScope: "partial" },
  { type: "pocket", category: "detail", label: "포켓", description: "주머니 구조와 디테일", requires: "pocket", aspectRatio: "1:1", inferred: false, qaScope: "partial" },
];

/** 기본 상품 촬영 세트에서만 쓰는 "로고 또는 주요 디자인 디테일" 컷. */
export const DESIGN_DETAIL_SHOT: ShotSpec = {
  type: "design_detail", category: "detail", label: "주요 디자인 디테일", description: "로고 · 프린팅 · 자수 등 대표 디자인 확대",
  requires: "main_design", aspectRatio: "1:1", inferred: false, qaScope: "partial",
};

export const CUSTOM_REGION_SHOT: ShotSpec = {
  type: "custom_region", category: "custom", label: "선택 영역 확대", description: "이미지에서 직접 고른 부분", aspectRatio: "1:1", inferred: false, qaScope: "partial",
};

export const ALL_SHOTS: ShotSpec[] = [...ANGLE_SHOTS, ...DETAIL_SHOTS, DESIGN_DETAIL_SHOT, CUSTOM_REGION_SHOT];

export const getShotSpec = (type: string): ShotSpec | null => ALL_SHOTS.find((spec) => spec.type === type) ?? null;

export const isProductShotType = (value: unknown): value is ProductShotType => typeof value === "string" && Boolean(getShotSpec(value));

/** 기본 상품 촬영 세트: 정면 · 후면 · 측면 · 원단 · 로고(주요 디자인) 디테일 = 5장. */
export const BASIC_SHOT_SET: ProductShotType[] = ["front", "back", "side", "fabric", "design_detail"];

const ELEMENT_KEYS: DesignElementKey[] = ["neckline", "sleeve", "hem", "print", "embroidery", "closure", "pocket", "logo"];

/* ───────────── 영역(사용자 지정 · 분석 박스) ───────────── */

/** 화면에서 고른 영역(0~1 비율). */
export type NormalizedRegion = { x: number; y: number; width: number; height: number };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** 화면이 보낸 영역을 검증 · 보정한다. 너무 작거나 잘못되면 null. */
export const normalizeRegion = (value: unknown): NormalizedRegion | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const nums = ["x", "y", "width", "height"].map((key) => Number(raw[key]));
  if (nums.some((entry) => !Number.isFinite(entry))) return null;
  const x = clamp01(nums[0]);
  const y = clamp01(nums[1]);
  const width = Math.min(1 - x, Math.max(0, nums[2]));
  const height = Math.min(1 - y, Math.max(0, nums[3]));
  if (width < 0.02 || height < 0.02) return null;
  return { x, y, width, height };
};

export const regionToBox = (region: NormalizedRegion): Box => [
  Math.round(region.y * 1000),
  Math.round(region.x * 1000),
  Math.round((region.y + region.height) * 1000),
  Math.round((region.x + region.width) * 1000),
];

export const parseBox = (value: unknown): Box | null => {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const box = value.map(Number);
  if (box.some((entry) => !Number.isFinite(entry))) return null;
  const [ymin, xmin, ymax, xmax] = box.map((entry) => Math.min(1000, Math.max(0, Math.round(entry))));
  return ymax - ymin >= 10 && xmax - xmin >= 10 ? [ymin, xmin, ymax, xmax] : null;
};

/**
 * 확대 컷 참조용 크롭 영역(픽셀). 박스 주변을 조금 넓혀 맥락(봉제선 · 주변 원단)이 함께 보이게 하고,
 * 너무 작은 박스는 최소 크기를 보장한다.
 */
export const cropRectForBox = (width: number, height: number, box: Box, padding = 0.12, minFraction = 0.12) => {
  const [ymin, xmin, ymax, xmax] = box;
  let x0 = (xmin / 1000) * width;
  let x1 = (xmax / 1000) * width;
  let y0 = (ymin / 1000) * height;
  let y1 = (ymax / 1000) * height;
  const padX = (x1 - x0) * padding;
  const padY = (y1 - y0) * padding;
  x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
  const minW = width * minFraction;
  const minH = height * minFraction;
  if (x1 - x0 < minW) { const cx = (x0 + x1) / 2; x0 = cx - minW / 2; x1 = cx + minW / 2; }
  if (y1 - y0 < minH) { const cy = (y0 + y1) / 2; y0 = cy - minH / 2; y1 = cy + minH / 2; }
  // 가장자리에 붙은 영역은 잘라내지 말고 이미지 안쪽으로 밀어 넣어 크기를 유지한다.
  const shift = (start: number, end: number, limit: number) => {
    const size = Math.min(limit, end - start);
    const begin = Math.min(Math.max(0, start), limit - size);
    return [Math.floor(begin), Math.ceil(begin + size)] as const;
  };
  const [x, xEnd] = shift(x0, x1, width);
  const [y, yEnd] = shift(y0, y1, height);
  return {
    x,
    y,
    width: Math.max(1, Math.min(width, xEnd) - x),
    height: Math.max(1, Math.min(height, yEnd) - y),
  };
};

/* ───────────── 원본 분석 ───────────── */

export const ANALYSIS_PROMPT = `You are a garment technical designer inspecting ONE product image of a garment design.
The image may show two views side by side: the garment FRONT on the left half and the BACK on the right half.
Report ONLY what is actually visible. Never guess hidden parts. Return JSON only:
{
  "garmentType": "hoodie",                  // short English garment type
  "layout": "front_back",                   // "front_back" if front and back views are shown side by side, else "single"
  "frontBox": [ymin, xmin, ymax, xmax],     // box of the front view garment (0-1000 scale), null if not visible
  "backBox": [ymin, xmin, ymax, xmax],      // box of the back view garment, null if the back is not shown
  "backVisible": true,                      // true only if the back of the garment is clearly shown
  "elements": {                             // each: {"present": bool, "box": [ymin,xmin,ymax,xmax] or null, "description": "short English"}
    "neckline": {}, // neckline / collar / hood opening / neck rib
    "sleeve": {},   // sleeve end, cuff
    "hem": {},      // bottom hem / waistband hem
    "print": {},    // printed graphic or printed lettering (screen print, DTG, all-over print)
    "embroidery": {}, // embroidered logo, patch or lettering (raised thread texture)
    "closure": {},  // zipper, buttons, snaps, toggles actually visible on the garment
    "pocket": {},   // pockets (kangaroo, patch, welt, flap ...)
    "logo": {}      // any logo or brand mark (printed or embroidered)
  },
  "mainDesignDetail": {"present": bool, "kind": "print|embroidery|logo|other|none", "box": [..] or null, "description": "short English"}, // the single most important decorative design point, prefer the front view
  "colors": ["main body color", "..."],      // dominant colors and color-blocking, short English
  "fabric": "short English description of the visible fabric (knit/woven, texture, thickness)",
  "summary": "2-3 sentences describing the immutable design: silhouette, fit, length, colors and color blocking, every graphic with its exact position and size, seams/panels, trims and hardware."
}
Boxes use the whole image as the 0-1000 frame. Use the FRONT view for element boxes unless the element exists only on the back.
Set "present": false (and box null) for anything that is not clearly visible. Do not report a zipper or buttons unless you can see them.`;

const emptyElement = (): DesignElement => ({ present: false, box: null, description: "" });

const parseElement = (value: unknown): DesignElement => {
  if (!value || typeof value !== "object") return emptyElement();
  const raw = value as Record<string, unknown>;
  const box = parseBox(raw.box);
  return {
    present: raw.present === true,
    box: raw.present === true ? box : null,
    description: typeof raw.description === "string" ? raw.description.replace(/\s+/g, " ").trim().slice(0, 200) : "",
  };
};

const parseJsonText = (text: string) => {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
};

/** 모델 응답(JSON 텍스트 또는 객체)을 안전한 분석 결과로 만든다. */
export const parseDesignAnalysis = (input: unknown): DesignAnalysis => {
  const raw = (typeof input === "string" ? parseJsonText(input) : input ?? {}) as Record<string, unknown>;
  const rawElements = (raw.elements ?? {}) as Record<string, unknown>;
  const elements = Object.fromEntries(ELEMENT_KEYS.map((key) => [key, parseElement(rawElements[key])])) as Record<DesignElementKey, DesignElement>;
  const main = parseElement(raw.mainDesignDetail);
  const kindRaw = String((raw.mainDesignDetail as Record<string, unknown> | undefined)?.kind ?? "none");
  const kind = (["print", "embroidery", "logo", "other"].includes(kindRaw) ? kindRaw : "none") as DesignAnalysis["mainDesignDetail"]["kind"];
  const backBox = parseBox(raw.backBox);
  const layout = raw.layout === "front_back" && backBox ? "front_back" : "single";
  return {
    garmentType: typeof raw.garmentType === "string" ? raw.garmentType.slice(0, 60) : "",
    layout,
    frontBox: parseBox(raw.frontBox),
    backBox: layout === "front_back" ? backBox : null,
    backVisible: raw.backVisible === true && layout === "front_back",
    elements,
    mainDesignDetail: { ...main, present: main.present && kind !== "none", kind: main.present ? kind : "none" },
    colors: Array.isArray(raw.colors) ? raw.colors.map((entry) => String(entry).slice(0, 60)).filter(Boolean).slice(0, 6) : [],
    fabric: typeof raw.fabric === "string" ? raw.fabric.replace(/\s+/g, " ").slice(0, 200) : "",
    summary: typeof raw.summary === "string" ? raw.summary.replace(/\s+/g, " ").trim().slice(0, 900) : "",
  };
};

/** 이 컷을 만들 수 있는지(원본에 해당 요소가 보이는지). 분석이 없으면 판단을 서버 생성 단계로 미룬다(true). */
export const isShotAvailable = (type: ProductShotType, analysis: DesignAnalysis | null): boolean => {
  const spec = getShotSpec(type);
  if (!spec?.requires || !analysis) return true;
  if (spec.requires === "main_design") return analysis.mainDesignDetail.present;
  return analysis.elements[spec.requires].present;
};

/** 분석 결과에서 이 컷이 확대할 영역. */
export const focusBoxForShot = (type: ProductShotType, analysis: DesignAnalysis | null): Box | null => {
  if (!analysis) return null;
  if (type === "design_detail") return analysis.mainDesignDetail.box;
  const spec = getShotSpec(type);
  if (spec?.requires && spec.requires !== "main_design") return analysis.elements[spec.requires].box;
  return null;
};

/** 결과에 "참고 이미지(원본에서 보이지 않는 부분은 AI 추정)" 표시가 필요한지. */
export const isInferredShot = (type: ProductShotType, analysis: DesignAnalysis | null) => {
  const spec = getShotSpec(type);
  if (!spec) return false;
  if (spec.inferred === "when_back_hidden") return !analysis?.backVisible;
  return spec.inferred;
};

/**
 * 기본 상품 촬영 세트 구성. 주요 디자인 디테일(로고 · 프린팅 · 자수)이 원본에 없으면 그 컷은 빼고
 * needsConfirmation 으로 알려 화면이 사용자 확인(봉제 디테일로 대체 또는 제외)을 받게 한다.
 */
export const planBasicShotSet = (analysis: DesignAnalysis | null) => {
  const missing = BASIC_SHOT_SET.filter((type) => !isShotAvailable(type, analysis));
  return {
    shots: BASIC_SHOT_SET.filter((type) => !missing.includes(type)),
    missing,
    needsConfirmation: missing.length > 0,
  };
};

/* ───────────── 생성 프롬프트 ───────────── */

const BACKGROUND = "Seamless light-grey studio background (#EFEFEF) with soft, even, diffused lighting and a subtle natural contact shadow.";

const ANGLE_DIRECTIONS: Record<AngleShotType, string> = {
  front:
    "SHOT: Straight-on FRONT view of the whole garment, centered, filling most of the frame with every edge visible. Render it like the front view in the reference: the same 3D invisible-mannequin (ghost) product presentation with natural volume and drape. Exactly one garment, no second view.",
  back:
    "SHOT: Straight-on BACK view of the whole garment, centered, filling most of the frame with every edge visible, same 3D invisible-mannequin presentation as the reference. Exactly one garment, no second view.",
  side:
    "SHOT: True SIDE profile (left side, camera rotated 90° from the front) of the whole garment on an invisible mannequin, showing the side seam, sleeve hang, body depth and silhouette. Exactly one garment.",
  three_quarter:
    "SHOT: Three-quarter view — the camera is rotated about 45° from the front toward the garment's left side, so the front and the left side are both visible with clear 3D depth. Whole garment on an invisible mannequin, every edge visible. Exactly one garment.",
  flat_lay:
    "SHOT: Overhead FLAT LAY — the garment laid flat, front side up, on a clean light-grey surface, photographed from directly above. Neatly arranged with sleeves (if any) relaxed slightly outward, natural soft creases, whole garment in frame. No props, no hanger, no mannequin.",
  hanger:
    "SHOT: The garment hanging from a simple plain hanger (wooden or matte metal, no text) against a light-grey wall, front facing the camera, whole garment and hanger hook visible. For trousers/skirts use a plain clip hanger. No other items.",
  mannequin:
    "SHOT: The garment worn on a plain matte white HEADLESS dress form (fashion mannequin torso without head, face or arms; a lower-body form for trousers/skirts), front facing the camera, whole garment visible, realistic fit and drape. No real person, no head, no face.",
};

const DETAIL_DIRECTIONS: Record<DetailShotType | "custom_region", string> = {
  fabric:
    "SHOT: Extreme macro close-up of the garment FABRIC surface, filling the frame: show the knit/weave structure, fiber texture, surface hand-feel and thickness at the exact same color. Sample a plain body area with no graphic. Slight angle with raking light to reveal texture.",
  stitching:
    "SHOT: Macro close-up of the garment's SEAM construction — stitches, seam lines, topstitching and seam finishing — exactly as they appear on the reference (same stitch type, thread color and seam placement). Do not invent decorative stitching.",
  neckline:
    "SHOT: Close-up of the NECKLINE area — collar / hood opening / neck rib (ribbing) and its finishing — exactly as on the reference.",
  sleeve:
    "SHOT: Close-up of the SLEEVE END and cuff (rib cuff, hem or placket) with its stitching, exactly as on the reference.",
  hem:
    "SHOT: Close-up of the bottom HEM — hem band or folded hem, its stitching and finishing — exactly as on the reference.",
  print:
    "SHOT: Close-up of the PRINTED GRAPHIC. Reproduce the graphic exactly as on the reference (same shapes, letters, colors, proportions and orientation) and show realistic print ink texture sitting on the fabric. Do not redraw, simplify, translate or add to the graphic.",
  embroidery:
    "SHOT: Macro close-up of the EMBROIDERY. Reproduce the embroidered design exactly as on the reference (same shapes, letters, colors and size relative to the garment) and show realistic raised thread texture and stitch direction.",
  closure:
    "SHOT: Close-up of the CLOSURE hardware actually present on the reference (zipper or buttons): same type, count, color, finish and placement. Do not add hardware that is not on the reference.",
  pocket:
    "SHOT: Close-up of the POCKET exactly as on the reference — its shape, opening, stitching and construction.",
  design_detail:
    "SHOT: Close-up of the garment's main DESIGN DETAIL (its logo / print / embroidery) exactly as on the reference — same shapes, letters, colors and placement — with realistic material texture (ink or thread).",
  custom_region:
    "SHOT: Close-up of exactly the area the user selected (see the SELECTED AREA reference). Show that same area larger and sharper, as if photographed closer with a macro lens. Reproduce only what is inside the selected area — same graphic, colors, stitching and fabric — and add nothing that is not there.",
};

export type ProductShotPromptInput = {
  type: ProductShotType;
  /** 참조 이미지 라벨(순서 = 요청에 붙는 순서). 첫 번째는 항상 원본 디자인. */
  referenceLabels: string[];
  analysis: DesignAnalysis | null;
  product: { clothType?: string | null; material?: string | null; color?: string | null; fit?: string | null; detail?: string | null };
  /** 사용자 지정 영역(0~1000 박스). */
  region?: Box | null;
  /** 화면에서 입력한 보충 설명(무엇을 보고 싶은지). */
  note?: string | null;
  retryNote?: string | null;
};

const clean = (value: string | null | undefined, max = 300) => (value ?? "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** 컷 하나를 만드는 프롬프트. 원본 디자인 고정(DESIGN LOCK)이 가장 앞선다. */
export const buildProductShotPrompt = (input: ProductShotPromptInput) => {
  const spec = getShotSpec(input.type);
  if (!spec) throw new Error(`unknown shot type: ${input.type}`);
  const analysis = input.analysis;
  const refs = input.referenceLabels.map((label, index) => `- REFERENCE IMAGE ${index + 1}: ${label}`).join("\n");
  const product = [
    clean(input.product.clothType, 60) && `garment: ${clean(input.product.clothType, 60)}`,
    clean(input.product.material, 60) && `material: ${clean(input.product.material, 60)}`,
    clean(input.product.color, 60) && `color: ${clean(input.product.color, 60)}`,
    clean(input.product.fit, 60) && `fit: ${clean(input.product.fit, 60)}`,
  ].filter(Boolean).join(", ");

  const visible = analysis
    ? ELEMENT_KEYS.filter((key) => analysis.elements[key].present).map((key) => `${key}${analysis.elements[key].description ? ` (${analysis.elements[key].description})` : ""}`)
    : [];
  const absent = analysis ? ELEMENT_KEYS.filter((key) => !analysis.elements[key].present && key !== "neckline" && key !== "sleeve" && key !== "hem") : [];

  const hidden =
    input.type === "back" && !analysis?.backVisible
      ? "The back is NOT shown in the reference. Infer only a plain back that is consistent with the front (same body color, panels, rib, length). Do NOT put any graphic, print, logo, text, embroidery, pocket or hardware on the back."
      : input.type === "side" || input.type === "three_quarter"
        ? "Parts of the side are not visible in the reference: continue the front/back colors, seams and panels logically, and do NOT add any graphic, stripe, pocket, zipper or trim that is not visible in the references."
        : "";

  const regionLine = input.region
    ? `SELECTED AREA: the user selected the box [ymin ${input.region[0]}, xmin ${input.region[1]}, ymax ${input.region[2]}, xmax ${input.region[3]}] (0-1000 scale) of REFERENCE IMAGE 1. Focus the close-up on that area only.`
    : "";

  const isAngle = spec.category === "angle";
  const note = clean(input.note, 200);

  return [
    "TASK: Product photography of an EXISTING garment. This is NOT a new design: photograph the exact same physical garment shown in REFERENCE IMAGE 1 " +
      (isAngle ? "from a different camera angle / presentation." : "from much closer, as a detail close-up."),
    `REFERENCES:\n${refs}`,
    [
      "DESIGN LOCK (highest priority after the branding policy) — keep IDENTICAL to the reference:",
      "- silhouette, fit, proportions and length",
      "- every color and the color blocking / color placement",
      "- logo position, size and shape",
      "- print and embroidery artwork (shapes, letters, colors, placement, scale)",
      "- seams, panel / cut lines and stitching",
      "- pockets, zippers, buttons, drawcords, rib and every trim — same count, type and placement",
      "- fabric texture, sheen and thickness",
      "Do not add any element that is not visible in the references and do not remove any element that is. Never invent hardware, pockets, graphics or text.",
    ].join("\n"),
    analysis?.summary ? `THE DESIGN (from the reference): ${analysis.summary}` : "",
    visible.length ? `Visible design elements: ${visible.join("; ")}.` : "",
    absent.length ? `NOT present on this garment (must not appear): ${absent.join(", ")}.` : "",
    analysis?.fabric ? `Fabric: ${analysis.fabric}.` : "",
    product ? `Product info: ${product}.` : "",
    analysis?.layout === "front_back"
      ? "REFERENCE IMAGE 1 shows the FRONT on the left half and the BACK on the right half of one garment — they are two views of the same single garment."
      : "",
    isAngle ? ANGLE_DIRECTIONS[input.type as AngleShotType] : DETAIL_DIRECTIONS[input.type as DetailShotType | "custom_region"],
    regionLine,
    hidden,
    note ? `Creator's note for this shot (apply only if it does not change the design): "${note}"` : "",
    BACKGROUND,
    "No people, faces, heads, hands or body parts. No props. No text overlays, captions, rulers, tags, watermarks or frames.",
    [
      "BRANDING POLICY:",
      '- "BRAND-ER" is the platform name, never the product brand. Never write "BRAND-ER"/"BRANDER" or draw its logo anywhere.',
      "- The logo/graphics/lettering already on the reference garment are the creator's design: reproduce them exactly and only where they are. Do not add any other logo, wordmark, label text, slogan, number or watermark.",
    ].join("\n"),
    input.retryNote ? clean(input.retryNote, 1200) : "",
    "Output exactly one photorealistic, high-resolution e-commerce product photo.",
  ]
    .filter(Boolean)
    .join("\n\n");
};
