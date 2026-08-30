import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator, Loader2, PackageCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { closetSlotLabel, characterConfig } from "@/lib/closet-character-config";
import { mannequinSizeShortLabel } from "@/lib/mannequin-presets";
import { getDedupedWornGarments } from "@/lib/fitting-state";
import { getCombinedFittingEstimate, type CombinedFittingQuote } from "@/lib/fitting-quote";
import { resolveGarmentQuoteImage } from "@/lib/quote-garment-handoff";
import { serializeFittingStateForHandoff, uploadFittingPreview } from "@/lib/fitting-preview";
import { createDirectProductionRequest } from "@/services/orderCreation";
import { createFundingDraft } from "@/services/funding";
import { screenTrademarkImage } from "@/services/trademarkScreening";
import type { CharacterGender, ClosetGarment, ClosetOutfit, MannequinSize } from "@/types/closet";

interface FittingOutfitEstimatePanelProps {
  character: CharacterGender;
  mannequinSize: MannequinSize;
  outfit: ClosetOutfit;
  /** AI 피팅 photoreal render, used as the fitting preview when no 3D screenshot is available. */
  renderedCharacterImage: string | null;
  /** Captures the current 3D canvas as a PNG data URL — see Mannequin3DViewerHandle. */
  getScreenshot: () => string | null;
}

const formatWonRange = (min: number, max: number) =>
  min === max ? `${min.toLocaleString("ko-KR")}원` : `${min.toLocaleString("ko-KR")}원 ~ ${max.toLocaleString("ko-KR")}원`;

/**
 * "현재 착용 의류 전체 견적받기" (spec §12/§13) → "이 코디로 제작의뢰" / "이 디자인으로 펀딩 시작"
 * (spec §14/§15). Reads only `fittingState`-equivalent data (outfit slots, deduped by garmentId via
 * getDedupedWornGarments) — never the UI's rendered image — and reuses the existing single-garment
 * auto-quote/order/funding pipelines unchanged (getCombinedFittingEstimate only sums their outputs).
 */
