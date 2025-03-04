import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { clothTypes } from "@/lib/customize-constants";
import { Material } from "@/types/customize";
import { createDraftOrder } from "./orderCreation";

export const generateImage = async (
  selectedType: string,
  selectedMaterial: string,
  selectedDetail: string,
  materials: Material[],
  selectedStyle: string = "",
  selectedPocket: string = "",
  selectedColor: string = "",
  selectedFit: string = "",
  saveAsDraft: boolean = true,
) => {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    
    if (!user) {
      toast({
        title: "로그인 필요",
        description: "이미지를 생성하려면 로그인해주세요.",
        variant: "destructive",
      });
      return null;
    }

    // Build the prompt based on selections
    const selectedClothType = clothTypes.find(type => type.id === selectedType)?.name || selectedType;
    
    // Find material by ID, including handling custom materials
    const selectedMaterialObj = materials.find(material => material.id === selectedMaterial);
    const selectedMaterialName = selectedMaterialObj?.name || selectedMaterial;
    
    // Construct the generation prompt using only the detail text
    // 이 부분이 중요합니다: selectedDetail을 우선시함
    let prompt;
    
    if (selectedDetail && selectedDetail.trim() !== '') {
      // 상세 설명이 있을 경우 그것을 기반으로 프롬프트 생성
      prompt = `${selectedMaterialName} ${selectedClothType}, ${selectedDetail}, 고해상도, 프로덕트 이미지`;
    } else {
      // 상세 설명이 없을 경우에만 개별 옵션 사용
      prompt = `${selectedMaterialName} ${selectedClothType}, ` +
        (selectedStyle ? `${selectedStyle} 스타일, ` : '') +
        (selectedPocket ? `${selectedPocket} 포켓, ` : '') +
        (selectedColor ? `${selectedColor} 색상, ` : '') +
        (selectedFit ? `${selectedFit} 핏, ` : '') +
        `고해상도, 프로덕트 이미지`;
    }

    console.log("Generation prompt:", prompt);

    // Call the function to generate the image
    const { data: generationData, error: generationError } = await supabase.functions.invoke(
      'generate-optimized-image',
      {
        body: { prompt }
      }
    );

    if (generationError) {
      console.error("Image generation error:", generationError);
      toast({
        title: "이미지 생성 실패",
        description: "이미지를 생성하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      return null;
    }

    console.log("Generation result:", generationData);

    const imageUrl = generationData?.imageUrl;
    let storedImageUrl = null;
    let imagePath = null;

    // If we have an image URL, store in Supabase Storage
    if (imageUrl) {
      try {
        const { data: storeData, error: storeError } = await supabase.functions.invoke(
          'store-generated-image',
          {
            body: { 
              imageUrl,
              userId: user.id,
              clothType: selectedClothType
            }
          }
        );

        if (storeError) {
          console.error("Image storage error:", storeError);
        } else {
          console.log("Image storage result:", storeData);
          // Get the storage URL and path from the response
          storedImageUrl = storeData?.storedImageUrl || null;
          imagePath = storeData?.imagePath || null;
          console.log("Stored image public URL:", storedImageUrl);
        }
      } catch (storageError) {
        console.error("Failed to store image:", storageError);
      }
    }

    // Store image information in the generated_images table
    if (imageUrl && user.id) {
      try {
        // Store image information in the generated_images table
        const { data: imageData, error: imageError } = await supabase.functions.invoke(
          'save-generated-image',
          {
            body: {
              userId: user.id,
              originalImageUrl: imageUrl,
              storedImageUrl: storedImageUrl,
              imagePath: imagePath,
              prompt: prompt,
              clothType: selectedClothType,
              material: selectedMaterialName,
              detail: selectedDetail,
              style: selectedStyle,
              pocket: selectedPocket,
              color: selectedColor,
              fit: selectedFit
            }
          }
        );

        if (imageError) {
          console.error("Failed to save image data:", imageError);
        } else {
          console.log("Image data saved:", imageData);
        }
      } catch (saveError) {
        console.error("Error saving image data:", saveError);
      }
    }

    // Save as draft order if requested
    if (saveAsDraft) {
      // Use the createDraftOrder function to save the draft
      await createDraftOrder(
        selectedType,
        selectedMaterial,
        selectedDetail,
        selectedStyle,
        selectedPocket,
        selectedColor,
        selectedFit,
        storedImageUrl || imageUrl,
        imagePath,
        materials
      );
    }

    return {
      imageUrl,
      storedImageUrl,
      imagePath,
      prompt,
    };
  } catch (error: any) {
    console.error("Image generation error:", error);
    toast({
      title: "이미지 생성 실패",
      description: "이미지를 생성하는 중 예상치 못한 오류가 발생했습니다.",
      variant: "destructive",
    });
    return null;
  }
};
