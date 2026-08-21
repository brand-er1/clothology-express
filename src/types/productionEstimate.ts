export type EstimateDifficulty = "easy" | "medium" | "hard";

export type DecorationAnalysisKind =
  | "screen_print_1_color"
  | "screen_print_multi_color"
  | "dtf"
  | "dtg"
  | "pu"
  | "silicone_print"
  | "embroidery"
  | "patch"
  | "transfer"
  | "label"
  | "washing"
  | "pigment"
  | "unknown_print";

export type DecorationLocation =
  | "front"
  | "back"
  | "left_sleeve"
  | "right_sleeve"
  | "neck"
  | "other";

export type ArtworkType = "logo" | "photo" | "illustration";
export type PrintSize = "small" | "medium" | "large" | "unknown";

export type AccessoryAnalysisKind =
  | "stud"
  | "zipper"
  | "button"
  | "rivet"
  | "hood_cord"
  | "snap_button"
  | "buckle"
  | "drawstring";

export interface UploadedArtworkAnalysis {
  artworkType: ArtworkType;
  artworkTypeLabel: string;
  recommendedKind: DecorationAnalysisKind;
  location: DecorationLocation;
  locationLabel: string;
  confidence: number;
  reason: string;
  priceLabel?: string | null;
  unitMin?: number | null;
  unitMax?: number | null;
  isStartingFrom?: boolean;
  pricingNote?: string | null;
}

export interface DecorationEstimateLine {
  kind: DecorationAnalysisKind;
  label: string;
  location: DecorationLocation;
  locationLabel: string;
  size: PrintSize;
  confidence: number;
  unitMin: number;
  unitMax: number;
  lineMin: number;
  lineMax: number;
  isStartingFrom: boolean;
  note?: string | null;
  source?: "image_analysis" | "uploaded_artwork";
  artworkType?: ArtworkType | null;
  /** Set only on the aggregate top-level `decorations` array of a multi-item estimate. */
  itemIndex?: number;
  itemLabel?: string;
  /** 0-based indices into the request's `images` array where this exact decoration was found. */
  sourceImages?: number[];
  /** True when the AI could not confidently tell which decoration technique this is. */
  ambiguous?: boolean;
  /** Candidate techniques to offer the user when `ambiguous` is true. */
  ambiguousOptions?: DecorationAnalysisKind[];
  /**
   * Stable id linking this (possibly location-expanded) line back to its source entry in
   * `ProductionEstimateResult.rawAnalysisSnapshot`, so resolving an ambiguous technique can be
   * sent back to the pricing engine without re-running the AI analysis.
   */
  sourceDecorationId?: string;
}

export interface AccessoryEstimateLine {
  kind: AccessoryAnalysisKind;
  label: string;
  count: number;
  confidence: number;
  unitPrice: number;
  lineTotal: number;
  note?: string | null;
  /** Set only on the aggregate top-level `accessories` array of a multi-item estimate. */
  itemIndex?: number;
  itemLabel?: string;
  /** 0-based indices into the request's `images` array where this accessory was found. */
  sourceImages?: number[];
}

export interface ProductionAnalysis {
  categoryKey: string;
  categoryLabel: string;
  categoryConfidence: number;
  hasLining: boolean;
  difficulty: EstimateDifficulty;
  difficultyReason: string;
  hasPrinting: boolean;
  hasEmbroidery: boolean;
  hasDyeing: boolean;
  hasWashing: boolean;
  detectedDecorationCount: number;
  detectedAccessoryCount: number;
  features: string[];
}

export interface ProductionEstimateMaterial {
  key: string;
  label: string;
  confidence: number;
  composition: string;
}

export interface ManualProductionAnalysis {
  categoryKey: string;
  categoryConfidence: number;
  materialKey: string;
  materialLabel: string;
  materialConfidence: number;
  materialComposition: string;
  hasLining: boolean;
  hasWashing: boolean;
  difficulty: EstimateDifficulty;
  difficultyReason: string;
  decorations: Array<{
    kind: DecorationAnalysisKind;
    location: DecorationLocation;
    size: PrintSize;
    confidence: number;
  }>;
  accessories: Array<{
    kind: AccessoryAnalysisKind;
    count: number;
    confidence: number;
  }>;
  features: string[];
}

