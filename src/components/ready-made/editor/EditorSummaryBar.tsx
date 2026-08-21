import { READY_MADE_COLOR_SWATCHES, READY_MADE_PRINT_METHOD_OPTIONS } from "@/data/ready-made-pricing-config";
import type { UseReadyMadeGroupWearFormReturn } from "@/hooks/useReadyMadeGroupWearForm";

interface EditorSummaryBarProps {
  form: UseReadyMadeGroupWearFormReturn;
  layout: "column" | "row";
}

const formatWon = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 text-xs">
    <span className="font-semibold text-stone-500">{label}</span>
    <span className="truncate font-bold text-stone-800">{value}</span>
  </div>
);

export const EditorSummaryBar = ({ form, layout }: EditorSummaryBarProps) => {
  const printMethodLabel = READY_MADE_PRINT_METHOD_OPTIONS.find((option) => option.key === form.printMethod)?.label;

  return (
    <div className={layout === "column" ? "space-y-3" : "flex items-center gap-4 overflow-x-auto"}>
      {layout === "column" && <p className="text-sm font-black text-stone-950">실시간 요약</p>}

      <div className={layout === "column" ? "space-y-2" : "flex shrink-0 items-center gap-4"}>
        <div className={layout === "row" ? "flex shrink-0 items-center gap-1.5" : undefined}>
          {layout === "row" && (
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
              style={{ backgroundColor: READY_MADE_COLOR_SWATCHES[form.selectedColor] }}
            />
          )}
          <Row label="상품" value={`${form.selectedProduct.label} · ${form.selectedColor}`} />
        </div>
        <Row label="인쇄" value={`${printMethodLabel ?? ""} · ${form.printJobs.length}곳`} />
        <Row label="수량" value={`${form.totalQuantity.toLocaleString("ko-KR")}장`} />
        <Row label="예상 단가" value={form.quote ? formatWon(form.quote.unitPrice) : "-"} />
      </div>

      <div
        className={
          layout === "column"
            ? "flex items-center justify-between rounded-xl bg-brand/5 px-3.5 py-3"
            : "flex shrink-0 items-center gap-2 rounded-xl bg-brand/5 px-3 py-1.5"
        }
      >
        <span className="text-xs font-bold text-stone-600">예상 총액</span>
        <span className="ml-2 text-base font-black text-brand">
          {form.quote ? formatWon(form.quote.total) : "-"}
        </span>
      </div>
    </div>
  );
};
