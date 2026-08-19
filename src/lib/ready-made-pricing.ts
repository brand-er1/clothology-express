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
  READY_MADE_BULK_TIER_MIN_QUANTITY,
  READY_MADE_DEFAULT_BULK_SIZE_KEY,
  READY_MADE_DTF_BULK_SIZE_OPTIONS,
  READY_MADE_DTG_BULK_SIZE_OPTIONS,
  READY_MADE_ESTIMATED_LEAD_TIME_LABEL,
  READY_MADE_GARMENT_BASE_PRICE,
  READY_MADE_GRAPHIC_SIZE_CATEGORIES,
  READY_MADE_PRINT_LOCATION_OPTIONS,
  READY_MADE_SAMPLE_TIER_MAX_QUANTITY,
  READY_MADE_SAMPLE_TIER_PRINT_PRICE,
  READY_MADE_SMALL_BATCH_TIER_PRINT_PRICE,
  READY_MADE_VAT_RATE,
  type ReadyMadePrintMethod,
  type ReadyMadeQuantityTier,
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

export const getReadyMadeQuantityTier = (quantity: number): ReadyMadeQuantityTier => {
  if (quantity <= READY_MADE_SAMPLE_TIER_MAX_QUANTITY) return "sample";
  if (quantity < READY_MADE_BULK_TIER_MIN_QUANTITY) return "smallBatch";
  return "bulk";
};

const getPrintLocationLabel = (job: ReadyMadePrintJob): string => {
  if (job.location === "custom") {
    return job.customLocationNote?.trim() || "직접 지정 위치";
  }
  return (
    READY_MADE_PRINT_LOCATION_OPTIONS.find((option) => option.key === job.location)?.label ??
    job.location
  );
};

const getBulkSizeKey = (job: ReadyMadePrintJob, method: ReadyMadePrintMethod): string =>
  job.bulkSizeKey || READY_MADE_DEFAULT_BULK_SIZE_KEY[method][job.sizeCategory];

const getDtfBulkUnitPrice = (job: ReadyMadePrintJob): number => {
  const key = getBulkSizeKey(job, "dtf");
  const option = READY_MADE_DTF_BULK_SIZE_OPTIONS.find((entry) => entry.key === key);
  if (!option) {
    throw new Error(`알 수 없는 DTF 대량생산 규격입니다: ${key}`);
  }
  return option.price;
};

const getDtgBulkUnitPrice = (job: ReadyMadePrintJob): number => {
  const key = getBulkSizeKey(job, "dtg");
  const option = READY_MADE_DTG_BULK_SIZE_OPTIONS.find((entry) => entry.key === key);
  if (!option) {
    throw new Error(`알 수 없는 DTG 대량생산 규격입니다: ${key}`);
  }
  return job.pretreatment ? option.pretreatmentPrice : option.noPretreatmentPrice;
};

/** One print job's per-piece print cost, given the order's shared quantity tier and print method. */
export const calculateReadyMadePrintJobUnitPrice = (
  job: ReadyMadePrintJob,
  tier: ReadyMadeQuantityTier,
  method: ReadyMadePrintMethod,
): number => {
  if (tier === "sample") return READY_MADE_SAMPLE_TIER_PRINT_PRICE[job.sizeCategory];
  if (tier === "smallBatch") return READY_MADE_SMALL_BATCH_TIER_PRINT_PRICE[job.sizeCategory];
  return method === "dtf" ? getDtfBulkUnitPrice(job) : getDtgBulkUnitPrice(job);
};

const getSizeLabel = (job: ReadyMadePrintJob, tier: ReadyMadeQuantityTier, method: ReadyMadePrintMethod): string => {
  if (tier === "bulk") {
    const key = getBulkSizeKey(job, method);
    const option =
      method === "dtf"
        ? READY_MADE_DTF_BULK_SIZE_OPTIONS.find((entry) => entry.key === key)
        : READY_MADE_DTG_BULK_SIZE_OPTIONS.find((entry) => entry.key === key);
    return option?.label ?? key;
  }
  return READY_MADE_GRAPHIC_SIZE_CATEGORIES[job.sizeCategory].spec;
};

/**
 * Computes the full quote for a ready-made group wear order:
 * 장당가격 = 기성품가격(7,000원) + 인쇄 위치별 인쇄비 합
 * 공급가 = 장당가격 × 수량, VAT = 공급가 × 10%, 최종 예상금액 = 공급가 + VAT
 */
export const calculateReadyMadeQuote = (input: ReadyMadeQuoteInput): ReadyMadeQuoteResult => {
  const quantity = sumReadyMadeSizeQuantities(input.sizeQuantities);
  if (quantity <= 0) {
    throw new Error("총 수량은 1장 이상이어야 합니다.");
  }
  if (input.printJobs.length === 0) {
    throw new Error("인쇄 위치를 1곳 이상 선택해주세요.");
  }

  const tier = getReadyMadeQuantityTier(quantity);

  const locationBreakdown = input.printJobs.map((job) => ({
    jobId: job.id,
    location: job.location,
    locationLabel: getPrintLocationLabel(job),
    sizeLabel: getSizeLabel(job, tier, input.printMethod),
    unitPrice: calculateReadyMadePrintJobUnitPrice(job, tier, input.printMethod),
  }));

  const printUnitPrice = locationBreakdown.reduce((sum, entry) => sum + entry.unitPrice, 0);
  const unitPrice = READY_MADE_GARMENT_BASE_PRICE + printUnitPrice;
  const subtotal = unitPrice * quantity;
  const vat = Math.round(subtotal * READY_MADE_VAT_RATE);
  const total = subtotal + vat;

  return {
    quantity,
    tier,
    garmentUnitPrice: READY_MADE_GARMENT_BASE_PRICE,
    printUnitPrice,
    unitPrice,
    locationBreakdown,
    subtotal,
    vat,
    total,
    estimatedLeadTimeLabel: READY_MADE_ESTIMATED_LEAD_TIME_LABEL,
  };
};
