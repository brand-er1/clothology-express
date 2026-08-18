import type {
  ProductionEstimateItem,
  ProductionEstimateResult,
  ProductionEstimateTotals,
} from "@/types/productionEstimate";

export const normalizeEstimateQuantity = (
  value: number,
  minimumQuantity = 20,
) =>
  Math.min(
    100000,
    Math.max(
      minimumQuantity,
      Math.round(Number(value) || minimumQuantity),
    ),
  );

export const getProductionDiscountRate = (quantity: number) => {
  const normalizedQuantity = normalizeEstimateQuantity(quantity);
  if (normalizedQuantity >= 300) return 0.1;
  if (normalizedQuantity >= 200) return 0.07;
  if (normalizedQuantity >= 100) return 0.05;
  return 0;
};

const applyDiscount = (amount: number | null, discountRate: number) =>
  amount === null ? null : Math.round(amount * (1 - discountRate));

/**
 * Recomputes one item's quantity-dependent totals at a new shared quantity, from its own
 * quantity-independent unit costs (production/decoration unit price, development cost). Mirrors
 * the edge function's `priceItem` math exactly, so client-side quantity changes never need a
 * round trip to the server.
 */
const recalculateItemTotals = (
  totals: ProductionEstimateTotals,
  isKnit: boolean,
  quantity: number,
): ProductionEstimateTotals => {
  const productionDiscountRate = isKnit ? 0 : getProductionDiscountRate(quantity);
  const productionOriginalMin = totals.productionOriginalMin ?? totals.productionMin;
  const productionOriginalMax = totals.productionOriginalMax ?? totals.productionMax;
  const productionMin = applyDiscount(productionOriginalMin, productionDiscountRate);
  const productionMax = applyDiscount(productionOriginalMax, productionDiscountRate);
  const knownProductionMin = productionMin ?? 0;
  const knownProductionMax = productionMax ?? 0;
  const productionTotalMin = knownProductionMin * quantity;
  const productionTotalMax = knownProductionMax * quantity;
  const decorationTotalMin = totals.decorationMin * quantity;
  const decorationTotalMax = totals.decorationMax * quantity;
  const accessoryTotal = totals.accessoryUnitTotal * quantity;
  const directUnitMin = knownProductionMin + totals.decorationMin + totals.accessoryUnitTotal;
  const directUnitMax = knownProductionMax + totals.decorationMax + totals.accessoryUnitTotal;
  const totalMin = productionTotalMin + decorationTotalMin + accessoryTotal + totals.developmentTotal;
  const totalMax = productionTotalMax + decorationTotalMax + accessoryTotal + totals.developmentTotal;

  return {
    ...totals,
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
  };
};

const sumOrNull = (values: Array<number | null | undefined>) =>
  values.some((value) => value === null || value === undefined)
    ? null
    : (values as number[]).reduce((sum, value) => sum + value, 0);

/**
 * Re-sums a multi-item estimate's aggregate ("SET TOTAL") fields from its freshly-recalculated
 * items, exactly like the edge function does — so the aggregate is always internally consistent
 * with the per-item breakdown shown in the UI, never independently re-derived from stale totals.
 */
/**
 * Sums a set of items' totals into one aggregate — exported so the UI can recompute a "SET
 * TOTAL" from just the checked-in items when a visitor excludes a wrongly-detected item.
 */
