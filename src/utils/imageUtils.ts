
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";

/**
 * Stores a generated image in Supabase storage
 */
export const storeGeneratedImage = async (
  imageUrl: string, 
  userId: string,
  clothType?: string
): Promise<{
  success: boolean;
  storedImageUrl?: string;
  imagePath?: string;
  message?: string;
}> => {
  try {
    // Call the new Edge Function to store the image
    const { data, error } = await supabase.functions.invoke(
      'store-generated-image2',  // Using the new Edge Function
      {
        body: { 
          imageUrl, 
          userId,
          clothType
        }
      }
    );
    
    if (error) {
      console.error("Error storing image:", error);
      return { 
        success: false, 
        message: `Failed to store image: ${error.message}`
      };
    }
    
    // Make sure we have a proper data object
    if (!data) {
      console.error("No data returned from store-generated-image2");
      return {
        success: false,
        message: "No data returned from image storage function"
      };
    }
    
    return {
      success: true,
      storedImageUrl: data.storedImageUrl,
      imagePath: data.imagePath,
      message: data.message
    };
  } catch (error: any) {
    console.error("Error in storeGeneratedImage:", error);
    return { 
      success: false, 
      message: `Failed to store image: ${error.message}`
    };
  }
};

/**
 * Saves metadata about a generated image to the database
 */
export const saveImageMetadata = async (
  userId: string,
  originalImageUrl: string,
  storedImageUrl: string | null,
  imagePath: string | null,
  prompt: string,
  clothType?: string,
  material?: string,
  detailDescription?: string
): Promise<boolean> => {
  try {
    // Call the Edge Function to save the metadata
    const { error } = await supabase.functions.invoke(
      'save-generated-image',
      {
        body: {
          userId,
          originalImageUrl,
          storedImageUrl,
          imagePath,
          prompt,
          clothType,
          material,
          detailDescription
        }
      }
    );
    
    if (error) {
      console.error("Error saving image metadata:", error);
      toast({
        title: "저장 실패",
        description: "이미지 메타데이터를 저장하는데 실패했습니다.",
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  } catch (error: any) {
    console.error("Error in saveImageMetadata:", error);
    return false;
  }
};
