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
}
