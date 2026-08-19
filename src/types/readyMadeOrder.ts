import type {
  ReadyMadeArtworkPlacement,
  ReadyMadeGarmentSide,
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
  /** Which mockup (front/back) this job's placement lives on. Fixed by `location` for every
   * built-in location; only "custom" locations let the customer choose. */
  side: ReadyMadeGarmentSide;
  /** Where the artwork actually sits on that side's mockup — the customer can drag/resize this
   * freely from the `location`'s preset starting point, so it's the source of truth for the
   * on-screen preview, independent of the coarse `location` label used for order text/pricing. */
  placement: ReadyMadeArtworkPlacement;
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
