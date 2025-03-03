
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
  materials: { id: string; name: string }[]
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
      throw new Error(`이미지 생성 오류: ${generationError.message}`);
    }

    if (!generationData || !generationData.imageUrl) {
      throw new Error("이미지 생성에 실패했습니다");
    }

    // If image generation is successful, try to store it
    let storedImageUrl = null;
    let imagePath = null;

    try {
      // Store the generated image in Supabase Storage
      const { data: storageData, error: storageError } = await supabase.functions.invoke('store-generated-image', {
        body: { imageUrl: generationData.imageUrl }
      });

      if (storageError) {
        console.error("Image storage error:", storageError);
        // Log error but continue with temporary URL
        toast({
          title: "이미지 저장 오류",
          description: "생성된 이미지를 저장하는데 오류가 발생했습니다. 일시적인 링크가 사용됩니다.",
          variant: "destructive",
        });
      } else if (storageData) {
        storedImageUrl = storageData.storedImageUrl;
        imagePath = storageData.path;
      }
    } catch (storageErr) {
      console.error("Error storing image:", storageErr);
      // Continue with temporary URL if storage fails
    }

    toast({
      title: "이미지 생성 완료",
      description: "AI가 생성한 이미지가 준비되었습니다.",
    });

    return {
      imageUrl: generationData.imageUrl, // Original URL (temporary)
      prompt: generationData.optimizedPrompt || prompt,
      storedImageUrl: storedImageUrl, // Permanent storage URL (may be null)
      imagePath: imagePath // Path in storage (may be null)
    };
    
  } catch (err: any) {
    console.error("Image generation failed:", err);
    toast({
      title: "오류",
      description: err.message || "이미지 생성에 실패했습니다. 다시 시도해주세요.",
      variant: "destructive",
    });
    throw err;
  }
};
