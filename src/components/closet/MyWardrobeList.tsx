import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { closetSlotLabel } from "@/lib/closet-character-config";
import { replaceMyWardrobeGarment, type MyWardrobeGarment } from "@/lib/closet-store";
import { modifyClosetGarment } from "@/services/closetDressing";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

interface MyWardrobeListProps {
  items: MyWardrobeGarment[];
  onWear: (garment: MyWardrobeGarment) => void;
}

export const MyWardrobeList = ({ items, onWear }: MyWardrobeListProps) => {
  const [localItems, setLocalItems] = useState(items);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => setLocalItems(items), [items]);

  const handleEdit = async (garment: MyWardrobeGarment) => {
    const instruction = window.prompt(
      "이 옷에서 무엇을 수정할까요?\n예: 후드 색상만 와인색으로 바꿔줘 / 가슴 로고를 더 작게 해줘",
      "",
    );
    if (!instruction?.trim()) return;

    setEditingId(garment.id);
    try {
      const edited = await modifyClosetGarment(garment, instruction);
      if (!edited) return;
      const updated: MyWardrobeGarment = { ...edited, createdAt: garment.createdAt };
      const next = replaceMyWardrobeGarment(updated);
      setLocalItems(next);
      // Immediately wear the edited garment. Parent rebuilds the look from the immutable mascot.
      onWear(updated);
      toast({ title: "옷 수정 완료", description: "수정한 옷으로 바로 다시 입혀보고 있어요." });
    } finally {
      setEditingId(null);
    }
  };

  if (localItems.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-stone-950">👗 내 옷장</p>
        <p className="text-[11px] font-semibold text-stone-400">만든 옷은 수정 후 다시 입힐 수 있어요</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {localItems.map((garment) => (
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
                  onClick={() => void handleEdit(garment)}
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
