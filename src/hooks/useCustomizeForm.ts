import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { TOTAL_STEPS, clothTypes, colorOptions, fitOptions } from "@/lib/customize-constants";
import { generateImage, storeSelectedImage } from "@/services/imageGeneration";
import { createFundingDraft } from "@/services/funding";
import { createDirectProductionRequest } from "@/services/orderCreation";
import { analyzeProductionEstimate } from "@/services/productionEstimate";
import type {
  ArtworkPlacement,
  ArtworkReference,
  CompositedImageReference,
  ImageModificationEntry,
  Material,
  SizeTableItem,
} from "@/types/customize";
import {
  createFundingSizeMeasurements,
  type ProductionSizeSelection,
} from "@/lib/production-size-guide";
import type {
  ProductionEstimateResult,
  UploadedArtworkAnalysis,
} from "@/types/productionEstimate";
import { supabase } from "@/lib/supabase";
import { screenTrademarkImage } from "@/services/trademarkScreening";

interface ModifyImageOptions {
  referenceImage?: ArtworkReference;
  placement?: ArtworkPlacement;
  compositedImage?: CompositedImageReference;
}

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
    { id: "leather", name: "레더", description: "고급스럽고 구조감이 있는 가죽 소재" },
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
  const [productionSizeSelection, setProductionSizeSelection] =
    useState<ProductionSizeSelection | null>(null);
  const [directQuantity, setDirectQuantity] = useState(20);
  
  // New state for image modification
  const [imageModifying, setImageModifying] = useState(false);
  const [modificationHistory, setModificationHistory] = useState<ImageModificationEntry[]>([]);
  const [activeHistory, setActiveHistory] = useState<ImageModificationEntry[]>([]);
  const [currentModifiedImageUrl, setCurrentModifiedImageUrl] = useState<string | null>(null);
  const [currentArtworkAnalysis, setCurrentArtworkAnalysis] =
    useState<UploadedArtworkAnalysis | null>(null);
  const [currentArtworkScreeningId, setCurrentArtworkScreeningId] =
    useState<string | null>(null);
  const [lastFinalScreeningId, setLastFinalScreeningId] =
    useState<string | null>(null);
  const [currentProductionEstimate, setCurrentProductionEstimate] =
    useState<ProductionEstimateResult | null>(null);

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
        break;
      case 5:
        // No validation for modification step - it's optional
        break;
      case 6:
        if (!productionSizeSelection?.selectedSizes.length) {
          toast({
            title: "사이즈 필요",
            description: "생산할 사이즈를 한 개 이상 선택해주세요.",
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
      setCurrentModifiedImageUrl(null);
      setModificationHistory([]);
      setActiveHistory([]);
      setCurrentArtworkAnalysis(null);
      setCurrentArtworkScreeningId(null);
      setLastFinalScreeningId(null);
      setCurrentProductionEstimate(null);
      
      const result = await generateImage(
        selectedType,
        selectedMaterial,
        selectedDetail,
        materials,
        selectedStyle,
        selectedPocket,
        selectedColor,
        selectedFit,
        selectedTexture,
        selectedElasticity,
        selectedTransparency,
        selectedThickness,
        selectedSeason,
        false
      );
      
      if (result) {
        setGeneratedImageUrls(result.imageUrls);
        setStoredImageUrls(result.storedImageUrls);
        setImagePaths(result.imagePaths);
        setGeneratedPrompt(result.optimizedPrompt || "");
        setSelectedImageIndex(0);
        if (result.storedImageUrls?.[0]) {
          setStoredImageUrl(result.storedImageUrls[0]);
          setCurrentModifiedImageUrl(result.storedImageUrls[0]);
        } else if (result.imageUrls?.[0]) {
          setCurrentModifiedImageUrl(result.imageUrls[0]);
        }
        // 생성 직후 수정 단계로 이동
        setCurrentStep(5);
      }
    } catch (err) {
      console.error("Error generating images:", err);
    } finally {
      setImageLoading(false);
    }
  };

  const handleSelectImage = (_index: number) => {
    // Selection disabled; we auto-use the first/only image.
    return;
  };

  const handleModifyImage = async (
    prompt: string,
    options: ModifyImageOptions = {},
  ) => {
    try {
      setImageModifying(true);
      setCurrentProductionEstimate(null);
      
      const imageUrlToModify = currentModifiedImageUrl || 
        (storedImageUrls && selectedImageIndex >= 0 ? 
          storedImageUrls[selectedImageIndex] : 
          (generatedImageUrls && selectedImageIndex >= 0 ? 
            generatedImageUrls[selectedImageIndex] : null));
      
      if (!imageUrlToModify) {
        toast({
          title: "이미지 필요",
          description: "수정할 이미지가 없습니다.",
          variant: "destructive",
        });
        return false;
      }
      
      // Get current user
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      
      if (!user) {
        toast({
          title: "로그인 필요",
          description: "이미지를 수정하려면 로그인해주세요.",
          variant: "destructive",
        });
        return false;
      }
      
      // Find material name
      const selectedMaterialObj = materials.find(material => material.id === selectedMaterial);
      const selectedMaterialName = selectedMaterialObj?.name || selectedMaterial;
      
      // Call the edge function
      const { data: modificationData, error: modificationError } = await supabase.functions.invoke(
        'modify-generated-image',
        {
          body: { 
            imageUrl: imageUrlToModify,
            modificationPrompt: prompt,
            userId: user.id,
            clothType: selectedType,
            originalPrompt: `${selectedMaterialName} ${selectedType}, ${selectedDetail}`,
            referenceImage: options.referenceImage,
            compositedImage: options.compositedImage,
            artworkLocation: options.placement?.location,
            artworkSize: options.placement?.size,
            artworkPosition: options.placement
              ? {
                  xPercent: options.placement.xPercent,
                  yPercent: options.placement.yPercent,
                  widthPercent: options.placement.widthPercent,
                }
              : undefined,
          }
        }
      );
      
      if (modificationError) {
        console.error("Image modification error:", modificationError);
        toast({
          title: "이미지 수정 실패",
          description: "이미지를 수정하는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
        return false;
      }
      
      console.log("Modification result:", modificationData);
      
      const newImageUrl = modificationData?.modifiedImageUrl || currentModifiedImageUrl;
      const newImagePath = modificationData?.modifiedImagePath || imagePath;
      const textResponse = modificationData?.textResponse || "이미지가 수정되었습니다.";
      const artworkAnalysis =
        (modificationData?.artworkAnalysis as
          | UploadedArtworkAnalysis
          | undefined) || currentArtworkAnalysis;

      if (newImageUrl) {
        setCurrentModifiedImageUrl(newImageUrl);
        setStoredImageUrl(newImageUrl);
      }
      if (newImagePath) {
        setImagePath(newImagePath);
      }
      setCurrentArtworkAnalysis(artworkAnalysis);
      
      const newEntry: ImageModificationEntry = {
        prompt,
        response: textResponse,
        imageUrl: newImageUrl || null,
        imagePath: newImagePath || null,
        artworkAnalysis,
      };

      setModificationHistory(prev => [...prev, newEntry]);

      // Build active path based on currently selected path (or full history if none)
      setActiveHistory(prev => {
        const basePath = prev.length ? prev : modificationHistory;
        return [...basePath.slice(0, basePath.length), newEntry];
      });
      
      toast({
        title: options.compositedImage
          ? "선택한 위치에 적용 완료"
          : "이미지 수정 완료",
        description: options.compositedImage
          ? "미리보기에서 지정한 위치와 크기를 그대로 반영했습니다."
          : "수정된 결과가 아래 챗창에 반영되었습니다.",
      });
      return true;
      
    } catch (err) {
      console.error("Error modifying image:", err);
      toast({
        title: "이미지 수정 실패",
        description: "이미지를 수정하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      return false;
    } finally {
      setImageModifying(false);
    }
  };
  
  const handleResetModifications = () => {
    // Reset to original selected image
    if (storedImageUrls && selectedImageIndex >= 0) {
      setCurrentModifiedImageUrl(storedImageUrls[selectedImageIndex]);
    }
    setModificationHistory([]);
    setActiveHistory([]);
    setCurrentArtworkAnalysis(null);
    setCurrentArtworkScreeningId(null);
    setCurrentProductionEstimate(null);
    toast({
      title: "수정 내역 초기화",
      description: "이미지가 원래 상태로 복원되었습니다.",
    });
  };

  const handleSelectHistoryImage = (imageUrl: string | null, imagePath?: string | null, index?: number) => {
    if (!imageUrl) return;
    if (typeof index === "number" && index >= 0) {
      setActiveHistory(modificationHistory.slice(0, index + 1));
      setCurrentArtworkAnalysis(
        modificationHistory[index]?.artworkAnalysis || null,
      );
    }
    setCurrentModifiedImageUrl(imageUrl);
    setStoredImageUrl(imageUrl);
    setCurrentProductionEstimate(null);
    if (imagePath) {
      setImagePath(imagePath);
    }
  };

  const handleCreateFunding = async () => {
    try {
      setIsLoading(true);
      
      if (!generatedImageUrls || generatedImageUrls.length === 0) {
        toast({
          title: "이미지 선택 필요",
          description: "펀딩을 만들기 전에 이미지를 생성해주세요.",
          variant: "destructive",
        });
        return;
      }
      
      const selectedImageUrl = currentModifiedImageUrl || generatedImageUrls[selectedImageIndex >= 0 ? selectedImageIndex : 0];
      
      let finalImageUrl = selectedImageUrl;
      let finalImagePath = imagePath;
      const selectedIdx = selectedImageIndex >= 0 ? selectedImageIndex : 0;
      
      try {
        console.log("Storing selected image before creating order...");
        
        const imageResult = await storeSelectedImage(
          selectedType,
          selectedMaterial,
          selectedDetail,
          selectedImageUrl,
          currentModifiedImageUrl || storedImageUrl,
          imagePath,
          generatedImageUrls,
          storedImageUrls,
          imagePaths,
          selectedIdx,
          generatedPrompt,
          materials,
          true,
          modificationHistory
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
      
      console.log("Funding data:", {
        selectedType,
        selectedMaterial,
        selectedDetail,
        selectedStyle,
        selectedPocket,
        selectedColor,
        selectedFit,
        selectedSize,
        productionSizeSelection,
        customMeasurements,
        finalImageUrl,
        finalImagePath,
        materials,
        sizeTableData
      });

      if (!finalImageUrl) {
        throw new Error("펀딩에 사용할 이미지 URL이 없습니다.");
      }

      const trademarkScreening = await screenTrademarkImage({
        imageUrl: finalImageUrl,
        source: "final_design",
        selectedType,
        selectedMaterial,
        parentScreeningId: currentArtworkScreeningId,
        previousScreeningId: lastFinalScreeningId,
      });
      setLastFinalScreeningId(trademarkScreening.id);
      if (trademarkScreening.decision === "blocked") {
        toast({
          title: "펀딩 등록이 거절되었습니다",
          description:
            "최종 이미지에서 유명 타사 상표 또는 매우 유사한 로고가 감지되었습니다. 해당 요소를 제거한 뒤 다시 시도해주세요.",
          variant: "destructive",
        });
        return;
      }

      const finalSizeOptions = productionSizeSelection?.selectedSizes.length
        ? productionSizeSelection.selectedSizes
        : [selectedSize || "M"];
      const finalSize = finalSizeOptions[0];
      const clothTypeName = clothTypes.find((type) => type.id === selectedType)?.name || selectedType;
      const materialName = materials.find((material) => material.id === selectedMaterial)?.name || selectedMaterial;
      const colorName = colorOptions.find((color) => color.value === selectedColor)?.label || selectedColor;
      const fitName = fitOptions.find((fit) => fit.value === selectedFit)?.label || selectedFit;
      const productName = [colorName, clothTypeName].filter(Boolean).join(" ");
      const measurements = productionSizeSelection
        ? createFundingSizeMeasurements(productionSizeSelection)
        : sizeTableData.length > 0
          ? sizeTableData.reduce<Record<string, string | number>>((result, item) => {
              result[item.key] = item.value;
              return result;
            }, {})
          : Object.keys(customMeasurements).length > 0
            ? customMeasurements
            : null;
      const description = [
        `${productName || clothTypeName} 디자인입니다. 목표 인원이 모이면 브랜더가 실제 제품으로 제작합니다.`,
        selectedDetail ? `디자인 특징: ${selectedDetail}` : "",
        fitName ? `핏: ${fitName}` : "",
        `소재: ${materialName}`,
      ].filter(Boolean).join("\n");

      let productionEstimate = currentProductionEstimate;
      if (!productionEstimate) {
        try {
          productionEstimate = await analyzeProductionEstimate({
            imageUrl: finalImageUrl,
            selectedType,
            selectedMaterial,
            designContext: [generatedPrompt, selectedDetail]
              .filter(Boolean)
              .join("\n"),
            uploadedArtwork: currentArtworkAnalysis,
          });
        } catch (estimateError) {
          console.error("Funding estimate analysis error:", estimateError);
        }
      }

      const funding = await createFundingDraft({
        productName: productName || clothTypeName,
        clothType: clothTypeName,
        material: materialName,
        color: colorName,
        size: finalSize,
        sizeOptions: finalSizeOptions,
        measurements,
        imageUrl: finalImageUrl,
        imagePath: finalImagePath,
        description,
        estimateDirectUnitMin:
          productionEstimate?.totals.directUnitMin ?? null,
        estimateDirectUnitMax:
          productionEstimate?.totals.directUnitMax ?? null,
        estimateDevelopmentTotal:
          productionEstimate?.totals.developmentTotal ?? null,
        trademarkScreeningId: trademarkScreening.id,
      });

      toast({
        title:
          trademarkScreening.decision === "review"
            ? "펀딩이 상표 검토 대기로 등록되었습니다"
            : "펀딩 페이지가 만들어졌습니다",
        description:
          trademarkScreening.decision === "review"
            ? "감지된 상표의 권리 관계를 관리자가 확인한 뒤 승인 또는 거절합니다."
            : "MOQ 20장·관리자 승인 대기 상태로 자동 등록했습니다.",
      });
      navigate(`/fundings/${funding.id}/edit`);
    } catch (error) {
      console.error("Error creating funding:", error);
      toast({
        title: "펀딩 생성 실패",
        description: "펀딩 페이지를 만드는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDirectRequest = async () => {
    try {
      setIsLoading(true);

      if (!generatedImageUrls || generatedImageUrls.length === 0) {
        toast({
          title: "이미지 선택 필요",
          description: "제작을 의뢰하기 전에 이미지를 생성해주세요.",
          variant: "destructive",
        });
        return;
      }

      if (directQuantity < 20) {
        toast({
          title: "최소 제작 수량을 확인해주세요",
          description: "바로 제작 의뢰는 총 20장부터 접수할 수 있습니다.",
          variant: "destructive",
        });
        return;
      }

      const selectedImageUrl =
        currentModifiedImageUrl ||
        generatedImageUrls[selectedImageIndex >= 0 ? selectedImageIndex : 0];
      let finalImageUrl = selectedImageUrl;
      let finalImagePath = imagePath;
      const selectedIdx = selectedImageIndex >= 0 ? selectedImageIndex : 0;

      try {
        const imageResult = await storeSelectedImage(
          selectedType,
          selectedMaterial,
          selectedDetail,
          selectedImageUrl,
          currentModifiedImageUrl || storedImageUrl,
          imagePath,
          generatedImageUrls,
          storedImageUrls,
          imagePaths,
          selectedIdx,
          generatedPrompt,
          materials,
          true,
          modificationHistory,
        );

        if (imageResult) {
          finalImageUrl = imageResult.storedImageUrl || selectedImageUrl;
          finalImagePath = imageResult.imagePath;
        }
      } catch (imageError) {
        console.error("Error storing direct request image:", imageError);
      }

      if (!finalImageUrl) {
        throw new Error("제작 의뢰에 사용할 이미지 URL이 없습니다.");
      }

      const trademarkScreening = await screenTrademarkImage({
        imageUrl: finalImageUrl,
        source: "final_design",
        selectedType,
        selectedMaterial,
        parentScreeningId: currentArtworkScreeningId,
        previousScreeningId: lastFinalScreeningId,
      });
      setLastFinalScreeningId(trademarkScreening.id);

      if (trademarkScreening.decision === "blocked") {
        toast({
          title: "제작 의뢰가 거절되었습니다",
          description:
            "최종 이미지에서 유명 타사 상표 또는 매우 유사한 로고가 감지되었습니다. 해당 요소를 제거한 뒤 다시 시도해주세요.",
          variant: "destructive",
        });
        return;
      }

      const finalSizeOptions = productionSizeSelection?.selectedSizes.length
        ? productionSizeSelection.selectedSizes
        : [selectedSize || "M"];
      const clothTypeName =
        clothTypes.find((type) => type.id === selectedType)?.name || selectedType;
      const materialName =
        materials.find((material) => material.id === selectedMaterial)?.name ||
        selectedMaterial;
      const colorName =
        colorOptions.find((color) => color.value === selectedColor)?.label ||
        selectedColor;
      const fitName =
        fitOptions.find((fit) => fit.value === selectedFit)?.label || selectedFit;

      let productionEstimate = currentProductionEstimate;
      if (!productionEstimate) {
        try {
          productionEstimate = await analyzeProductionEstimate({
            imageUrl: finalImageUrl,
            selectedType,
            selectedMaterial,
            designContext: [generatedPrompt, selectedDetail]
              .filter(Boolean)
              .join("\n"),
            uploadedArtwork: currentArtworkAnalysis,
          });
        } catch (estimateError) {
          console.error("Direct request estimate analysis error:", estimateError);
        }
      }

      const formatWon = (amount?: number | null) =>
        typeof amount === "number"
          ? `${Math.round(amount).toLocaleString("ko-KR")}원`
          : "분석 후 안내";
      const directUnitRange = productionEstimate
        ? `${formatWon(productionEstimate.totals.directUnitMin)} ~ ${formatWon(
            productionEstimate.totals.directUnitMax,
          )}`
        : "상담 후 안내";
      const developmentTotal = productionEstimate
        ? formatWon(productionEstimate.totals.developmentTotal)
        : "상담 후 안내";
      const detailDescription = [
        "의뢰 방식: 바로 제작",
        `제작 희망 수량: ${directQuantity}장`,
        colorName ? `컬러: ${colorName}` : "",
        fitName ? `핏: ${fitName}` : "",
        selectedDetail ? `디자인 특징: ${selectedDetail}` : "",
        `자동 견적 장당 변동비: ${directUnitRange}`,
        `자동 견적 1회 개발비: ${developmentTotal}`,
        trademarkScreening.decision === "review"
          ? "상표 분석: 관리자 추가 확인 필요"
          : "상표 분석: 자동 확인 완료",
      ]
        .filter(Boolean)
        .join("\n");

      await createDirectProductionRequest({
        clothType: clothTypeName,
        material: materialName,
        detailDescription,
        size: finalSizeOptions.join(", "),
        measurements: {
          "제작 수량": `${directQuantity}장`,
          "선택 사이즈": finalSizeOptions.join(", "),
          "사이즈 기준": productionSizeSelection
            ? `${productionSizeSelection.gender} · ${productionSizeSelection.category}`
            : "기본 사이즈",
          "예상 장당 변동비": directUnitRange,
          "예상 1회 개발비": developmentTotal,
        },
        generatedImageUrl: finalImageUrl,
        imagePath: finalImagePath,
      });

      toast({
        title: "바로 제작 의뢰가 접수되었습니다",
        description:
          trademarkScreening.decision === "review"
            ? "관리자가 상표와 제작 사양을 확인한 뒤 연락드립니다."
            : "관리자가 제작 사양과 견적을 확인한 뒤 연락드립니다.",
      });
      navigate("/orders?submitted=1");
    } catch (error) {
      console.error("Error creating direct production request:", error);
      toast({
        title: "제작 의뢰 접수 실패",
        description:
          error instanceof Error
            ? error.message
            : "제작 의뢰를 접수하는 중 오류가 발생했습니다.",
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

  const handleProductionSizeChange = useCallback(
    (selection: ProductionSizeSelection) => {
      setProductionSizeSelection(selection);
      setSelectedSize(selection.selectedSizes[0] || "");
    },
    [],
  );

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
    productionSizeSelection,
    handleProductionSizeChange,
    directQuantity,
    setDirectQuantity,
    handleAddMaterial,
    handleGenerateImage,
    handleSelectImage,
    handleNext,
    handleBack,
    handleCreateFunding,
    handleCreateDirectRequest,
    imageModifying,
    modificationHistory,
    currentModifiedImageUrl,
    currentArtworkAnalysis,
    setCurrentArtworkScreeningId,
    currentProductionEstimate,
    setCurrentProductionEstimate,
    handleModifyImage,
    handleResetModifications,
    handleSelectHistoryImage,
  };
};
