import { closetSlotLabel } from "@/lib/closet-character-config";
import type { MyWardrobeGarment } from "@/lib/closet-store";
import { Button } from "@/components/ui/button";
import { Check, RefreshCw } from "lucide-react";
import type { ClosetOutfit } from "@/types/closet";

interface MyWardrobeListProps {
  items: MyWardrobeGarment[];
  outfit: ClosetOutfit;
  onWear: (garment: MyWardrobeGarment) => void;
}

export const MyWardrobeList = ({ items, outfit, onWear }: MyWardrobeListProps) => {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3 rounded-[1.5rem] border border-stone-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-black text-stone-950">👗 내가 만든 옷</p>
        <p className="mt-1 text-xs leading-5 text-stone-500">
          AI로 만들거나 업로드한 옷을 골라 현재 옷과 바로 바꿀 수 있어요.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((garment) => {
          const isWearing = outfit[garment.slot]?.id === garment.id;
          return (
            <div
              key={garment.id}
              className={`overflow-hidden rounded-xl border bg-white transition ${
                isWearing ? "border-brand ring-2 ring-brand/15" : "border-stone-200"
              }`}
            >
              <div className="flex aspect-square items-center justify-center bg-[#f4f0ea] p-2">
                <img
                  src={garment.imageUrl}
                  alt={garment.label}
                  className="h-full w-full object-contain"
                />
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
                  disabled={isWearing}
                >
                  {isWearing ? (
                    <>
                      <Check className="mr-1 h-3.5 w-3.5" /> 착용 중
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-1 h-3.5 w-3.5" /> 이 옷으로 교체
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
