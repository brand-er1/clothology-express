
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
import { TOTAL_STEPS } from "@/lib/customize-constants";

const Customize = () => {
  const [userGender, setUserGender] = useState<string>("남성");

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
    isLoading: isSubmitting,
    imageLoading,
    generatedImageUrls,
    storedImageUrls,
    selectedImageIndex,
    storedImageUrl,
    generatedPrompt,
    productionSizeSelection,
    handleProductionSizeChange,
    directQuantity,
    setDirectQuantity,
    handleAddMaterial,
    handleGenerateImage,
    handleNext,
    handleBack,
    handleCreateFunding,
    handleCreateDirectRequest,
    // New properties for image modification
    imageModifying,
    modificationHistory,
    currentModifiedImageUrl,
    currentArtworkAnalysis,
    setCurrentArtworkScreeningId,
    setCurrentProductionEstimate,
    handleModifyImage,
    handleResetModifications,
    handleSelectHistoryImage,
  } = useCustomizeForm();

  const stepContent = [
    ["무엇을 만들까요?", "첫 컬렉션으로 제작할 의류 아이템을 선택해주세요."],
    ["어떤 원단이 좋을까요?", "제품의 분위기와 착용감을 결정할 소재를 선택해주세요."],
    ["원하는 디자인을 설명해주세요", "예시처럼 색상, 핏, 프린트 위치와 분위기를 문장으로 적으면 AI가 디자인에 반영합니다."],
    ["첫 디자인을 생성합니다", "입력한 조건을 바탕으로 앞·뒤 의류 디자인을 확인해보세요."],
    ["내 디자인으로 완성하세요", "이미지를 편집하고 로고를 배치하면 견적과 상표 분석이 함께 진행됩니다."],
    ["생산 정보를 확인해주세요", "사이즈와 수량을 확인한 뒤 펀딩 페이지를 만들거나 제작만 바로 의뢰할 수 있습니다."],
  ];

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
          .select('gender')
          .eq('id', user.id)
          .single();

        if (error) {
          throw error;
        }

        if (profile) {
          setUserGender(profile.gender || "남성");
        }
      } catch (error: unknown) {
        console.error('Error loading profile:', error);
        toast({
          title: "프로필 로드 실패",
          description: "프로필 정보를 불러오는데 실패했습니다.",
          variant: "destructive",
        });
      }
    };

    loadUserProfile();
  }, []);

  return (
    <div className="min-h-screen bg-[#f4f0ea]">
      <Header />
      <main className="mx-auto max-w-[1320px] px-3 pb-24 pt-20 sm:px-6 sm:pt-24 lg:px-8 lg:pt-28">
        <div>
          <div className="mb-6 flex flex-col justify-between gap-3 px-1 sm:mb-8 md:flex-row md:items-end">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand sm:text-xs sm:tracking-[0.2em]">
                Brand-er design studio
              </p>
              <h1 className="mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.045em] text-stone-950 sm:mt-3 md:text-5xl">
                나만의 첫 컬렉션
              </h1>
            </div>
            <p className="max-w-md text-[15px] leading-6 text-stone-500 md:max-w-sm md:text-sm">
              AI 디자인을 완성한 뒤 펀딩 페이지를 만들거나, 펀딩 없이
              관리자에게 제작을 바로 의뢰할 수 있습니다.
            </p>
          </div>

          <StepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />

          <section
            className={`mt-4 rounded-[1.5rem] border border-stone-200 bg-[#fbfaf8] shadow-[0_24px_80px_rgba(36,26,24,0.06)] sm:mt-6 sm:rounded-[2rem] sm:p-9 lg:p-12 ${
              currentStep === 4 || currentStep === 5 ? "p-2.5" : "p-4"
            }`}
          >
            <div className="mb-6 border-b border-stone-200 px-1 pb-5 pt-2 sm:mb-8 sm:px-0 sm:pb-6 sm:pt-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand sm:text-xs sm:tracking-[0.16em]">
                Step {String(currentStep).padStart(2, "0")}
              </p>
              <h2 className="mt-2 text-[1.55rem] font-bold leading-tight tracking-[-0.035em] text-stone-950 md:text-3xl">
                {stepContent[currentStep - 1]?.[0]}
              </h2>
              <p className="mt-2 text-[15px] leading-6 text-stone-500 sm:text-sm">
                {stepContent[currentStep - 1]?.[1]}
              </p>
            </div>

            <div>
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
                selectedType={selectedType}
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
              />
            )}

            {currentStep === 5 && (
              <ModifyImageStep
                isLoading={imageModifying}
                selectedImageUrl={currentModifiedImageUrl || (storedImageUrls && selectedImageIndex >= 0 ? storedImageUrls[selectedImageIndex] : null)}
                selectedType={selectedType}
                selectedMaterial={selectedMaterial}
                designContext={[generatedPrompt, selectedDetail].filter(Boolean).join("\n")}
                modificationHistory={modificationHistory}
                currentArtworkAnalysis={currentArtworkAnalysis}
                onEstimateChange={setCurrentProductionEstimate}
                onArtworkScreeningApplied={setCurrentArtworkScreeningId}
                onModifyImage={handleModifyImage}
                onResetModifications={handleResetModifications}
                onSelectHistoryImage={handleSelectHistoryImage}
              />
            )}

            {currentStep === 6 && (
              <SizeStep
                productionSizeSelection={productionSizeSelection}
                onProductionSizeChange={handleProductionSizeChange}
                selectedType={selectedType}
                gender={userGender}
                directQuantity={directQuantity}
                onDirectQuantityChange={setDirectQuantity}
              />
            )}
            </div>

            <div className="sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 mt-8 flex items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-white/95 p-2.5 shadow-[0_16px_45px_rgba(36,26,24,0.12)] backdrop-blur sm:static sm:mt-10 sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
              {currentStep > 1 ? (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="h-12 shrink-0 rounded-full border-stone-300 px-5 sm:px-6"
                >
                  이전
                </Button>
              ) : <div />}
              {currentStep === TOTAL_STEPS ? (
                <div className="grid min-w-0 flex-1 gap-2 sm:flex sm:flex-none sm:gap-3">
                  <Button
                    onClick={() => void handleCreateFunding()}
                    disabled={isSubmitting}
                    className="h-12 rounded-full bg-brand px-5 text-[14px] font-bold hover:bg-brand-dark sm:px-7 sm:text-sm"
                  >
                    {isSubmitting
                      ? "처리 중..."
                      : "이 이미지로 펀딩 만들기"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleCreateDirectRequest()}
                    disabled={isSubmitting}
                    className="h-12 rounded-full border-brand px-5 text-[14px] font-bold text-brand hover:bg-brand/5 hover:text-brand sm:px-7 sm:text-sm"
                  >
                    {isSubmitting ? "처리 중..." : "제작 의뢰하기"}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={isSubmitting}
                  className="h-12 min-w-0 flex-1 rounded-full bg-brand px-4 text-[15px] font-bold hover:bg-brand-dark sm:flex-none sm:px-7 sm:text-sm"
                >
                  {currentStep === 4 ? "이 디자인 편집하기" : "다음 단계"}
                </Button>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Customize;
