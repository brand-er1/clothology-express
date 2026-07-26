import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

const labels = ["아이템", "원단", "디테일", "AI 생성", "편집·견적", "사이즈"];

export const StepIndicator = ({ currentStep, totalSteps }: StepIndicatorProps) => {
  const progress = totalSteps > 1 ? ((currentStep - 1) / (totalSteps - 1)) * 100 : 0;

  return (
    <div className="rounded-[1.5rem] border border-stone-200 bg-white px-4 py-5 shadow-[0_12px_40px_rgba(36,26,24,0.05)] sm:px-6">
      <div className="mb-4 flex items-center justify-between md:hidden">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Step {currentStep}</span>
        <span className="text-xs text-stone-500">{labels[currentStep - 1]}</span>
      </div>
      <div className="relative">
        <div className="absolute left-4 right-4 top-4 h-px bg-stone-200" />
        <div
          className="absolute left-4 top-4 h-px bg-brand transition-all duration-500"
          style={{ width: `calc((100% - 2rem) * ${progress / 100})` }}
        />
        <div className="relative flex items-start justify-between">
          {Array.from({ length: totalSteps }, (_, index) => index + 1).map((step) => {
            const isComplete = step < currentStep;
            const isCurrent = step === currentStep;

            return (
              <div key={step} className="flex w-8 flex-col items-center sm:w-20">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-all ${
                    isComplete
                      ? "border-brand bg-brand text-white"
                      : isCurrent
                        ? "border-brand bg-white text-brand ring-4 ring-brand/10"
                        : "border-stone-200 bg-[#fbfaf8] text-stone-400"
                  }`}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : step}
                </span>
                <span className={`mt-3 hidden text-[11px] font-semibold md:block ${isCurrent ? "text-brand" : "text-stone-400"}`}>
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
