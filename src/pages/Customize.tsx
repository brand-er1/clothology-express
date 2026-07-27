
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
import { useSearchParams } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { TOTAL_STEPS } from "@/lib/customize-constants";

const Customize = () => {
  const [userGender, setUserGender] = useState<string>("남성");
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") === "direct" ? "direct" : "funding";

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
  } = useCustomizeForm(mode);

  const stepContent = [
    ["무엇을 만들까요?", "첫 컬렉션으로 제작할 의류 아이템을 선택해주세요."],
    ["어떤 원단이 좋을까요?", "제품의 분위기와 착용감을 결정할 소재를 선택해주세요."],
    ["디자인을 구체화해볼까요?", "컬러, 핏과 디테일을 선택하면 AI가 이해할 제작 방향이 완성됩니다."],
    ["첫 디자인을 생성합니다", "입력한 조건을 바탕으로 앞·뒤 의류 디자인을 확인해보세요."],
    ["내 디자인으로 완성하세요", "이미지를 편집하고 로고를 배치하면 견적과 상표 분석이 함께 진행됩니다."],
    mode === "direct"
      ? ["제작 수량과 사이즈를 정해주세요", "성별·카테고리별 추천표를 참고해 바로 생산할 수량과 사이즈를 설정합니다."]
      : ["판매할 사이즈를 정해주세요", "성별·카테고리별 추천표를 참고해 출시 사이즈를 설정합니다."],
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
      <main className="mx-auto max-w-[1180px] px-4 pb-20 pt-24 sm:px-6 lg:px-8 lg:pt-28">
        <div>
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">
                {mode === "direct" ? "Direct production request" : "Brand-er funding studio"}
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-stone-950 md:text-5xl">
                {mode === "direct" ? "바로 제작 의뢰" : "나만의 첫 컬렉션"}
              </h1>
            </div>
            <p className="max-w-sm text-sm leading-6 text-stone-500">
              {mode === "direct"
                ? "AI 디자인과 자동 견적을 확인한 뒤 제작 의뢰를 접수하면 담당자가 사양을 검토해 연락드립니다."
                : "선택한 정보는 AI 디자인과 자동 견적에 함께 반영됩니다. 언제든 이전 단계로 돌아가 수정할 수 있어요."}
            </p>
          </div>

          <StepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />

          <section className="mt-6 rounded-[2rem] border border-stone-200 bg-[#fbfaf8] p-5 shadow-[0_24px_80px_rgba(36,26,24,0.06)] sm:p-8 lg:p-10">
            <div className="mb-8 border-b border-stone-200 pb-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">
                Step {String(currentStep).padStart(2, "0")}
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-stone-950 md:text-3xl">
                {stepContent[currentStep - 1]?.[0]}
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-500">
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
                mode={mode}
                directQuantity={directQuantity}
                onDirectQuantityChange={setDirectQuantity}
              />
            )}
            </div>

            <div className="sticky bottom-4 z-20 mt-10 flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white/95 p-3 shadow-[0_16px_45px_rgba(36,26,24,0.12)] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
              {currentStep > 1 ? (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="h-12 rounded-full border-stone-300 px-6"
                >
                  이전
                </Button>
              ) : <div />}
              <Button
                onClick={handleNext}
                disabled={isSubmitting}
                className="h-12 rounded-full bg-brand px-7 font-bold hover:bg-brand-dark"
              >
                {currentStep === 4
                  ? "이 디자인 편집하기"
                  : currentStep === TOTAL_STEPS
                    ? mode === "direct"
                      ? (isSubmitting ? "제작 의뢰 접수 중..." : "이 디자인으로 바로 제작 의뢰하기")
                      : (isSubmitting ? "펀딩 페이지 만드는 중..." : "이 디자인으로 펀딩 만들기")
                    : "다음 단계"}
              </Button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Customize;
