/**
 * Pricing data for the "기성품 단체복 빠른 제작" (ready-made group wear) service.
 *
 * This module holds ONLY data (prices, labels, catalogs) — no calculation logic.
 * It is intentionally separate from `src/lib/ready-made-pricing.ts` so an admin
 * updating a price only ever needs to edit values in this file, never touch the
 * math in the pricing module or any UI component.
 *
 * This pricing model is completely independent from the existing custom-clothing
 * auto-estimate (`src/lib/production-estimate-quantity.ts`, `productionEstimate`
 * types/services). Nothing here is read by, or should be read by, that flow.
 */

/** 기성 무지 의류 기본 가격 (원/장) — section 2 */
export const READY_MADE_GARMENT_BASE_PRICE = 7000;

/** VAT rate applied on top of the supply amount — section 11 */
export const READY_MADE_VAT_RATE = 0.1;

export const READY_MADE_ESTIMATED_LEAD_TIME_LABEL = "약 7일 이내";

// ---------------------------------------------------------------------------
// Sizes — section 3
// ---------------------------------------------------------------------------

export const READY_MADE_SIZE_OPTIONS = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
] as const;

export type ReadyMadeSize = (typeof READY_MADE_SIZE_OPTIONS)[number];

export type ReadyMadeSizeQuantities = Record<ReadyMadeSize, number>;

export const createEmptySizeQuantities = (): ReadyMadeSizeQuantities => ({
  XS: 0,
  S: 0,
  M: 0,
  L: 0,
  XL: 0,
  "2XL": 0,
  "3XL": 0,
});

// ---------------------------------------------------------------------------
// Ready-made product catalog — section 1 / step 01
// (Garment choice never changes the price — the base price is flat per section 2.)
// ---------------------------------------------------------------------------

export interface ReadyMadeProductOption {
  key: string;
  label: string;
  description: string;
  image: string;
  colors: string[];
}

export const READY_MADE_PRODUCT_OPTIONS: ReadyMadeProductOption[] = [
  {
    key: "short_sleeve_tee",
    label: "반팔 티셔츠",
    description: "가장 기본적인 라운드넥 반팔 티셔츠",
    image: "/lovable-uploads/short_sleeve.png",
    colors: ["화이트", "블랙", "그레이", "네이비", "레드"],
  },
  {
    key: "long_sleeve_tee",
    label: "긴팔 티셔츠",
    description: "환절기·행사에 무난한 라운드넥 긴팔 티셔츠",
    image: "/lovable-uploads/long_sleeve.png",
    colors: ["화이트", "블랙", "그레이", "네이비"],
  },
  {
    key: "sweatshirt",
    label: "맨투맨",
    description: "두께감 있는 기본 맨투맨",
    image: "/lovable-uploads/sweatshirt.png",
    colors: ["블랙", "그레이", "네이비", "베이지"],
  },
  {
    key: "hoodie_zipup",
    label: "후드 집업",
    description: "단체 스태프복으로 자주 쓰는 후드 집업",
    image: "/lovable-uploads/hoodie.png",
    colors: ["블랙", "그레이", "네이비"],
  },
];

// ---------------------------------------------------------------------------
// Print method — section 4
// ---------------------------------------------------------------------------

export type ReadyMadePrintMethod = "dtg" | "dtf";

export const READY_MADE_PRINT_METHOD_LABELS: Record<ReadyMadePrintMethod, string> = {
  dtg: "DTG 디지털 나염",
  dtf: "DTF 필름 전사",
};

// ---------------------------------------------------------------------------
// Print locations — section 5
// ---------------------------------------------------------------------------

export type ReadyMadePrintLocation =
  | "left_chest"
  | "right_chest"
  | "front_center"
  | "back_center"
  | "sleeve"
  | "custom";

export const READY_MADE_PRINT_LOCATION_OPTIONS: {
  key: ReadyMadePrintLocation;
  label: string;
}[] = [
  { key: "left_chest", label: "왼쪽 가슴" },
  { key: "right_chest", label: "오른쪽 가슴" },
  { key: "front_center", label: "앞면 중앙" },
  { key: "back_center", label: "뒷면 중앙" },
  { key: "sleeve", label: "소매" },
  { key: "custom", label: "직접 위치 지정" },
];

export type ReadyMadeGarmentSide = "front" | "back";

