
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "@/components/customize/StepIndicator";
import { TypeStep } from "@/components/customize/TypeStep";
import { MaterialStep } from "@/components/customize/MaterialStep";
import { DetailStep } from "@/components/customize/DetailStep";
import { ImageStep } from "@/components/customize/ImageStep";
import { ModifyImageStep } from "@/components/customize/ModifyImageStep";
import { SizeStep } from "@/components/customize/SizeStep";
import { useCustomizeForm } from "@/hooks/useCustomizeForm";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

const TOTAL_STEPS = 6; // Updated from 5 to 6 to include the new modification step

const Customize = () => {
  const [userGender, setUserGender] = useState<string>("남성");
  const [userHeight, setUserHeight] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isMobile = useIsMobile();

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
    selectedFit,
    setSelectedFit,
    selectedTexture,
    setSelectedTexture,
    selectedElasticity,
    setSelectedElasticity,
    selectedTransparency,
    setSelectedTransparency,
    selectedThickness,
    setSelectedThickness,
    selectedSeason,
    setSelectedSeason,
    imageLoading,
    generatedImageUrls,
    storedImageUrls,
    selectedImageIndex,
    storedImageUrl,
    generatedPrompt,
    selectedSize,
    setSelectedSize,
    customMeasurements,
    setCustomMeasurements,
    sizeTableData,
    handleSizeTableChange,
    handleAddMaterial,
    handleGenerateImage,
    handleSelectImage,
    handleNext,
    handleBack,
    // New properties for image modification
    imageModifying,
    modificationHistory,
    currentModifiedImageUrl,
    handleModifyImage,
    handleResetModifications,
  } = useCustomizeForm();

  // 사용자 정보 가져오기
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        
        if (!user) {
          toast({
            title: "로그인이 필요합니다",
            description: "사이즈 추천을 위해 로그인해주세요.",
            variant: "destructive",
          });
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('gender, height')
          .eq('id', user.id)
          .single();

        if (error) {
          throw error;
        }

        if (profile) {
          setUserGender(profile.gender || "남성");
          setUserHeight(profile.height);
        }
      } catch (error: any) {
        console.error('Error loading profile:', error);
        toast({
          title: "프로필 로드 실패",
          description: "프로필 정보를 불러오는데 실패했습니다.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadUserProfile();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 pt-16 md:pt-24 pb-12">
        <div className="max-w-4xl mx-auto">
          <StepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />

          {/* Navigation Buttons for Mobile - Top */}
          {isMobile && (
            <div className="flex flex-col space-y-3 mt-4 mb-6">
              {currentStep > 1 && (
                <Button 
                  variant="outline" 
                  onClick={handleBack} 
                  className="w-full"
                >
                  이전
                </Button>
              )}
              <Button
                onClick={handleNext}
                className="w-full bg-brand hover:bg-brand-dark"
              >
                {currentStep === TOTAL_STEPS ? "주문하기" : "다음"}
              </Button>
            </div>
          )}

          <div className="mt-4 md:mt-8">
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
                selectedFit={selectedFit}
                selectedTexture={selectedTexture}
                selectedElasticity={selectedElasticity}
                selectedTransparency={selectedTransparency}
                selectedThickness={selectedThickness}
                selectedSeason={selectedSeason}
                onDetailInputChange={setSelectedDetail}
                onStyleSelect={setSelectedStyle}
                onPocketSelect={setSelectedPocket}
                onColorSelect={setSelectedColor}
                onFitSelect={setSelectedFit}
                onTextureSelect={setSelectedTexture}
                onElasticitySelect={setSelectedElasticity}
                onTransparencySelect={setSelectedTransparency}
                onThicknessSelect={setSelectedThickness}
                onSeasonSelect={setSelectedSeason}
              />
            )}

            {currentStep === 4 && (
              <ImageStep
                isLoading={imageLoading}
                generatedImageUrls={generatedImageUrls}
                selectedImageIndex={selectedImageIndex}
                storedImageUrls={storedImageUrls}
                selectedType={selectedType}
                selectedMaterial={selectedMaterial}
                selectedStyle={selectedStyle}
                selectedColor={selectedColor}
                selectedPocket={selectedPocket}
                selectedFit={selectedFit}
                selectedDetail={selectedDetail}
                onGenerateImage={handleGenerateImage}
                onSelectImage={handleSelectImage}
              />
            )}

            {currentStep === 5 && (
              <ModifyImageStep
                isLoading={imageModifying}
                selectedImageUrl={currentModifiedImageUrl || (storedImageUrls && selectedImageIndex >= 0 ? storedImageUrls[selectedImageIndex] : null)}
                modificationHistory={modificationHistory}
                onModifyImage={handleModifyImage}
                onResetModifications={handleResetModifications}
              />
            )}

            {currentStep === 6 && (
              <SizeStep
                selectedSize={selectedSize}
                customMeasurements={customMeasurements}
                sizeTableData={sizeTableData}
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
                onSizeTableChange={handleSizeTableChange}
                selectedType={selectedType}
                selectedMaterial={selectedMaterial}
                selectedDetail={selectedDetail}
                generatedPrompt={generatedPrompt}
                gender={userGender}
              />
            )}
          </div>

          {/* Navigation Buttons - Bottom (Desktop or Mobile) */}
          <div className={`flex ${isMobile ? 'flex-col space-y-3 sticky bottom-4 mt-6 bg-white p-3 rounded-lg shadow-lg' : 'justify-between'} mt-8`}>
            {!isMobile && currentStep > 1 && (
              <Button 
                variant="outline" 
                onClick={handleBack}
              >
                이전
              </Button>
            )}
            {isMobile ? null : <div className="flex-1" />}
            {!isMobile && (
              <Button
                onClick={handleNext}
                className="bg-brand hover:bg-brand-dark"
              >
                {currentStep === TOTAL_STEPS ? "주문하기" : "다음"}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Customize;
