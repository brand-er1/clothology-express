import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

const labels = ["아이템", "원단", "디테일", "AI 생성", "편집·견적", "사이즈"];

export const StepIndicator = ({ currentStep, totalSteps }: StepIndicatorProps) => {
  const progress = totalSteps > 1 ? ((currentStep - 1) / (totalSteps - 1)) * 100 : 0;

  return (
    <div className="px-1 py-2 sm:py-3">
      <div className="mb-3 flex items-center justify-between md:hidden">
        <span className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Step {String(currentStep).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}</span>
        <span className="text-[13px] font-semibold text-stone-600">{labels[currentStep - 1]}</span>
      </div>
      <div className="relative">
        <div className="absolute left-3.5 right-3.5 top-3.5 h-px bg-black/10 sm:left-4 sm:right-4 sm:top-4" />
        <div
          className="absolute left-3.5 right-3.5 top-3.5 h-px origin-left bg-brand transition-transform duration-500 sm:left-4 sm:right-4 sm:top-4"
          style={{ transform: `scaleX(${progress / 100})` }}
        />
        <div className="relative flex items-start justify-between">
          {Array.from({ length: totalSteps }, (_, index) => index + 1).map((step) => {
            const isComplete = step < currentStep;
            const isCurrent = step === currentStep;

            return (
              <div key={step} className="flex w-7 flex-col items-center sm:w-20">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border font-display text-[11px] font-semibold transition-colors duration-300 sm:h-8 sm:w-8 sm:text-xs ${
                    isComplete
                      ? "border-brand bg-brand text-white"
                      : isCurrent
                        ? "border-brand bg-[#f6f3ee] text-brand"
                        : "border-black/10 bg-[#f6f3ee] text-stone-400"
                  }`}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : step}
                </span>
                <span className={`mt-3 hidden text-xs md:block ${isCurrent ? "font-semibold text-brand" : "text-stone-400"}`}>
                  {labels[step - 1]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