/** Which mockup (front/back) each location lives on by default. "custom" has no fixed side —
 * the customer picks one when they place it. */
export const READY_MADE_LOCATION_SIDE: Record<
  Exclude<ReadyMadePrintLocation, "custom">,
  ReadyMadeGarmentSide
> = {
  left_chest: "front",
  right_chest: "front",
  front_center: "front",
  back_center: "back",
  sleeve: "front",
};

/** Percentage-based placement geometry for one artwork on a garment mockup — same shape as the
 * custom-clothing flow's `ArtworkPlacement` (x/y/width, all % of the mockup image), kept as a
 * plain local type instead of importing that one so this pricing-data module has no dependency
 * on the custom-clothing feature. */
export interface ReadyMadeArtworkPlacement {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
}

export const READY_MADE_MIN_ARTWORK_WIDTH_PERCENT = 6;
export const READY_MADE_MAX_ARTWORK_WIDTH_PERCENT = 55;

/** Starting placement for each location, matched to the size category's real-world scale
 * (section 6) relative to a garment mockup — the customer can drag/resize freely from here. */
export const READY_MADE_LOCATION_PLACEMENT_PRESET: Record<
  Exclude<ReadyMadePrintLocation, "custom">,
  ReadyMadeArtworkPlacement
> = {
  left_chest: { xPercent: 34, yPercent: 28, widthPercent: 16 },
  right_chest: { xPercent: 66, yPercent: 28, widthPercent: 16 },
  front_center: { xPercent: 50, yPercent: 50, widthPercent: 30 },
  back_center: { xPercent: 50, yPercent: 46, widthPercent: 32 },
  sleeve: { xPercent: 18, yPercent: 42, widthPercent: 14 },
};

export const READY_MADE_CUSTOM_LOCATION_PLACEMENT_PRESET: ReadyMadeArtworkPlacement = {
  xPercent: 50,
  yPercent: 50,
  widthPercent: 24,
};

// ---------------------------------------------------------------------------
// Graphic size categories — section 6
// ---------------------------------------------------------------------------

export type ReadyMadeGraphicSizeCategory = "small" | "medium" | "large";

export interface ReadyMadeGraphicSizeCategoryInfo {
  key: ReadyMadeGraphicSizeCategory;
  label: string;
  spec: string;
  widthCm: number;
  heightCm: number;
}

export const READY_MADE_GRAPHIC_SIZE_CATEGORIES: Record<
  ReadyMadeGraphicSizeCategory,
  ReadyMadeGraphicSizeCategoryInfo
> = {
  small: {
    key: "small",
    label: "소",
    spec: "10 × 10cm",
    widthCm: 10,
    heightCm: 10,
  },
  medium: {
    key: "medium",
    label: "중",
    spec: "A4 이내 (21 × 29.7cm)",
    widthCm: 21,
    heightCm: 29.7,
  },
  large: {
    key: "large",
    label: "대",
    spec: "A3 이내 (29.7 × 42cm)",
    widthCm: 29.7,
    heightCm: 42,
  },
};

// ---------------------------------------------------------------------------
// Quantity tiers — the pricing table that applies depends on total quantity.
// Boundaries per spec: 1-4 / 5-49 / 50+.
// ---------------------------------------------------------------------------

export type ReadyMadeQuantityTier = "sample" | "smallBatch" | "bulk";

export const READY_MADE_SAMPLE_TIER_MAX_QUANTITY = 4;
export const READY_MADE_SMALL_BATCH_TIER_MAX_QUANTITY = 49;
export const READY_MADE_BULK_TIER_MIN_QUANTITY = 50;

/** 1~4장 샘플 주문 인쇄비 (동일 디자인 기준, 원/장) — section 7 */
export const READY_MADE_SAMPLE_TIER_PRINT_PRICE: Record<
  ReadyMadeGraphicSizeCategory,
  number
> = {
  small: 5000,
  medium: 7000,
  large: 10000,
};

/** 5~49장 소량 생산 인쇄비 (동일 디자인 기준, 원/장) — section 8 */
export const READY_MADE_SMALL_BATCH_TIER_PRINT_PRICE: Record<
  ReadyMadeGraphicSizeCategory,
  number
> = {
  small: 3000,
  medium: 5000,
  large: 7000,
};

