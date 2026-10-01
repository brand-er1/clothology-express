import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DetailLibraryImage } from "@/services/detailPage";
import { cn } from "@/lib/utils";

const GROUPS: Array<{ value: DetailLibraryImage["group"] | "all"; label: string }> = [
  { value: "all", label: "전체" },
  { value: "generated", label: "AI 생성" },
  { value: "upload", label: "업로드" },
  { value: "color", label: "컬러별" },
  { value: "design", label: "원본 디자인" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  load: () => Promise<DetailLibraryImage[]>;
  /** 교체 모드면 1장만 고른다. */
  single?: boolean;
  max?: number;
  onPick: (images: DetailLibraryImage[]) => void;
};

/** 이 상세페이지에서 쓸 수 있는 이미지(AI 생성 · 업로드 · 컬러별 · 원본)를 골라 섹션에 넣는다. */
export const DetailImageLibraryDialog = ({ open, onOpenChange, load, single = false, max = 6, onPick }: Props) => {
  const [images, setImages] = useState<DetailLibraryImage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<(typeof GROUPS)[number]["value"]>("all");
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setImages(null);
    setError(null);
    setPicked([]);
    load()
      .then((list) => !cancelled && setImages(list))
      .catch(() => !cancelled && setError("이미지 목록을 불러오지 못했어요."));
    return () => {
      cancelled = true;
    };
  }, [open, load]);

  const visible = (images ?? []).filter((image) => group === "all" || image.group === group);
  const limit = single ? 1 : max;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col rounded-md p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>{single ? "이미지 교체" : "이미지 불러오기"}</DialogTitle>
          <DialogDescription>AI로 생성한 이미지, 업로드한 이미지, 컬러별 상품 이미지를 불러올 수 있어요.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1.5 overflow-x-auto px-5 pb-1" role="tablist">
          {GROUPS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              role="tab"
              aria-selected={group === entry.value}
              onClick={() => setGroup(entry.value)}
              className={cn(
                "h-8 shrink-0 border px-3 text-xs font-semibold",
                group === entry.value ? "border-brand bg-brand text-white" : "border-stone-300 text-stone-600",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <div className="min-h-[200px] flex-1 overflow-y-auto px-5 py-3">
          {error ? (
            <p className="py-10 text-center text-sm text-red-600">{error}</p>
          ) : images === null ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-brand" /></div>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-stone-500">불러올 이미지가 없어요.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {visible.map((image) => {
                const order = picked.indexOf(image.key);
                return (
                  <li key={image.key}>
                    <button
                      type="button"
                      aria-pressed={order >= 0}
                      aria-label={image.label}
                      onClick={() =>
                        setPicked((current) =>
                          current.includes(image.key)
                            ? current.filter((key) => key !== image.key)
                            : single
                              ? [image.key]
                              : current.length >= limit
                                ? current
                                : [...current, image.key],
                        )
                      }
                      className={cn("relative block w-full border-2 text-left", order >= 0 ? "border-brand" : "border-transparent")}
                    >
                      <img src={image.url} alt="" className="aspect-square w-full bg-stone-100 object-cover" loading="lazy" />
                      {order >= 0 && (
                        <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
                          {single ? <Check className="h-3.5 w-3.5" /> : order + 1}
                        </span>
                      )}
                      <span className="block truncate px-1 py-1 text-[11px] text-stone-600">{image.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter className="gap-2 border-t border-stone-200 px-5 py-3 sm:gap-0">
          <Button type="button" variant="outline" className="h-11 rounded-md" onClick={() => onOpenChange(false)}>취소</Button>
          <Button
            type="button"
            className="h-11 rounded-md bg-brand hover:bg-brand-dark"
            disabled={picked.length === 0}
            onClick={() => {
              const byKey = new Map((images ?? []).map((image) => [image.key, image]));
              onPick(picked.map((key) => byKey.get(key)!).filter(Boolean));
              onOpenChange(false);
            }}
          >
            {single ? "이 이미지로 교체" : `${picked.length}장 넣기`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
