import { supabase } from "@/lib/supabase";
import type { ReadyMadeProductOption } from "@/data/ready-made-pricing-config";
import type { ReadyMadeQuoteInput, ReadyMadeQuoteResult } from "@/types/readyMadeOrder";
import type { TrademarkScreeningDecision } from "@/types/trademark";
import { READY_MADE_PRINT_LOCATION_OPTIONS } from "@/data/ready-made-pricing-config";

export interface ReadyMadeGroupWearRequestInput {
  product: ReadyMadeProductOption;
  color: string;
  quoteInput: ReadyMadeQuoteInput;
  quote: ReadyMadeQuoteResult;
  requestNote: string;
  imageBase64: string | null;
  imageMimeType: string | null;
  trademarkDecision: TrademarkScreeningDecision | null;
}

const formatWon = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;

const buildDetailDescription = (input: ReadyMadeGroupWearRequestInput) => {
  const sizeSummary = Object.entries(input.quoteInput.sizeQuantities)
    .filter(([, count]) => count > 0)
    .map(([size, count]) => `${size} ${count}장`)
    .join(", ");

  const printSummary = input.quote.locationBreakdown
    .map((line) => `${line.locationLabel} ${formatWon(line.unitPrice)}`)
    .join(", ");

  const placementSummary = input.quoteInput.printJobs
    .map((job) => {
      const label =
        READY_MADE_PRINT_LOCATION_OPTIONS.find((option) => option.key === job.location)?.label || job.location;
      const side = job.side === "front" ? "앞면" : "뒷면";
      return `${label}: ${side} 기준 중심 (${Math.round(job.placement.xPercent)}%, ${Math.round(job.placement.yPercent)}%) · 폭 ${Math.round(job.placement.widthPercent)}%`;
    })
    .join(" / ");

  return [
    "[기성품 단체복 빠른 제작 의뢰]",
    `제품: ${input.product.label} / 색상: ${input.color}`,
    `사이즈별 수량: ${sizeSummary || "없음"} (총 ${input.quote.quantity}장)`,
    `인쇄 위치: ${printSummary || "없음"}`,
    `배치 상세(고객 지정): ${placementSummary || "없음"}`,
    `기성 의류 단가: ${formatWon(input.quote.garmentUnitPrice)}`,
    `장당 예상금액: ${formatWon(input.quote.unitPrice)}`,
    `공급가: ${formatWon(input.quote.subtotal)}`,
    `VAT: ${formatWon(input.quote.vat)}`,
    `총 예상금액(VAT 포함): ${formatWon(input.quote.total)}`,
    `예상 제작기간: ${input.quote.estimatedLeadTimeLabel}`,
    input.trademarkDecision === "review"
      ? "상표 분석: 관리자 추가 확인 필요"
      : input.trademarkDecision === "clear"
        ? "상표 분석: 자동 확인 완료"
        : "",
    input.requestNote.trim() ? `추가 요청: ${input.requestNote.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

/**
 * Submits a ready-made group wear ("기성품 단체복 빠른 제작") production request.
 *
 * This intentionally does NOT reuse `createDirectProductionRequest` from
 * `src/services/orderCreation.ts`: that function enforces the custom-clothing
 * MOQ table (`getMinimumOrderQuantity`), which does not apply to this
 * ready-made service. It also does not attach an `estimateSnapshot` to the
 * order, because the admin order list/review dialog renders any snapshot as
 * a custom-clothing `ProductionEstimateResult` — the full ready-made
 * breakdown is written into the plain-text `detailDescription` instead, which
 * every admin view already renders safely.
 */
export const createReadyMadeGroupWearRequest = async (
  input: ReadyMadeGroupWearRequestInput,
) => {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;

  if (!user) {
    throw new Error("제작 의뢰를 접수하려면 로그인이 필요합니다.");
  }

  const { data: orderData, error } = await supabase.functions.invoke("save-order", {
    body: {
      userId: user.id,
      clothType: `기성품 단체복 · ${input.product.label}`,
      material: "기성 원단 (변경 불가)",
      detailDescription: buildDetailDescription(input),
      size: "XS~3XL (사이즈별 수량 개별 지정)",
      measurements: null,
      generatedImageUrl: null,
      imagePath: null,
      imageBase64: input.imageBase64,
      imageMimeType: input.imageMimeType,
      requestSource: "ready_made_group_wear",
      requestTitle: `${input.product.label} 단체복 빠른 제작 (${input.quote.quantity}장)`,
      requestedQuantity: input.quote.quantity,
      status: "pending",
    },
  });

  if (error) {
    throw new Error(error.message || "제작 의뢰를 저장하지 못했습니다.");
  }

  if (!orderData?.success) {
    throw new Error(orderData?.error || "제작 의뢰를 저장하지 못했습니다.");
  }

  return orderData;
};
