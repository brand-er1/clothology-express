import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailImageView } from "@/components/detail-page/DetailImageView";
import { ImageRegenerateDialog } from "@/components/detail-page/ImageRegenerateDialog";
import { getDetailImageSpec } from "@/lib/detail-page/imagePipeline";
import type { DetailImage, DetailImageJobStatus, DetailImageType, DetailPageDocument } from "@/types/detailPage";

/**
 * Every AI shot on the page, one row per shot type ("HERO 이미지 다시 생성", "FABRIC 이미지 다시
 * 생성"...). Regenerating one never touches the rest of the page; the original design stays the
 * reference so the garment is the same in every shot.
 */
export const AiImagePanel = ({
  document,
  imageStatus,
  busyTypes,
  onRegenerate,
}: {
  document: DetailPageDocument;
  imageStatus: Partial<Record<DetailImageType, DetailImageJobStatus>>;
  busyTypes: DetailImageType[];
  onRegenerate: (type: DetailImageType, instruction: string) => void;
}) => {
  const [target, setTarget] = useState<DetailImageType | null>(null);
  const slots = new Map<DetailImageType, DetailImage>();
  for (const section of document.sections) {
    for (const image of section.images) if (image.slot && !slots.has(image.slot)) slots.set(image.slot, image);
  }
  if (!slots.size) {
    return <p className="py-10 text-center text-sm text-stone-500">이 페이지에는 AI 촬영 컷이 없어요. 섹션 편집에서 이미지를 추가할 수 있어요.</p>;
  }
  return (
    <div>
      <p className="mb-3 text-xs leading-5 text-stone-500">원본 디자인을 기준으로 필요한 컷만 다시 촬영합니다. 제품 디자인·색상·그래픽은 유지돼요.</p>
      <ul className="divide-y divide-stone-200 border-y border-stone-200">
        {Array.from(slots.entries()).map(([type, image]) => {
          const spec = getDetailImageSpec(type);
          const status = imageStatus[type];
          const busy = busyTypes.includes(type) || status === "generating" || status === "pending";
          return (
            <li key={type} className="flex items-center gap-3 py-3">
              <DetailImageView image={image} className="h-16 w-14 shrink-0 bg-stone-100" fit={image.source === "design" ? "contain" : "cover"} padded={false} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{spec.label}</p>
                <p className="truncate text-xs text-stone-500">
                  {image.source === "generated" ? "AI 촬영 완료" : status === "failed" ? "생성 실패 · 원본 디자인 표시 중" : busy ? "제작 중..." : "원본 디자인 표시 중"}
                  {image.ratio ? ` · ${image.ratio}` : ""}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 rounded-md px-3 text-xs" disabled={busy} onClick={() => setTarget(type)}>
                {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
                다시 생성
              </Button>
            </li>
          );
        })}
      </ul>
      <ImageRegenerateDialog
        open={target !== null}
        label={target ? getDetailImageSpec(target).label : undefined}
        onOpenChange={(open) => !open && setTarget(null)}
        onSubmit={(instruction) => target && onRegenerate(target, instruction)}
      />
    </div>
  );
};
