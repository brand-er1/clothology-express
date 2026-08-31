import { useRef, useState } from "react";
import { Check, ChevronDown, ImagePlus, RefreshCw, Settings2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { closetSlotLabel, closetSlotOrder } from "@/lib/closet-character-config";
import { GarmentFitInfoForm } from "@/components/closet/GarmentFitInfoForm";
import { MultiAngleViewer } from "@/components/visualization/MultiAngleViewer";
import type { ClosetGarment, ClosetOutfit, ClosetSlot, GarmentFitInfo } from "@/types/closet";
import type { MyWardrobeGarment } from "@/lib/closet-store";
import { toast } from "@/components/ui/use-toast";

interface WardrobeSlotPickerProps {
  outfit: ClosetOutfit;
  wardrobe: MyWardrobeGarment[];
  onEquip: (slot: ClosetSlot, garment: ClosetGarment) => void;
  onRemove: (slot: ClosetSlot) => void;
  onUpdateFitInfo: (slot: ClosetSlot, fitInfo: GarmentFitInfo) => void;
}

const emptyFitInfo = (): GarmentFitInfo => ({ fitType: "regular", hasMeasurements: false });

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

export const WardrobeSlotPicker = ({
  outfit,
  wardrobe,
  onEquip,
  onRemove,
  onUpdateFitInfo,
}: WardrobeSlotPickerProps) => {
  const fileInputRefs = useRef<Partial<Record<ClosetSlot, HTMLInputElement | null>>>({});
  const [openSlot, setOpenSlot] = useState<ClosetSlot | null>(null);
  const [fitInfoSlot, setFitInfoSlot] = useState<ClosetSlot | null>(null);

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
      setOpenSlot(null);
    } catch (error) {
      toast({
        title: "업로드 실패",
        description: error instanceof Error ? error.message : "다시 시도해주세요.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="grid gap-3">
      {closetSlotOrder.map((slot) => {
        const garment = outfit[slot];
        const savedOptions = wardrobe.filter((item) => item.slot === slot);
        const isOpen = openSlot === slot;
        return (
          <div
            key={slot}
            className={`overflow-hidden rounded-2xl border bg-white transition ${
              isOpen ? "border-brand/40 ring-2 ring-brand/10" : "border-stone-200"
            }`}
          >
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
            <div className="flex items-center gap-3 p-3">
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full border-stone-300 px-3 text-xs font-bold text-stone-700"
                  onClick={() => setOpenSlot(isOpen ? null : slot)}
                  aria-expanded={isOpen}
                >
                  {garment ? <RefreshCw className="mr-1 h-3.5 w-3.5" /> : <ImagePlus className="mr-1 h-3.5 w-3.5" />}
                  {garment ? "변경" : "선택"}
                  <ChevronDown className={`ml-1 h-3.5 w-3.5 transition ${isOpen ? "rotate-180" : ""}`} />
                </Button>
                {garment && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={`h-9 w-9 border-stone-300 ${fitInfoSlot === slot ? "border-brand text-brand" : "text-stone-500"}`}
                    onClick={() => setFitInfoSlot(fitInfoSlot === slot ? null : slot)}
                    aria-label={`${closetSlotLabel[slot]} 핏 정보 입력`}
                    aria-expanded={fitInfoSlot === slot}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                )}
                {garment && (
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
                )}
              </div>
            </div>
            {garment && fitInfoSlot === slot && (
              <div className="border-t border-stone-100 p-3">
                <GarmentFitInfoForm
                  slot={slot}
                  fitInfo={garment.fitInfo || emptyFitInfo()}
                  onChange={(fitInfo) => onUpdateFitInfo(slot, fitInfo)}
                />
              </div>
            )}
            {isOpen && (
              <div className="border-t border-stone-100 bg-[#faf8f5] p-3">
                <p className="text-xs font-bold text-stone-700">
                  {savedOptions.length > 0
                    ? `저장된 ${closetSlotLabel[slot]}에서 선택`
                    : `저장된 ${closetSlotLabel[slot]}가 아직 없어요`}
                </p>
                {savedOptions.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {savedOptions.map((option) => {
                      const isWearing = garment?.id === option.id;
                      return (
                        <div
                          key={option.id}
                          role="button"
                          tabIndex={isWearing ? -1 : 0}
                          className={`relative overflow-hidden rounded-xl border bg-white p-1.5 text-left transition ${
                            isWearing
                              ? "border-brand ring-2 ring-brand/15"
                              : "cursor-pointer border-stone-200 hover:border-brand/50"
                          }`}
                          onClick={() => {
                            if (isWearing) return;
                            onEquip(slot, option);
                            setOpenSlot(null);
                          }}
                          onKeyDown={(event) => {
                            if (isWearing) return;
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onEquip(slot, option);
                              setOpenSlot(null);
                            }
                          }}
                          aria-label={`${option.label}${isWearing ? ", 착용 중" : ", 이 옷으로 교체"}`}
                        >
                          <div className="relative flex aspect-square items-center justify-center rounded-lg bg-[#f4f0ea] p-1">
                            <img
                              src={option.imageUrl}
                              alt=""
                              className="h-full w-full object-contain"
                            />
                            <div className="absolute bottom-1 left-1" onClick={(event) => event.stopPropagation()}>
                              <MultiAngleViewer
                                sourceImageUrl={option.imageUrl}
                                mode="garment"
                                triggerLabel="360°"
                                className="h-6 gap-1 rounded-full px-1.5 text-[9px]"
                              />
                            </div>
                          </div>
                          <p className="mt-1 truncate text-[10px] font-bold text-stone-700">
                            {option.label}
                          </p>
                          {isWearing && (
                            <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 h-9 w-full rounded-full border-dashed border-stone-300 bg-white text-xs font-bold text-stone-700"
                  onClick={() => fileInputRefs.current[slot]?.click()}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  다른 의류 이미지 업로드
                </Button>
                <p className="mt-2 text-center text-[10px] leading-4 text-stone-400">
                  같은 부위의 옷은 겹치지 않고 선택한 옷으로 교체됩니다.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
