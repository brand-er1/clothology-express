
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "@/components/customize/StepIndicator";
import { TypeStep } from "@/components/customize/TypeStep";
import { MaterialStep } from "@/components/customize/MaterialStep";
import { DetailStep } from "@/components/customize/DetailStep";
import { ImageStep } from "@/components/customize/ImageStep";
import { SizeStep } from "@/components/customize/SizeStep";
import { useCustomizeForm } from "@/hooks/useCustomizeForm";

const TOTAL_STEPS = 5;

const Customize = () => {
  const {
    currentStep,
    selectedType,
    setSelectedType,
    selectedMaterial,
    setSelectedMaterial,
    selectedDetail,
    setSelectedDetail,
    newMaterialName,
    setNewMaterialName,
    materials,
    selectedStyle,
    setSelectedStyle,
    selectedPocket,
    setSelectedPocket,
    selectedColor,
    setSelectedColor,
    selectedFit,       // 새로 추가
    setSelectedFit,    // 새로 추가
    isLoading,
    generatedImageUrl,
    selectedSize,
    setSelectedSize,
    customMeasurements,
    setCustomMeasurements,
    handleAddMaterial,
    handleGenerateImage,
    handleNext,
    handleBack,
  } = useCustomizeForm();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto">
          <StepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />

          {currentStep === 1 && (
            <TypeStep
              selectedType={selectedType}
              onSelectType={setSelectedType}
            />
          )}

          {currentStep === 2 && (
            <MaterialStep
              materials={materials}
              selectedMaterial={selectedMaterial}
              newMaterialName={newMaterialName}
              onSelectMaterial={setSelectedMaterial}
              onNewMaterialNameChange={setNewMaterialName}
              onAddMaterial={handleAddMaterial}
            />
          )}

          {currentStep === 3 && (
            <DetailStep
              detailInput={selectedDetail}
              selectedStyle={selectedStyle}
              selectedPocket={selectedPocket}
              selectedColor={selectedColor}
              selectedFit={selectedFit}        // 새로 추가
              onDetailInputChange={setSelectedDetail}
              onStyleSelect={setSelectedStyle}
              onPocketSelect={setSelectedPocket}
              onColorSelect={setSelectedColor}
              onFitSelect={setSelectedFit}     // 새로 추가
            />
          )}

          {currentStep === 4 && (
            <ImageStep
              isLoading={isLoading}
              generatedImageUrl={generatedImageUrl}
              selectedType={selectedType}
              selectedMaterial={selectedMaterial}
              selectedDetail={selectedDetail}
              onGenerateImage={handleGenerateImage}
            />
          )}

          {currentStep === 5 && (
            <SizeStep
              selectedSize={selectedSize}
              customMeasurements={customMeasurements}
              onSizeChange={setSelectedSize}
              onCustomMeasurementChange={(label, value) => {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                  setCustomMeasurements(prev => ({
                    ...prev,
                    [label]: numValue
                  }));
                }
              }}
              selectedType={selectedType}
              gender="남성" // TODO: 사용자의 성별에 따라 동적으로 변경
            />
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            {currentStep > 1 && (
              <Button variant="outline" onClick={handleBack}>
                이전
              </Button>
            )}
            <div className="flex-1" />
            <Button
              onClick={handleNext}
              className="bg-brand hover:bg-brand-dark"
            >
              {currentStep === TOTAL_STEPS ? "주문하기" : "다음"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Customize;

