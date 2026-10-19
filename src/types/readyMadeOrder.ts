import type {
  ReadyMadeArtworkPlacement,
  ReadyMadeGarmentSide,
  ReadyMadePrintLocation,
  ReadyMadePrintMethod,
  ReadyMadeSizeQuantities,
} from "@/data/ready-made-pricing-config";

/** One print job = one selected location on the garment. */
export interface ReadyMadePrintJob {
  id: string;
  location: ReadyMadePrintLocation;
  /** Which mockup (front/back) this job's placement lives on — fixed by `location`. */
  side: ReadyMadeGarmentSide;
  /** Where the artwork actually sits on that side's mockup — the customer can drag/resize this
   * freely from the `location`'s preset starting point, so it's the source of truth for the
   * on-screen preview, independent of the coarse `location` label used for order text/pricing. */
  placement: ReadyMadeArtworkPlacement;
}

export interface ReadyMadeQuoteInput {
  sizeQuantities: ReadyMadeSizeQuantities;
  /** 의류 1장당 기본 단가 (원) — selected product's `basePrice`. */
  garmentBasePrice: number;
  printJobs: ReadyMadePrintJob[];
}

export interface ReadyMadeQuoteLocationBreakdown {
  jobId: string;
  location: ReadyMadePrintLocation;
  locationLabel: string;
  unitPrice: number;
}

export interface ReadyMadeQuoteResult {
  quantity: number;
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

/**
 * One print job's placement as actually rendered, saved at submission time for the admin's
 * "제작 데이터" view. `x`/`y` are the artwork's CENTER point and `width`/`height` its size — all
 * four normalized 0-1 against the garment mockup's own on-screen box, exactly like `placement`
 * above but measured directly from the live editor DOM (not recomputed) so device/viewport
 * differences (mobile vs. desktop) can never shift the saved position relative to what the
 * customer actually saw.
 *
 * `width`/`height` are the artwork's own (unrotated) size; `rotation` is the clockwise angle in
 * degrees around the center and `flipX`/`flipY` mirror the artwork, exactly as set in the editor.
 * `scale` stays 1 — size is carried entirely by `width`/`height`. Orders saved before rotation
 * existed have `rotation: 0` and no flip fields, which means "not rotated, not flipped".
 */
export interface ReadyMadeOrderDesignJob {
  id: string;
  location: ReadyMadePrintLocation;
  locationLabel: string;
  side: ReadyMadeGarmentSide;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  rotation: number;
  flipX?: boolean;
  flipY?: boolean;
}

/** Structured design snapshot saved alongside `front_preview_url`/`back_preview_url` on the
 * order row (`orders.ready_made_design_data`) — see that column's migration comment. */
export interface ReadyMadeOrderDesignData {
  product: { id: string; type: string; name: string };
  color: string;
  garmentImages: { front: string; back: string };
  sizeQuantities: ReadyMadeSizeQuantities;
  totalQuantity: number;
  printJobs: ReadyMadeOrderDesignJob[];
  printMethod: ReadyMadePrintMethod;
  requestNote: string;
}
