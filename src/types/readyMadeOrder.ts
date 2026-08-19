import type {
  ReadyMadeGraphicSizeCategory,
  ReadyMadePrintLocation,
  ReadyMadePrintMethod,
  ReadyMadeQuantityTier,
  ReadyMadeSizeQuantities,
} from "@/data/ready-made-pricing-config";

/** One print job = one selected location with its own size (and, at bulk quantities, its own exact size / pretreatment choice). */
export interface ReadyMadePrintJob {
  id: string;
  location: ReadyMadePrintLocation;
  /** Only used/required when location === "custom". */
  customLocationNote?: string;
  sizeCategory: ReadyMadeGraphicSizeCategory;
  /** Required only once the order reaches the 50+ bulk tier. Key into the DTF/DTG bulk size tables. */
  bulkSizeKey?: string;
  /** DTG-only: 전처리 여부. Ignored for DTF. */
  pretreatment?: boolean;
}

export interface ReadyMadeQuoteInput {
  sizeQuantities: ReadyMadeSizeQuantities;
  printMethod: ReadyMadePrintMethod;
  printJobs: ReadyMadePrintJob[];
}

export interface ReadyMadeQuoteLocationBreakdown {
  jobId: string;
  location: ReadyMadePrintLocation;
  locationLabel: string;
  sizeLabel: string;
  unitPrice: number;
}

export interface ReadyMadeQuoteResult {
  quantity: number;
  tier: ReadyMadeQuantityTier;
  garmentUnitPrice: number;
  printUnitPrice: number;
  unitPrice: number;
  locationBreakdown: ReadyMadeQuoteLocationBreakdown[];
  /** 공급가 (수량 × 장당가격) */
  subtotal: number;
  vat: number;
  /** 최종 예상금액 (VAT 포함) */
  total: number;
  estimatedLeadTimeLabel: string;
}
