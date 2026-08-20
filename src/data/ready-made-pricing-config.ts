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
 *
 * Pricing formula:
 *   장당 예상금액 = 의류 기본단가 (품목별) + (프린팅 위치 개수 × 5,000원)
 *   총 예상금액 = 장당 예상금액 × 제작수량 (+ VAT)
 */

/** 위치 1곳당 프린팅 비용 (원/장) */
export const READY_MADE_PRINT_LOCATION_PRICE = 5000;

/** VAT rate applied on top of the supply amount. */
export const READY_MADE_VAT_RATE = 0.1;

export const READY_MADE_ESTIMATED_LEAD_TIME_LABEL = "약 7일 이내";

// ---------------------------------------------------------------------------
// Sizes
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
// Colors — shared across every product so color-swap works the same way
// everywhere. `swatch` is the hex value the on-screen mockup gets recolored
// to (see `src/lib/garment-recolor.ts`). Gray is the first/default selection.
// ---------------------------------------------------------------------------

export const READY_MADE_COLOR_OPTIONS = ["그레이", "화이트", "블랙", "네이비"] as const;
export type ReadyMadeColor = (typeof READY_MADE_COLOR_OPTIONS)[number];

export const READY_MADE_COLOR_SWATCHES: Record<ReadyMadeColor, string> = {
  화이트: "#ffffff",
  블랙: "#1c1c1c",
  그레이: "#8f8f8f",
  네이비: "#1e2a4a",
};

// ---------------------------------------------------------------------------
// Ready-made product catalog & base prices
// ---------------------------------------------------------------------------

export interface ReadyMadeProductOption {
  key: string;
  label: string;
  description: string;
  /** 의류 1장당 기본 단가 (원) */
  basePrice: number;
  /** 브랜더가 미리 준비한 무지 의류 앞면 기본 이미지 */
  imageFront: string;
  /** 브랜더가 미리 준비한 무지 의류 뒷면 기본 이미지 */
  imageBack: string;
  /** 상품의 최초 기본 색상 */
  defaultColor: ReadyMadeColor;
  /** True while this category is still using a placeholder image instead of a real product photo. */
  hasPlaceholderImage?: boolean;
  colors: readonly ReadyMadeColor[];
}

const readyMadeUploadsBase = "/lovable-uploads/ready-made";
const clothingTemplatesBase = "/clothing-templates";

export const READY_MADE_PRODUCT_OPTIONS: ReadyMadeProductOption[] = [
  {
    key: "short_sleeve_tee",
    label: "라운드 반팔 티셔츠",
    description: "가장 기본적인 라운드넥 반팔 티셔츠",
    basePrice: 7000,
    imageFront: `${readyMadeUploadsBase}/short_sleeve_front.png`,
    imageBack: `${readyMadeUploadsBase}/short_sleeve_back.png`,
    defaultColor: "그레이",
    colors: READY_MADE_COLOR_OPTIONS,
  },
  {
    key: "polo",
    label: "폴로셔츠",
    description: "카라가 있는 단정한 폴로셔츠",
    basePrice: 9000,
    imageFront: `${readyMadeUploadsBase}/placeholder.png`,
    imageBack: `${readyMadeUploadsBase}/placeholder.png`,
    defaultColor: "그레이",
    hasPlaceholderImage: true,
    colors: READY_MADE_COLOR_OPTIONS,
  },
  {
    key: "sweatshirt",
    label: "맨투맨",
    description: "두께감 있는 기본 맨투맨",
    basePrice: 12000,
    imageFront: `${readyMadeUploadsBase}/sweatshirt_front.png`,
    imageBack: `${readyMadeUploadsBase}/sweatshirt_back.png`,
    defaultColor: "그레이",
    colors: READY_MADE_COLOR_OPTIONS,
  },
  {
    key: "half_pants",
    label: "하프팬츠",
    description: "여름 단체복으로 자주 쓰는 하프팬츠",
    basePrice: 15000,
    imageFront: `${readyMadeUploadsBase}/placeholder.png`,
    imageBack: `${readyMadeUploadsBase}/placeholder.png`,
    defaultColor: "그레이",
    hasPlaceholderImage: true,
    colors: READY_MADE_COLOR_OPTIONS,
  },
  {
    key: "hoodie",
    label: "후드티",
    description: "단체 스태프복으로 자주 쓰는 기본 후드티",
    basePrice: 15000,
    imageFront: `${readyMadeUploadsBase}/hoodie_front.png`,
    imageBack: `${readyMadeUploadsBase}/hoodie_back.png`,
    defaultColor: "그레이",
    colors: READY_MADE_COLOR_OPTIONS,
  },
  {
    key: "hoodie_zipup",
    label: "후드집업",
    description: "앞지퍼가 있는 후드 집업",
    basePrice: 20000,
    imageFront: `${readyMadeUploadsBase}/placeholder.png`,
    imageBack: `${readyMadeUploadsBase}/placeholder.png`,
    defaultColor: "그레이",
    hasPlaceholderImage: true,
    colors: READY_MADE_COLOR_OPTIONS,
  },
];

