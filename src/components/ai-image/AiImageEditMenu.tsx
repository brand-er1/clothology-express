import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AI_IMAGE_EDIT_PRESETS, type AiImageEditPreset } from "@/services/aiImageEdit";
import { cn } from "@/lib/utils";

type Props = {
  /** 편집 실행(부모가 API 호출과 이미지 교체를 맡는다). */
  onEdit: (preset: AiImageEditPreset, prompt?: string) => Promise<void> | void;
  busy?: boolean;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
};

/** [AI 이미지 수정] → 로고 제거 / 글자 제거 / 디자인 수정 / 컬러 수정 / 직접 수정 요청 */
export const AiImageEditMenu = ({ onEdit, busy, disabled, className, size = "sm" }: Props) => {
  const [pending, setPending] = useState<(typeof AI_IMAGE_EDIT_PRESETS)[number] | null>(null);
  const [prompt, setPrompt] = useState("");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || busy}
            className={cn(size === "sm" ? "h-8 rounded-md px-1 text-[11px]" : "h-11 rounded-md", className)}
          >
            {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Wand2 className="mr-1 h-3 w-3" />}
            {busy ? "수정 중..." : "AI 이미지 수정"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-stone-500">핏·색상·원단·배경·구도는 그대로 유지해요</DropdownMenuLabel>
          {AI_IMAGE_EDIT_PRESETS.map((preset, index) => (
            <div key={preset.value}>
              {index === 2 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onSelect={() => {
                  if (preset.needsPrompt) {
                    setPrompt("");
                    setPending(preset);
                  } else {
                    void onEdit(preset.value);
                  }
                }}
              >
                {preset.label}
                {preset.needsPrompt && <span className="ml-auto text-[11px] text-stone-400">요청 입력</span>}
              </DropdownMenuItem>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="max-w-md rounded-md">
          <DialogHeader>
            <DialogTitle>{pending?.label}</DialogTitle>
            <DialogDescription>요청한 부분만 바꾸고 나머지(핏·색상·원단·디테일·배경·구도)는 그대로 유지합니다. 원본 이미지는 남아 있어요.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={prompt}
            maxLength={300}
            placeholder={pending?.placeholder}
            aria-label="수정 요청"
            onChange={(event) => setPrompt(event.target.value)}
            className="min-h-[96px] rounded-md text-base sm:text-sm"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="h-11 rounded-md" onClick={() => setPending(null)}>
              취소
            </Button>
            <Button
              type="button"
              className="h-11 rounded-md bg-brand hover:bg-brand-dark"
              disabled={!prompt.trim()}
              onClick={() => {
                if (!pending) return;
                const preset = pending.value;
                setPending(null);
                void onEdit(preset, prompt);
              }}
            >
              <Wand2 className="mr-1.5 h-4 w-4" /> 이미지 수정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
