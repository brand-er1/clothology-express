import { buildQuoteDesignContext, resolveGarmentQuoteImage } from "@/lib/quote-garment-handoff";
import { closetSlotLabel } from "@/lib/closet-character-config";
import { analyzeProductionEstimate } from "@/services/productionEstimate";
import type { ClosetGarment } from "@/types/closet";
import type { ProductionEstimateResult } from "@/types/productionEstimate";

export interface FittingQuoteItem {
  garment: ClosetGarment;
  estimate: ProductionEstimateResult;
}

export interface FittingQuoteFailure {
  garment: ClosetGarment;
  message: string;
}

export interface CombinedFittingQuote {
  items: FittingQuoteItem[];
  failures: FittingQuoteFailure[];
  totalMin: number;
  totalMax: number;
  /** A `ProductionEstimateResult`-shaped aggregate (sum of each item's already-computed `totals` —
   * never a new price formula) so it can be stored as `orders.estimate_snapshot`/read by the
   * existing admin `OrderReviewDialog` unchanged. `items[]` carries the per-slot breakdown. */
  combinedEstimate: ProductionEstimateResult | null;
}

const sumField = (items: FittingQuoteItem[], pick: (totals: ProductionEstimateResult["totals"]) => number) =>
  items.reduce((sum, item) => sum + (pick(item.estimate.totals) || 0), 0);

const quoteOneGarment = async (garment: ClosetGarment): Promise<FittingQuoteItem> => {
  const resolved = await resolveGarmentQuoteImage(garment);
  const designContext = buildQuoteDesignContext(
    { slot: garment.slot, label: garment.label, fitInfo: garment.fitInfo },
    null,
    garment.designRef?.designContext,
  );
  const estimate = await analyzeProductionEstimate({
    imageUrl: resolved.url || undefined,
    imageBase64: resolved.base64 || undefined,
    imageMimeType: resolved.mimeType,
    selectedType: garment.designRef?.selectedType || "",
    selectedMaterial: garment.designRef?.selectedMaterial || "",
    designContext,
  });
  return { garment, estimate };
};

/**
 * "현재 착용 의류 전체 견적받기" (spec §12/§13). Quotes every passed-in garment (the caller is
 * expected to already have deduped by garmentId via `getDedupedWornGarments`) by calling the
 * existing single-garment `analyze-production-estimate` pipeline once per item — never a new
 * pricing formula — then sums the already-computed `totals` across items. One garment failing to
 * quote (unreadable image, transient network error) is reported in `failures` without blocking the
 * others.
 */
export const getCombinedFittingEstimate = async (garments: ClosetGarment[]): Promise<CombinedFittingQuote> => {
  const settled = await Promise.allSettled(garments.map(quoteOneGarment));
  const items: FittingQuoteItem[] = [];
  const failures: FittingQuoteFailure[] = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      items.push(result.value);
    } else {
      const message =
        result.reason instanceof Error ? result.reason.message : "이 의류의 견적을 계산하지 못했습니다.";
      failures.push({ garment: garments[index], message });
    }
  });

  const totalMin = sumField(items, (totals) => totals.totalMin);
  const totalMax = sumField(items, (totals) => totals.totalMax);

  const combinedEstimate: ProductionEstimateResult | null = items.length
    ? {
        sourceFile: "fitting-outfit-combine",
        sourceVersion: "1",
        generatedAt: new Date().toISOString(),
        currency: "KRW",
        analysis: items[0].estimate.analysis,
        garment: {
          key: "outfit",
          label: items.length > 1 ? `코디 (${items.length}종)` : items[0].estimate.garment.label,
          moq: Math.max(...items.map((item) => item.estimate.garment.moq)),
        },
        material: {
          key: "mixed",
          label: items.length > 1 ? "혼합 소재" : items[0].estimate.material.label,
          confidence: 1,
          composition: items
            .map((item) => `${closetSlotLabel[item.garment.slot]}: ${item.estimate.material.composition}`)
            .join(" · "),
        },
        materialPremium: null,
        decorations: items.flatMap((item) => item.estimate.decorations),
        accessories: items.flatMap((item) => item.estimate.accessories),
        totals: {
          ...items[0].estimate.totals,
          totalMin,
          totalMax,
          effectiveUnitMin: totalMin,
          effectiveUnitMax: totalMax,
          sampleCost: sumField(items, (totals) => totals.sampleCost),
          developmentTotal: sumField(items, (totals) => totals.developmentTotal),
          productionTotalMin: sumField(items, (totals) => totals.productionTotalMin),
          productionTotalMax: sumField(items, (totals) => totals.productionTotalMax),
          decorationTotalMin: sumField(items, (totals) => totals.decorationTotalMin),
          decorationTotalMax: sumField(items, (totals) => totals.decorationTotalMax),
          accessoryTotal: sumField(items, (totals) => totals.accessoryTotal),
          directUnitMin: sumField(items, (totals) => totals.directUnitMin),
          directUnitMax: sumField(items, (totals) => totals.directUnitMax),
        },
        isPartial: items.some((item) => item.estimate.isPartial) || failures.length > 0,
        manualReviewReasons: Array.from(new Set(items.flatMap((item) => item.estimate.manualReviewReasons))),
        items: items.map((item, index) => ({
          itemIndex: index,
          itemLabel: `${closetSlotLabel[item.garment.slot]} · ${item.garment.label}`,
          analysis: item.estimate.analysis,
          garment: item.estimate.garment,
          material: item.estimate.material,
          materialPremium: item.estimate.materialPremium,
          decorations: item.estimate.decorations,
          accessories: item.estimate.accessories,
          totals: item.estimate.totals,
          isPartial: item.estimate.isPartial,
          manualReviewReasons: item.estimate.manualReviewReasons,
        })),
      }
    : null;

  return { items, failures, totalMin, totalMax, combinedEstimate };
};