export const FittingOutfitEstimatePanel = ({
  character,
  mannequinSize,
  outfit,
  renderedCharacterImage,
  getScreenshot,
}: FittingOutfitEstimatePanelProps) => {
  const navigate = useNavigate();
  const [quote, setQuote] = useState<CombinedFittingQuote | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [isSubmittingFunding, setIsSubmittingFunding] = useState(false);
  const [fundingGarmentId, setFundingGarmentId] = useState<string | null>(null);
  const [orderSubmitted, setOrderSubmitted] = useState(false);

  const garments = getDedupedWornGarments(outfit);

  const runQuote = async () => {
    if (garments.length === 0) {
      toast({
        title: "견적을 낼 의류가 없어요",
        description: "AI로 만들거나 직접 업로드한 옷을 먼저 입혀주세요.",
        variant: "destructive",
      });
      return;
    }
    setIsQuoting(true);
    setOrderSubmitted(false);
    try {
      const result = await getCombinedFittingEstimate(garments);
      setQuote(result);
      setFundingGarmentId(result.items[0]?.garment.id ?? null);
      if (result.items.length === 0) {
        toast({ title: "견적을 계산하지 못했어요", variant: "destructive" });
      } else if (result.failures.length > 0) {
        toast({
          title: `${result.failures.length}개 의류는 견적에서 제외됐어요`,
          description: result.failures.map((failure) => failure.garment.label).join(", "),
        });
      }
    } finally {
      setIsQuoting(false);
    }
  };

  const currentUserId = async () => (await supabase.auth.getSession()).data.session?.user?.id ?? null;

  const submitOutfitOrder = async () => {
    if (!quote?.combinedEstimate) return;
    setIsSubmittingOrder(true);
    try {
      const userId = await currentUserId();
      const previewSource = getScreenshot() || renderedCharacterImage;
      const fittingPreviewUrl = await uploadFittingPreview(previewSource, userId);
      const fittingState = serializeFittingStateForHandoff(character, mannequinSize, outfit);

      const breakdown = quote.items
        .map(
          (item) =>
            `${closetSlotLabel[item.garment.slot]} · ${item.garment.label}: ${formatWonRange(
              item.estimate.totals.totalMin,
              item.estimate.totals.totalMax,
            )}`,
        )
        .join("\n");
      const detailDescription = [
        "[3D 가상피팅 코디 전체 제작 의뢰]",
        `마네킹: ${characterConfig[character].label} ${mannequinSizeShortLabel[mannequinSize]}`,
        `착용 의류 ${quote.items.length}종`,
        breakdown,
        `예상 총 제작비: ${formatWonRange(quote.totalMin, quote.totalMax)} (원단 제외)`,
      ].join("\n");

      const result = await createDirectProductionRequest({
        clothType: quote.combinedEstimate.garment.label,
        material: quote.combinedEstimate.material.composition,
        detailDescription,
        size: `${characterConfig[character].label} ${mannequinSizeShortLabel[mannequinSize]}`,
        measurements: null,
        generatedImageUrl: fittingPreviewUrl,
        imagePath: null,
        requestSource: "virtual_fitting_3d",
        requestTitle: `3D 가상 피팅 코디 제작 의뢰 (${quote.items.length}종)`,
        requestedQuantity: quote.combinedEstimate.totals.quantity,
        estimateSnapshot: quote.combinedEstimate,
        fittingState,
        fittingPreviewUrl,
      });
      setOrderSubmitted(true);
      toast({
        title: "제작 의뢰 접수 완료",
        description: `주문번호: ${result.id ?? "-"} · 관리자가 확인 후 연락드립니다.`,
      });
    } catch (error) {
      toast({
        title: "제작 의뢰 접수 실패",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const startOutfitFunding = async () => {
    const chosen: ClosetGarment | undefined = quote?.items.find((item) => item.garment.id === fundingGarmentId)?.garment;
    const chosenEstimate = quote?.items.find((item) => item.garment.id === fundingGarmentId)?.estimate;
    if (!chosen || !chosenEstimate) return;

    setIsSubmittingFunding(true);
    try {
      const resolved = await resolveGarmentQuoteImage(chosen);
      if (!resolved.url) {
        toast({
          title: "펀딩을 시작할 수 없어요",
          description: "이 의류는 저장된 이미지 URL이 없어 펀딩으로 넘길 수 없습니다.",
          variant: "destructive",
        });
        return;
      }

      const trademarkScreening = await screenTrademarkImage({
        imageUrl: resolved.url,
        source: "final_design",
        selectedType: chosen.designRef?.selectedType || undefined,
        selectedMaterial: chosen.designRef?.selectedMaterial || undefined,
      });
      if (trademarkScreening.decision === "blocked") {
        toast({
          title: "펀딩 등록이 거절되었습니다",
          description: "유명 타사 상표 또는 매우 유사한 로고가 감지되었습니다.",
          variant: "destructive",
        });
        return;
      }

      const userId = await currentUserId();
      const previewSource = getScreenshot() || renderedCharacterImage;
      const fittingPreviewUrl = await uploadFittingPreview(previewSource, userId);
      const fittingState = serializeFittingStateForHandoff(character, mannequinSize, outfit);

      const description = [
        `${chosen.label} 디자인입니다. 목표 인원이 모이면 브랜더가 실제 제품으로 제작합니다.`,
        `BRAND-ER 3D 가상 피팅에서 ${characterConfig[character].label} ${mannequinSizeShortLabel[mannequinSize]} 체형에 입혀보고 만든 펀딩입니다.`,
        quote && quote.items.length > 1
          ? `함께 착용했던 코디: ${quote.items.map((item) => `${closetSlotLabel[item.garment.slot]} · ${item.garment.label}`).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const funding = await createFundingDraft({
        productName: chosen.label,
        clothType: chosen.designRef?.selectedType || chosenEstimate.garment.label,
        material: chosen.designRef?.selectedMaterial || chosenEstimate.material.composition,
        color: "기본 색상",
        size: "M",
        sizeOptions: ["M"],
        measurements: null,
        imageUrl: resolved.url,
        imagePath: chosen.designRef?.imagePath || null,
        description,
        estimateDirectUnitMin: chosenEstimate.totals.directUnitMin,
        estimateDirectUnitMax: chosenEstimate.totals.directUnitMax,
        estimateDevelopmentTotal: chosenEstimate.totals.developmentTotal,
        trademarkScreeningId: trademarkScreening.id,
        fittingState,
        fittingPreviewUrl,
      });

      toast({
        title:
          trademarkScreening.decision === "review"
            ? "펀딩이 상표 검토 대기로 등록되었습니다"
            : "펀딩 페이지가 만들어졌습니다",
      });
      navigate(`/fundings/${funding.id}/edit`);
    } catch (error) {
      toast({
        title: "펀딩 시작 실패",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingFunding(false);
    }
  };

  return (
    <Card className="rounded-[1.5rem] border-brand/20 bg-brand/5 p-5">
      <p className="flex items-center gap-1.5 font-black text-stone-950">
        <Calculator className="h-4 w-4 text-brand" />
        현재 착용 의류 전체 견적받기
      </p>
      <p className="mt-1 text-xs leading-5 text-stone-500">
        마네킹이 지금 입고 있는 모든 의류({garments.length}개, 중복 제외)를 한 번에 견적받아요.
      </p>

      <Button
        type="button"
        className="mt-3 h-11 w-full rounded-full bg-brand text-sm font-bold hover:bg-brand-dark"
        onClick={() => void runQuote()}
        disabled={isQuoting || garments.length === 0}
      >
        {isQuoting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            견적 계산 중...
          </>
        ) : (
          `현재 착용 의류 ${garments.length}개 전체 견적받기`
        )}
      </Button>

      {quote && quote.items.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-xs font-bold text-stone-500">현재 착용 의류 {quote.items.length}개</p>
          <div className="space-y-2">
            {quote.items.map((item) => (
              <div key={item.garment.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                <div>
                  <p className="font-bold text-stone-800">{closetSlotLabel[item.garment.slot]}</p>
                  <p className="text-xs text-stone-500">{item.garment.label}</p>
                </div>
                <p className="text-right text-xs font-bold text-brand">
                  예상 제작단가
                  <br />
                  {formatWonRange(item.estimate.totals.totalMin, item.estimate.totals.totalMax)}
                </p>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-stone-950 px-4 py-3 text-center text-white">
            <p className="text-xs font-bold text-white/70">예상 총 제작비</p>
            <p className="text-lg font-black">{formatWonRange(quote.totalMin, quote.totalMax)}</p>
          </div>

          {quote.items.length > 1 && (
            <div className="rounded-xl border border-stone-200 bg-white p-3">
              <p className="mb-2 text-xs font-bold text-stone-500">펀딩으로 시작할 대표 의류 선택</p>
              <div className="flex flex-wrap gap-2">
                {quote.items.map((item) => (
                  <button
                    key={item.garment.id}
                    type="button"
                    onClick={() => setFundingGarmentId(item.garment.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      fundingGarmentId === item.garment.id
                        ? "bg-stone-900 text-white"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {closetSlotLabel[item.garment.slot]} · {item.garment.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full border-brand/30 bg-white text-sm font-bold text-brand"
              onClick={() => void submitOutfitOrder()}
              disabled={isSubmittingOrder || orderSubmitted}
            >
              {isSubmittingOrder ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : orderSubmitted ? (
                <PackageCheck className="mr-2 h-4 w-4" />
              ) : null}
              {orderSubmitted ? "제작의뢰 접수 완료" : "이 코디로 제작의뢰"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full border-brand/30 bg-white text-sm font-bold text-brand"
              onClick={() => void startOutfitFunding()}
              disabled={isSubmittingFunding || !fundingGarmentId}
            >
              {isSubmittingFunding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              이 디자인으로 펀딩 시작
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