export const aggregateFromItems = (
  items: ProductionEstimateItem[],
  quantity: number,
): ProductionEstimateTotals => {
  const primary = items[0].totals;
  const sum = (pick: (totals: ProductionEstimateTotals) => number) =>
    items.reduce((total, item) => total + pick(item.totals), 0);
  const totalMin = sum((totals) => totals.totalMin);
  const totalMax = sum((totals) => totals.totalMax);

  return {
    quantity,
    productionOriginalMin: sumOrNull(items.map((item) => item.totals.productionOriginalMin)),
    productionOriginalMax: sumOrNull(items.map((item) => item.totals.productionOriginalMax)),
    productionMin: sumOrNull(items.map((item) => item.totals.productionMin)),
    productionMax: sumOrNull(items.map((item) => item.totals.productionMax)),
    productionIsStartingFrom: items.some((item) => item.totals.productionIsStartingFrom),
    productionDiscountRate: primary.productionDiscountRate,
    productionUnitSurcharge: sum((totals) => totals.productionUnitSurcharge),
    productionTotalMin: sum((totals) => totals.productionTotalMin),
    productionTotalMax: sum((totals) => totals.productionTotalMax),
    patternCost: sum((totals) => totals.patternCost),
    baseSampleCost: sum((totals) => totals.baseSampleCost),
    sampleCost: sum((totals) => totals.sampleCost),
    sampleSurcharge: sum((totals) => totals.sampleSurcharge),
    printPlateCount: sum((totals) => totals.printPlateCount),
    printPlateCost: sum((totals) => totals.printPlateCost),
    embroiderySampleCount: sum((totals) => totals.embroiderySampleCount),
    embroiderySampleCost: sum((totals) => totals.embroiderySampleCost),
    dyeingSampleCount: sum((totals) => totals.dyeingSampleCount),
    dyeingSampleCost: sum((totals) => totals.dyeingSampleCost),
    washingSampleCount: sum((totals) => totals.washingSampleCount),
    washingSampleCost: sum((totals) => totals.washingSampleCost),
    decorationDevelopmentCost: sum((totals) => totals.decorationDevelopmentCost),
    developmentTotal: sum((totals) => totals.developmentTotal),
    decorationMin: sum((totals) => totals.decorationMin),
    decorationMax: sum((totals) => totals.decorationMax),
    decorationTotalMin: sum((totals) => totals.decorationTotalMin),
    decorationTotalMax: sum((totals) => totals.decorationTotalMax),
    accessoryUnitTotal: sum((totals) => totals.accessoryUnitTotal),
    accessoryTotal: sum((totals) => totals.accessoryTotal),
    directUnitMin: sum((totals) => totals.directUnitMin),
    directUnitMax: sum((totals) => totals.directUnitMax),
    totalMin,
    totalMax,
    effectiveUnitMin: Math.ceil(totalMin / quantity),
    effectiveUnitMax: Math.ceil(totalMax / quantity),
    totalIsStartingFrom: items.some((item) => item.totals.totalIsStartingFrom),
  };
};

export const recalculateEstimateQuantity = (
  estimate: ProductionEstimateResult,
  requestedQuantity: number,
): ProductionEstimateResult => {
  if (!estimate.items || estimate.items.length <= 1) {
    const quantity = normalizeEstimateQuantity(requestedQuantity, estimate.garment.moq);
    const totals = recalculateItemTotals(
      estimate.totals,
      estimate.analysis.categoryKey === "knit",
      quantity,
    );
    const items = estimate.items?.length === 1
      ? [{ ...estimate.items[0], totals, isPartial: totals.productionMin === null || totals.productionMax === null }]
      : estimate.items;

    return { ...estimate, totals, items };
  }

  // Multi-item: every item shares the same requested quantity, but the actual floor is whichever
  // item has the highest MOQ (matching the server's "set is only as small as its most demanding
  // item" rule).
  const overallMinimumQuantity = Math.max(...estimate.items.map((item) => item.garment.moq));
  const quantity = normalizeEstimateQuantity(requestedQuantity, overallMinimumQuantity);

  const recalculatedItems = estimate.items.map((item) => {
    const totals = recalculateItemTotals(
      item.totals,
      item.analysis.categoryKey === "knit",
      quantity,
    );
    return {
      ...item,
      totals,
      isPartial: totals.productionMin === null || totals.productionMax === null,
    };
  });

  return {
    ...estimate,
    totals: aggregateFromItems(recalculatedItems, quantity),
    items: recalculatedItems,
  };
};
