
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";

/**
 * Stores a generated image in Supabase storage via the edge function
 */
export const storeGeneratedImage = async (
  imageUrl: string,
  userId: string | undefined,
  clothType: string
): Promise<{
  storedImageUrl: string | null;
  imagePath: string | null;
  success: boolean;
}> => {
  if (!userId || !imageUrl) {
    console.error("Missing user ID or image URL for storage");
    return { storedImageUrl: null, imagePath: null, success: false };
  }

  try {
    console.log("Starting image storage process with URL:", imageUrl);
    
    // Store the generated image in Supabase Storage with sanitized filename
    const { data: storeData, error: storeError } = await supabase.functions.invoke(
      'store-generated-image',
      {
        body: { 
          imageUrl,
          userId,
          clothType
        }
      }
    );

    if (storeError) {
      console.error("Image storage error:", storeError);
      return { storedImageUrl: null, imagePath: null, success: false };
    }
    
    console.log("Image storage result:", storeData);
    
    // Get the storage path and public URL
    const imagePath = storeData?.imagePath || null;
    const storedImageUrl = storeData?.storedImageUrl || null;
    
    if (imagePath) {
      console.log("Stored image path:", imagePath);
      console.log("Stored image URL:", storedImageUrl);
      return { storedImageUrl, imagePath, success: true };
    } else {
      console.warn("Storage succeeded but no image path or URL returned");
      return { storedImageUrl: null, imagePath: null, success: false };
    }
  } catch (storageError) {
    console.error("Failed to store image:", storageError);
    return { storedImageUrl: null, imagePath: null, success: false };
  }
};

/**
 * Saves image metadata to the database via the edge function
 */
export const saveImageMetadata = async (
  userId: string,
  originalImageUrl: string,
  storedImageUrl: string | null,
  imagePath: string | null,
  prompt: string,
  clothType: string,
  material: string,
  detailDescription: string
): Promise<boolean> => {
  try {
    // Store image information in the generated_images table
    const { data: imageData, error: imageError } = await supabase.functions.invoke(
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

    if (imageError) {
      console.error("Failed to save image data:", imageError);
      return false;
    }
    
    console.log("Image data saved:", imageData);
    return true;
  } catch (saveError) {
    console.error("Error saving image data:", saveError);
    return false;
  }
};
