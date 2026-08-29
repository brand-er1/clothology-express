import { analyzeProductionEstimate } from "@/services/productionEstimate";
import { buildQuoteDesignContext } from "@/lib/quote-garment-handoff";
import type { MultiQuoteGarmentItem } from "@/lib/quote-garment-handoff";
import { calculateEstimateByCountry, type ProductionCountry } from "@/lib/production-country";
import { aggregateFromItems } from "@/lib/production-estimate-quantity";
import type { ProductionEstimateItem, ProductionEstimateResult } from "@/types/productionEstimate";

/**
 * Runs the existing AI production-estimate analysis once per garment (never a combined multi-image
 * call) so the AI is never asked to re-derive which images belong to which garment — that grouping
 * is already known deterministically from the virtual-fitting outfit state. Every call goes through
 * the exact same `analyzeProductionEstimate` service (and therefore the same edge function/pricing
 * engine) the single-item quote flow uses.
 */
export const analyzeEachGarment = (items: MultiQuoteGarmentItem[]): Promise<ProductionEstimateResult[]> =>
  Promise.all(
    items.map((item) =>
      analyzeProductionEstimate({
        imageUrl: item.imageUrl || undefined,
        imageBase64: item.imageBase64 || undefined,
        imageMimeType: item.imageMimeType || undefined,
        selectedType: item.selectedType || "",
        selectedMaterial: item.selectedMaterial || "",
        designContext: buildQuoteDesignContext(
          { slot: item.slot, label: item.garmentLabel, fitInfo: item.fitInfo },
          null,
          "사용자가 AI 가상 피팅에서 착용한 원본 의류 이미지",
        ),
        quantity: 20,
      }),
    ),
  );

export interface PricedGarmentItem {
  item: ProductionEstimateItem;
  meetsMoq: boolean;
  moq: number;
  moqMessage: string | null;
}

/**
 * Prices every garment at its own chosen quantity and the shared production country, reusing
 * `calculateEstimateByCountry` — the exact same domestic-quantity + country-multiplier pipeline
 * `ProductionEstimateCard` calls for a single item — once per garment. Each single-image analysis
 * never produces more than one `items` entry on its own, so this always takes that garment's
 * top-level fields as its one priced item.
 */
export const priceEachGarment = (
  baseResults: ProductionEstimateResult[],
  items: MultiQuoteGarmentItem[],
  quantities: number[],
  country: ProductionCountry,
): PricedGarmentItem[] =>
  baseResults.map((base, index) => {
    const { estimate, meetsMoq, moq, moqMessage } = calculateEstimateByCountry(base, country, quantities[index]);
    const item: ProductionEstimateItem = {
      itemIndex: index,
      itemLabel: items[index].garmentLabel,
      analysis: estimate.analysis,
      garment: estimate.garment,
      material: estimate.material,
      materialPremium: estimate.materialPremium,
      decorations: estimate.decorations,
      accessories: estimate.accessories,
      totals: estimate.totals,
      isPartial: estimate.isPartial,
      manualReviewReasons: estimate.manualReviewReasons,
      sourceImages: [index],
    };
    return { item, meetsMoq, moq, moqMessage };
  });

/**
 * Combines every priced garment into one aggregate `ProductionEstimateResult` — the exact same
 * shape a single multi-image AI analysis would have produced (see `ProductionEstimateResult.items`)
 * — so it can be submitted through the existing "제작 의뢰 접수" path unchanged. `totals` is summed
 * via `aggregateFromItems`, the same function the multi-item card already uses for its SET TOTAL.
 */
export const buildAggregateEstimate = (
  priced: PricedGarmentItem[],
  sourceMeta: ProductionEstimateResult,
): ProductionEstimateResult => {
  const pricedItems = priced.map((entry) => entry.item);
  const totalQuantity = pricedItems.reduce((sum, item) => sum + item.totals.quantity, 0);
  const label = pricedItems.map((item) => item.itemLabel).join(" + ");

  return {
    sourceFile: sourceMeta.sourceFile,
    sourceVersion: sourceMeta.sourceVersion,
    generatedAt: new Date().toISOString(),
    currency: "KRW",
    analysis: pricedItems[0].analysis,
    garment: {
      key: "multi_outfit_set",
      label,
      moq: Math.max(...pricedItems.map((item) => item.garment.moq)),
    },
    material: pricedItems[0].material,
    materialPremium: null,
    decorations: pricedItems.flatMap((item) => item.decorations),
    accessories: pricedItems.flatMap((item) => item.accessories),
    totals: aggregateFromItems(pricedItems, totalQuantity),
    isPartial: pricedItems.some((item) => item.isPartial),
    manualReviewReasons: pricedItems.flatMap((item) => item.manualReviewReasons),
    items: pricedItems,
    imageCount: pricedItems.length,
  };
};
