import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, RotateCcw, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { UseReadyMadeGroupWearFormReturn } from "@/hooks/useReadyMadeGroupWearForm";

interface SubmitStepProps {
  form: UseReadyMadeGroupWearFormReturn;
}

const formatWon = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;

export const SubmitStep = ({ form }: SubmitStepProps) => {
  if (form.submittedOrderId) {
    return (
      <Card className="rounded-[1.75rem] border-emerald-200 bg-emerald-50 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-black text-emerald-950">제작 의뢰가 접수되었습니다</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              관리자가 확인 후 등록된 연락처로 안내드립니다.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button asChild className="h-11 rounded-full bg-emerald-700 hover:bg-emerald-800">
            <Link to="/orders">내 제작 의뢰 확인</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full border-emerald-300 bg-white"
            onClick={() => form.setCurrentStep(1)}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            새 단체복 제작 시작하기
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-black text-stone-950">제작 의뢰를 접수해주세요</h2>
      <p className="mt-1 text-sm leading-6 text-stone-500">
        접수하면 관리자 페이지에 디자인과 견적서가 함께 저장됩니다.
      </p>

      {form.quote && (
        <Card className="mt-5 rounded-2xl bg-stone-50 p-4">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="font-semibold text-stone-500">{form.quote.quantity}장 기준 총 예상금액</span>
            <span className="text-lg font-black text-brand">{formatWon(form.quote.total)}</span>
          </div>
          <p className="mt-1 text-right text-xs font-semibold text-stone-400">VAT 포함</p>
        </Card>
      )}

      <label className="mt-5 block text-sm font-bold text-stone-700">
        관리자에게 전달할 추가 요청사항
        <Textarea
          value={form.requestNote}
          onChange={(event) => form.setRequestNote(event.target.value)}
          placeholder="희망 납기, 로고 수정 사항 등을 적어주세요. (선택)"
          maxLength={1000}
          className="mt-2 min-h-24 resize-none bg-white"
        />
      </label>

      <Button
        type="button"
        className="mt-4 h-12 w-full rounded-full bg-brand text-base font-black hover:bg-brand-dark"
        onClick={() => void form.submitRequest()}
        disabled={form.isSubmitting || !form.quote}
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
    </div>
  );
};
