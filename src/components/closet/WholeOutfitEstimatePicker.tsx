import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Info, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { closetSlotLabel } from "@/lib/closet-character-config";
import { DEFAULT_MULTI_ESTIMATE_QUANTITY, type ActiveGarmentEntry } from "@/lib/closet-multi-estimate";

interface WholeOutfitEstimatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: ActiveGarmentEntry[];
  /** How many duplicate garments were already silently collapsed before this list was built. */
  removedDuplicateCount: number;
  isPreparing: boolean;
  onConfirm: (selected: ActiveGarmentEntry[]) => void;
}

/**
 * "견적 대상" preview shown before the whole-outfit estimate runs — every currently worn, deduped
 * design garment defaults to checked. A visitor can uncheck any item to leave it out, and set a
 * shared quantity for every item at once (still adjustable per item on the quote page itself).
 */
export const WholeOutfitEstimatePicker = ({
  open,
  onOpenChange,
  entries,
  removedDuplicateCount,
  isPreparing,
  onConfirm,
}: WholeOutfitEstimatePickerProps) => {
  const isMobile = useIsMobile();
  const [includedIds, setIncludedIds] = useState<Set<string>>(new Set());
  const [bulkQuantity, setBulkQuantity] = useState(DEFAULT_MULTI_ESTIMATE_QUANTITY);

  useEffect(() => {
    if (open) {
      setIncludedIds(new Set(entries.map((entry) => entry.key)));
      setBulkQuantity(DEFAULT_MULTI_ESTIMATE_QUANTITY);
    }
    // Only reset when the dialog opens fresh, not on every entries re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (key: string) => {
    setIncludedIds((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        if (next.size <= 1) return current; // always keep at least one item selected
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectedCount = includedIds.size;

  const confirm = () => {
    const selected = entries
      .filter((entry) => includedIds.has(entry.key))
      .map((entry) => ({ ...entry, quantity: bulkQuantity }));
    onConfirm(selected);
  };

  const body = (
    <>
      {removedDuplicateCount > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs font-bold leading-5 text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          동일한 의류가 중복 감지되어 {removedDuplicateCount}개를 제외하고 견적에 포함했습니다.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {entries.map((entry) => {
          const included = includedIds.has(entry.key);
          return (
            <button
              key={entry.key}
              type="button"
              disabled={isPreparing}
              onClick={() => toggle(entry.key)}
              className={`overflow-hidden rounded-2xl border text-left transition disabled:opacity-50 ${
                included ? "border-brand bg-white" : "border-stone-200 bg-stone-50 opacity-60"
              }`}
            >
              <div className="flex aspect-square items-center justify-center bg-[#f4f0ea] p-2">
                <img src={entry.garment.imageUrl} alt={entry.garment.label} className="h-full w-full object-contain" />
              </div>
              <div className="flex items-start gap-1.5 p-2.5">
                {included ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                ) : (
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-300" />
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-brand">{closetSlotLabel[entry.garment.slot]}</p>
                  <p className="truncate text-xs font-bold text-stone-950">{entry.garment.label}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3.5 py-3">
        <label className="text-xs font-bold text-stone-600" htmlFor="whole-outfit-bulk-quantity">
          품목별 생산 수량
        </label>
        <div className="relative w-32">
          <Input
            id="whole-outfit-bulk-quantity"
            type="number"
            min={1}
            max={100000}
            value={bulkQuantity}
            onChange={(event) => setBulkQuantity(Math.max(1, Number(event.target.value) || 1))}
            className="h-10 rounded-lg pr-8 text-right text-sm font-bold"
          />
          <span className="pointer-events-none absolute right-3 top-2.5 text-xs font-bold text-stone-500">장</span>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] leading-5 text-stone-400">
        모든 품목에 동일하게 적용되며, 견적 페이지에서 품목별로 다시 조절할 수 있어요.
      </p>

      <Button
        type="button"
        className="mt-4 h-11 w-full rounded-full bg-brand text-sm font-bold hover:bg-brand-dark"
        disabled={isPreparing || selectedCount === 0}
        onClick={confirm}
      >
        {isPreparing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            원본 의류 준비 중...
          </>
        ) : (
          `견적 대상 ${selectedCount}개로 견적받기`
        )}
      </Button>
    </>
  );

  const description = (
    <p className="mt-1 text-xs leading-5 text-stone-500">
      현재 마네킹이 착용 중인 의류를 자동으로 감지했어요. 제외하고 싶은 품목은 체크를 해제해주세요.
    </p>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex max-h-[85dvh] flex-col">
          <DrawerHeader className="flex-shrink-0 pb-2 text-left">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DrawerTitle className="text-base">견적 대상 {entries.length}개</DrawerTitle>
                {description}
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="닫기"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[1.75rem] bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-black text-stone-950">견적 대상 {entries.length}개</p>
            {description}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="닫기">
            <X className="h-4 w-4" />
          </Button>
        </div>
        {body}
      </div>
    </div>
  );
};

