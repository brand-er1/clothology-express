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
    { id: "cotton", name: "면", description: "부드럽고 통기성이 ��은 천연 소재" },
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
  const [storedImageUrls, setStoredImageUrls] = useState<string[] | null>(null);
  const [imagePaths, setImagePaths] = useState<string[] | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(-1);
  const [storedImageUrl, setStoredImageUrl] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState("");
  const [customMeasurements, setCustomMeasurements] = useState<Record<string, number>>({});
  const [imageLoading, setImageLoading] = useState(false);
  const [sizeTableData, setSizeTableData] = useState<SizeTableItem[]>([]);

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
      setSelectedImageIndex(-1);
      setStoredImageUrl(null);
      setImagePath(null);
      setStoredImageUrls(null);
      setImagePaths(null);
      
      const result = await generateImage(
        selectedType,
        selectedMaterial,
        selectedDetail,
        materials,
        selectedStyle,
        selectedPocket,
        selectedColor,
        selectedFit,
        false
      );
      
      if (result) {
        setGeneratedImageUrls(result.imageUrls);
        setStoredImageUrls(result.storedImageUrls);
        setImagePaths(result.imagePaths);
        setGeneratedPrompt(result.optimizedPrompt || "");
      }
    } catch (err) {
      console.error("Error generating images:", err);
    } finally {
      setImageLoading(false);
    }
  };

  const handleSelectImage = (index: number) => {
    if (!generatedImageUrls || index >= generatedImageUrls.length) return;
    
    setSelectedImageIndex(index);
    
    if (storedImageUrls && storedImageUrls[index]) {
      setStoredImageUrl(storedImageUrls[index]);
    } else {
      setStoredImageUrl(null);
    }
    
    if (imagePaths && imagePaths[index]) {
      setImagePath(imagePaths[index]);
    } else {
      setImagePath(null);
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
      
      let finalImageUrl = selectedImageUrl;
      let finalImagePath = null;
      
      try {
        console.log("Storing selected image before creating order...");
        
        const imageResult = await storeSelectedImage(
          selectedType,
          selectedMaterial,
          selectedDetail,
          selectedImageUrl,
          storedImageUrl,
          imagePath,
          generatedImageUrls,
          storedImageUrls,
          imagePaths,
          selectedImageIndex,
          generatedPrompt,
          materials,
          true
        );
        
        if (imageResult) {
          finalImageUrl = imageResult.storedImageUrl || selectedImageUrl;
          finalImagePath = imageResult.imagePath;
          
          console.log("Image stored successfully:", {
            url: finalImageUrl,
            path: finalImagePath
          });
        }
      } catch (imageError) {
        console.error("Error storing selected image:", imageError);
      }
      
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
        finalImageUrl,
        finalImagePath,
        materials,
        sizeTableData
      });

      const finalSize = selectedSize || "M";
      
      const result = await createOrder(
        selectedType,
        selectedMaterial,
        selectedDetail,
        finalSize,
        customMeasurements,
        finalImageUrl,
        finalImagePath,
        materials,
        sizeTableData
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
      const itemIndex = prev.findIndex(item => item.key === updatedItem.key);
      
      if (itemIndex >= 0) {
        const newData = [...prev];
        newData[itemIndex] = updatedItem;
        return newData;
      } else {
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
    storedImageUrls,
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
