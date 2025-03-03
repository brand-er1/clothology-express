
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "@/components/customize/StepIndicator";
import { TypeStep } from "@/components/customize/TypeStep";
import { MaterialStep } from "@/components/customize/MaterialStep";
import { DetailStep } from "@/components/customize/DetailStep";
import { ImageStep } from "@/components/customize/ImageStep";
import { SizeStep } from "@/components/customize/SizeStep";
import { useCustomizeForm } from "@/hooks/useCustomizeForm";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";

const TOTAL_STEPS = 5;

const Customize = () => {
  const navigate = useNavigate();
  const [userGender, setUserGender] = useState<string>("남성");
  const [userHeight, setUserHeight] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [saveInProgress, setSaveInProgress] = useState(false);

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
    imageLoading,
    generatedImageUrl,
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
    handleNext,
    handleBack,
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

        setUserId(user.id);

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

  // Save progress whenever user completes a step
  const saveProgress = async () => {
    if (!userId) {
      toast({
        title: "로그인이 필요합니다",
        description: "진행 상태를 저장하려면 로그인해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaveInProgress(true);
      
      console.log("Saving progress:", {
        step: currentStep,
        selectedType,
        selectedMaterial,
        selectedDetail
      });
      
      const { data, error } = await supabase.functions.invoke('save-customize-progress', {
        body: {
          user_id: userId,
          selectedType,
          selectedMaterial,
          selectedStyle,
          selectedPocket,
          selectedColor, 
          selectedDetail,
          selectedSize,
          customMeasurements,
          generatedImageUrl: storedImageUrl || generatedImageUrl,
          imagePath: null,
          sizeTableData,
          step: currentStep
        }
      });

      if (error) {
        throw error;
      }

      console.log("Progress saved:", data);
      // Silent success - no need to show a toast for routine saves
    } catch (error) {
      console.error("Error saving progress:", error);
      toast({
        title: "저장 실패",
        description: "진행 상태 저장에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setSaveInProgress(false);
    }
  };

  // Enhanced handleNext to save progress before advancing
  const handleNextWithSave = async () => {
    await saveProgress();
    handleNext();
  };

  // Handle final submission with save
  const handleSubmitOrder = async () => {
    try {
      setSaveInProgress(true);
      
      // Final save with pending status
      const { data, error } = await supabase.functions.invoke('save-customize-progress', {
        body: {
          user_id: userId,
          selectedType,
          selectedMaterial,
          selectedStyle,
          selectedPocket,
          selectedColor, 
          selectedDetail,
          selectedSize,
          customMeasurements,
          generatedImageUrl: storedImageUrl || generatedImageUrl,
          imagePath: null,
          sizeTableData,
          step: TOTAL_STEPS,
          finalSubmit: true
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "주문 완료",
        description: "주문이 성공적으로 접수되었습니다.",
      });
      
      navigate("/orders");
    } catch (error: any) {
      console.error("Error submitting order:", error);
      toast({
        title: "주문 실패",
        description: `주문 제출 중 오류가 발생했습니다: ${error.message || "알 수 없는 오류"}`,
        variant: "destructive",
      });
    } finally {
      setSaveInProgress(false);
    }
  };

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
              selectedFit={selectedFit}
              onDetailInputChange={setSelectedDetail}
              onStyleSelect={setSelectedStyle}
              onPocketSelect={setSelectedPocket}
              onColorSelect={setSelectedColor}
              onFitSelect={setSelectedFit}
            />
          )}

          {currentStep === 4 && (
            <ImageStep
              isLoading={imageLoading}
              generatedImageUrl={generatedImageUrl}
              storedImageUrl={storedImageUrl}
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

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            {currentStep > 1 && (
              <Button variant="outline" onClick={handleBack}>
                이전
              </Button>
            )}
            <div className="flex-1" />
            <Button
              onClick={currentStep === TOTAL_STEPS ? handleSubmitOrder : handleNextWithSave}
              className="bg-brand hover:bg-brand-dark"
              disabled={saveInProgress}
            >
              {saveInProgress ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  처리 중...
                </span>
              ) : (
                currentStep === TOTAL_STEPS ? "주문하기" : "다음"
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Customize;
