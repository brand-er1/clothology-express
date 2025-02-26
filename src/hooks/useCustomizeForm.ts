import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { TOTAL_STEPS } from "@/lib/customize-constants";
import { generateImage } from "@/services/imageGeneration";
import { createOrder } from "@/services/orderCreation";
import { UseCustomizeFormState, Material } from "@/types/customize";

export const useCustomizeForm = () => {
  const navigate = useNavigate();
  
  // Initialize all state
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedType, setSelectedType] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [selectedDetail, setSelectedDetail] = useState("");
  const [newMaterialName, setNewMaterialName] = useState("");
  const [materials, setMaterials] = useState<Material[]>([
    { id: "cotton", name: "면", description: "부드럽고 통기성이 좋은 천연 소재" },
    { id: "denim", name: "데님", description: "튼튼하고 클래식한 청바지 소재" },
    { id: "poly", name: "폴리", description: "구김이 적고 관리가 쉬운 소재" },
    { id: "linen", name: "린넨", description: "시원하고 자연스러운 질감의 소재" },
  ]);
  const [selectedStyle, setSelectedStyle] = useState("");
  const [selectedPocket, setSelectedPocket] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedFit, setSelectedFit] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [customMeasurements, setCustomMeasurements] = useState<Record<string, number>>({});

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
      setImageLoading(true);
      setGeneratedImageUrl(null); // 새로운 이미지 생성 시 기존 이미지 제거
      await new Promise(resolve => setTimeout(resolve, 2000)); // 임시로 로딩 표시를 위한 지연
      // 실제 이미지 생성 로직은 주석 처리
      // const imageUrl = await generateImage(
      //   selectedType,
      //   selectedMaterial,
      //   selectedStyle,
      //   selectedColor,
      //   selectedPocket,
      //   selectedDetail,
      //   materials
      // );
      // setGeneratedImageUrl(imageUrl);
    } catch (err) {
      toast({
        title: "이미지 생성 실패",
        description: "이미지 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setImageLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    try {
      setIsLoading(true);
      const success = await createOrder(
        selectedType,
        selectedMaterial,
        selectedStyle,
        selectedPocket,
        selectedColor,
        selectedDetail,
        selectedSize,
        customMeasurements,
        generatedImageUrl,
        materials
      );
      
      if (success) {
        navigate("/orders");
      }
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

  return {
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
    selectedSize,
    setSelectedSize,
    customMeasurements,
    setCustomMeasurements,
    handleAddMaterial,
    handleGenerateImage,
    handleNext,
    handleBack,
  };
};
