import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { clothTypes } from "@/lib/customize-constants";
import { Material } from "@/types/customize";
import { buildGenerationPrompt, formatDetailDescription } from "@/utils/promptUtils";
import { storeGeneratedImage, saveImageMetadata } from "@/utils/imageUtils";

/**
 * Generates an AI image of clothing based on user selections
 */
export const generateClothingImage = async (
  selectedType: string,
  selectedMaterial: string,
  selectedStyle: string,
  selectedColor: string,
  selectedPocket: string,
  selectedDetail: string,
  selectedFit: string,
  materials: Material[],
): Promise<{
  imageUrl: string | null;
  storedImageUrl: string | null;
  imagePath: string | null;
  prompt: string;
} | null> => {
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
    const prompt = buildGenerationPrompt(
      selectedType,
      selectedMaterial,
      selectedStyle,
      selectedColor,
      selectedPocket,
      selectedDetail,
      selectedFit,
      materials
    );

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
    
    if (!imageUrl) {
      console.error("No image URL returned from generation");
      toast({
        title: "이미지 생성 실패",
        description: "이미지 URL을 받지 못했습니다.",
        variant: "destructive",
      });
      return null;
    }
    
    // Default values for storage results
    let storedImageUrl = null;
    let imagePath = null;

    // Store the generated image in Supabase Storage
    const selectedClothType = clothTypes.find(type => type.id === selectedType)?.name || selectedType;
    const storageResult = await storeGeneratedImage(imageUrl, user.id, selectedClothType);
    
    if (storageResult.success) {
      storedImageUrl = storageResult.storedImageUrl;
      imagePath = storageResult.imagePath;
    }

    // Create a formatted description with the selections
    const detailDesc = formatDetailDescription(
      selectedDetail,
      selectedStyle,
      selectedPocket,
      selectedColor,
      selectedFit
    );

    // Find material name for metadata
    const selectedMaterialObj = materials.find(material => material.id === selectedMaterial);
    const selectedMaterialName = selectedMaterialObj?.name || selectedMaterial;

    // Store image information in the database
    if (imageUrl && user.id) {
      await saveImageMetadata(
        user.id,
        imageUrl,
        storedImageUrl,
        imagePath,
        prompt,
        selectedClothType,
        selectedMaterialName,
        detailDesc
      );
    }

    // Return all URLs and path for potential use
    return {
      imageUrl, // Original URL from generation
      storedImageUrl, // URL from storage (preferred)
      imagePath, // Path in storage
      prompt, // The prompt used
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
