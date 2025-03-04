
import { toast } from "@/components/ui/use-toast";
import { clothTypes } from "@/lib/customize-constants";
import { Material } from "@/types/customize";
import { createDraftOrder } from "./orderCreation";
import { generateClothingImage } from "./imageGenService";

/**
 * Main image generation function that maintains backward compatibility
 * with existing code while delegating to more focused components
 */
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
    // Generate the clothing image using the refactored service
    const result = await generateClothingImage(
      selectedType,
      selectedMaterial,
      selectedStyle,
      selectedColor,
      selectedPocket,
      selectedDetail,
      selectedFit,
      materials
    );
    
    if (!result) {
      return null;
    }

    const { imageUrl, storedImageUrl, imagePath, prompt } = result;

    // Save as draft order if requested
    if (saveAsDraft) {
      // Use the createDraftOrder function to save the draft - ALWAYS use storage URL if available
      await createDraftOrder(
        selectedType,
        selectedMaterial,
        selectedStyle,
        selectedPocket,
        selectedColor,
        selectedDetail,
        selectedFit,
        storedImageUrl || imageUrl, // Use the stored URL if available, otherwise fallback to the generated URL
        imagePath, // Also pass the image path for future reference
        materials
      );
    }

    return result;
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
