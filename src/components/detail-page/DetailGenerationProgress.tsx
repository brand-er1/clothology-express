import { Check, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DETAIL_IMAGE_SPECS } from "@/lib/detail-page/imagePipeline";
import type { DetailImageJob, DetailImageType } from "@/types/detailPage";
import { cn } from "@/lib/utils";

type StepState = "done" | "active" | "waiting" | "failed";

const StepIcon = ({ state }: { state: StepState }) =>
  state === "done" ? (
    <Check className="h-4 w-4 text-emerald-600" />
  ) : state === "active" ? (
    <Loader2 className="h-4 w-4 animate-spin text-brand" />
  ) : state === "failed" ? (
    <X className="h-4 w-4 text-red-600" />
  ) : (
    <span className="h-1.5 w-1.5 rounded-full bg-stone-300" />
  );

/**
 * "AI 상세페이지 제작 중" progress: copy → each image (independent status) → assembly.
 * Never blocks the editor; failed images get their own retry button.
 */
export const DetailGenerationProgress = ({
  copyStatus,
  jobs,
  onRetry,
}: {
  copyStatus: "idle" | "generating" | "done";
  jobs: Partial<Record<DetailImageType, DetailImageJob>>;
  onRetry: (type: DetailImageType) => void;
}) => {
  const list = DETAIL_IMAGE_SPECS.map((spec) => ({ spec, job: jobs[spec.type] })).filter((entry) => entry.job);
  if (!list.length && copyStatus !== "generating") return null;
  const completed = list.filter((entry) => entry.job?.status === "completed").length;
  const failed = list.filter((entry) => entry.job?.status === "failed").length;
  const running = list.some((entry) => entry.job?.status === "generating" || entry.job?.status === "pending");
  const allDone = !running && copyStatus !== "generating" && list.length > 0;

  const steps: Array<[string, StepState]> = [
    ["상품 분석 완료", "done"],
    ["상품 설명 생성", copyStatus === "generating" ? "active" : "done"],
  ];

  return (
    <section className="border border-stone-200 bg-white" aria-live="polite">
      <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <p className="text-sm font-bold">{allDone ? "AI 상세페이지 완성" : "AI 상세페이지 제작 중"}</p>
        {list.length > 0 && (
          <span className="shrink-0 text-xs font-semibold text-stone-500">
            이미지 {completed} / {list.length} 완료{failed ? ` · 실패 ${failed}` : ""}
          </span>
        )}
      </div>
      <div className="h-0.5 bg-stone-100">
        <div className="h-full bg-brand transition-all" style={{ width: `${list.length ? (completed / list.length) * 100 : 10}%` }} />
      </div>
      <ol className="divide-y divide-stone-100 px-4 text-sm">
        {steps.map(([label, state]) => (
          <li key={label} className="flex items-center gap-2.5 py-2">
            <StepIcon state={state} />
            <span className={cn(state === "active" && "font-semibold")}>{label}{state === "active" ? " 중..." : ""}</span>
          </li>
        ))}
        {list.map(({ spec, job }) => {
          const state: StepState =
            job!.status === "completed" ? "done" : job!.status === "failed" ? "failed" : job!.status === "generating" ? "active" : "waiting";
          return (
            <li key={spec.type} className="flex items-center gap-2.5 py-2">
              <StepIcon state={state} />
              <div className="min-w-0 flex-1">
                <p className={cn("truncate", state === "active" && "font-semibold")}>
                  <span className="text-[11px] font-bold text-stone-400">{spec.number}</span> {spec.label}
                  <span className="ml-1.5 text-xs text-stone-500">
                    {state === "active" ? "생성 중..." : state === "waiting" ? "대기" : state === "failed" ? "실패" : "완료"}
                  </span>
                </p>
                {state === "failed" && job!.error && <p className="truncate text-[11px] text-red-600" title={job!.error}>{job!.error}</p>}
              </div>
              {state === "failed" && (
                <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 rounded-md px-2.5 text-xs" onClick={() => onRetry(spec.type)}>
                  <RotateCcw className="mr-1 h-3 w-3" /> 다시 생성
                </Button>
              )}
            </li>
          );
        })}
        {list.length > 0 && (
          <li className="flex items-center gap-2.5 py-2">
            <StepIcon state={allDone ? "done" : "waiting"} />
            <span>{allDone ? "상세페이지 구성 완료" : "상세페이지 구성 (이미지가 완성되는 대로 자동 배치)"}</span>
          </li>
        )}
      </ol>
    </section>
  );
};

export const ImageTypeChecklist = ({
  value,
  onChange,
}: {
  value: DetailImageType[];
  onChange: (next: DetailImageType[]) => void;
}) => (
  <div>
    <ul className="grid grid-cols-1 border-t border-stone-200 sm:grid-cols-2 sm:gap-x-6">
      {DETAIL_IMAGE_SPECS.map((spec) => {
        const id = `image-type-${spec.type}`;
        const checked = value.includes(spec.type);
        return (
          <li key={spec.type} className="border-b border-stone-200">
            <label htmlFor={id} className="flex min-h-12 cursor-pointer items-center gap-3 py-2">
              <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={(next) =>
                  onChange(next ? [...value, spec.type] : value.filter((type) => type !== spec.type))
                }
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  <span className="text-[11px] text-stone-400">IMAGE {spec.number}</span> {spec.label}
                </span>
                <span className="block text-xs text-stone-500">{spec.description}</span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
    <p className="mt-2 text-xs text-stone-500">
      이미지 {value.length}장 · 이미지당 AI 이미지 API 1회 호출. 모든 이미지는 원본 디자인을 reference로 사용해 같은 제품을 유지합니다.
    </p>
  </div>
);
