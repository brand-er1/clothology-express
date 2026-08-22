import { Bookmark, Check, Loader2, RefreshCw, Sparkles, Trash2, Wand2 } from "lucide-react";
import { closetSlotLabel } from "@/lib/closet-character-config";
import type { MyWardrobeGarment } from "@/lib/closet-store";
import { Button } from "@/components/ui/button";
import type { ClosetOutfit } from "@/types/closet";

interface MyWardrobeListProps {
  items: MyWardrobeGarment[];
  outfit: ClosetOutfit;
  /** Garment id currently running an async action (regenerate/save/delete) — disables its buttons. */
  busyGarmentId?: string | null;
  onWear: (garment: MyWardrobeGarment) => void;
  onEdit: (garment: MyWardrobeGarment) => void;
  onRegenerate: (garment: MyWardrobeGarment) => void;
  onSave: (garment: MyWardrobeGarment) => void;
  onDelete: (garment: MyWardrobeGarment) => void;
}

export const MyWardrobeList = ({
  items,
  outfit,
  busyGarmentId,
  onWear,
  onEdit,
  onRegenerate,
  onSave,
  onDelete,
}: MyWardrobeListProps) => {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3 rounded-[1.5rem] border border-stone-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-black text-stone-950">👗 내가 만든 옷</p>
        <p className="mt-1 text-xs leading-5 text-stone-500">
          AI로 만들거나 업로드한 옷을 골라 입혀보고, 마음에 안 드는 부분만 수정해보세요.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((garment) => {
          const isWearing = outfit[garment.slot]?.id === garment.id;
          const isBusy = busyGarmentId === garment.id;
          const canRegenerate = garment.source === "ai_design";
          return (
            <div
              key={garment.id}
              className={`overflow-hidden rounded-xl border bg-white transition ${
                isWearing ? "border-brand ring-2 ring-brand/15" : "border-stone-200"
              }`}
            >
              <div className="relative flex aspect-square items-center justify-center bg-[#f4f0ea] p-2">
                <img
                  src={garment.imageUrl}
                  alt={garment.label}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain"
                />
                {(garment.revisions?.length ?? 0) > 1 && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-stone-950/80 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    수정 {(garment.revisions?.length ?? 1) - 1}회
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onSave(garment)}
                  disabled={isBusy}
                  aria-label="옷장에 저장"
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-stone-500 shadow-sm transition hover:text-brand disabled:opacity-50"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-2 p-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-brand">
                    {closetSlotLabel[garment.slot]}
                  </p>
                  <p className="truncate text-xs font-bold text-stone-950">{garment.label}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={isWearing ? "outline" : "default"}
                  className={`h-8 w-full rounded-full px-2 text-[11px] font-bold ${
                    isWearing
                      ? "border-brand/30 text-brand"
                      : "bg-stone-950 text-white hover:bg-stone-800"
                  }`}
                  onClick={() => onWear(garment)}
                  disabled={isWearing || isBusy}
                >
                  {isWearing ? (
                    <>
                      <Check className="mr-1 h-3.5 w-3.5" /> 착용 중
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-1 h-3.5 w-3.5" /> 입혀보기
                    </>
                  )}
                </Button>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-full border-stone-300 px-1 text-[10px] font-bold text-stone-700"
                    onClick={() => onEdit(garment)}
                    disabled={isBusy}
                  >
                    <Wand2 className="mr-1 h-3 w-3" /> 수정하기
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-full border-stone-300 px-1 text-[10px] font-bold text-stone-700 disabled:opacity-40"
                    onClick={() => onRegenerate(garment)}
                    disabled={isBusy || !canRegenerate}
                    title={canRegenerate ? undefined : "업로드한 이미지는 다시 생성할 수 없어요"}
                  >
                    {isBusy ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-3 w-3" />
                    )}
                    다시 생성
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(garment)}
                  disabled={isBusy}
                  className="flex h-6 w-full items-center justify-center gap-1 rounded-full text-[10px] font-bold text-stone-400 transition hover:text-rose-600 disabled:opacity-40"
                >
                  <Trash2 className="h-3 w-3" /> 삭제
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
