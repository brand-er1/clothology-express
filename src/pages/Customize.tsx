import { useState } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { StepIndicator } from "@/components/customize/StepIndicator";
import { TypeStep } from "@/components/customize/TypeStep";
import { MaterialStep } from "@/components/customize/MaterialStep";
import { DetailStep } from "@/components/customize/DetailStep";
import { ImageStep } from "@/components/customize/ImageStep";
import { SizeStep } from "@/components/customize/SizeStep";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { 
  clothTypes, 
  styleOptions, 
  pocketOptions, 
  colorOptions 
} from "@/lib/customize-constants";

const TOTAL_STEPS = 5;

const Customize = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedType, setSelectedType] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [selectedDetail, setSelectedDetail] = useState("");
  const [newMaterialName, setNewMaterialName] = useState("");
  const [materials, setMaterials] = useState([
    { 
      id: "cotton", 
      name: "면", 
      description: "부드럽고 통기성이 좋은 천연 소재" 
    },
    { 
      id: "denim", 
      name: "데님", 
      description: "튼튼하고 클래식한 청바지 소재" 
    },
    { 
      id: "poly", 
      name: "폴리", 
      description: "구김이 적고 관리가 쉬운 소재" 
    },
    { 
      id: "linen", 
      name: "린넨", 
      description: "시원하고 자연스러운 질감의 소재" 
    },
  ]);
  const [selectedStyle, setSelectedStyle] = useState("");
  const [selectedPocket, setSelectedPocket] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [customMeasurements, setCustomMeasurements] = useState<Record<string, number>>({});

  const handleCreateOrder = async () => {
    try {
      setIsLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "로그인 필요",
          description: "주문하기 전에 로그인해주세요.",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      const selectedClothType = clothTypes.find(type => type.id === selectedType)?.name;
      const selectedMaterialName = materials.find(material => material.id === selectedMaterial)?.name;
      const selectedStyleName = styleOptions.find(style => style.value === selectedStyle)?.label;
      const selectedPocketName = pocketOptions.find(pocket => pocket.value === selectedPocket)?.label;
      const selectedColorName = colorOptions.find(color => color.value === selectedColor)?.label;

      const { error } = await supabase.from('orders').insert({
        user_id: user.id,
        cloth_type: selectedClothType,
        material: selectedMaterialName,
        style: selectedStyleName,
        pocket_type: selectedPocketName,
        color: selectedColorName,
        detail_description: selectedDetail,
        size: selectedSize,
        measurements: selectedSize === 'custom' ? customMeasurements : null,
        generated_image_url: generatedImageUrl,
      });

      if (error) throw error;

      toast({
        title: "주문 완료",
        description: "주문이 성공적으로 접수되었습니다.",
      });
      
      navigate("/orders");
    } catch (err) {
      console.error("Order creation failed:", err);
      toast({
        title: "주문 실패",
        description: "주문 생성 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (!validateCurrentStep()) {
      return;
    }

    if (currentStep === TOTAL_STEPS) {
      handleCreateOrder();
      return;
    }

    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        if (!selectedType) {
          toast({
            title: "의류 종류 필요",
            description: "의류 종류를 선택해주세요.",
            variant: "destructive",
          });
          return false;
        }
        break;
      case 2:
        if (!selectedMaterial) {
          toast({
            title: "원단 필요",
            description: "원단을 선택해주세요.",
            variant: "destructive",
          });
          return false;
        }
        break;
      case 4:
        if (!generatedImageUrl) {
          toast({
            title: "이미지 필요",
            description: "이미지를 생성해주세요.",
            variant: "destructive",
          });
          return false;
        }
        break;
      case 5:
        if (!selectedSize) {
          toast({
            title: "사이즈 필요",
            description: "사이즈를 선택해주세요.",
            variant: "destructive",
          });
          return false;
        }
        break;
    }
    return true;
  };

  const handleAddMaterial = () => {
    if (newMaterialName.trim()) {
      const newMaterial = {
        id: `custom-${Date.now()}`,
        name: newMaterialName.trim(),
        description: "사용자 지정 원단",
      };
      setMaterials([...materials, newMaterial]);
      setSelectedMaterial(newMaterial.id);
      setNewMaterialName("");
    }
  };

  const handleGenerateImage = async () => {
    try {
      setIsLoading(true);
      
      // 선택된 옵션들을 상세한 프롬프트로 조합
      const selectedClothType = clothTypes.find(type => type.id === selectedType)?.name || "";
      const selectedMaterialName = materials.find(material => material.id === selectedMaterial)?.name || "";
      const selectedStyleName = styleOptions.find(style => style.value === selectedStyle)?.label || "";
      const selectedPocketName = pocketOptions.find(pocket => pocket.value === selectedPocket)?.label || "";
      const selectedColorName = colorOptions.find(color => color.value === selectedColor)?.label || "";
      
      const prompt = `
        Create a detailed fashion design for a ${selectedClothType.toLowerCase()}.
        Material: ${selectedMaterialName}
        Style: ${selectedStyleName}
        Color: ${selectedColorName}
        Pockets: ${selectedPocketName}
        Additional details: ${selectedDetail || "none"}
      `.trim();

      const { data, error } = await supabase.functions.invoke('generate-optimized-image', {
        body: { prompt }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
        toast({
          title: "이미지 생성 완료",
          description: "AI가 생성한 이미지가 준비되었습니다.",
        });
      } else {
        throw new Error("이미지 생성에 실패했습니다");
      }
      
    } catch (err) {
      console.error("Image generation failed:", err);
      toast({
        title: "오류",
        description: "이미지 생성에 실패했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
              onDetailInputChange={setSelectedDetail}
              onStyleSelect={setSelectedStyle}
              onPocketSelect={setSelectedPocket}
              onColorSelect={setSelectedColor}
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
