import { useRef } from "react";
import { FileImage, ImagePlus, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getAppPath } from "@/utils/appUrl";
import type { UseReadyMadeGroupWearFormReturn } from "@/hooks/useReadyMadeGroupWearForm";

interface DesignUploadStepProps {
  form: UseReadyMadeGroupWearFormReturn;
}

export const DesignUploadStep = ({ form }: DesignUploadStepProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <h2 className="text-xl font-black text-stone-950">로고·디자인을 업로드해주세요</h2>
      <p className="mt-1 text-sm leading-6 text-stone-500">
        PNG · JPG · JPEG · WEBP / 최대 10MB. 배경이 없는 투명 PNG를 권장합니다.
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Card className="overflow-hidden rounded-2xl border-stone-200 bg-[#fbfaf8] p-4">
          <button
            type="button"
            className="flex min-h-[220px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-white transition hover:border-brand/50"
            onClick={() => inputRef.current?.click()}
          >
            {form.previewUrl ? (
              <img src={form.previewUrl} alt="업로드한 디자인 미리보기" className="max-h-56 max-w-full object-contain p-3" />
            ) : (
              <div className="px-6 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <ImagePlus className="h-6 w-6" />
                </span>
                <p className="mt-3 text-sm font-bold text-stone-800">디자인 파일을 올려주세요</p>
                <p className="mt-1 text-xs text-stone-400">클릭해서 선택</p>
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
              if (nextFile) void form.selectDesignFile(nextFile);
            }}
          />
          {form.file && (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-stone-200">
              <FileImage className="h-4 w-4 shrink-0 text-brand" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-stone-800">{form.file.name}</p>
                <p className="text-[11px] text-stone-400">{(form.file.size / 1024 / 1024).toFixed(1)}MB</p>
              </div>
              {form.isPreparingImage && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand" />}
            </div>
          )}
        </Card>

        <Card className="rounded-2xl border-stone-200 bg-white p-4">
          <p className="text-xs font-bold text-stone-500">인쇄 위치 미리보기 (참고용)</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {(["front", "back"] as const).map((side) => (
              <div key={side} className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl bg-stone-50">
                <img
                  src={getAppPath(form.selectedProduct.image)}
                  alt={`${form.selectedProduct.label} ${side === "front" ? "앞면" : "뒷면"}`}
                  className="h-full w-full object-contain p-4"
                />
                {form.previewUrl && (
                  <img
                    src={form.previewUrl}
                    alt="디자인 배치 미리보기"
                    className="pointer-events-none absolute left-1/2 top-[38%] h-[22%] w-[38%] -translate-x-1/2 -translate-y-1/2 object-contain opacity-90"
                  />
                )}
                <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-bold text-stone-500">
                  {side === "front" ? "앞면" : "뒷면"}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-5 text-stone-400">
            실제 인쇄 위치와 크기는 다음 단계에서 정확히 지정합니다. 이 미리보기는 대략적인 배치 확인용입니다.
          </p>
        </Card>
      </div>
    </div>
  );
};
