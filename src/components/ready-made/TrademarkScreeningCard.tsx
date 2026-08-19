import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import type { TrademarkScreeningResult } from "@/types/trademark";

interface TrademarkScreeningCardProps {
  screening: TrademarkScreeningResult | null;
  isScreening: boolean;
}

export const TrademarkScreeningCard = ({ screening, isScreening }: TrademarkScreeningCardProps) => {
  if (isScreening) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-xs font-bold text-stone-500">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand" />
        상표 위험도 자동 검수 중...
      </div>
    );
  }

  if (!screening) return null;

  const tone =
    screening.decision === "blocked" ? "red" : screening.decision === "review" ? "amber" : "emerald";

  return (
    <div
      className={`mt-4 rounded-xl border p-3.5 ${
        tone === "red"
          ? "border-red-200 bg-red-50"
          : tone === "amber"
            ? "border-amber-200 bg-amber-50"
            : "border-emerald-200 bg-emerald-50"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {screening.decision === "clear" ? (
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <ShieldAlert className={`mt-0.5 h-5 w-5 shrink-0 ${tone === "red" ? "text-red-600" : "text-amber-600"}`} />
        )}
        <div className="min-w-0">
          <p
            className={`text-xs font-extrabold ${
              tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-emerald-700"
            }`}
          >
            {screening.decision === "blocked"
              ? "상표 위험 · 제작 불가"
              : screening.decision === "review"
                ? "상표 검토 필요 · 관리자 확인"
                : "상표 자동 검수 통과"}
          </p>
          <p className="mt-1 text-xs leading-5 text-stone-700">{screening.reason}</p>
          {screening.detected_marks.length > 0 && (
            <p className="mt-1 text-[11px] font-semibold text-stone-600">
              감지 표지: {screening.detected_marks.map((mark) => mark.displayName).join(", ")}
            </p>
          )}
          <p className="mt-1 text-[10px] leading-4 text-stone-500">
            {screening.decision === "review"
              ? "제작 의뢰 접수 후 관리자가 상표권 보유·사용 허가 여부를 확인합니다."
              : screening.disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
};
