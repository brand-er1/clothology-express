import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  Info,
  Loader2,
  Printer,
  RefreshCw,
  Scissors,
  Shirt,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { analyzeProductionEstimate } from "@/services/productionEstimate";
import type {
  ArtworkType,
  EstimateDifficulty,
  ProductionEstimateResult,
  UploadedArtworkAnalysis,
} from "@/types/productionEstimate";

interface ProductionEstimateCardProps {
  selectedType: string;
  imageUrl: string;
  designContext?: string;
  uploadedArtwork?: UploadedArtworkAnalysis | null;
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

const EstimateLoading = () => (
  <Card className="w-full overflow-hidden border-brand/20">
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="rounded-full bg-brand/10 p-3 text-brand">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
      <div>
        <p className="font-bold text-gray-950">AI가 디자인을 분석하고 있습니다</p>
        <p className="mt-1 text-sm text-gray-500">
          의류 종류·프린팅 위치·후가공·난이도를 확인해 견적을 계산합니다.
        </p>
      </div>
    </div>
  </Card>
);

export const ProductionEstimateCard = ({
  selectedType,
  imageUrl,
  designContext = "",
  uploadedArtwork = null,
}: ProductionEstimateCardProps) => {
  const [estimate, setEstimate] = useState<ProductionEstimateResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadEstimate = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setError(null);

    try {
      const result = await analyzeProductionEstimate({
        imageUrl,
        selectedType,
        designContext,
        uploadedArtwork,
      });
      if (requestIdRef.current !== requestId) return;
      setEstimate(result);
    } catch (analysisError) {
      if (requestIdRef.current !== requestId) return;
      console.error("Production estimate analysis error:", analysisError);
      setEstimate(null);
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
  }, [designContext, imageUrl, selectedType, uploadedArtwork]);

  useEffect(() => {
    void loadEstimate();
    return () => {
      requestIdRef.current += 1;
    };
  }, [loadEstimate]);

  if (isLoading) return <EstimateLoading />;

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
  const totalLabel = estimate.isPartial
    ? `${totals.quantity}장 기준 확인 가능한 합계`
    : `${totals.quantity}장 기준 예상 제작비`;

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
                {garment.label} · MOQ {garment.moq}장
              </span>
            </div>
            <h3 className="mt-3 flex items-center gap-2 text-xl font-extrabold">
              <Calculator className="h-5 w-5" /> 예상 제작 견적
            </h3>
            <p className="mt-1 text-xs font-semibold text-white/75">
              장당 생산·프린팅 공임 + 별도 패턴·샘플 개발비
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
            <Scissors className="h-4 w-4" /> 샘플비 (별도 · 1회)
          </p>
          <p className="mt-2 font-bold text-gray-950">
            {formatWon(totals.sampleCost)}
          </p>
        </div>
      </div>

      <div className="mx-5 mb-5 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-bold text-gray-950">
            <Printer className="h-4 w-4 text-brand" />
            프린팅·후가공 (장당)
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
                    {formatRange(
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
            이미지에서 뚜렷한 프린팅·자수·패치가 확인되지 않았습니다.
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
              생산공임 + 프린팅·후가공 공임
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
            산출 기준: 생산·프린팅 공임은 장당 단가이며, 패턴·샘플비는
            수량과 곱하지 않는 별도 1회 개발비입니다.
          </p>
          <p className="font-extrabold text-brand">※ 원단 가격은 별도입니다.</p>
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
