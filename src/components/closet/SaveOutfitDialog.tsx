import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { closetSlotLabel, closetSlotOrder } from "@/lib/closet-character-config";
import { mannequinSizeShortLabel } from "@/lib/mannequin-presets";
import { buildOutfitItemsPayload, getOutfitErrorMessage, saveOutfit } from "@/services/outfits";
import type { CharacterGender, ClosetOutfit, MannequinSize } from "@/types/closet";

interface SaveOutfitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outfit: ClosetOutfit;
  character: CharacterGender;
  mannequinSize: MannequinSize;
  renderedCharacterImage: string | null;
  defaultTitle: string;
  /** Whether the public toggle starts on — lets "코디 저장" (off) and "코디 올리기" (on) share one dialog. */
  initialPublic?: boolean;
}

const parseTags = (raw: string) =>
  Array.from(
    new Set(
      raw
        .split(/[\s,#]+/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ).slice(0, 8);

const SaveOutfitBody = ({
  outfit,
  character,
  mannequinSize,
  renderedCharacterImage,
  defaultTitle,
  initialPublic,
  onClose,
}: {
  outfit: ClosetOutfit;
  character: CharacterGender;
  mannequinSize: MannequinSize;
  renderedCharacterImage: string | null;
  defaultTitle: string;
  initialPublic: boolean;
  onClose: () => void;
}) => {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [isSaving, setIsSaving] = useState(false);
  const [savedResult, setSavedResult] = useState<{ id: string; isPublic: boolean } | null>(null);

  const items = buildOutfitItemsPayload(outfit);
  const wornSlots = closetSlotOrder.filter((slot) => outfit[slot]);

  const handleSave = async () => {
    if (!renderedCharacterImage) {
      toast({ title: "완성된 코디 이미지가 없어요", variant: "destructive" });
      return;
    }
    if (!title.trim()) {
      toast({ title: "코디 제목을 입력해주세요", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const id = await saveOutfit({
        title: title.trim(),
        description: description.trim(),
        imageUrl: renderedCharacterImage,
        imagePath: null,
        characterGender: character,
        mannequinSize,
        isPublic,
        items,
        tags: parseTags(tagsInput),
      });
      setSavedResult({ id, isPublic });
      toast({
        title: isPublic ? "코디를 올렸어요!" : "코디를 저장했어요",
        description: isPublic ? "코디 피드에 바로 표시돼요." : "마이페이지 > 내 코디에서 볼 수 있어요.",
      });
    } catch (error) {
      toast({
        title: "코디를 저장하지 못했어요",
        description: getOutfitErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (savedResult) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Sparkles className="h-6 w-6" />
        </span>
        <div>
          <p className="text-lg font-black text-stone-950">
            {savedResult.isPublic ? "코디가 피드에 올라갔어요!" : "코디를 저장했어요!"}
          </p>
          <p className="mt-1 text-sm text-stone-500">
            {savedResult.isPublic
              ? "다른 사용자들이 좋아요를 누를 수 있어요."
              : "마이페이지에서 언제든 다시 공개로 전환할 수 있어요."}
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2">
          <Button asChild variant="outline" className="h-11 rounded-full border-stone-300 font-bold">
            <Link to="/my-outfits" onClick={onClose}>내 코디 보기</Link>
          </Button>
          {savedResult.isPublic ? (
            <Button asChild className="h-11 rounded-full bg-brand font-bold hover:bg-brand-dark">
              <Link to={`/outfits/${savedResult.id}`} onClick={onClose}>피드에서 보기</Link>
            </Button>
          ) : (
            <Button className="h-11 rounded-full bg-brand font-bold hover:bg-brand-dark" onClick={onClose}>
              계속하기
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 pb-2">
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-[#f4f0ea] p-3">
          {renderedCharacterImage ? (
            <img
              src={renderedCharacterImage}
              alt="완성된 코디"
              className="h-full w-full object-contain"
            />
          ) : (
            <p className="text-sm text-stone-400">코디를 먼저 완성해주세요</p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-brand/10 px-3 py-1 text-[11px] font-bold text-brand">
            {mannequinSizeShortLabel[mannequinSize]} 사이즈
          </span>
          {wornSlots.map((slot) => (
            <span
              key={slot}
              className="rounded-full bg-[#f4f0ea] px-3 py-1 text-[11px] font-bold text-stone-600"
            >
              {closetSlotLabel[slot]} · {outfit[slot]?.label}
            </span>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="outfit-title" className="text-xs font-bold text-stone-500">코디 제목</Label>
          <Input
            id="outfit-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="예: 오늘의 스트릿 코디"
            maxLength={80}
            className="h-11 rounded-2xl border-stone-200 bg-white text-base"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="outfit-description" className="text-xs font-bold text-stone-500">한 줄 설명</Label>
          <Textarea
            id="outfit-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="예: 오버핏 후드와 레이어드 스커트를 활용한 코디"
            maxLength={300}
            className="min-h-[64px] resize-none rounded-2xl border-stone-200 bg-white text-base"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="outfit-tags" className="text-xs font-bold text-stone-500">태그</Label>
          <Input
            id="outfit-tags"
            value={tagsInput}
            onChange={(event) => setTagsInput(event.target.value)}
            placeholder="예: #스트릿 #후드 #레이어드"
            className="h-11 rounded-2xl border-stone-200 bg-white text-base"
          />
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3">
          <div>
            <p className="text-sm font-black text-stone-950">코디 피드에 공개</p>
            <p className="mt-0.5 text-xs text-stone-500">
              {isPublic ? "다른 사용자들이 이 코디를 볼 수 있어요." : "나만 볼 수 있는 비공개 코디예요."}
            </p>
          </div>
          <Switch checked={isPublic} onCheckedChange={setIsPublic} />
        </div>
      </div>

      <div
        className="mt-3 shrink-0 border-t border-stone-100 pt-3"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <Button
          type="button"
          className="h-12 w-full rounded-full bg-brand text-base font-bold hover:bg-brand-dark"
          onClick={() => void handleSave()}
          disabled={isSaving || !renderedCharacterImage}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              저장하는 중...
            </>
          ) : isPublic ? (
            "✨ 코디 올리기"
          ) : (
            "코디 저장하기"
          )}
        </Button>
      </div>
    </div>
  );
};

export const SaveOutfitDialog = ({
  open,
  onOpenChange,
  outfit,
  character,
  mannequinSize,
  renderedCharacterImage,
  defaultTitle,
  initialPublic = false,
}: SaveOutfitDialogProps) => {
  const isMobile = useIsMobile();
  // Reset transient body state (title/description/saved-result) each time the sheet reopens.
  const [instanceKey, setInstanceKey] = useState(0);
  useEffect(() => {
    if (open) setInstanceKey((key) => key + 1);
  }, [open]);

  const body = (
    <SaveOutfitBody
      key={instanceKey}
      outfit={outfit}
      character={character}
      mannequinSize={mannequinSize}
      renderedCharacterImage={renderedCharacterImage}
      defaultTitle={defaultTitle}
      initialPublic={initialPublic}
      onClose={() => onOpenChange(false)}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex max-h-[92dvh] flex-col">
          <DrawerHeader className="flex-shrink-0 pb-2 text-left">
            <div className="flex items-center justify-between">
              <DrawerTitle className="flex items-center gap-1.5 text-base">
                <Sparkles className="h-4 w-4 text-brand" />코디 저장하기
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
          <div className="min-h-0 flex-1 px-4 pb-4">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-hidden rounded-[1.5rem] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-brand" />코디 저장하기
          </DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[70vh] flex-col">{body}</div>
      </DialogContent>
    </Dialog>
  );
};
