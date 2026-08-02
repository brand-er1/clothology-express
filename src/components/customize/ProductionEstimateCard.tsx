import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  CirclePlus,
  Info,
  Loader2,
  Printer,
  RefreshCw,
  Scissors,
  Shirt,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { analyzeProductionEstimate } from "@/services/productionEstimate";
import type {
  ArtworkType,
  EstimateDifficulty,
  ManualProductionAnalysis,
  ProductionEstimateResult,
  UploadedArtworkAnalysis,
} from "@/types/productionEstimate";
import {
  accessoryOptions,
  decorationOptions,
  estimateGarmentOptions,
  estimateMaterialOptions,
  printSizeLabels,
} from "@/lib/production-estimate-options";
import {
  normalizeEstimateQuantity,
  recalculateEstimateQuantity,
} from "@/lib/production-estimate-quantity";

interface ProductionEstimateCardProps {
  selectedType: string;
  selectedMaterial: string;
  imageUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  designContext?: string;
  uploadedArtwork?: UploadedArtworkAnalysis | null;
  editable?: boolean;
  quantity?: number;
  onQuantityChange?: (quantity: number) => void;
  onEstimateChange?: (estimate: ProductionEstimateResult | null) => void;
}

const formatWon = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;

const formatRange = (
  minimum: number,
  maximum: number,
  isStartingFrom = false,
) => {
  if (minimum === maximum) {
    return `${formatWon(minimum)}${isStartingFrom ? "부터" : ""}`;
  }

  return `${formatWon(minimum)} ~ ${formatWon(maximum)}${isStartingFrom ? " 이상" : ""}`;
};

const difficultyLabel: Record<EstimateDifficulty, string> = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
};

const difficultyStyle: Record<EstimateDifficulty, string> = {
  easy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  hard: "border-rose-200 bg-rose-50 text-rose-700",
};

const artworkTypeLabel: Record<ArtworkType, string> = {
  logo: "로고형",
  photo: "사진형",
  illustration: "일러스트형",
};

const knitDecorationOptions = decorationOptions.filter((option) =>
  ["patch", "label", "pigment", "washing"].includes(option.value),
);

const toManualAnalysis = (
  estimate: ProductionEstimateResult,
): ManualProductionAnalysis => ({
  categoryKey: estimate.analysis.categoryKey,
  categoryConfidence: 1,
  materialKey: estimate.material.key,
  materialLabel: estimate.material.label,
  materialConfidence: 1,
  materialComposition: estimate.material.composition,
  hasLining: estimate.analysis.hasLining,
  hasWashing: estimate.analysis.hasWashing,
  difficulty: estimate.analysis.difficulty,
  difficultyReason: estimate.analysis.difficultyReason,
  decorations: estimate.decorations.map((decoration) => ({
    kind: decoration.kind,
    location: decoration.location,
    size: decoration.size,
    confidence: 1,
  })),
  accessories: estimate.accessories.map((accessory) => ({
    kind: accessory.kind,
    count: accessory.count,
    confidence: 1,
  })),
  features: estimate.analysis.features || [],
});

const EstimateLoading = () => (
  <Card className="w-full overflow-hidden border-brand/20">
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="rounded-full bg-brand/10 p-3 text-brand">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
      <div>
        <p className="font-bold text-gray-950">AI가 디자인을 분석하고 있습니다</p>
        <p className="mt-1 text-sm text-gray-500">
          의류 종류·프린팅·부자재·난이도를 확인해 견적을 계산합니다.
        </p>
      </div>
    </div>
  </Card>
);

