import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const INSTRUCTION_EXAMPLES = [
  "배경을 어두운 콘크리트 바닥으로 변경",
  "모델 없이 제품만 보여줘",
  "좀 더 밝은 자연광으로",
  "제품을 바닥에 자연스럽게 놓은 느낌",
];

/**
 * "이 이미지만 다시 생성": asks for an optional instruction. The garment design always comes from
 * the original reference, so the instruction can only change set, light, composition or model.
 */
export const ImageRegenerateDialog = ({
  open,
  label,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  /** e.g. "HERO", "FABRIC" — shown in the title. */
  label?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (instruction: string) => void;
}) => {
  const [instruction, setInstruction] = useState("");
  useEffect(() => {
    if (open) setInstruction("");
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-md">
        <DialogHeader>
          <DialogTitle>{label ? `${label} 이미지 다시 생성` : "어떻게 변경할까요?"}</DialogTitle>
          <DialogDescription>
            원본 디자인을 기준으로 이 이미지만 다시 만듭니다. 옷의 형태·색상·그래픽·로고 위치는 그대로 유지돼요.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={instruction}
          maxLength={300}
          placeholder="비워두면 같은 연출로 새로 촬영합니다."
          onChange={(event) => setInstruction(event.target.value)}
          className="min-h-[96px] rounded-md text-base leading-6 sm:text-sm"
        />
        <div className="flex flex-wrap gap-1.5">
          {INSTRUCTION_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setInstruction(example)}
              className="min-h-9 border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600 hover:border-stone-400"
            >
              {example}
            </button>
          ))}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="h-11 rounded-md" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            type="button"
            className="h-11 rounded-md bg-brand hover:bg-brand-dark"
            onClick={() => {
              onOpenChange(false);
              onSubmit(instruction);
            }}
          >
            <Sparkles className="mr-1.5 h-4 w-4" /> 다시 생성
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
