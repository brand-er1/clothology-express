import { useRef, useState } from "react";
import { ImagePlus, Loader2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TrademarkScreeningCard } from "@/components/ready-made/TrademarkScreeningCard";
import type { UseReadyMadeGroupWearFormReturn } from "@/hooks/useReadyMadeGroupWearForm";

interface DesignPanelProps {
  form: UseReadyMadeGroupWearFormReturn;
}

export const DesignPanel = ({ form }: DesignPanelProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"upload" | "ai">("upload");
  const [aiPrompt, setAiPrompt] = useState("");

  const isBusy = form.isPreparingDesign || form.isGeneratingDesign;

  return (
    <div>
      <h3 className="text-sm font-black text-stone-950">디자인</h3>
      <p className="mt-1 text-xs leading-5 text-stone-500">
        업로드하면 캔버스 위에 바로 나타나요. PNG 투명 배경을 권장해요.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex h-10 items-center justify-center gap-1.5 rounded-full text-xs font-bold transition ${
            mode === "upload" ? "bg-brand text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
          }`}
        >
          <Upload className="h-3.5 w-3.5" />
          직접 업로드
        </button>
        <button
          type="button"
          onClick={() => setMode("ai")}
          className={`flex h-10 items-center justify-center gap-1.5 rounded-full text-xs font-bold transition ${
            mode === "ai" ? "bg-brand text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI로 생성
        </button>
      </div>

      {mode === "upload" ? (
        <>
          <button
            type="button"
            className="mt-3 flex min-h-[160px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-[#fbfaf8] transition hover:border-brand/50"
            onClick={() => inputRef.current?.click()}
            disabled={isBusy}
          >
            {form.designPreviewUrl ? (
              <img
                src={form.designPreviewUrl}
                alt="업로드한 디자인 미리보기"
                className="max-h-40 max-w-full object-contain p-3"
              />
            ) : (
              <div className="px-4 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <ImagePlus className="h-5 w-5" />
                </span>
                <p className="mt-2 text-xs font-bold text-stone-800">디자인 파일을 올려주세요</p>
                <p className="mt-1 text-[11px] text-stone-400">PNG · JPG · WEBP · 최대 10MB</p>
              </div>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              const nextFile = event.target.files?.[0];
              event.target.value = "";
              if (nextFile) void form.uploadDesignFile(nextFile);
            }}
          />
          {form.isPreparingDesign && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#fbfaf8] px-3 py-2.5 text-xs font-bold text-stone-500 ring-1 ring-stone-200">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand" />
              이미지 준비 중...
            </div>
          )}
        </>
      ) : (
        <div className="mt-3 flex flex-col">
          {form.designPreviewUrl && (
            <img
              src={form.designPreviewUrl}
              alt="생성된 디자인 미리보기"
              className="mb-3 max-h-32 w-full rounded-lg border border-stone-200 bg-white object-contain p-2"
            />
          )}
          <Textarea
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
            placeholder="예: 등산 동아리 로고, 산 실루엣과 나침반"
            maxLength={300}
            className="min-h-20 resize-none bg-white text-sm"
            disabled={form.isGeneratingDesign}
          />
          <Button
            type="button"
            className="mt-2.5 h-10 rounded-full bg-brand text-sm font-bold hover:bg-brand-dark"
            onClick={() => void form.generateDesignFromPrompt(aiPrompt)}
            disabled={form.isGeneratingDesign || !aiPrompt.trim()}
          >
            {form.isGeneratingDesign ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                AI 디자인 생성
              </>
            )}
          </Button>
        </div>
      )}

      <TrademarkScreeningCard screening={form.trademarkScreening} isScreening={form.isScreeningTrademark} />
    </div>
  );
};
