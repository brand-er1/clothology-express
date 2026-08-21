import type {
  ProductionEstimateResult,
  ProductionEstimateTotals,
} from "@/types/productionEstimate";
import {
  aggregateFromItems,
  recalculateEstimateQuantity,
} from "@/lib/production-estimate-quantity";

export type ProductionCountry = "korea" | "china" | "japan";

export interface ProductionCountryOption {
  key: ProductionCountry;
  flag: string;
  label: string;
  headline: string;
  /** One-line MOQ + price-character summary for the compact selector (embedded in the quote card). */
  shortDescription: string;
  bullets: string[];
  buttonLabel: string;
  /** Applied to recurring, quantity-scaling production costs only — never to one-time development costs. */
  multiplier: number;
  /** Fixed MOQ for this country, or null to fall back to the garment's own domestic MOQ. */
  moq: number | null;
}

export const productionCountryOrder: ProductionCountry[] = ["korea", "china", "japan"];

export const productionCountryConfig: Record<ProductionCountry, ProductionCountryOption> = {
  korea: {
    key: "korea",
    flag: "🇰🇷",
    label: "한국",
    headline: "소량 제작부터 안정적으로",
    shortDescription: "소량 생산 및 빠른 커뮤니케이션",
    bullets: [
      "MOQ: 기존 국내 기준",
      "가격 기준: 국내 기본 견적",
      "빠른 커뮤니케이션",
      "소량 생산 추천",
    ],
    buttonLabel: "한국 생산으로 견적 받기",
    multiplier: 1.0,
    moq: null,
  },
  china: {
    key: "china",
    flag: "🇨🇳",
    label: "중국",
    headline: "대량 생산의 가격 경쟁력",
    shortDescription: "MOQ 100장 · 가격 경쟁력 중심",
    bullets: [
      "MOQ: 100장",
      "국내 생산 기준 약 0.7배",
      "대량 생산 추천",
      "가격 경쟁력 중심",
    ],
    buttonLabel: "중국 생산으로 견적 받기",
    multiplier: 0.7,
    moq: 100,
  },
  japan: {
    key: "japan",
    flag: "🇯🇵",
    label: "일본",
    headline: "프리미엄 퀄리티 생산",
    shortDescription: "MOQ 200장 · 프리미엄 생산",
    bullets: [
      "MOQ: 200장",
      "국내 생산 기준 약 1.5배",
      "높은 봉제 완성도",
      "프리미엄 제품 추천",
    ],
    buttonLabel: "일본 생산으로 견적 받기",
    multiplier: 1.5,
    moq: 200,
  },
};

export const getProductionCountryMoq = (
  country: ProductionCountry,
  domesticMoq: number,
) => productionCountryConfig[country].moq ?? domesticMoq;

export const getProductionCountryMoqMessage = (
  country: ProductionCountry,
  domesticMoq: number,
) => {
  if (country === "korea") return null;
  const moq = getProductionCountryMoq(country, domesticMoq);
  return `${productionCountryConfig[country].label} 생산은 최소 ${moq.toLocaleString("ko-KR")}장부터 견적이 가능합니다.`;
};

const scaleAmount = (value: number, multiplier: number) => Math.round(value * multiplier);
const scaleNullable = (value: number | null, multiplier: number) =>
  value === null ? null : scaleAmount(value, multiplier);

/**
 * Applies a production-country price multiplier to the recurring, quantity-scaling costs only
 * (원단비·봉제공임 production cost, 장당 후가공비, 부자재 공임) — never to one-time development
 * costs (패턴비/샘플비/판비), per BRAND-ER pricing policy. Always derives from the totals passed
 * in (which must already reflect the domestic Korea-baseline math), so re-applying with a
 * different country never compounds a previous multiplier.
 */
const applyCountryMultiplierToTotals = (
  totals: ProductionEstimateTotals,
  country: ProductionCountry,
): ProductionEstimateTotals => {
  const { multiplier } = productionCountryConfig[country];
  if (multiplier === 1) {
    return {
      ...totals,
      productionCountry: country,
      productionCountryMultiplier: 1,
      domesticProductionMin: totals.productionMin,
      domesticProductionMax: totals.productionMax,
    };
  }

  const domesticProductionMin = totals.productionMin;
  const domesticProductionMax = totals.productionMax;
  const productionOriginalMin = scaleNullable(
    totals.productionOriginalMin ?? totals.productionMin,
    multiplier,
  );
  const productionOriginalMax = scaleNullable(
    totals.productionOriginalMax ?? totals.productionMax,
    multiplier,
  );
  const productionMin = scaleNullable(totals.productionMin, multiplier);
  const productionMax = scaleNullable(totals.productionMax, multiplier);
  const productionUnitSurcharge = scaleAmount(totals.productionUnitSurcharge, multiplier);
  const decorationMin = scaleAmount(totals.decorationMin, multiplier);
  const decorationMax = scaleAmount(totals.decorationMax, multiplier);
  const accessoryUnitTotal = scaleAmount(totals.accessoryUnitTotal, multiplier);

  const quantity = totals.quantity;
  const knownProductionMin = productionMin ?? 0;
  const knownProductionMax = productionMax ?? 0;
  const productionTotalMin = knownProductionMin * quantity;
  const productionTotalMax = knownProductionMax * quantity;
  const decorationTotalMin = decorationMin * quantity;
  const decorationTotalMax = decorationMax * quantity;
  const accessoryTotal = accessoryUnitTotal * quantity;
  const directUnitMin = knownProductionMin + decorationMin + accessoryUnitTotal;
  const directUnitMax = knownProductionMax + decorationMax + accessoryUnitTotal;
  const totalMin = productionTotalMin + decorationTotalMin + accessoryTotal + totals.developmentTotal;
  const totalMax = productionTotalMax + decorationTotalMax + accessoryTotal + totals.developmentTotal;

  return {
    ...totals,
    productionOriginalMin,
    productionOriginalMax,
    productionMin,
    productionMax,
    productionUnitSurcharge,
    productionTotalMin,
    productionTotalMax,
    decorationMin,
    decorationMax,
    decorationTotalMin,
    decorationTotalMax,
    accessoryUnitTotal,
    accessoryTotal,
    directUnitMin,
    directUnitMax,
    totalMin,
    totalMax,
    effectiveUnitMin: quantity > 0 ? Math.ceil(totalMin / quantity) : totalMin,
    effectiveUnitMax: quantity > 0 ? Math.ceil(totalMax / quantity) : totalMax,
    productionCountry: country,
    productionCountryMultiplier: multiplier,
    domesticProductionMin,
    domesticProductionMax,
  };
};

