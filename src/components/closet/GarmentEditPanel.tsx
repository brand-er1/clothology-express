import { useEffect, useState } from "react";
import { Loader2, Sparkles, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { closetSlotLabel } from "@/lib/closet-character-config";
import { withNewGarmentRevision } from "@/lib/closet-store";
import { editGarment } from "@/services/closetGarmentEdit";
import { saveDesign } from "@/services/designs";
import { RevisionHistory } from "@/components/closet/RevisionHistory";
import type { ClosetGarment } from "@/types/closet";

const suggestionChips = [
  "색상을 검정으로",
  "로고를 작게",
  "소매를 길게",
  "크롭 기장으로",
  "오버핏으로",
  "포켓 추가",
];

interface PendingEdit {
  imageUrl: string;
  imagePath: string | null;
  promptLabel: string;
}

interface GarmentEditPanelProps {
  garment: ClosetGarment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (updatedGarment: ClosetGarment) => void;
  onRestoreRevision: (garment: ClosetGarment, revisionId: string) => void;
}

const GarmentEditBody = ({
  garment,
  onApply,
  onRestoreRevision,
  onClose,
}: {
  garment: ClosetGarment;
  onApply: (updatedGarment: ClosetGarment) => void;
  onRestoreRevision: (garment: ClosetGarment, revisionId: string) => void;
  onClose: () => void;
}) => {
  const [prompt, setPrompt] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [pending, setPending] = useState<PendingEdit | null>(null);
  const [compareView, setCompareView] = useState<"before" | "after">("after");

  // Switching to a different garment (or a revision-restore on this one) drops any in-progress
  // preview — it was generated from the previous base image and no longer applies.
  useEffect(() => {
    setPending(null);
    setPrompt("");
    setCompareView("after");
  }, [garment.id, garment.activeRevisionId]);

  const handleGenerate = async () => {
    if (isEditing) return;
    if (!prompt.trim()) {
      toast({ title: "어떻게 수정할지 알려주세요", variant: "destructive" });
      return;
    }
    setIsEditing(true);
    setCompareView("after");
    try {
      const result = await editGarment(garment, prompt.trim());
      if (!result) return;
      setPending({
        imageUrl: result.editedImageUrl,
        imagePath: result.editedImagePath,
        promptLabel: prompt.trim(),
      });
    } finally {
      setIsEditing(false);
    }
  };

  const handleApply = () => {
    if (!pending) return;
    const updated = withNewGarmentRevision(garment, {
      imageUrl: pending.imageUrl,
      promptLabel: pending.promptLabel,
      designRef: {
        ...garment.designRef,
        imageUrl: pending.imageUrl,
        imagePath: pending.imagePath,
        imageBase64: null,
        imageMimeType: null,
      },
    });
    onApply(updated);
    setPending(null);
    setPrompt("");
    onClose();

    // Keep the SAME design_id pointing at the current image — "생성 → 수정" must stay one design,
    // never look like a new one to the rest of the flow (자동견적/코디). Best-effort: the edit is
    // already applied locally either way.
    const designId = garment.designRef?.designId;
    if (designId) {
      void saveDesign({
        designId,
        frontImageUrl: pending.imageUrl,
        imagePath: pending.imagePath,
        detail: pending.promptLabel,
      }).catch((error) => console.error("Failed to update design record after garment edit:", error));
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f4f0ea]">
            <img src={garment.imageUrl} alt={garment.label} className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-brand">{closetSlotLabel[garment.slot]}</p>
            <p className="truncate text-sm font-black text-stone-950">{garment.label}</p>
          </div>
        </div>

        <RevisionHistory garment={garment} onRestore={(id) => onRestoreRevision(garment, id)} />

        {pending ? (
          <div className="space-y-3">
            <p className="text-xs font-bold text-stone-500">수정 전 · 수정 후 비교</p>
            <div className="hidden grid-cols-2 gap-3 sm:grid">
              <div>
                <p className="mb-1 text-center text-[11px] font-bold text-stone-400">수정 전</p>
                <div className="flex aspect-square items-center justify-center rounded-2xl bg-[#f4f0ea] p-2">
                  <img src={garment.imageUrl} alt="수정 전" className="h-full w-full object-contain" />
                </div>
              </div>
              <div>
                <p className="mb-1 text-center text-[11px] font-bold text-brand">수정 후</p>
                <div className="flex aspect-square items-center justify-center rounded-2xl border-2 border-brand/30 bg-[#f4f0ea] p-2">
                  <img src={pending.imageUrl} alt="수정 후" className="h-full w-full object-contain" />
                </div>
              </div>
            </div>
            <div className="sm:hidden">
              <div className="mb-2 inline-flex w-full rounded-full border border-stone-200 bg-white p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setCompareView("before")}
                  className={`flex-1 rounded-full py-1.5 font-bold transition ${
                    compareView === "before" ? "bg-stone-900 text-white" : "text-stone-500"
                  }`}
                >
                  수정 전
                </button>
                <button
                  type="button"
                  onClick={() => setCompareView("after")}
                  className={`flex-1 rounded-full py-1.5 font-bold transition ${
                    compareView === "after" ? "bg-brand text-white" : "text-stone-500"
                  }`}
                >
                  수정 후
                </button>
              </div>
              <div className="flex aspect-square items-center justify-center rounded-2xl bg-[#f4f0ea] p-2">
                <img
                  src={compareView === "before" ? garment.imageUrl : pending.imageUrl}
                  alt={compareView === "before" ? "수정 전" : "수정 후"}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full border-stone-300 text-sm font-bold"
                onClick={() => setPending(null)}
              >
                이전 버전 유지
              </Button>
              <Button
                type="button"
                className="h-11 rounded-full bg-brand text-sm font-bold hover:bg-brand-dark"
                onClick={handleApply}
              >
                이 옷으로 입히기
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-[#f4f0ea] p-3">
              <img src={garment.imageUrl} alt={garment.label} className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestionChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setPrompt(chip)}
                  className="rounded-full bg-[#f4f0ea] px-3 py-1.5 text-xs font-bold text-stone-600 transition hover:bg-brand/10 hover:text-brand"
                >
                  {chip}
                </button>
              ))}
            </div>
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="어떻게 수정할까요?"
              className="min-h-[76px] resize-none rounded-2xl border-stone-200 bg-white text-base"
            />
            {isEditing && (
              <p className="flex items-center gap-1.5 text-xs font-bold text-brand">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                요청하신 부분만 수정하고 있어요...
              </p>
            )}
          </div>
        )}
      </div>

      {!pending && (
        <div
          className="mt-4 shrink-0 border-t border-stone-100 pt-3"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <Button
            type="button"
            className="h-12 w-full rounded-full bg-brand text-base font-bold hover:bg-brand-dark"
            onClick={() => void handleGenerate()}
            disabled={isEditing}
          >
            {isEditing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                수정하는 중...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                AI로 수정하기
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

/** "수정하기" — inline panel on desktop, Bottom Sheet on mobile. Same underlying edit logic either way. */
export const GarmentEditPanel = ({
  garment,
  open,
  onOpenChange,
  onApply,
  onRestoreRevision,
}: GarmentEditPanelProps) => {
  const isMobile = useIsMobile();
  // Keep rendering the last known garment while the sheet/panel is closing so the exit
  // animation doesn't flash empty content — `open` alone controls visibility.
  const [displayGarment, setDisplayGarment] = useState<ClosetGarment | null>(garment);
  useEffect(() => {
    if (garment) setDisplayGarment(garment);
  }, [garment]);

  if (!displayGarment) return null;
  const garmentToShow = displayGarment;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex max-h-[92dvh] flex-col">
          <DrawerHeader className="flex-shrink-0 pb-2 text-left">
            <div className="flex items-center justify-between">
              <DrawerTitle className="flex items-center gap-1.5 text-base">
                <Sparkles className="h-4 w-4 text-brand" />이 옷 수정하기
              </DrawerTitle>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="닫기"
                className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </DrawerHeader>
          <div className="min-h-0 flex-1 px-4 pb-4">
            <GarmentEditBody
              garment={garmentToShow}
              onApply={onApply}
              onRestoreRevision={onRestoreRevision}
              onClose={() => onOpenChange(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  if (!open) return null;

  return (
    <div className="rounded-[1.5rem] border border-brand/20 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-black text-stone-950">
          <Sparkles className="h-4 w-4 text-brand" />이 옷 수정하기
        </p>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="닫기"
          className="flex h-7 w-7 items-center justify-center rounded-full text-stone-400 hover:text-stone-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <GarmentEditBody
        garment={garmentToShow}
        onApply={onApply}
        onRestoreRevision={onRestoreRevision}
        onClose={() => onOpenChange(false)}
      />
    </div>
  );
};
