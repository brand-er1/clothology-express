import type { ProductionSummary } from "@/lib/buyer-management";
import { cn } from "@/lib/utils";

// 생산 수량 집계: 사이즈별 · 컬러별 · 컬러 × 사이즈. 결제 완료 · 미취소 주문 기준.
export const ProductionSummaryPanel = ({ summary, className }: { summary: ProductionSummary; className?: string }) => {
  if (summary.total === 0) {
    return <p className={cn("text-sm text-stone-500", className)}>아직 결제 완료된 주문이 없어 집계할 수량이 없습니다.</p>;
  }

  return (
    <div className={cn("grid min-w-0 gap-5", className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-stone-500">사이즈별</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {summary.bySize.map((item) => (
              <span key={item.key} className="rounded-full bg-stone-100 px-3 py-1 text-sm">
                <b className="font-bold">{item.key}</b> <span className="tabular-nums">{item.quantity.toLocaleString("ko-KR")}장</span>
              </span>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-stone-500">컬러별</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {summary.byColor.map((item) => (
              <span key={item.key} className="rounded-full bg-stone-100 px-3 py-1 text-sm">
                <b className="font-bold">{item.key}</b> <span className="tabular-nums">{item.quantity.toLocaleString("ko-KR")}장</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-xs font-bold text-stone-500">컬러 × 사이즈</p>
        <div className="mt-2 overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="bg-stone-50 text-xs text-stone-500">
                <th className="sticky left-0 bg-stone-50 px-3 py-2 text-left font-bold">컬러</th>
                {summary.sizes.map((size) => <th key={size} className="px-3 py-2 text-right font-bold">{size}</th>)}
                <th className="px-3 py-2 text-right font-bold">합계</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {summary.colors.map((color) => (
                <tr key={color}>
                  <th scope="row" className="sticky left-0 bg-white px-3 py-2 text-left font-bold">{color}</th>
                  {summary.sizes.map((size) => (
                    <td key={size} className={cn("px-3 py-2 text-right tabular-nums", !summary.matrix[color]?.[size] && "text-stone-300")}>
                      {summary.matrix[color]?.[size] ?? 0}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{summary.byColor.find((item) => item.key === color)?.quantity ?? 0}</td>
                </tr>
              ))}
              <tr className="bg-stone-50 font-bold">
                <th scope="row" className="sticky left-0 bg-stone-50 px-3 py-2 text-left">합계</th>
                {summary.bySize.map((item) => <td key={item.key} className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>)}
                <td className="px-3 py-2 text-right tabular-nums">{summary.total}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
