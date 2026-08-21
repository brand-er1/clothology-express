import { closetSlotLabel } from "@/lib/closet-character-config";
import type { MyWardrobeGarment } from "@/lib/closet-store";
import { Button } from "@/components/ui/button";

interface MyWardrobeListProps {
  items: MyWardrobeGarment[];
  onWear: (garment: MyWardrobeGarment) => void;
}

export const MyWardrobeList = ({ items, onWear }: MyWardrobeListProps) => {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-black text-stone-950">👗 내 옷장</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((garment) => (
          <div
            key={garment.id}
            className="group relative overflow-hidden rounded-xl border border-stone-200 bg-white"
          >
            <img
              src={garment.imageUrl}
              alt={garment.label}
              className="aspect-square w-full object-cover"
            />
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/0 to-black/0 p-1.5 opacity-0 transition group-hover:opacity-100">
              <p className="truncate text-[10px] font-bold text-white">
                {closetSlotLabel[garment.slot]}
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-1 h-6 rounded-full bg-white px-2 text-[10px] font-bold text-stone-950 hover:bg-stone-100"
                onClick={() => onWear(garment)}
              >
                입혀보기
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
