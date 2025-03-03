import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { clothTypes, styleOptions, pocketOptions, colorOptions, fitOptions } from "@/lib/customize-constants";
import { Material } from "@/types/customize";
import { createDraftOrder } from "./orderCreation";

export const generateImage = async (
  selectedType: string,
  selectedMaterial: string,
  selectedStyle: string,
  selectedColor: string,
  selectedPocket: string,
  selectedDetail: string,
  selectedFit: string,
  materials: Material[],
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
    
    const selectedStyleName = styleOptions.find(style => style.value === selectedStyle)?.label || selectedStyle;
    const selectedPocketName = pocketOptions.find(pocket => pocket.value === selectedPocket)?.label || selectedPocket;
    const selectedColorName = colorOptions.find(color => color.value === selectedColor)?.label || selectedColor;
    const selectedFitName = fitOptions.find(fit => fit.value === selectedFit)?.label || selectedFit;

    // Construct the generation prompt
    const prompt = `${selectedColorName} ${selectedMaterialName} ${selectedClothType}, ${selectedStyleName} 스타일, ${selectedFitName}, ` +
      (selectedPocket !== 'none' ? `${selectedPocketName}, ` : '') +
      (selectedDetail ? `${selectedDetail}, ` : '') +
      `인체 없는 의류 사진, 고해상도, 프로덕트 이미지`;

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

    // If we have an image URL and save flag is true, store in Supabase Storage
    if (imageUrl && saveAsDraft) {
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
          storedImageUrl = storeData?.storedImageUrl;
          imagePath = storeData?.imagePath;
        }
      } catch (storageError) {
        console.error("Failed to store image:", storageError);
      }
    }

    // Save as draft order if requested
    if (saveAsDraft) {
      // Use the createDraftOrder function to save the draft
      await createDraftOrder(
        selectedType,
        selectedMaterial,
        selectedStyle,
        selectedPocket,
        selectedColor,
        selectedDetail,
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
