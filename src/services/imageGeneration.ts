
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { clothTypes, styleOptions, colorOptions, pocketOptions } from "@/lib/customize-constants";

export const generateImage = async (
  selectedType: string,
  selectedMaterial: string,
  selectedStyle: string,
  selectedColor: string,
  selectedPocket: string,
  selectedDetail: string,
  materials: { id: string; name: string }[],
  saveProgress: boolean = false
) => {
  try {
    const selectedClothType = clothTypes.find(type => type.id === selectedType)?.name || "";
    const selectedMaterialName = materials.find(material => material.id === selectedMaterial)?.name || "";
    
    const optionalDetails = [
      selectedStyle && `Style: ${styleOptions.find(style => style.value === selectedStyle)?.label}`,
      selectedColor && `Color: ${colorOptions.find(color => color.value === selectedColor)?.label}`,
      selectedPocket && `Pockets: ${pocketOptions.find(pocket => pocket.value === selectedPocket)?.label}`,
      selectedDetail && `Additional details: ${selectedDetail}`
    ].filter(Boolean).join('\n');
    
    const prompt = [
      `Create a detailed fashion design for a ${selectedClothType.toLowerCase()}.`,
      `Material: ${selectedMaterialName}`,
      optionalDetails
    ].filter(Boolean).join('\n');

    console.log('Generated prompt:', prompt);

    // Generate the image
    const { data: generationData, error: generationError } = await supabase.functions.invoke('generate-optimized-image', {
      body: { prompt }
    });

    if (generationError) {
      throw new Error(generationError.message);
    }

    if (!generationData || !generationData.imageUrl) {
      throw new Error("이미지 생성에 실패했습니다");
    }

    // Store the generated image in Supabase Storage
    const { data: storageData, error: storageError } = await supabase.functions.invoke('store-generated-image', {
      body: { imageUrl: generationData.imageUrl }
    });

    if (storageError) {
      console.error("Image storage error:", storageError);
      // Still return the original image URL if storage fails
      toast({
        title: "이미지 저장 오류",
        description: "생성된 이미지를 저장하는데 오류가 발생했습니다. 일시적인 링크가 사용됩니다.",
        variant: "destructive",
      });
      
      return {
        imageUrl: generationData.imageUrl,
        prompt: generationData.optimizedPrompt || prompt,
        storedImageUrl: null
      };
    }

    // 중요: Supabase Storage에서 공개 URL을 가져옵니다
    let finalImageUrl = generationData.imageUrl;
    if (storageData && storageData.path) {
      const { data: publicUrlData } = await supabase.storage
        .from('generated_images')  // 수정: 하이픈(-) 대신 언더스코어(_) 사용
        .getPublicUrl(storageData.path);
      
      if (publicUrlData && publicUrlData.publicUrl) {
        finalImageUrl = publicUrlData.publicUrl;
        console.log("Using storage public URL:", finalImageUrl);
      }
    }

    // If saveProgress is true, save the current progress as a draft order
    if (saveProgress) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        
        if (user) {
          const selectedStyleName = styleOptions.find(style => style.value === selectedStyle)?.label;
          const selectedPocketName = pocketOptions.find(pocket => pocket.value === selectedPocket)?.label;
          const selectedColorName = colorOptions.find(color => color.value === selectedColor)?.label;
          
          await supabase.functions.invoke('save-order', {
            body: {
              userId: user.id,
              clothType: selectedClothType,
              material: selectedMaterialName,
              style: selectedStyleName,
              pocketType: selectedPocketName,
              color: selectedColorName,
              detailDescription: selectedDetail,
              size: null,
              measurements: null,
              // 중요: 항상 영구 스토리지 URL 사용
              generatedImageUrl: finalImageUrl,
              imagePath: storageData?.path,
              status: 'draft'
            }
          });
          
          console.log("Progress saved as draft order");
        }
      } catch (error) {
        console.error("Failed to save progress:", error);
        // Don't throw here, as we want to continue with image generation even if saving progress fails
      }
    }

    toast({
      title: "이미지 생성 완료",
      description: "AI가 생성한 이미지가 준비되었습니다.",
    });

    return {
      imageUrl: generationData.imageUrl, // Original URL (temporary)
      prompt: generationData.optimizedPrompt || prompt,
      storedImageUrl: finalImageUrl, // 수정: 영구 스토리지 URL 사용
      imagePath: storageData?.path // Path in storage
    };
    
  } catch (err) {
    console.error("Image generation failed:", err);
    toast({
      title: "오류",
      description: "이미지 생성에 실패했습니다. 다시 시도해주세요.",
      variant: "destructive",
    });
    throw err;
  }
};
