import { Check } from "lucide-react";
import type { Funding } from "@/types/funding";
import { buildSuccessTimeline, getPublicProductionLabel } from "@/lib/funding-success-stories";

const formatDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
};

/**
 * 펀딩 상세의 [제작 과정] 탭: 아이디어 등록부터 펀딩 성공·배송까지의 실제 진행 기록.
 * (예전 /success-stories/:id 페이지의 타임라인을 상세 화면 안으로 옮긴 것)
 */
export const FundingProcessPanel = ({ funding }: { funding: Funding }) => {
  const steps = buildSuccessTimeline(funding);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-black/10 pb-6">
        <div>
          <p className="eyebrow">Success story</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">아이디어에서 제품이 되기까지</h2>
        </div>
        <p className="inline-flex min-h-9 items-center gap-2 border border-brand/30 bg-brand/5 px-3 text-sm font-semibold text-brand">
          현재 제작 상태 · {getPublicProductionLabel(funding)}
        </p>
      </div>

      <ol className="mt-10 grid gap-0 lg:grid-cols-6 lg:gap-6">
        {steps.map((step, index) => (
          <li key={step.key} className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-4 pb-9 lg:block lg:pb-0">
            {index < steps.length - 1 && (
              <span
                aria-hidden
                className="absolute left-[1.0625rem] top-9 h-[calc(100%-2.25rem)] w-px bg-black/15 lg:left-9 lg:top-[1.0625rem] lg:h-px lg:w-[calc(100%-1.5rem)]"
              />
            )}
            <span
              className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold ${
                step.state === "done"
                  ? "border-brand bg-brand text-white"
                  : step.state === "current"
                    ? "border-brand bg-[#f6f3ee] text-brand"
                    : "border-black/20 bg-[#f6f3ee] text-stone-400"
              }`}
            >
              {step.state === "done" ? <Check className="h-4 w-4" strokeWidth={2.5} /> : String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 lg:mt-6">
              <p className="font-display text-[11px] font-semibold tracking-[0.18em] text-brand">STEP {String(index + 1).padStart(2, "0")}</p>
              <h3 className="mt-1.5 text-base font-semibold tracking-[-0.02em]">
                {step.title}
                {step.state === "current" && <span className="ml-2 text-xs font-medium text-brand">진행 중</span>}
              </h3>
              {formatDate(step.date) && <p className="mt-1 font-display text-xs text-stone-500">{formatDate(step.date)}</p>}
              <p className="text-wrap-anywhere mt-2 text-sm leading-6 text-stone-600">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};
