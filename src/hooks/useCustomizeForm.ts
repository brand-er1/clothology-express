import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { TOTAL_STEPS } from "@/lib/customize-constants";
import { generateImage, storeSelectedImage } from "@/services/imageGeneration";
import { createOrder } from "@/services/orderCreation";
import { UseCustomizeFormState, Material, SizeTableItem } from "@/types/customize";

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
  const [selectedTexture, setSelectedTexture] = useState("");
  const [selectedElasticity, setSelectedElasticity] = useState("");
  const [selectedTransparency, setSelectedTransparency] = useState("");
  const [selectedThickness, setSelectedThickness] = useState("");
  const [selectedSeason, setSelectedSeason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImageUrls, setGeneratedImageUrls] = useState<string[] | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(-1);
  const [storedImageUrl, setStoredImageUrl] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState("");
  const [customMeasurements, setCustomMeasurements] = useState<Record<string, number>>({});
  const [imageLoading, setImageLoading] = useState(false);
  const [sizeTableData, setSizeTableData] = useState<SizeTableItem[]>([]);
  const [storingImageInProgress, setStoringImageInProgress] = useState(false);

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
        if (!generatedImageUrls || generatedImageUrls.length === 0) {
          toast({
            title: "이미지 필요",
            description: "이미지를 생성해주세요.",
            variant: "destructive",
          });
          return false;
        }
        if (selectedImageIndex === -1) {
          toast({
            title: "이미지 선택 필요",
            description: "생성된 이미지 중 하나를 선택해주세요.",
            variant: "destructive",
          });
          return false;
        }
        break;
      case 5:
        if (!selectedSize && sizeTableData.length === 0) {
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
      // Create a readable ID based on the material name
      const newId = `custom-${newMaterialName.trim().toLowerCase().replace(/\s+/g, '-')}`;
      
      const newMaterial = {
        id: newId,
        name: newMaterialName.trim(),
        description: "사용자 지정 원단",
        isCustom: true,
      };
      
      setMaterials([...materials, newMaterial]);
      setSelectedMaterial(newId);
      setNewMaterialName("");
    }
  };

  const handleGenerateImage = async () => {
    try {
      setImageLoading(true);
      // Reset selection when generating new images
      setSelectedImageIndex(-1);
      setStoredImageUrl(null);
      setImagePath(null);
      
      const result = await generateImage(
        selectedType,
        selectedMaterial,
        selectedDetail,
        materials,
        selectedStyle,
        selectedPocket,
        selectedColor,
        selectedFit,
        false // Don't save as draft yet until user selects an image
      );
      
      if (result) {
        setGeneratedImageUrls(result.imageUrls);
        setGeneratedPrompt(result.optimizedPrompt || "");
      }
    } catch (err) {
      // Error is already handled in generateImage
    } finally {
      setImageLoading(false);
    }
  };

  const handleSelectImage = async (index: number) => {
    if (!generatedImageUrls || index >= generatedImageUrls.length) return;
    
    // 이미 선택된 이미지를 다시 클릭하는 경우 또는 현재 저장 작업이 진행 중인 경우 무시
    if (index === selectedImageIndex && storedImageUrl) return;
    if (storingImageInProgress) return;
    
    // 즉시 UI에 선택 상태 반영
    setSelectedImageIndex(index);
    
    try {
      // 이미지 저장 작업 시작 표시
      setStoringImageInProgress(true);
      
      const selectedImageUrl = generatedImageUrls[index];
      
      // 백그라운드에서 저장 작업 진행 (사용자는 UI 차단없이 계속 사용 가능)
      const result = await storeSelectedImage(
        selectedType,
        selectedMaterial,
        selectedDetail,
        selectedImageUrl,
        generatedImageUrls,
        index,
        generatedPrompt,
        materials,
        true // Save as draft when user selects an image
      );
      
      if (result) {
        setStoredImageUrl(result.storedImageUrl);
        setImagePath(result.imagePath);
      }
    } catch (err) {
      console.error("Error selecting image:", err);
      // UI에는 선택이 반영되어 있으므로 오류 메시지만 표시
      toast({
        title: "이미지 저장 실패",
        description: "백그라운드에서 이미지 저장 중 오류가 발생했습니다. 다음 단계에서 다시 시도하거나 도움을 요청하세요.",
        variant: "destructive",
      });
    } finally {
      setStoringImageInProgress(false);
    }
  };

  const handleCreateOrder = async () => {
    try {
      setIsLoading(true);
      
      if (selectedImageIndex === -1 || !generatedImageUrls) {
        toast({
          title: "이미지 선택 필요",
          description: "주문하기 전에 이미지를 선택해주세요.",
          variant: "destructive",
        });
        return;
      }
      
      const selectedImageUrl = generatedImageUrls[selectedImageIndex];
      
      console.log("Order data:", {
        selectedType,
        selectedMaterial,
        selectedDetail,
        selectedStyle,
        selectedPocket,
        selectedColor,
        selectedFit,
        selectedSize,
        customMeasurements,
        storedImageUrl,
        selectedImageUrl,
        imagePath,
        materials,
        sizeTableData
      });

      // If no size is selected, use default size 'M'
      const finalSize = selectedSize || "M";
      
      const result = await createOrder(
        selectedType,
        selectedMaterial,
        selectedDetail,
        finalSize,
        customMeasurements,
        storedImageUrl || selectedImageUrl, // Prefer stored URL if available
        imagePath, // Include the storage path
        materials,
        sizeTableData // Pass the edited size measurements directly
      );
      
      if (result && result.redirectToConfirmation) {
        navigate("/order-confirmation");
      } else if (result && result.success) {
        navigate("/orders");
      }
    } catch (error) {
      console.error("Error creating order:", error);
      toast({
        title: "주문 실패",
        description: "주문 생성 중 오류가 발생했습니다.",
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
  
  const handleSizeTableChange = (updatedItem: SizeTableItem) => {
    setSizeTableData(prev => {
      // Check if the item already exists in the array
      const itemIndex = prev.findIndex(item => item.key === updatedItem.key);
      
      if (itemIndex >= 0) {
        // Update existing item
        const newData = [...prev];
        newData[itemIndex] = updatedItem;
        return newData;
      } else {
        // Add new item
        return [...prev, updatedItem];
      }
    });
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
    isLoading,
    imageLoading,
    generatedImageUrls,
    selectedImageIndex,
    storedImageUrl,
    imagePath,
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
  };
};
