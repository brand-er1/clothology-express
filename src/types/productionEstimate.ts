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
  | "unknown_print";

export type DecorationLocation =
  | "front"
  | "back"
  | "left_sleeve"
  | "right_sleeve"
  | "neck"
  | "other";

export interface DecorationEstimateLine {
  kind: DecorationAnalysisKind;
  label: string;
  location: DecorationLocation;
  locationLabel: string;
  unitMin: number;
  unitMax: number;
  lineMin: number;
  lineMax: number;
  isStartingFrom: boolean;
  note?: string | null;
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
  detectedDecorationCount: number;
}

export interface ProductionEstimateTotals {
  quantity: number;
  productionMin: number | null;
  productionMax: number | null;
  productionIsStartingFrom: boolean;
  productionTotalMin: number;
  productionTotalMax: number;
  patternCost: number;
  sampleCost: number;
  developmentTotal: number;
  decorationMin: number;
  decorationMax: number;
  decorationTotalMin: number;
  decorationTotalMax: number;
  directUnitMin: number;
  directUnitMax: number;
  totalMin: number;
  totalMax: number;
  effectiveUnitMin: number;
  effectiveUnitMax: number;
  totalIsStartingFrom: boolean;
}

export interface ProductionEstimateResult {
  sourceFile: string;
  sourceVersion: string;
  generatedAt: string;
  currency: "KRW";
  analysis: ProductionAnalysis;
  garment: {
    key: string;
    label: string;
    moq: number;
    note?: string | null;
  };
  decorations: DecorationEstimateLine[];
  totals: ProductionEstimateTotals;
  isPartial: boolean;
  manualReviewReasons: string[];
}