/**
 * Re-prices a domestic (Korea-baseline) estimate for the given production country. Call after
 * `recalculateEstimateQuantity` so `estimate` already reflects the requested quantity. One-time
 * development costs (pattern/sample/plate fees) are left untouched; only recurring per-unit
 * production/decoration/accessory costs scale by the country multiplier.
 */
export const applyProductionCountryPricing = (
  estimate: ProductionEstimateResult,
  country: ProductionCountry,
): ProductionEstimateResult => {
  if (!estimate.items || estimate.items.length <= 1) {
    const totals = applyCountryMultiplierToTotals(estimate.totals, country);
    const items = estimate.items?.length === 1
      ? [{ ...estimate.items[0], totals }]
      : estimate.items;
    return { ...estimate, totals, items };
  }

  const items = estimate.items.map((item) => ({
    ...item,
    totals: applyCountryMultiplierToTotals(item.totals, country),
  }));

  return {
    ...estimate,
    items,
    totals: {
      ...aggregateFromItems(items, estimate.totals.quantity),
      productionCountry: country,
      productionCountryMultiplier: productionCountryConfig[country].multiplier,
      domesticProductionMin: items.length
        ? items.reduce((sum, item) => sum + (item.totals.domesticProductionMin ?? 0), 0)
        : null,
      domesticProductionMax: items.length
        ? items.reduce((sum, item) => sum + (item.totals.domesticProductionMax ?? 0), 0)
        : null,
    },
  };
};

/** Highest domestic garment MOQ across a (possibly multi-item) estimate. */
export const getEstimateDomesticMoq = (estimate: ProductionEstimateResult) =>
  estimate.items && estimate.items.length > 1
    ? Math.max(...estimate.items.map((item) => item.garment.moq))
    : estimate.garment.moq;

export interface CountryEstimateResult {
  /** The requested-country, requested-quantity estimate. Numbers are still populated even when
   *  `meetsMoq` is false — callers that must not show a below-MOQ quote should gate on `meetsMoq`. */
  estimate: ProductionEstimateResult;
  meetsMoq: boolean;
  moq: number;
  /** Guidance to show instead of/alongside the estimate when `meetsMoq` is false. */
  moqMessage: string | null;
}

/**
 * The single entry point every quote surface (design-quote upload, AI-generated design, saved
 * designs, set/bundle estimates, …) must go through to turn a domestic (Korea-baseline) analysis
 * into a country-priced, quantity-priced estimate. Keeping this logic in one function is what
 * guarantees the design-quote and AI-image-quote flows can never drift apart:
 *
 *   1. Resolve this estimate's domestic MOQ and the requested country's MOQ.
 *   2. Recompute quantity-dependent domestic totals (discount tier, quantity multiply) via the
 *      existing `recalculateEstimateQuantity` — untouched, still the single source of truth for
 *      domestic pricing math.
 *   3. Apply the country multiplier to recurring per-unit costs only (`applyProductionCountryPricing`).
 *   4. One-time development costs (pattern/sample/plate fees) are left untouched by construction —
 *      `applyProductionCountryPricing` never scales them.
 *   5. Return the priced estimate plus whether the requested quantity actually clears this
 *      country's MOQ, so the caller can show a "buy more to unlock this country" message instead
 *      of a real price.
 */
export const calculateEstimateByCountry = (
  baseEstimate: ProductionEstimateResult,
  country: ProductionCountry,
  quantity: number,
): CountryEstimateResult => {
  const domesticMoq = getEstimateDomesticMoq(baseEstimate);
  const moq = getProductionCountryMoq(country, domesticMoq);
  const meetsMoq = quantity >= moq;

  const domesticEstimate = recalculateEstimateQuantity(baseEstimate, Math.max(quantity, domesticMoq));
  const estimate = applyProductionCountryPricing(domesticEstimate, country);

  return {
    estimate,
    meetsMoq,
    moq,
    moqMessage: meetsMoq ? null : getProductionCountryMoqMessage(country, domesticMoq),
  };
};
