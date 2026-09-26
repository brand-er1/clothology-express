import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { colorHexOf } from "@/lib/funding-colors";
import { fetchFundingColorSummary, type ColorOrderSummary as Row } from "@/services/fundingColors";

/** 컬러별 주문(생산) 수량. 결제 완료·미취소 주문 기준, 결제 대기는 별도 표기. */
export const ColorOrderSummary = ({ fundingId, className, refreshKey }: { fundingId: string; className?: string; refreshKey?: unknown }) => {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchFundingColorSummary(fundingId)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch((reason) => { if (!cancelled) setError(reason?.message ?? "컬러별 수량을 불러오지 못했습니다."); });
    return () => { cancelled = true; };
  }, [fundingId, refreshKey]);

  if (error) return <p className={className ?? ""}><span className="text-xs text-rose-600">{error}</span></p>;
  if (!rows) return <div className={className}><Loader2 className="h-4 w-4 animate-spin text-stone-400" /></div>;

  const total = rows.reduce((sum, row) => sum + row.paidQuantity, 0);
  const pending = rows.reduce((sum, row) => sum + row.pendingQuantity, 0);
  const visible = rows.filter((row) => row.status === "active" || row.paidQuantity > 0 || row.pendingQuantity > 0);

  return (
    <div className={className}>
      <ul className="divide-y divide-stone-100" data-testid="color-order-summary">
        {visible.map((row) => (
          <li key={row.colorId ?? `legacy-${row.colorName}`} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/15" style={{ backgroundColor: colorHexOf({ name: row.colorName, hex: row.hex }) }} />
              <span className="truncate font-semibold">{row.colorName}</span>
              {row.status === "deleted" && <span className="text-[11px] text-stone-400">(삭제된 컬러)</span>}
              {row.status === "unlinked" && <span className="text-[11px] text-stone-400">(이전 주문)</span>}
            </span>
            <span className="shrink-0 tabular-nums">
              <strong>{row.paidQuantity}장</strong>
              {row.pendingQuantity > 0 && <span className="ml-1.5 text-xs text-stone-400">대기 {row.pendingQuantity}</span>}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t border-stone-200 pt-2 text-sm font-extrabold">
        <span>총</span>
        <span className="tabular-nums">{total}장{pending > 0 && <span className="ml-1.5 text-xs font-normal text-stone-400">대기 {pending}</span>}</span>
      </div>
    </div>
  );
};
