import type { ProductionEstimateResult } from "@/types/productionEstimate";

export const normalizeEstimateQuantity = (value: number) =>
  Math.min(100000, Math.max(20, Math.round(Number(value) || 20)));

export const getProductionDiscountRate = (quantity: number) => {
  const normalizedQuantity = normalizeEstimateQuantity(quantity);
  if (normalizedQuantity >= 300) return 0.1;
  if (normalizedQuantity >= 200) return 0.07;
  if (normalizedQuantity >= 100) return 0.05;
  return 0;
};

const applyDiscount = (amount: number | null, discountRate: number) =>
  amount === null ? null : Math.round(amount * (1 - discountRate));

export const recalculateEstimateQuantity = (
  estimate: ProductionEstimateResult,
  requestedQuantity: number,
): ProductionEstimateResult => {
  const quantity = normalizeEstimateQuantity(requestedQuantity);
  const productionDiscountRate = getProductionDiscountRate(quantity);
  const productionOriginalMin =
    estimate.totals.productionOriginalMin ?? estimate.totals.productionMin;
  const productionOriginalMax =
    estimate.totals.productionOriginalMax ?? estimate.totals.productionMax;
  const productionMin = applyDiscount(
    productionOriginalMin,
    productionDiscountRate,
  );
  const productionMax = applyDiscount(
    productionOriginalMax,
    productionDiscountRate,
  );
  const knownProductionMin = productionMin ?? 0;
  const knownProductionMax = productionMax ?? 0;
  const productionTotalMin = knownProductionMin * quantity;
  const productionTotalMax = knownProductionMax * quantity;
  const decorationTotalMin = estimate.totals.decorationMin * quantity;
  const decorationTotalMax = estimate.totals.decorationMax * quantity;
  const accessoryTotal = estimate.totals.accessoryUnitTotal * quantity;
  const directUnitMin =
    knownProductionMin +
    estimate.totals.decorationMin +
    estimate.totals.accessoryUnitTotal;
  const directUnitMax =
    knownProductionMax +
    estimate.totals.decorationMax +
    estimate.totals.accessoryUnitTotal;
  const totalMin =
    productionTotalMin +
    decorationTotalMin +
    accessoryTotal +
    estimate.totals.developmentTotal;
  const totalMax =
    productionTotalMax +
    decorationTotalMax +
    accessoryTotal +
    estimate.totals.developmentTotal;

  return {
    ...estimate,
    totals: {
      ...estimate.totals,
      quantity,
      productionOriginalMin,
      productionOriginalMax,
      productionDiscountRate,
      productionMin,
      productionMax,
      productionTotalMin,
      productionTotalMax,
      decorationTotalMin,
      decorationTotalMax,
      accessoryTotal,
      directUnitMin,
      directUnitMax,
      totalMin,
      totalMax,
      effectiveUnitMin: Math.ceil(totalMin / quantity),
      effectiveUnitMax: Math.ceil(totalMax / quantity),
    },
  };
};
