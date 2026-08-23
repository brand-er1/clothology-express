import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Send, Timer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  READY_MADE_ESTIMATE_VARIANCE_NOTICE,
  READY_MADE_SERVICE_NOTICE,
  READY_MADE_VAT_NOTICE,
} from "@/data/ready-made-pricing-config";
import type { UseReadyMadeGroupWearFormReturn } from "@/hooks/useReadyMadeGroupWearForm";

interface QuotePanelProps {
  form: UseReadyMadeGroupWearFormReturn;
}

const formatWon = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;

export const QuotePanel = ({ form }: QuotePanelProps) => {
  const { quote } = form;

  if (form.submittedOrderId) {
    return (
      <div>
        <h3 className="text-sm font-black text-emerald-950">제작 의뢰가 접수되었습니다</h3>
        <p className="mt-2 text-xs leading-5 text-emerald-800">관리자가 확인 후 등록된 연락처로 안내드립니다.</p>
        <div className="mt-4 grid gap-2">
          {form.isAuthenticated && (
            <Button asChild className="h-10 rounded-full bg-emerald-700 text-sm hover:bg-emerald-800">
              <Link to="/orders">
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                내 제작 의뢰 확인
              </Link>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-full border-emerald-300 bg-white text-sm"
            onClick={() => window.location.reload()}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            새 단체복 디자인 시작하기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-black text-stone-950">실시간 견적</h3>
      <p className="mt-1 text-xs leading-5 text-stone-500">선택하신 옵션 기준 자동 계산된 예상 견적입니다.</p>

      {!quote ? (
        <Card className="mt-4 rounded-xl border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-800">
          <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
          사이즈·수량과 인쇄 위치를 입력하면 견적이 표시됩니다.
        </Card>
      ) : (
        <Card className="mt-4 overflow-hidden rounded-xl border-brand/20 bg-white">
          <div className="space-y-2 p-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-500">기본 의류 ({form.selectedProduct.label})</span>
              <span className="font-bold text-stone-800">{formatWon(quote.garmentUnitPrice)}</span>
            </div>
            {quote.locationBreakdown.map((line) => (
              <div key={line.jobId} className="flex items-center justify-between">
                <span className="font-semibold text-stone-500">{line.locationLabel} 프린팅</span>
                <span className="font-bold text-stone-800">+{formatWon(line.unitPrice)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-dashed border-stone-200 pt-2">
              <span className="font-bold text-stone-600">장당 예상금액</span>
              <span className="text-sm font-black text-brand">{formatWon(quote.unitPrice)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-500">수량</span>
              <span className="font-bold text-stone-800">{quote.quantity.toLocaleString("ko-KR")}장</span>
            </div>
          </div>
          <div className="space-y-1.5 border-t border-stone-100 bg-stone-50 p-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-500">공급가</span>
              <span className="font-bold text-stone-800">{formatWon(quote.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-500">VAT (10%)</span>
              <span className="font-bold text-stone-800">{formatWon(quote.vat)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-stone-200 pt-1.5">
              <span className="text-sm font-black text-stone-950">총 예상금액</span>
              <span className="text-base font-black text-brand">{formatWon(quote.total)}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-stone-500">
              <Timer className="h-3 w-3" />
              예상 제작기간 {quote.estimatedLeadTimeLabel}
            </div>
          </div>
        </Card>
      )}

      {!form.isAuthenticated && (
        <div className="mt-4 grid gap-2.5 rounded-xl border border-stone-200 bg-white p-3.5">
          <p className="text-xs font-bold text-stone-700">
            안내받을 연락처 <span className="text-brand">(필수)</span>
          </p>
          <label className="block text-xs font-bold text-stone-700">
            이름
            <Input
              value={form.guestName}
              onChange={(event) => form.setGuestName(event.target.value)}
              placeholder="담당자 이름"
              maxLength={50}
              className="mt-1.5 h-10 bg-white text-sm"
            />
          </label>
          <label className="block text-xs font-bold text-stone-700">
            연락처
            <Input
              value={form.guestPhone}
              onChange={(event) => form.setGuestPhone(event.target.value)}
              placeholder="010-0000-0000"
              maxLength={30}
              className="mt-1.5 h-10 bg-white text-sm"
            />
          </label>
        </div>
      )}

      <label className="mt-4 block text-xs font-bold text-stone-700">
        관리자에게 전달할 추가 요청사항
        <Textarea
          value={form.requestNote}
          onChange={(event) => form.setRequestNote(event.target.value)}
          placeholder="희망 납기, 로고 수정 사항 등을 적어주세요. (선택)"
          maxLength={1000}
          className="mt-1.5 min-h-20 resize-none bg-white text-sm"
        />
      </label>

      <Button
        type="button"
        className="mt-3 h-11 w-full rounded-full bg-brand text-sm font-black hover:bg-brand-dark"
        onClick={() => void form.submitRequest()}
        disabled={
          form.isSubmitting ||
          !quote ||
          !form.designArtwork ||
          (!form.isAuthenticated && (!form.guestName.trim() || !form.guestPhone.trim()))
        }
      >
        {form.isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            제작 의뢰 접수 중...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />이 견적으로 제작 의뢰 접수
          </>
        )}
      </Button>

      <div className="mt-4 space-y-2 rounded-xl bg-[#fbfaf8] p-3.5 text-[11px] leading-5 text-stone-500">
        <p className="whitespace-pre-line">{READY_MADE_SERVICE_NOTICE}</p>
        <p>{READY_MADE_ESTIMATE_VARIANCE_NOTICE}</p>
        <p>{READY_MADE_VAT_NOTICE}</p>
      </div>
    </div>
  );
};
