import { useRef, useState } from "react";
import { FileImage, ImagePlus, Loader2, Sparkles, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TrademarkScreeningCard } from "@/components/ready-made/TrademarkScreeningCard";
import type { UseReadyMadeGroupWearFormReturn } from "@/hooks/useReadyMadeGroupWearForm";

interface DesignUploadStepProps {
  form: UseReadyMadeGroupWearFormReturn;
}

export const DesignUploadStep = ({ form }: DesignUploadStepProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"upload" | "ai">("upload");
  const [aiPrompt, setAiPrompt] = useState("");

  const isBusy = form.isPreparingDesign || form.isGeneratingDesign;

  return (
    <div>
      <h2 className="text-xl font-black text-stone-950">로고·디자인을 준비해주세요</h2>
      <p className="mt-1 text-sm leading-6 text-stone-500">
        가지고 있는 디자인을 올리거나, AI에게 설명만 하면 인쇄용 그래픽을 만들어드려요.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex h-11 items-center justify-center gap-1.5 rounded-full text-sm font-bold transition ${
            mode === "upload" ? "bg-brand text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
          }`}
        >
          <Upload className="h-4 w-4" />
          직접 업로드
        </button>
        <button
          type="button"
          onClick={() => setMode("ai")}
          className={`flex h-11 items-center justify-center gap-1.5 rounded-full text-sm font-bold transition ${
            mode === "ai" ? "bg-brand text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          AI로 생성
        </button>
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <Card className="overflow-hidden rounded-2xl border-stone-200 bg-[#fbfaf8] p-4">
          {mode === "upload" ? (
            <>
              <button
                type="button"
                className="flex min-h-[220px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-white transition hover:border-brand/50"
                onClick={() => inputRef.current?.click()}
                disabled={isBusy}
              >
                {form.designPreviewUrl ? (
                  <img
                    src={form.designPreviewUrl}
                    alt="업로드한 디자인 미리보기"
                    className="max-h-56 max-w-full object-contain p-3"
                  />
                ) : (
                  <div className="px-6 text-center">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
                      <ImagePlus className="h-6 w-6" />
                    </span>
                    <p className="mt-3 text-sm font-bold text-stone-800">디자인 파일을 올려주세요</p>
                    <p className="mt-1 text-xs text-stone-400">클릭해서 선택 · PNG · JPG · WEBP · 최대 10MB</p>
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
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-bold text-stone-500 ring-1 ring-stone-200">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand" />
                  이미지 준비 중...
                </div>
              )}
            </>
          ) : (
            <div className="flex min-h-[220px] flex-col">
              {form.designPreviewUrl && (
                <img
                  src={form.designPreviewUrl}
                  alt="생성된 디자인 미리보기"
                  className="mb-3 max-h-40 w-full rounded-lg border border-stone-200 bg-white object-contain p-2"
                />
              )}
              <Textarea
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                placeholder="예: 등산 동아리 로고, 산 실루엣과 나침반, 네이비 톤 심플한 그래픽"
                maxLength={300}
                className="min-h-24 flex-1 resize-none bg-white"
                disabled={form.isGeneratingDesign}
              />
              <Button
                type="button"
                className="mt-3 h-11 rounded-full bg-brand font-bold hover:bg-brand-dark"
                onClick={() => void form.generateDesignFromPrompt(aiPrompt)}
                disabled={form.isGeneratingDesign || !aiPrompt.trim()}
              >
                {form.isGeneratingDesign ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    디자인 생성 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    AI 디자인 생성하기
                  </>
                )}
              </Button>
            </div>
          )}

          <TrademarkScreeningCard screening={form.trademarkScreening} isScreening={form.isScreeningTrademark} />
        </Card>

        <Card className="rounded-2xl border-stone-200 bg-white p-4">
          <p className="text-xs font-bold text-stone-500">디자인 준비 안내</p>
          <ul className="mt-2 space-y-2 text-xs leading-5 text-stone-500">
            <li className="flex items-start gap-1.5">
              <FileImage className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
              배경이 없는 투명 PNG를 사용하면 인쇄 결과가 가장 깔끔해요.
            </li>
            <li className="flex items-start gap-1.5">
              <FileImage className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
              단색 배경 이미지는 자동으로 배경 제거를 시도해요.
            </li>
            <li className="flex items-start gap-1.5">
              <FileImage className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
              업로드·생성된 모든 디자인은 상표 위험도를 자동으로 검수해요.
            </li>
          </ul>
          <p className="mt-4 text-[11px] leading-5 text-stone-400">
            정확한 인쇄 위치와 크기는 다음 단계에서 실제 제품 이미지 위에 직접 배치하며 확인할 수 있어요.
          </p>
        </Card>
      </div>
    </div>
  );
};