export const ProductionEstimateCard = ({
  selectedType,
  selectedMaterial,
  imageUrl = "",
  imageBase64 = "",
  imageMimeType = "",
  designContext = "",
  uploadedArtwork = null,
  editable = false,
  quantity,
  onQuantityChange,
  onEstimateChange,
}: ProductionEstimateCardProps) => {
  const [baseEstimate, setBaseEstimate] =
    useState<ProductionEstimateResult | null>(null);
  const [internalQuantity, setInternalQuantity] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualAnalysis, setManualAnalysis] =
    useState<ManualProductionAnalysis | null>(null);
  const requestIdRef = useRef(0);
  const minimumQuantity = baseEstimate?.garment.moq ?? 20;
  const activeQuantity = normalizeEstimateQuantity(
    quantity ?? internalQuantity,
    minimumQuantity,
  );
  const estimate = useMemo(
    () =>
      baseEstimate
        ? recalculateEstimateQuantity(baseEstimate, activeQuantity)
        : null,
    [activeQuantity, baseEstimate],
  );

  const changeQuantity = (value: number) => {
    const nextQuantity = normalizeEstimateQuantity(value, minimumQuantity);
    if (quantity === undefined) {
      setInternalQuantity(nextQuantity);
    }
    onQuantityChange?.(nextQuantity);
  };

  const loadEstimate = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setError(null);

    try {
      const result = await analyzeProductionEstimate({
        imageUrl,
        imageBase64,
        imageMimeType,
        selectedType,
        selectedMaterial,
        designContext,
        uploadedArtwork,
        manualAnalysis,
        quantity: 20,
      });
      if (requestIdRef.current !== requestId) return;
      setBaseEstimate(result);
    } catch (analysisError) {
      if (requestIdRef.current !== requestId) return;
      console.error("Production estimate analysis error:", analysisError);
      setBaseEstimate(null);
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "자동 견적 분석에 실패했습니다.",
      );
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [
    designContext,
    imageBase64,
    imageMimeType,
    imageUrl,
    manualAnalysis,
    selectedMaterial,
    selectedType,
    uploadedArtwork,
  ]);

  useEffect(() => {
    void loadEstimate();
    return () => {
      requestIdRef.current += 1;
    };
  }, [loadEstimate]);

  useEffect(() => {
    onEstimateChange?.(estimate);
  }, [estimate, onEstimateChange]);

  if (isLoading && !estimate) return <EstimateLoading />;

  if (error || !estimate) {
    return (
      <Card className="w-full border-rose-200 bg-rose-50/50 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div className="flex-1">
            <p className="font-bold text-gray-950">자동 견적을 불러오지 못했습니다</p>
            <p className="mt-1 text-sm text-gray-600">
              {error || "잠시 후 다시 시도해주세요."}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 bg-white"
              onClick={() => void loadEstimate()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              다시 분석
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const { analysis, garment, totals, decorations } = estimate;
  const isKnit = analysis.categoryKey === "knit";
  const accessories = estimate.accessories || [];
  const accessoryUnitTotal = totals.accessoryUnitTotal || 0;
  const accessoryTotal = totals.accessoryTotal || 0;
  const totalLabel = estimate.isPartial
    ? `${totals.quantity}장 기준 확인 가능한 합계`
    : `${totals.quantity}장 기준 예상 제작비`;

  const updateManualAnalysis = (
    updater: (draft: ManualProductionAnalysis) => ManualProductionAnalysis,
  ) => {
    const base = manualAnalysis || toManualAnalysis(estimate);
    setManualAnalysis(updater(base));
  };

  const changeDecoration = (index: number, kind: string) => {
    updateManualAnalysis((draft) => {
      const decorations = draft.decorations.map((decoration, itemIndex) =>
        itemIndex === index
          ? {
              ...decoration,
              kind: kind as ManualProductionAnalysis["decorations"][number]["kind"],
              confidence: 1,
            }
          : decoration,
      );
      return {
        ...draft,
        decorations,
        hasWashing: decorations.some(
          (decoration) => decoration.kind === "washing",
        ),
      };
    });
  };

  const removeDecoration = (index: number) => {
    updateManualAnalysis((draft) => {
      const decorations = draft.decorations.filter(
        (_, itemIndex) => itemIndex !== index,
      );
      return {
        ...draft,
        decorations,
        hasWashing: decorations.some(
          (decoration) => decoration.kind === "washing",
        ),
      };
    });
  };

  const removeAccessory = (index: number) => {
    updateManualAnalysis((draft) => ({
      ...draft,
      accessories: draft.accessories.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    }));
  };

  return (
    <Card className="w-full overflow-hidden border-brand/20 bg-gradient-to-br from-white via-white to-brand/5 shadow-sm">
      <div className="border-b border-brand/10 bg-brand px-5 py-5 text-white">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-white/20 bg-white/15 text-white hover:bg-white/15">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                AI 이미지 분석
              </Badge>
              <span className="text-xs font-medium text-white/75">
                {garment.label} · 견적 수량 직접 조절
              </span>
            </div>
            <h3 className="mt-3 flex items-center gap-2 text-xl font-extrabold">
              <Calculator className="h-5 w-5" /> 예상 제작 견적
            </h3>
            <p className="mt-1 text-xs font-semibold text-white/75">
              장당 생산·프린팅·부자재 공임 + 별도 패턴·샘플 개발비
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold text-white/70">{totalLabel}</p>
            <p className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
              {formatRange(
                totals.totalMin,
                totals.totalMax,
                totals.totalIsStartingFrom,
              )}
            </p>
            <p className="mt-1 text-xs font-bold text-white/80">(원단 제외)</p>
          </div>
        </div>
      </div>

      <div className="border-b border-brand/10 bg-white px-5 py-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-extrabold text-stone-950">견적 수량</p>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              {isKnit
                ? "니트 생산공임은 수량과 관계없이 장당 20,000원 기준"
                : "100장 이상 생산공임 5% · 200장 이상 7% · 300장 이상 10% 할인"}
            </p>
          </div>
          <div className="relative w-full sm:w-48">
            <Input
              aria-label={`견적 수량 (최소 ${garment.moq}장)`}
              type="number"
              min={garment.moq}
              max={100000}
              step={1}
              value={activeQuantity}
              onChange={(event) => changeQuantity(Number(event.target.value))}
              className="h-12 rounded-xl pr-12 text-right text-lg font-black"
            />
            <span className="pointer-events-none absolute right-4 top-3.5 text-sm font-bold text-stone-500">
              장
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs font-bold text-brand">
          {garment.label} MOQ {garment.moq}장부터 견적을 계산할 수 있습니다.
        </p>
        {totals.productionDiscountRate > 0 && (
          <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
            {activeQuantity.toLocaleString("ko-KR")}장 기준 생산공임{" "}
            {Math.round(totals.productionDiscountRate * 100)}% 할인이 적용되었습니다.
          </div>
        )}
      </div>

      {editable && (
        <div className="border-b border-stone-200 bg-[#fbfaf8] p-5">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <p className="font-extrabold text-stone-950">AI 분석 결과 확인</p>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                잘못 인식된 항목을 수정하면 기존 계산식으로 견적이 즉시 다시 계산됩니다.
              </p>
            </div>
            {isLoading && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-brand" aria-live="polite">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                견적 재계산 중
              </span>
            )}
          </div>

          {isKnit && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs font-semibold leading-5 text-amber-900">
              니트 로고·이미지는 원단 조직 보호를 위해 프린팅·직자수 없이
              패치(와펜) 부착 방식만 적용됩니다.
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-bold text-stone-600">
              의류 종류
              <Select
                value={analysis.categoryKey}
                onValueChange={(categoryKey) =>
                  updateManualAnalysis((draft) => ({
                    ...draft,
                    categoryKey,
                    categoryConfidence: 1,
                  }))
                }
              >
                <SelectTrigger className="h-11 bg-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {estimateGarmentOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="space-y-1.5 text-xs font-bold text-stone-600">
              소재
              <Select
                value={estimate.material.key}
                onValueChange={(materialKey) => {
                  const materialLabel =
                    estimateMaterialOptions.find(
                      (option) => option.value === materialKey,
                    )?.label || materialKey;
                  updateManualAnalysis((draft) => ({
                    ...draft,
                    materialKey,
                    materialLabel,
                    materialComposition: materialLabel,
                    materialConfidence: 1,
                  }));
                }}
              >
                <SelectTrigger className="h-11 bg-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {estimateMaterialOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          {decorations.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold text-stone-600">
                {isKnit ? "패치·후가공" : "프린팅·후가공"}
              </p>
              <div className="mt-2 grid gap-2">
                {decorations.map((decoration, index) => (
                  <div
                    key={`${decoration.kind}-${decoration.location}-${index}`}
                    className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white p-2"
                  >
                    <Select
                      value={decoration.kind}
                      onValueChange={(kind) => changeDecoration(index, kind)}
                    >
                      <SelectTrigger className="h-10 flex-1 border-0 bg-stone-50 text-sm shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(isKnit ? knitDecorationOptions : decorationOptions).map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="hidden text-xs text-stone-400 sm:inline">
                      {decoration.locationLabel}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0 text-stone-400 hover:text-rose-600"
                      onClick={() => removeDecoration(index)}
                      aria-label={`${decoration.label} 제거`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {accessories.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold text-stone-600">부자재</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {accessories.map((accessory, index) => (
                  <div
                    key={`${accessory.kind}-${index}`}
                    className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white p-2"
                  >
                    <Select
                      value={accessory.kind}
                      onValueChange={(kind) =>
                        updateManualAnalysis((draft) => ({
                          ...draft,
                          accessories: draft.accessories.map(
                            (item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    kind: kind as ManualProductionAnalysis["accessories"][number]["kind"],
                                    confidence: 1,
                                  }
                                : item,
                          ),
                        }))
                      }
                    >
                      <SelectTrigger className="h-9 min-w-0 flex-1 border-0 bg-stone-50 text-sm shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {accessoryOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={accessory.count}
                      onChange={(event) => {
                        const count = Math.min(
                          50,
                          Math.max(1, Number(event.target.value) || 1),
                        );
                        updateManualAnalysis((draft) => ({
                          ...draft,
                          accessories: draft.accessories.map(
                            (item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, count, confidence: 1 }
                                : item,
                          ),
                        }));
                      }}
                      className="h-9 w-16 rounded-lg border border-stone-200 bg-stone-50 px-2 text-center text-sm"
                      aria-label={`${accessory.label} 개수`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-stone-400 hover:text-rose-600"
                      onClick={() => removeAccessory(index)}
                      aria-label={`${accessory.label} 제거`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full bg-white"
              onClick={() =>
                updateManualAnalysis((draft) => ({
                  ...draft,
                  decorations: [
                    ...draft.decorations,
                    {
                      kind: isKnit ? "patch" : "screen_print_1_color",
                      location: "front",
                      size: "medium",
                      confidence: 1,
                    },
                  ],
                }))
              }
            >
              <CirclePlus className="mr-1.5 h-4 w-4" />
              후가공 추가
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full bg-white"
              onClick={() =>
                updateManualAnalysis((draft) => ({
                  ...draft,
                  accessories: [
                    ...draft.accessories,
                    { kind: "zipper", count: 1, confidence: 1 },
                  ],
                }))
              }
            >
              <CirclePlus className="mr-1.5 h-4 w-4" />
              부자재 추가
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-3 p-5 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs text-gray-500">
                <Shirt className="h-4 w-4" /> AI 분석 의류
              </p>
              <p className="mt-2 font-extrabold text-gray-950">{garment.label}</p>
              <p className="mt-1 text-xs text-gray-500">
                판단 신뢰도 {Math.round(analysis.categoryConfidence * 100)}%
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                {analysis.difficultyReason}
              </p>
            </div>
            <Badge
              variant="outline"
              className={difficultyStyle[analysis.difficulty]}
            >
              난이도 {difficultyLabel[analysis.difficulty]}
            </Badge>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Sparkles className="h-4 w-4" /> AI 분석 소재
          </p>
          <p className="mt-2 font-extrabold text-gray-950">
            {estimate.material.composition}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            소재 신뢰도 {Math.round(estimate.material.confidence * 100)}%
          </p>
          {(analysis.features || []).length > 0 && (
            <p className="mt-2 text-xs leading-5 text-gray-500">
              디테일 · {analysis.features.join(" · ")}
            </p>
          )}
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Shirt className="h-4 w-4" /> 생산공임 (장당)
          </p>
          <p className="mt-2 font-bold text-gray-950">
            {totals.productionMin === null || totals.productionMax === null
              ? "상담 후 확정"
              : formatRange(
                  totals.productionMin,
                  totals.productionMax,
                  totals.productionIsStartingFrom,
                )}
          </p>
          {totals.productionDiscountRate > 0 &&
            totals.productionOriginalMin != null &&
            totals.productionOriginalMax != null && (
              <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                기존{" "}
                <span className="line-through">
                  {formatRange(
                    totals.productionOriginalMin,
                    totals.productionOriginalMax,
                    totals.productionIsStartingFrom,
                  )}
                </span>{" "}
                · {Math.round(totals.productionDiscountRate * 100)}% 할인
              </p>
            )}
          {estimate.materialPremium &&
            totals.productionUnitSurcharge > 0 && (
              <p className="mt-1 text-[11px] font-semibold text-brand">
                {estimate.materialPremium.label} 소재 공임{" "}
                +{formatWon(totals.productionUnitSurcharge)}/장 포함
              </p>
            )}
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Scissors className="h-4 w-4" /> 패턴비 (별도 · 1회)
          </p>
          <p className="mt-2 font-bold text-gray-950">
            {formatWon(totals.patternCost)}
          </p>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Scissors className="h-4 w-4" /> 샘플비 합계 (별도 · 1회)
          </p>
          <p className="mt-2 font-bold text-gray-950">
            {formatWon(totals.sampleCost)}
          </p>
          <div className="mt-3 space-y-1.5 border-t border-stone-100 pt-3 text-[11px]">
            <div className="flex items-center justify-between gap-3 text-stone-600">
              <span>기존 의류 샘플비</span>
              <span className="font-bold text-stone-900">
                {formatWon(totals.baseSampleCost)}
              </span>
            </div>
          {estimate.materialPremium && totals.sampleSurcharge > 0 && (
              <div className="flex items-center justify-between gap-3 text-brand">
                <span>{estimate.materialPremium.label} 소재 추가</span>
                <span className="font-bold">
                  +{formatWon(totals.sampleSurcharge)}
                </span>
              </div>
          )}
          {totals.printPlateCost > 0 && (
              <div className="flex items-center justify-between gap-3 text-brand">
                <span>
                  나염·프린팅 샘플 판비 ({totals.printPlateCount}개 × 30,000원)
                </span>
                <span className="font-bold">
                  +{formatWon(totals.printPlateCost)}
                </span>
              </div>
          )}
          {totals.embroiderySampleCost > 0 && (
              <div className="flex items-center justify-between gap-3 text-brand">
                <span>
                  자수 샘플 판비 ({totals.embroiderySampleCount}개 × 50,000원)
                </span>
                <span className="font-bold">
                  +{formatWon(totals.embroiderySampleCost)}
                </span>
              </div>
          )}
            {totals.dyeingSampleCost > 0 && (
              <div className="flex items-center justify-between gap-3 text-brand">
                <span>
                  염색·피그먼트 샘플 추가비 ({totals.dyeingSampleCount}개 ×
                  50,000원)
                </span>
                <span className="font-bold">
                  +{formatWon(totals.dyeingSampleCost)}
                </span>
              </div>
            )}
            {totals.washingSampleCost > 0 && (
              <div className="flex items-center justify-between gap-3 text-brand">
                <span>
                  워싱 샘플 추가비 ({totals.washingSampleCount}개 × 50,000원)
                </span>
                <span className="font-bold">
                  +{formatWon(totals.washingSampleCost)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-5 mb-5 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-bold text-gray-950">
            <Printer className="h-4 w-4 text-brand" />
            {isKnit ? "패치·후가공" : "프린팅·후가공"}{" "}
            {decorations.length > 0 && `(${decorations.length}개)`} (장당)
          </p>
          <p className="font-extrabold text-brand">
            {decorations.length
              ? formatRange(totals.decorationMin, totals.decorationMax)
              : "없음"}
          </p>
        </div>

        {decorations.length > 0 ? (
          <div className="mt-3 divide-y divide-gray-100">
            {decorations.map((decoration, index) => (
              <div
                key={`${decoration.kind}-${decoration.location}-${index}`}
                className="flex items-start justify-between gap-4 py-2.5 text-sm"
              >
                <div>
                  <p className="font-semibold text-gray-800">
                    {decoration.locationLabel} · {decoration.label}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-gray-500">
                    {printSizeLabels[decoration.size]} · AI 신뢰도{" "}
                    {Math.round(decoration.confidence * 100)}%
                  </p>
                  {decoration.source === "uploaded_artwork" &&
                    decoration.artworkType && (
                      <p className="mt-0.5 text-[11px] font-bold text-brand">
                        업로드 {artworkTypeLabel[decoration.artworkType]} 분석
                        기준
                      </p>
                    )}
                  {decoration.note && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      {decoration.note}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold text-gray-950">
                    {decoration.lineMin === 0 &&
                    decoration.lineMax === 0 &&
                    decoration.kind === "label"
                      ? "상담 후 확정"
                      : formatRange(
                          decoration.lineMin,
                          decoration.lineMax,
                          decoration.isStartingFrom,
                        )}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-gray-500">
                    장당
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs leading-5 text-gray-500">
            이미지에서 뚜렷한 {isKnit ? "패치·후가공" : "프린팅·자수·패치"}가
            확인되지 않았습니다.
          </p>
        )}
      </div>

      <div className="mx-5 mb-5 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-bold text-gray-950">
            <CirclePlus className="h-4 w-4 text-brand" />
            이미지 판별 부자재 (장당)
          </p>
          <p className="font-extrabold text-brand">
            {accessories.length
              ? formatWon(accessoryUnitTotal)
              : "없음"}
          </p>
        </div>

        {accessories.length > 0 ? (
          <div className="mt-3 divide-y divide-gray-100">
            {accessories.map((accessory) => (
              <div
                key={accessory.kind}
                className="flex items-start justify-between gap-4 py-2.5 text-sm"
              >
                <div>
                  <p className="font-semibold text-gray-800">
                    {accessory.label} × {accessory.count}개
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-gray-500">
                    AI 판별 신뢰도 {Math.round(accessory.confidence * 100)}% ·
                    개당 {formatWon(accessory.unitPrice)}
                  </p>
                  {accessory.note && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      {accessory.note}
                    </p>
                  )}
                </div>
                <p className="shrink-0 font-bold text-gray-950">
                  {formatWon(accessory.lineTotal)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs leading-5 text-gray-500">
            이미지에서 견적에 반영할 부자재가 뚜렷하게 확인되지 않았습니다.
          </p>
        )}
      </div>

      <div className="mx-5 mb-5 overflow-hidden rounded-xl border border-brand/15 bg-white shadow-sm">
        <div className="grid divide-y divide-gray-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="p-4">
            <p className="text-xs font-semibold text-gray-500">
              장당 제작 공임
            </p>
            <p className="mt-1 text-lg font-extrabold text-gray-950">
              {formatRange(totals.directUnitMin, totals.directUnitMax)}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-gray-500">
              생산공임 + 프린팅·후가공 + 부자재 공임
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs font-semibold text-gray-500">
              별도 개발비 (1회)
            </p>
            <p className="mt-1 text-lg font-extrabold text-gray-950">
              {formatWon(totals.developmentTotal)}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-gray-500">
              패턴비 {formatWon(totals.patternCost)} + 샘플비{" "}
              {formatWon(totals.sampleCost)}
            </p>
            {totals.decorationDevelopmentCost > 0 && (
              <p className="mt-1 text-[11px] font-semibold leading-4 text-brand">
                기존 샘플비에 나염·자수·염색·워싱 추가 샘플비{" "}
                {formatWon(totals.decorationDevelopmentCost)} 포함
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 bg-brand/5 p-4">
          <p className="text-xs font-extrabold text-brand">
            {totals.quantity}장 제작 기준
          </p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-600">
                생산공임 × {totals.quantity}장
                {totals.productionDiscountRate > 0 &&
                  ` (${Math.round(totals.productionDiscountRate * 100)}% 할인)`}
              </span>
              <span className="font-bold text-gray-950">
                {formatRange(
                  totals.productionTotalMin,
                  totals.productionTotalMax,
                  totals.productionIsStartingFrom,
                )}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-600">
                프린팅·후가공 × {totals.quantity}장
              </span>
              <span className="font-bold text-gray-950">
                {formatRange(
                  totals.decorationTotalMin,
                  totals.decorationTotalMax,
                )}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-600">
                이미지 판별 부자재 × {totals.quantity}장
              </span>
              <span className="font-bold text-gray-950">
                {formatWon(accessoryTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-600">패턴·샘플 개발비 (별도 1회)</span>
              <span className="font-bold text-gray-950">
                {formatWon(totals.developmentTotal)}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between gap-4 border-t border-brand/15 pt-3">
            <div>
              <p className="text-sm font-extrabold text-gray-950">
                총 예상 제작비
              </p>
              <p className="mt-0.5 text-[11px] text-gray-500">
                개발비 포함 환산 장당{" "}
                {formatRange(
                  totals.effectiveUnitMin,
                  totals.effectiveUnitMax,
                )}
              </p>
            </div>
            <p className="text-xl font-black text-brand">
              {formatRange(
                totals.totalMin,
                totals.totalMax,
                totals.totalIsStartingFrom,
              )}
            </p>
          </div>
        </div>
      </div>

      {analysis.difficulty === "hard" && (
        <div className="mx-5 mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-semibold">
            복잡한 봉제로 인해 실제 견적이 상승할 수 있습니다.
          </p>
        </div>
      )}

      {(garment.note || estimate.manualReviewReasons.length > 0) && (
        <div className="mx-5 mb-5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-600">
          {garment.note && <p>{garment.note}</p>}
          {estimate.manualReviewReasons.map((reason) => (
            <p key={reason}>• {reason}</p>
          ))}
        </div>
      )}

      <div className="mx-5 mb-5 flex items-start gap-2 rounded-xl bg-stone-100 px-4 py-4 text-xs leading-5 text-gray-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <div className="space-y-1">
          <p>
            산출 기준: 생산·프린팅·부자재 공임은 장당 단가이며,
            패턴·샘플비는 수량과 곱하지 않는 별도 1회 개발비입니다.
          </p>
          <p>
            {isKnit
              ? "※ 니트 생산공임은 장당 20,000원 고정 기준입니다."
              : "※ 수량 할인은 생산공임에만 적용됩니다. 100장 이상 5%, 200장 이상 7%, 300장 이상 10% 할인됩니다."}
          </p>
          <p className="font-extrabold text-brand">
            {isKnit
              ? "※ 니트 평균 원단비 13,000원/장은 별도입니다."
              : "※ 원단 가격은 별도입니다."}
          </p>
          <p>※ 위 금액은 예상 제작 단가(About Price)입니다.</p>
          <p>
            ※ 디자인 난이도, 봉제 방식, 후가공, 원단 종류에 따라 실제 견적은
            달라질 수 있습니다.
          </p>
          <p>
            ※ 브랜드 판매가는 일반적으로 제작원가의 약 2~3배 수준으로
            책정하는 것을 권장합니다.
          </p>
          <p className="pt-1 text-[11px] text-gray-500">
            단가 데이터 기준: {estimate.sourceVersion}
          </p>
        </div>
      </div>
    </Card>
  );
};
