
import { useState } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { StepIndicator } from "@/components/customize/StepIndicator";
import { SizeStep } from "@/components/customize/SizeStep";
import { DesignStep } from "@/components/customize/DesignStep";
import { OrderStep } from "@/components/customize/OrderStep";

const Customize = () => {
  const [selectedType, setSelectedType] = useState<"tops" | "bottoms">("tops");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [customMeasurements, setCustomMeasurements] = useState<Record<string, number>>({});
  const [currentStep, setCurrentStep] = useState(1);
  const TOTAL_STEPS = 3;

  const handleSizeChange = (sizeId: string) => {
    setSelectedSize(sizeId);
    if (sizeId === "custom") return;
    
    // Reset custom measurements when selecting a standard size
    setCustomMeasurements({});
  };

  const handleCustomMeasurementChange = (label: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setCustomMeasurements(prev => ({
        ...prev,
        [label]: numValue
      }));
      setSelectedSize("custom");
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && !selectedSize) {
      toast({
        title: "사이즈 필요",
        description: "사이즈를 선택해주세요.",
        variant: "destructive",
      });
      return;
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto">
          <StepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />

          {currentStep === 1 && (
            <SizeStep
              selectedType={selectedType}
              selectedSize={selectedSize}
              customMeasurements={customMeasurements}
              onTypeChange={setSelectedType}
              onSizeChange={handleSizeChange}
              onCustomMeasurementChange={handleCustomMeasurementChange}
            />
          )}

          {currentStep === 2 && <DesignStep />}
          {currentStep === 3 && <OrderStep />}

          {/* 하단 버튼 */}
          <div className="flex justify-between">
            {currentStep > 1 && (
              <Button
                variant="outline"
                onClick={handleBack}
              >
                이전
              </Button>
            )}
            <div className="flex-1" />
            <Button
              onClick={handleNext}
              className="bg-brand hover:bg-brand-dark"
              disabled={currentStep === 1 && !selectedSize}
            >
              {currentStep === 3 ? "주문하기" : "다음"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Customize;