// ---------------------------------------------------------------------------
// 50장 이상 DTF 대량생산 — section 9
//
// The spec lists a base price table, then says a size whose longer side
// exceeds 28cm uses a separate ("override") price column instead. Every size
// option at or under 28cm on both sides uses the base table; every option
// where a side exceeds 28cm (30×30 and up) uses the override values given in
// the spec, since those sizes always exceed 28cm on both sides.
// ---------------------------------------------------------------------------

export interface ReadyMadeBulkSizeOption {
  key: string;
  label: string;
  widthCm: number;
  heightCm: number;
  price: number;
}

export const READY_MADE_DTF_BULK_SIZE_OPTIONS: ReadyMadeBulkSizeOption[] = [
  { key: "10x10", label: "10×10cm", widthCm: 10, heightCm: 10, price: 1500 },
  { key: "15x15", label: "15×15cm", widthCm: 15, heightCm: 15, price: 1800 },
  { key: "20x20", label: "20×20cm", widthCm: 20, heightCm: 20, price: 2400 },
  { key: "27x28", label: "27×28cm", widthCm: 27, heightCm: 28, price: 2800 },
  // 단면(한 변) 28cm 초과 — 별도 가격 컬럼 적용
  { key: "30x30", label: "30×30cm", widthCm: 30, heightCm: 30, price: 4500 },
  { key: "35x35", label: "35×35cm", widthCm: 35, heightCm: 35, price: 4500 },
  { key: "40x40", label: "40×40cm", widthCm: 40, heightCm: 40, price: 6000 },
  { key: "45x45", label: "45×45cm", widthCm: 45, heightCm: 45, price: 7000 },
];

// ---------------------------------------------------------------------------
// 50장 이상 DTG 대량생산 — section 10
// ---------------------------------------------------------------------------

export interface ReadyMadeDtgBulkSizeOption {
  key: string;
  label: string;
  widthCm: number;
  heightCm: number;
  /** 전처리 O */
  pretreatmentPrice: number;
  /** 전처리 X */
  noPretreatmentPrice: number;
}

export const READY_MADE_DTG_BULK_SIZE_OPTIONS: ReadyMadeDtgBulkSizeOption[] = [
  { key: "10x10", label: "10×10cm", widthCm: 10, heightCm: 10, pretreatmentPrice: 2800, noPretreatmentPrice: 2000 },
  { key: "20x20", label: "20×20cm", widthCm: 20, heightCm: 20, pretreatmentPrice: 3600, noPretreatmentPrice: 2200 },
  { key: "30x30", label: "30×30cm", widthCm: 30, heightCm: 30, pretreatmentPrice: 4500, noPretreatmentPrice: 2400 },
  { key: "35x40", label: "35×40cm", widthCm: 35, heightCm: 40, pretreatmentPrice: 5000, noPretreatmentPrice: 2600 },
  { key: "40x45", label: "40×45cm", widthCm: 40, heightCm: 45, pretreatmentPrice: 5500, noPretreatmentPrice: 2800 },
];

/** Default bulk size key to preselect per graphic size category, per print method. */
export const READY_MADE_DEFAULT_BULK_SIZE_KEY: Record<
  ReadyMadePrintMethod,
  Record<ReadyMadeGraphicSizeCategory, string>
> = {
  dtf: { small: "10x10", medium: "27x28", large: "40x40" },
  dtg: { small: "10x10", medium: "30x30", large: "40x45" },
};

// ---------------------------------------------------------------------------
// Required customer-facing notices — section 14
// ---------------------------------------------------------------------------

export const READY_MADE_SERVICE_NOTICE = [
  "기성품을 활용하는 빠른 제작 서비스입니다.",
  "원단, 핏 및 세부 사이즈를 고객 요청에 맞게 변경할 수 없습니다.",
  "제품별 실측 사이즈와 색상은 재고 및 공급 제품에 따라 달라질 수 있습니다.",
  "정확한 원단·핏·사이즈를 원하시는 경우 '맞춤 의류 제작'을 이용해주세요.",
].join("\n");

export const READY_MADE_ESTIMATE_VARIANCE_NOTICE =
  "수량, 의류 형태, 인쇄량 및 디자인에 따라 최종 견적이 일부 달라질 수 있습니다.";

export const READY_MADE_VAT_NOTICE =
  "표시 가격은 VAT 별도 기준이며, 결제 단계에서 VAT를 포함한 최종 금액을 확인할 수 있습니다.";
