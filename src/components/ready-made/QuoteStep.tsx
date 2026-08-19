import { AlertTriangle, Timer } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  READY_MADE_ESTIMATE_VARIANCE_NOTICE,
  READY_MADE_SERVICE_NOTICE,
  READY_MADE_VAT_NOTICE,
} from "@/data/ready-made-pricing-config";
import type { UseReadyMadeGroupWearFormReturn } from "@/hooks/useReadyMadeGroupWearForm";

interface QuoteStepProps {
  form: UseReadyMadeGroupWearFormReturn;
}

const formatWon = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;

export const QuoteStep = ({ form }: QuoteStepProps) => {
  const { quote } = form;

  if (!quote) {
    return (
      <Card className="rounded-2xl border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
        <AlertTriangle className="mr-2 inline h-4 w-4" />
        견적을 계산할 수 없습니다. 사이즈·수량과 인쇄 위치를 다시 확인해주세요.
      </Card>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-black text-stone-950">실시간 예상 견적</h2>
      <p className="mt-1 text-sm leading-6 text-stone-500">
        선택하신 옵션을 기준으로 자동 계산된 예상 견적입니다.
      </p>

      <Card className="mt-5 overflow-hidden rounded-[1.5rem] border-brand/20 bg-white shadow-sm">
        <div className="space-y-3 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-stone-500">기성 무지 {form.selectedProduct.label}</span>
            <span className="text-sm font-bold text-stone-800">{formatWon(quote.garmentUnitPrice)}</span>
          </div>

          {quote.locationBreakdown.map((line) => (
            <div key={line.jobId} className="flex items-center justify-between">
              <span className="text-sm font-semibold text-stone-500">
                {form.printMethod === "dtf" ? "DTF" : "DTG"} {line.locationLabel} 로고 ({line.sizeLabel})
              </span>
              <span className="text-sm font-bold text-stone-800">{formatWon(line.unitPrice)}</span>
            </div>
          ))}

          <div className="border-t border-dashed border-stone-200 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-stone-600">장당 예상금액</span>
              <span className="text-lg font-black text-brand">{formatWon(quote.unitPrice)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-stone-500">수량</span>
            <span className="text-sm font-bold text-stone-800">{quote.quantity.toLocaleString("ko-KR")}장</span>
          </div>
        </div>

        <div className="space-y-2 border-t border-stone-100 bg-stone-50 p-5 sm:p-6">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-stone-500">공급가</span>
            <span className="font-bold text-stone-800">{formatWon(quote.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-stone-500">VAT (10%)</span>
            <span className="font-bold text-stone-800">{formatWon(quote.vat)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-stone-200 pt-2">
            <span className="text-base font-black text-stone-950">총 예상금액</span>
            <span className="text-xl font-black text-brand">{formatWon(quote.total)}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-stone-500">
            <Timer className="h-3.5 w-3.5" />
            예상 제작기간 {quote.estimatedLeadTimeLabel}
          </div>
        </div>
      </Card>

      <Card className="mt-4 space-y-3 rounded-2xl border-stone-200 bg-[#fbfaf8] p-5 text-xs leading-6 text-stone-500">
        <p className="whitespace-pre-line">{READY_MADE_SERVICE_NOTICE}</p>
        <p>{READY_MADE_ESTIMATE_VARIANCE_NOTICE}</p>
        <p>{READY_MADE_VAT_NOTICE}</p>
      </Card>
    </div>
  );
};
