import { useRef } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { closetSlotLabel, closetSlotOrder } from "@/lib/closet-character-config";
import type { ClosetGarment, ClosetOutfit, ClosetSlot } from "@/types/closet";
import { toast } from "@/components/ui/use-toast";

interface WardrobeSlotPickerProps {
  outfit: ClosetOutfit;
  onEquip: (slot: ClosetSlot, garment: ClosetGarment) => void;
  onRemove: (slot: ClosetSlot) => void;
}

const readFileAsDataUrl = (file: File) =>
  new Promise<{ base64: string; mimeType: string; dataUrl: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      resolve({ base64: dataUrl.split(",")[1] || "", mimeType: file.type, dataUrl });
    };
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });

export const WardrobeSlotPicker = ({ outfit, onEquip, onRemove }: WardrobeSlotPickerProps) => {
  const fileInputRefs = useRef<Partial<Record<ClosetSlot, HTMLInputElement | null>>>({});

  const handleUpload = async (slot: ClosetSlot, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "이미지 파일 필요", description: "PNG, JPG, WEBP 이미지를 선택해주세요.", variant: "destructive" });
      return;
    }
    try {
      const { base64, mimeType, dataUrl } = await readFileAsDataUrl(file);
      onEquip(slot, {
        id: `upload-${slot}-${Date.now()}`,
        slot,
        label: `내가 업로드한 ${closetSlotLabel[slot]}`,
        imageUrl: dataUrl,
        source: "upload",
        designRef: { imageBase64: base64, imageMimeType: mimeType },
      });
    } catch (error) {
      toast({
        title: "업로드 실패",
        description: error instanceof Error ? error.message : "다시 시도해주세요.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {closetSlotOrder.map((slot) => {
        const garment = outfit[slot];
        return (
          <div
            key={slot}
            className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f4f0ea]">
              {garment ? (
                <img src={garment.imageUrl} alt={garment.label} className="h-full w-full object-contain" />
              ) : (
                <span className="text-[10px] font-bold text-stone-400">없음</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-stone-500">{closetSlotLabel[slot]}</p>
              <p className="truncate text-sm font-bold text-stone-950">
                {garment ? garment.label : "아직 선택하지 않았어요"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {garment ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-stone-400 hover:text-rose-600"
                  onClick={() => onRemove(slot)}
                  aria-label={`${closetSlotLabel[slot]} 벗기기`}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button
                    asChild
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-brand hover:bg-brand/10"
                    title="AI로 만들기"
                  >
                    <Link to="/customize">
                      <Sparkles className="h-4 w-4" />
                    </Link>
                  </Button>
                  <input
                    ref={(element) => {
                      fileInputRefs.current[slot] = element;
                    }}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                      void handleUpload(slot, event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-stone-400 hover:text-brand"
                    title="직접 업로드"
                    onClick={() => fileInputRefs.current[slot]?.click()}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
