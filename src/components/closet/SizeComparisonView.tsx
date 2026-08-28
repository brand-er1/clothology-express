import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { mannequinSizeShortLabel } from "@/lib/mannequin-presets";
import { compareMannequinSizes, type SizeComparisonEntry } from "@/services/virtualFittingCompare";
import type { CharacterGender, ClosetGarment, ClosetSlot } from "@/types/closet";

interface SizeComparisonViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gender: CharacterGender;
  currentSize: string;
  garments: ClosetGarment[];
  changedSlots: ClosetSlot[];
}

const ComparisonBody = ({
  gender,
  currentSize,
  garments,
  changedSlots,
}: Omit<SizeComparisonViewProps, "open" | "onOpenChange">) => {
  const [entries, setEntries] = useState<SizeComparisonEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setEntries(null);
    void compareMannequinSizes(gender, garments, { changedSlots }).then((result) => {
      if (!cancelled) {
        setEntries(result);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender, garments.map((g) => `${g.slot}:${g.id}`).join(",")]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-sm font-bold text-stone-950">
          같은 얼굴·포즈·배경·조명으로 {gender === "female" ? "44·55·66·77" : "L·XL·2XL"} 사이즈를 모두 생성하고 있어요...
        </p>
        <p className="text-xs text-stone-500">의류와 카메라, 조명은 동일하게 유지하고 체형만 비교합니다.</p>
      </div>
    );
  }

  if (!entries) return null;

  return (
    <div>
      <p className="mb-3 text-xs leading-5 text-stone-500">
        동일한 의류·얼굴·포즈·카메라 거리·배경·조명 기준으로 체형별 핏 차이만 비교합니다.
      </p>
      {/* Grid on desktop, horizontal swipe on mobile (scroll-snap). */}
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible">
        {entries.map(({ size, result }) => (
          <div
            key={size}
            className={`w-[72vw] shrink-0 snap-center overflow-hidden rounded-2xl border bg-white sm:w-auto ${
              size === currentSize ? "border-brand ring-2 ring-brand/15" : "border-stone-200"
            }`}
          >
            <div className="flex aspect-[3/4] items-center justify-center bg-[#f4f0ea] p-2">
              {result?.renderedImageUrl ? (
                <img
                  src={result.renderedImageUrl}
                  alt={`${mannequinSizeShortLabel[size as keyof typeof mannequinSizeShortLabel]} 사이즈 피팅`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <p className="px-3 text-center text-xs font-semibold text-stone-400">생성하지 못했어요</p>
              )}
            </div>
            <p className="p-2 text-center text-sm font-black text-stone-950">
              {mannequinSizeShortLabel[size as keyof typeof mannequinSizeShortLabel]}
              {size === currentSize && <span className="ml-1 text-xs font-bold text-brand">현재</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

/** 같은 의류를 성별의 전체 사이즈에 대해 한 번에 생성·비교. 데스크톱은 그리드, 모바일은 가로 스와이프. */
export const SizeComparisonView = ({ open, onOpenChange, gender, currentSize, garments, changedSlots }: SizeComparisonViewProps) => {
  const isMobile = useIsMobile();
  const [instanceKey, setInstanceKey] = useState(0);
  useEffect(() => {
    if (open) setInstanceKey((key) => key + 1);
  }, [open]);

  const body = (
    <ComparisonBody key={instanceKey} gender={gender} currentSize={currentSize} garments={garments} changedSlots={changedSlots} />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex max-h-[92dvh] flex-col">
          <DrawerHeader className="flex-shrink-0 pb-2 text-left">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-base">사이즈별 비교</DrawerTitle>
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
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-[1.75rem] bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-lg font-black text-stone-950">사이즈별 비교</p>
          <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="닫기">
            <X className="h-4 w-4" />
          </Button>
        </div>
        {body}
      </div>
    </div>
  );
};
