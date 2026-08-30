import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Layers, Loader2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { closetSlotLabel } from "@/lib/closet-character-config";
import { DEFAULT_MULTI_ESTIMATE_QUANTITY } from "@/lib/closet-multi-estimate";
import type { MultiQuoteGarmentItem } from "@/lib/quote-garment-handoff";
import { describeProductionEstimateError } from "@/lib/production-estimate-error";
import { analyzeEachGarment, buildAggregateEstimate, priceEachGarment } from "@/services/multiGarmentEstimate";
import { productionCountryConfig, type ProductionCountry } from "@/lib/production-country";
import { ProductionCountryPicker } from "./ProductionCountryPicker";
import type { ProductionEstimateResult } from "@/types/productionEstimate";

interface MultiGarmentEstimateViewProps {
  items: MultiQuoteGarmentItem[];
  productionCountry: ProductionCountry;
  onChangeCountry: (country: ProductionCountry) => void;
  onEstimateChange?: (estimate: ProductionEstimateResult | null) => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

const formatWon = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;
const formatRange = (minimum: number, maximum: number, isStartingFrom = false) =>
  minimum === maximum
    ? `${formatWon(minimum)}${isStartingFrom ? "부터" : ""}`
    : `${formatWon(minimum)} ~ ${formatWon(maximum)}${isStartingFrom ? " 이상" : ""}`;

/**
 * "현재 착용 의류 전체 견적" result: analyzes every worn garment independently (see
 * `analyzeEachGarment` — never a single combined multi-image AI call, so grouping/dedup mistakes
 * can't happen), prices each at its own quantity + the shared production country, and shows both
 * a per-item breakdown and the combined total. Emits a standard `ProductionEstimateResult` (with
 * `items` populated) upward so the surrounding page's existing submit flow works unchanged.
 */
export const MultiGarmentEstimateView = ({
  items,
  productionCountry,
  onChangeCountry,
  onEstimateChange,
  onLoadingChange,
}: MultiGarmentEstimateViewProps) => {
  const [baseResults, setBaseResults] = useState<ProductionEstimateResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((item) => [item.garmentId, item.quantity || DEFAULT_MULTI_ESTIMATE_QUANTITY])),
  );
  const [bulkQuantityInput, setBulkQuantityInput] = useState(DEFAULT_MULTI_ESTIMATE_QUANTITY);
  const requestIdRef = useRef(0);

  const loadEstimates = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setError(null);
    try {
      const results = await analyzeEachGarment(items);
      if (requestIdRef.current !== requestId) return;
      setBaseResults(results);
    } catch (analysisError) {
      if (requestIdRef.current !== requestId) return;
      console.error("Whole-outfit estimate analysis error:", analysisError);
      setBaseResults(null);
      setError(describeProductionEstimateError(analysisError).message);
    } finally {
      if (requestIdRef.current === requestId) setIsLoading(false);
    }
    // Only re-run when the item set itself changes (new garment list from the picker) — quantity/
    // country changes are re-priced client-side below without another AI analysis round trip.
  }, [items]);

  useEffect(() => {
    void loadEstimates();
    return () => {
      requestIdRef.current += 1;
    };
  }, [loadEstimates]);

  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  const priced = useMemo(() => {
    if (!baseResults) return null;
    const quantityList = items.map((item) => quantities[item.garmentId] || DEFAULT_MULTI_ESTIMATE_QUANTITY);
    return priceEachGarment(baseResults, items, quantityList, productionCountry);
  }, [baseResults, items, quantities, productionCountry]);

  const aggregate = useMemo(() => {
    if (!priced || !baseResults?.length) return null;
    return buildAggregateEstimate(priced, baseResults[0]);
  }, [priced, baseResults]);

  const allMeetMoq = priced?.every((entry) => entry.meetsMoq) ?? false;

  useEffect(() => {
    onEstimateChange?.(allMeetMoq ? aggregate : null);
  }, [aggregate, allMeetMoq, onEstimateChange]);

  const changeQuantity = (garmentId: string, value: number) => {
    const next = Math.min(100000, Math.max(1, Math.round(Number(value) || 1)));
    setQuantities((current) => ({ ...current, [garmentId]: next }));
  };

  const applyBulkQuantity = () => {
    setQuantities(Object.fromEntries(items.map((item) => [item.garmentId, bulkQuantityInput])));
  };

  if (isLoading && !baseResults) {
    return (
      <Card className="w-full overflow-hidden border-brand/20">
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <div className="rounded-full bg-brand/10 p-3 text-brand">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <div>
            <p className="font-bold text-gray-950">착용 중인 의류 {items.length}개를 분석하고 있습니다</p>
            <p className="mt-1 text-sm text-gray-500">품목마다 독립적으로 견적을 계산한 뒤 합산합니다.</p>
          </div>
        </div>
      </Card>
    );
  }

  if (error || !priced || !aggregate) {
    return (
      <Card className="w-full border-rose-200 bg-rose-50/50 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div className="flex-1">
            <p className="font-bold text-gray-950">전체 견적을 불러오지 못했습니다</p>
            <p className="mt-1 text-sm text-gray-600">{error || "잠시 후 다시 시도해주세요."}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3 bg-white" onClick={() => void loadEstimates()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              다시 분석
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const countryOption = productionCountryConfig[productionCountry];
  const totals = aggregate.totals;

  return (
    <Card className="w-full overflow-hidden border-brand/20 bg-gradient-to-br from-white via-white to-brand/5 shadow-sm">
      <div className="border-b border-brand/10 bg-white px-5 py-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-brand" />
          <p className="font-extrabold text-stone-950">현재 착용 의류 {items.length}개 견적</p>
        </div>
        <p className="mt-1 text-xs leading-5 text-stone-500">
          품목마다 독립적으로 패턴비·샘플비·생산공임을 계산한 뒤 합산합니다.
        </p>
      </div>

      <div className="border-b border-brand/10 bg-[#fbfaf8] p-5">
        <p className="text-sm font-extrabold text-stone-950">품목별 수량</p>
        <div className="mt-3 space-y-2">
          {items.map((quoteItem) => (
            <div
              key={quoteItem.garmentId}
              className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-brand">{closetSlotLabel[quoteItem.slot]}</p>
                <p className="truncate text-sm font-bold text-stone-950">{quoteItem.garmentLabel}</p>
              </div>
              <div className="relative w-28 shrink-0">
                <Input
                  type="number"
                  min={1}
                  max={100000}
                  value={quantities[quoteItem.garmentId] || DEFAULT_MULTI_ESTIMATE_QUANTITY}
                  onChange={(event) => changeQuantity(quoteItem.garmentId, Number(event.target.value))}
                  className="h-10 rounded-lg pr-8 text-right text-sm font-bold"
                />
                <span className="pointer-events-none absolute right-3 top-2.5 text-xs font-bold text-stone-500">장</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="relative w-32">
            <Input
              type="number"
              min={1}
              max={100000}
              value={bulkQuantityInput}
              onChange={(event) => setBulkQuantityInput(Math.max(1, Number(event.target.value) || 1))}
              className="h-10 rounded-lg pr-8 text-right text-sm font-bold"
            />
            <span className="pointer-events-none absolute right-3 top-2.5 text-xs font-bold text-stone-500">장</span>
          </div>
          <Button type="button" variant="outline" size="sm" className="h-10 rounded-full bg-white text-xs font-bold" onClick={applyBulkQuantity}>
            전체 수량 {bulkQuantityInput.toLocaleString("ko-KR")}장으로 적용
          </Button>
        </div>
      </div>

      <div className="border-b border-brand/10 bg-white px-5 py-4">
        <ProductionCountryPicker selected={productionCountry} onSelect={onChangeCountry} variant="compact" />
      </div>

      {!allMeetMoq && (
        <div className="mx-5 mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-extrabold text-amber-900">
              {countryOption.flag} {countryOption.label} 생산 MOQ 미달인 품목이 있습니다
            </p>
            <ul className="mt-1 space-y-0.5 text-sm leading-6 text-amber-800">
              {priced
                .filter((entry) => !entry.meetsMoq)
                .map((entry) => (
                  <li key={entry.item.itemIndex}>
                    {entry.item.itemLabel} · {entry.moqMessage}
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}

      <div className="p-5">
        <p className="text-sm font-extrabold text-stone-950">품목별 예상 견적</p>
        <div className="mt-3 space-y-2">
          {priced.map((entry) => (
            <div
              key={entry.item.itemIndex}
              className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-stone-950">{entry.item.itemLabel}</p>
                <p className="text-xs text-stone-500">{entry.item.totals.quantity.toLocaleString("ko-KR")}장 기준</p>
              </div>
              <p className="shrink-0 text-sm font-black text-brand">
                {entry.meetsMoq
                  ? formatRange(entry.item.totals.totalMin, entry.item.totals.totalMax, entry.item.totals.totalIsStartingFrom)
                  : "MOQ 미달"}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl bg-brand/5 px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-extrabold text-brand">
              총 예상 제작비 · {items.length}개 품목 {totals.quantity.toLocaleString("ko-KR")}장 합계
            </p>
            <p className="text-lg font-black text-brand">
              {allMeetMoq ? formatRange(totals.totalMin, totals.totalMax, totals.totalIsStartingFrom) : "MOQ 확인 필요"}
            </p>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-stone-500">
            개발비 합계 {formatWon(totals.developmentTotal)} · 생산비 {formatRange(totals.productionTotalMin, totals.productionTotalMax)} ·
            후가공비 {formatRange(totals.decorationTotalMin, totals.decorationTotalMax)} (원단 제외)
          </p>
        </div>
      </div>
    </Card>
  );
};