// ---------------------------------------------------------------------------
// Print locations
// ---------------------------------------------------------------------------

export type ReadyMadePrintLocation =
  | "front_center"
  | "back_center"
  | "left_chest"
  | "right_chest"
  | "left_sleeve"
  | "right_sleeve";

export const READY_MADE_PRINT_LOCATION_OPTIONS: {
  key: ReadyMadePrintLocation;
  label: string;
}[] = [
  { key: "front_center", label: "앞면" },
  { key: "back_center", label: "뒷면" },
  { key: "left_chest", label: "왼쪽 가슴" },
  { key: "right_chest", label: "오른쪽 가슴" },
  { key: "left_sleeve", label: "왼쪽 소매" },
  { key: "right_sleeve", label: "오른쪽 소매" },
];

export type ReadyMadeGarmentSide = "front" | "back";

/** Which mockup (front/back) each location lives on. */
export const READY_MADE_LOCATION_SIDE: Record<ReadyMadePrintLocation, ReadyMadeGarmentSide> = {
  front_center: "front",
  back_center: "back",
  left_chest: "front",
  right_chest: "front",
  left_sleeve: "front",
  right_sleeve: "front",
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

/** Starting placement for each location relative to a garment mockup — the customer can
 * drag/resize freely from here. */
export const READY_MADE_LOCATION_PLACEMENT_PRESET: Record<
  ReadyMadePrintLocation,
  ReadyMadeArtworkPlacement
> = {
  front_center: { xPercent: 50, yPercent: 50, widthPercent: 30 },
  back_center: { xPercent: 50, yPercent: 46, widthPercent: 32 },
  left_chest: { xPercent: 34, yPercent: 28, widthPercent: 16 },
  right_chest: { xPercent: 66, yPercent: 28, widthPercent: 16 },
  left_sleeve: { xPercent: 18, yPercent: 42, widthPercent: 14 },
  right_sleeve: { xPercent: 82, yPercent: 42, widthPercent: 14 },
};

// ---------------------------------------------------------------------------
// Required customer-facing notices
// ---------------------------------------------------------------------------

export const READY_MADE_SERVICE_NOTICE = [
  "기성품을 활용하는 빠른 제작 서비스입니다.",
  "원단, 핏 및 세부 사이즈를 고객 요청에 맞게 변경할 수 없습니다.",
  "단체복용 기성품 기준 예상 단가이며, 최종 확정 금액은 상담 과정에서 달라질 수 있습니다.",
  "정확한 원단·핏·사이즈를 원하시는 경우 '맞춤 의류 제작'을 이용해주세요.",
].join("\n");

export const READY_MADE_ESTIMATE_VARIANCE_NOTICE =
  "수량, 의류 형태, 인쇄 위치 개수 및 디자인에 따라 최종 견적이 일부 달라질 수 있습니다.";

export const READY_MADE_VAT_NOTICE =
  "표시 가격은 VAT 별도 기준이며, 결제 단계에서 VAT를 포함한 최종 금액을 확인할 수 있습니다.";
