import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Image as ImageIcon, LayoutTemplate, Loader2, PaintBucket, Pencil, Sparkles, Trash2, Wand2 } from "lucide-react";
import { EDITORIAL_VARIANTS } from "@/lib/detail-page/artDirection";
import { cn } from "@/lib/utils";
import type { DetailSection } from "@/types/detailPage";

const ToolButton = ({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "flex h-9 w-9 shrink-0 items-center justify-center text-white/85 transition hover:bg-white/15 hover:text-white disabled:opacity-30",
      danger && "hover:bg-red-500/80",
    )}
  >
    {children}
  </button>
);

export type SectionToolbarActions = {
  onEdit: () => void;
  onMove: (delta: -1 | 1) => void;
  onCycleLayout: () => void;
  onCycleBackground: () => void;
  onChangeImage: () => void;
  onRegenerateImage: () => void;
  onRewrite: () => void;
  onRemove: () => void;
};

/**
 * Floating actions for one preview section: 수정 · 순서 변경 · 레이아웃 변경 · 배경 변경 ·
 * 이미지 변경 · AI 이미지 재생성 · 텍스트 AI 다시 작성 · 삭제.
 */
export const SectionToolbar = ({
  section,
  isFirst,
  isLast,
  busy,
  actions,
}: {
  section: DetailSection;
  isFirst: boolean;
  isLast: boolean;
  busy?: boolean;
  actions: SectionToolbarActions;
}) => {
  const hasImages = section.images.length > 0;
  const hasAiSlot = section.images.some((image) => image.slot);
  const canRewrite = !["custom_text", "custom_image", "brand", "lookbook", "video", "funding", "production"].includes(section.type);
  const hasVariants = (EDITORIAL_VARIANTS[section.type]?.length ?? 0) > 1;
  return (
    <div className="flex max-w-[calc(100vw-2rem)] flex-wrap items-center bg-[#161616]/90 shadow-lg backdrop-blur" role="toolbar" aria-label="섹션 편집 도구">
      <ToolButton label="수정" onClick={actions.onEdit}><Pencil className="h-4 w-4" /></ToolButton>
      <ToolButton label="위로 이동" onClick={() => actions.onMove(-1)} disabled={isFirst}><ArrowUp className="h-4 w-4" /></ToolButton>
      <ToolButton label="아래로 이동" onClick={() => actions.onMove(1)} disabled={isLast}><ArrowDown className="h-4 w-4" /></ToolButton>
      {hasVariants && <ToolButton label="레이아웃 변경" onClick={actions.onCycleLayout}><LayoutTemplate className="h-4 w-4" /></ToolButton>}
      {section.type !== "hero" && <ToolButton label="배경 변경" onClick={actions.onCycleBackground}><PaintBucket className="h-4 w-4" /></ToolButton>}
      {hasImages && <ToolButton label="이미지 변경" onClick={actions.onChangeImage}><ImageIcon className="h-4 w-4" /></ToolButton>}
      {hasAiSlot && (
        <ToolButton label="AI 이미지 재생성" onClick={actions.onRegenerateImage} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        </ToolButton>
      )}
      {canRewrite && <ToolButton label="텍스트 AI 다시 작성" onClick={actions.onRewrite} disabled={busy}><Wand2 className="h-4 w-4" /></ToolButton>}
      <ToolButton label="섹션 삭제" onClick={actions.onRemove} danger><Trash2 className="h-4 w-4" /></ToolButton>
    </div>
  );
};