export interface ProductionEstimateTotals {
  quantity: number;
  productionOriginalMin?: number | null;
  productionOriginalMax?: number | null;
  productionMin: number | null;
  productionMax: number | null;
  productionIsStartingFrom: boolean;
  productionDiscountRate: number;
  productionUnitSurcharge: number;
  productionTotalMin: number;
  productionTotalMax: number;
  patternCost: number;
  baseSampleCost: number;
  sampleCost: number;
  sampleSurcharge: number;
  printPlateCount: number;
  printPlateCost: number;
  embroiderySampleCount: number;
  embroiderySampleCost: number;
  dyeingSampleCount: number;
  dyeingSampleCost: number;
  washingSampleCount: number;
  washingSampleCost: number;
  decorationDevelopmentCost: number;
  developmentTotal: number;
  decorationMin: number;
  decorationMax: number;
  decorationTotalMin: number;
  decorationTotalMax: number;
  accessoryUnitTotal: number;
  accessoryTotal: number;
  directUnitMin: number;
  directUnitMax: number;
  totalMin: number;
  totalMax: number;
  effectiveUnitMin: number;
  effectiveUnitMax: number;
  totalIsStartingFrom: boolean;
  /** Present once a production-country multiplier has been applied (see `lib/production-country.ts`). */
  productionCountry?: "korea" | "china" | "japan";
  productionCountryMultiplier?: number;
  /** Domestic (Korea-baseline) per-unit production price before the country multiplier. */
  domesticProductionMin?: number | null;
  domesticProductionMax?: number | null;
}

export interface ProductionEstimateGarment {
  key: string;
  label: string;
  moq: number;
  note?: string | null;
}

export interface ProductionEstimateMaterialPremium {
  key: string;
  label: string;
  sampleSurcharge: number;
  productionUnitSurcharge: number;
  note?: string | null;
}

/**
 * One independently-analyzed, independently-priced garment out of a possibly-multi-item design
 * image (e.g. a jacket+pants set). Same field shape as the top-level result's own fields, just
 * scoped to this one item — so per-item and aggregate rendering can share formatting logic.
 */
export interface ProductionEstimateItem {
  itemIndex: number;
  /** Short Korean label for this item, e.g. "자켓" or "상의 · 후드집업" — used as a UI heading. */
  itemLabel: string;
  analysis: ProductionAnalysis;
  garment: ProductionEstimateGarment;
  material: ProductionEstimateMaterial;
  materialPremium: ProductionEstimateMaterialPremium | null;
  decorations: DecorationEstimateLine[];
  accessories: AccessoryEstimateLine[];
  totals: ProductionEstimateTotals;
  isPartial: boolean;
  manualReviewReasons: string[];
  /** 0-based indices into the request's `images` array grouped into this one product. */
  sourceImages?: number[];
}

/**
 * One image slot in a multi-image upload. `base64`/`mimeType` are used for a freshly-selected
 * file; `url` is used for an already-uploaded/stored image. At least one of `base64` or `url`
 * must be set.
 */
export interface ProductionEstimateImageInput {
  base64?: string;
  mimeType?: string;
  url?: string;
}

/** Loosely-typed raw per-item analysis entry as produced by the AI (or edited by the user). */
export interface ProductionAnalysisSnapshotDecoration {
  id?: string;
  kind?: string;
  locations?: string[];
  location?: string;
  size?: string;
  colorCount?: number;
  confidence?: number;
  sourceImages?: number[];
  ambiguous?: boolean;
  ambiguousOptions?: string[];
  [key: string]: unknown;
}

export interface ProductionAnalysisSnapshotItem {
  categoryKey?: string;
  decorations?: ProductionAnalysisSnapshotDecoration[];
  accessories?: Array<{
    kind?: string;
    count?: number;
    confidence?: number;
    sourceImages?: number[];
    [key: string]: unknown;
  }>;
  sourceImages?: number[];
  [key: string]: unknown;
}

export interface ProductionEstimateResult {
  sourceFile: string;
  sourceVersion: string;
  generatedAt: string;
  currency: "KRW";
  analysis: ProductionAnalysis;
  garment: ProductionEstimateGarment;
  material: ProductionEstimateMaterial;
  materialPremium: ProductionEstimateMaterialPremium | null;
  decorations: DecorationEstimateLine[];
  accessories: AccessoryEstimateLine[];
  totals: ProductionEstimateTotals;
  isPartial: boolean;
  manualReviewReasons: string[];
  /**
   * Per-item breakdown when the design image contains multiple independent garments (e.g. a
   * jacket+pants set). Always present and always matches every other top-level field when there
   * is exactly one item — the top-level fields are that single item's data, unchanged from
   * before this field existed. Absent only for responses built by code that predates this field.
   */
  items?: ProductionEstimateItem[];
  /** Number of images submitted for this analysis. Absent/1 for the legacy single-image shape. */
  imageCount?: number;
  /** AI-assigned short Korean role label per submitted image, e.g. "정면", "소매 자수 확대". */
  imageLabels?: string[];
  /**
   * The exact raw per-item analysis (AI output or manual override) used to build this estimate.
   * Opaque to normal rendering — its only purpose is to be edited (e.g. resolving an ambiguous
   * decoration technique) and sent back as `rawItemsOverride` to reprice without re-running AI.
   */
  rawAnalysisSnapshot?: ProductionAnalysisSnapshotItem[];
}
