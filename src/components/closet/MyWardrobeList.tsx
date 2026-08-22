import { Pencil } from "lucide-react";
import { closetSlotLabel } from "@/lib/closet-character-config";
import type { MyWardrobeGarment } from "@/lib/closet-store";
import { Button } from "@/components/ui/button";

interface MyWardrobeListProps {
  items: MyWardrobeGarment[];
  onWear: (garment: MyWardrobeGarment) => void;
  onEdit: (garment: MyWardrobeGarment) => void;
  editingId?: string | null;
}

export const MyWardrobeList = ({ items, onWear, onEdit, editingId }: MyWardrobeListProps) => {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-stone-950">👗 내 옷장</p>
        <p className="text-[11px] font-semibold text-stone-400">만든 옷은 수정 후 다시 입힐 수 있어요</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((garment) => (
          <div key={garment.id} className="group relative overflow-hidden rounded-xl border border-stone-200 bg-white">
            <img src={garment.imageUrl} alt={garment.label} className="aspect-square w-full object-cover" />
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/10 to-black/0 p-1.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
              <p className="truncate text-[10px] font-bold text-white">{closetSlotLabel[garment.slot]}</p>
              <div className="mt-1 grid grid-cols-2 gap-1">
                <Button
                  type="button"
                  size="sm"
                  className="h-6 rounded-full bg-white px-1.5 text-[10px] font-bold text-stone-950 hover:bg-stone-100"
                  onClick={() => onWear(garment)}
                  disabled={editingId === garment.id}
                >
                  입히기
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 rounded-full border-white/70 bg-black/20 px-1.5 text-[10px] font-bold text-white hover:bg-black/40 hover:text-white"
                  onClick={() => onEdit(garment)}
                  disabled={editingId === garment.id}
                >
                  <Pencil className="mr-1 h-2.5 w-2.5" />
                  {editingId === garment.id ? "수정 중" : "수정"}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
