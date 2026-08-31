import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { closetSlotLabel } from "@/lib/closet-character-config";
import { MultiAngleViewer } from "@/components/visualization/MultiAngleViewer";
import type { ClosetGarment } from "@/types/closet";

interface QuoteGarmentPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  garments: ClosetGarment[];
  onSelect: (garment: ClosetGarment) => void;
  isPreparing: boolean;
}

/**
 * "견적을 확인할 의류를 선택해주세요" — shown only when the mannequin is wearing more than one
 * original design garment at once. Autofit never merges different garments into a single product
 * for analysis, so the visitor always picks exactly one slot before the estimate page opens.
 */
export const QuoteGarmentPicker = ({ open, onOpenChange, garments, onSelect, isPreparing }: QuoteGarmentPickerProps) => {
  const isMobile = useIsMobile();

  const body = (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {garments.map((garment) => (
        <div
          key={`${garment.slot}-${garment.id}`}
          role="button"
          tabIndex={isPreparing ? -1 : 0}
          onClick={() => {
            if (isPreparing) return;
            onSelect(garment);
          }}
          onKeyDown={(event) => {
            if (isPreparing) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelect(garment);
            }
          }}
          aria-label={`${garment.label} 선택`}
          className={`overflow-hidden rounded-2xl border border-stone-200 bg-white text-left transition hover:border-brand/50 ${
            isPreparing ? "opacity-50" : "cursor-pointer"
          }`}
        >
          <div className="relative flex aspect-square items-center justify-center bg-[#f4f0ea] p-2">
            <img src={garment.imageUrl} alt={garment.label} className="h-full w-full object-contain" />
            <div className="absolute bottom-1.5 left-1.5" onClick={(event) => event.stopPropagation()}>
              <MultiAngleViewer
                sourceImageUrl={garment.imageUrl}
                mode="garment"
                triggerLabel="360°"
                className="h-6 gap-1 rounded-full px-1.5 text-[9px]"
              />
            </div>
          </div>
          <div className="p-2.5">
            <p className="text-[11px] font-bold text-brand">{closetSlotLabel[garment.slot]}</p>
            <p className="truncate text-xs font-bold text-stone-950">{garment.label}</p>
          </div>
        </div>
      ))}
    </div>
  );

  const description = (
    <p className="mt-1 text-xs leading-5 text-stone-500">
      선택하지 않은 옷은 마네킹에 그대로 남지만, 이번 자동견적 분석에는 포함되지 않아요.
    </p>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex max-h-[85dvh] flex-col">
          <DrawerHeader className="flex-shrink-0 pb-2 text-left">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DrawerTitle className="text-base">견적을 확인할 의류를 선택해주세요</DrawerTitle>
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
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {isPreparing && (
              <div className="mb-3 flex items-center gap-2 text-xs font-bold text-brand">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                원본 의류 이미지를 준비하고 있어요...
              </div>
            )}
            {body}
          </div>
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
            <p className="text-base font-black text-stone-950">견적을 확인할 의류를 선택해주세요</p>
            {description}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="닫기">
            <X className="h-4 w-4" />
          </Button>
        </div>
        {isPreparing && (
          <div className="mb-3 flex items-center gap-2 text-xs font-bold text-brand">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            원본 의류 이미지를 준비하고 있어요...
          </div>
        )}
        {body}
      </div>
    </div>
  );
};
