/**
 * Pricing/calculation logic for the "기성품 단체복 빠른 제작" (ready-made group wear)
 * service. Pure functions only — no React, no network calls — so they're trivial
 * to unit test and safe to call from any component.
 *
 * This is a separate pricing module from the existing custom-clothing auto-estimate
 * (`src/lib/production-estimate-quantity.ts`). Nothing here touches, imports from,
 * or is imported by that module — the two pricing systems never interact.
 *
 * All prices/labels/catalogs live in `src/data/ready-made-pricing-config.ts` so an
 * admin only ever needs to edit that data file, never this math.
 */
import {
  READY_MADE_ESTIMATED_LEAD_TIME_LABEL,
  READY_MADE_PRINT_LOCATION_OPTIONS,
  READY_MADE_PRINT_LOCATION_PRICE,
  READY_MADE_VAT_RATE,
  type ReadyMadeSizeQuantities,
} from "@/data/ready-made-pricing-config";
import type {
  ReadyMadePrintJob,
  ReadyMadeQuoteInput,
  ReadyMadeQuoteResult,
} from "@/types/readyMadeOrder";

export const sumReadyMadeSizeQuantities = (
  sizeQuantities: ReadyMadeSizeQuantities,
): number =>
  Object.values(sizeQuantities).reduce(
    (sum, count) => sum + (Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0),
    0,
  );

const getPrintLocationLabel = (job: ReadyMadePrintJob): string =>
  READY_MADE_PRINT_LOCATION_OPTIONS.find((option) => option.key === job.location)?.label ??
  job.location;

/**
 * Computes the full quote for a ready-made group wear order:
 *   장당 예상금액 = 의류 기본단가 (품목별) + (프린팅 위치 개수 × 5,000원)
 *   공급가 = 장당 예상금액 × 수량, VAT = 공급가 × 10%, 최종 예상금액 = 공급가 + VAT
 */
export const calculateReadyMadeQuote = (input: ReadyMadeQuoteInput): ReadyMadeQuoteResult => {
  const quantity = sumReadyMadeSizeQuantities(input.sizeQuantities);
  if (quantity <= 0) {
    throw new Error("총 수량은 1장 이상이어야 합니다.");
  }
  if (input.printJobs.length === 0) {
    throw new Error("인쇄 위치를 1곳 이상 선택해주세요.");
  }

  const locationBreakdown = input.printJobs.map((job) => ({
    jobId: job.id,
    location: job.location,
    locationLabel: getPrintLocationLabel(job),
    unitPrice: READY_MADE_PRINT_LOCATION_PRICE,
  }));

  const printUnitPrice = locationBreakdown.reduce((sum, entry) => sum + entry.unitPrice, 0);
  const unitPrice = input.garmentBasePrice + printUnitPrice;
  const subtotal = unitPrice * quantity;
  const vat = Math.round(subtotal * READY_MADE_VAT_RATE);
  const total = subtotal + vat;

  return {
    quantity,
    garmentUnitPrice: input.garmentBasePrice,
    printUnitPrice,
    unitPrice,
    locationBreakdown,
    subtotal,
    vat,
    total,
    estimatedLeadTimeLabel: READY_MADE_ESTIMATED_LEAD_TIME_LABEL,
  };
};
