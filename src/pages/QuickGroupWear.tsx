import { ArrowLeft, ArrowRight, Layers, Timer, Palette, Shirt } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useMascotPageContext } from "@/components/guide/MascotContext";
import { ReadyMadeStepIndicator } from "@/components/ready-made/ReadyMadeStepIndicator";
import { ProductStep } from "@/components/ready-made/ProductStep";
import { SizeQuantityStep } from "@/components/ready-made/SizeQuantityStep";
import { DesignUploadStep } from "@/components/ready-made/DesignUploadStep";
import { PrintOptionsStep } from "@/components/ready-made/PrintOptionsStep";
import { QuoteStep } from "@/components/ready-made/QuoteStep";
import { SubmitStep } from "@/components/ready-made/SubmitStep";
import { useReadyMadeGroupWearForm, READY_MADE_TOTAL_STEPS } from "@/hooks/useReadyMadeGroupWearForm";

const badges = [
  { icon: Timer, label: "약 7일 이내 제작" },
  { icon: Shirt, label: "XS ~ 3XL" },
  { icon: Layers, label: "소량 제작 가능" },
  { icon: Palette, label: "로고/그래픽 인쇄" },
];

const QuickGroupWear = () => {
  const form = useReadyMadeGroupWearForm();

  useMascotPageContext({ page: "quick-group-wear", hasEstimate: Boolean(form.quote) });

  const isLastStep = form.currentStep === READY_MADE_TOTAL_STEPS;
  const isFirstStep = form.currentStep === 1;

  return (
    <div className="min-h-screen bg-[#f4f0ea]">
      <Header />
      <main className="mx-auto max-w-[860px] px-4 pb-24 pt-24 sm:px-6 sm:pt-28 lg:px-8">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Brand-er quick production</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-stone-950 sm:text-5xl">
            빠르게 만드는 단체복
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-stone-500">
            기성 제품에 원하는 디자인만 더해 합리적인 가격으로 빠르게 제작하세요.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {badges.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/5 px-3 py-1.5 text-xs font-bold text-brand"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-6" data-tutorial="quick-group-wear-steps">
          <ReadyMadeStepIndicator currentStep={form.currentStep} />
        </div>

        <div className="rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm sm:p-7" data-tutorial="quick-group-wear-content">
          {form.currentStep === 1 && <ProductStep form={form} />}
          {form.currentStep === 2 && <SizeQuantityStep form={form} />}
          {form.currentStep === 3 && <DesignUploadStep form={form} />}
          {form.currentStep === 4 && <PrintOptionsStep form={form} />}
          {form.currentStep === 5 && <QuoteStep form={form} />}
          {form.currentStep === 6 && <SubmitStep form={form} />}
        </div>

        {!(isLastStep && form.submittedOrderId) && (
          <div className="mt-5 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-full border-stone-300 bg-white px-6"
              onClick={form.handleBack}
              disabled={isFirstStep}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              이전
            </Button>
            {!isLastStep && (
              <Button
                type="button"
                className="h-12 rounded-full bg-brand px-6 hover:bg-brand-dark"
                onClick={form.handleNext}
              >
                다음
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default QuickGroupWear;
