
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
  selectedTexture: string = "",
  selectedElasticity: string = "",
  selectedTransparency: string = "",
  selectedThickness: string = "",
  selectedSeason: string = "",
  saveAsDraft: boolean = false,
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
    
    // Construct the generation prompt using all selected attributes
    const promptParts = [
      `${selectedMaterialName} ${selectedClothType}`,
      selectedStyle && `스타일: ${selectedStyle}`,
      selectedColor && `색상: ${selectedColor}`,
      selectedPocket && `포켓: ${selectedPocket}`,
      selectedFit && `핏: ${selectedFit}`,
      selectedTexture && `질감: ${selectedTexture}`,
      selectedElasticity && `신축성: ${selectedElasticity}`,
      selectedTransparency && `비침: ${selectedTransparency}`,
      selectedThickness && `두께: ${selectedThickness}`,
      selectedSeason && `계절감: ${selectedSeason}`,
      selectedDetail && `추가 설명: ${selectedDetail}`,
    ].filter(Boolean);

    const prompt = `${promptParts.join(", ")}, 고해상도, 프로덕트 이미지`;

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

    const imageUrls = generationData?.imageUrls; // Now this is an array of URLs (single)
    const optimizedPrompt = generationData?.optimizedPrompt || prompt; // Get the optimized prompt from GPT
    const alreadyStored = generationData?.alreadyStored;
    const preStoredImagePaths = generationData?.imagePaths;
    const preStoredImageUrls = generationData?.storedImageUrls;

    if (!imageUrls || imageUrls.length === 0) {
      toast({
        title: "이미지 생성 실패",
        description: "이미지를 생성할 수 없습니다.",
        variant: "destructive",
      });
      return null;
    }

    // Store all generated images in storage right after generation (now only one)
    const storedImageUrls: string[] = [];
    const imagePaths: string[] = [];

    try {
      if (alreadyStored && preStoredImageUrls?.length) {
        storedImageUrls.push(preStoredImageUrls[0]);
        imagePaths.push(preStoredImagePaths?.[0] || null);
      } else {
        for (const [index, imageUrl] of imageUrls.entries()) {
          console.log(`Storing image ${index + 1} to storage...`);
          
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
            console.error(`Error storing image ${index + 1}:`, storeError);
            storedImageUrls.push(imageUrl); // Fall back to original URL if storage fails
            imagePaths.push(null);
          } else {
            console.log(`Image ${index + 1} stored successfully:`, storeData);
            storedImageUrls.push(storeData?.storedImageUrl || imageUrl);
            imagePaths.push(storeData?.imagePath || null);
          }
        }
      }
    } catch (storageError) {
      console.error("Error storing images:", storageError);
      // Continue with original URLs if storage fails
    }

    // Always save all generated images to DB, but without selecting any of them yet
    try {
      // Store image information in the generated_images table without selecting any
      const { data: imageData, error: imageError } = await supabase.functions.invoke(
        'save-generated-image',
        {
          body: {
            userId: user.id,
            originalImageUrls: imageUrls,
            storedImageUrls: storedImageUrls,
            imagePaths: imagePaths,
            prompt: prompt,
            clothType: selectedClothType,
            material: selectedMaterialName,
            detailDescription: selectedDetail,
            generationPrompt: optimizedPrompt // Store the actual GPT-optimized prompt
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

    return {
      imageUrls,
      storedImageUrls,
      imagePaths,
      selectedIndex: 0, // Auto-select the single image
      storedImageUrl: storedImageUrls[0] || null,
      imagePath: imagePaths[0] || null,
      prompt,
      optimizedPrompt,
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

// Function to store a selected image - now called at order creation time
export const storeSelectedImage = async (
  selectedType: string,
  selectedMaterial: string,
  selectedDetail: string,
  imageUrl: string,
  storedImageUrl: string | null,
  imagePath: string | null,
  allImageUrls: string[],
  allStoredImageUrls: string[] | null,
  allImagePaths: string[] | null,
  selectedIndex: number, 
  optimizedPrompt: string,
  materials: Material[],
  saveAsDraft: boolean = true
) => {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    
    if (!user) {
      toast({
        title: "로그인 필요",
        description: "이미지를 저장하려면 로그인해주세요.",
        variant: "destructive",
      });
      return null;
    }

    // Prepare metadata for the selected image
    const selectedClothType = clothTypes.find(type => type.id === selectedType)?.name || selectedType;
    const selectedMaterialObj = materials.find(material => material.id === selectedMaterial);
    const selectedMaterialName = selectedMaterialObj?.name || selectedMaterial;

    // Get the stored URL from the array if available
    let finalStoredImageUrl = storedImageUrl;
    let finalImagePath = imagePath;

    if (allStoredImageUrls && selectedIndex >= 0 && selectedIndex < allStoredImageUrls.length) {
      finalStoredImageUrl = allStoredImageUrls[selectedIndex];
    }

    if (allImagePaths && selectedIndex >= 0 && selectedIndex < allImagePaths.length) {
      finalImagePath = allImagePaths[selectedIndex];
    }

    // If we still don't have storage info, try to store it now
    if (!finalStoredImageUrl || !finalImagePath) {
      // Store the selected image in Supabase Storage if not already stored
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
        return null;
      }

      console.log("Image storage result:", storeData);
      finalStoredImageUrl = storeData?.storedImageUrl || null;
      finalImagePath = storeData?.imagePath || null;
      console.log("Stored image public URL:", finalStoredImageUrl);
    }

    // Now update the DB to mark the selected image - this happens only at order time
    const { data: imageData, error: imageError } = await supabase.functions.invoke(
      'save-generated-image',
      {
        body: {
          userId: user.id,
          originalImageUrls: allImageUrls,
          storedImageUrls: allStoredImageUrls,
          imagePaths: allImagePaths,
          storedImageUrl: finalStoredImageUrl,
          imagePath: finalImagePath,
          prompt: optimizedPrompt,
          clothType: selectedClothType,
          material: selectedMaterialName,
          detailDescription: selectedDetail,
          generationPrompt: optimizedPrompt,
          isSelected: selectedIndex, // Now we set the selected image
          saveOnlySelected: true // Flag to indicate we're only updating selection status
        }
      }
    );

    if (imageError) {
      console.error("Failed to save image selection:", imageError);
    } else {
      console.log("Image selection saved:", imageData);
    }

    // Save as draft order if requested
    if (saveAsDraft) {
      try {
        await createDraftOrder(
          selectedType,
          selectedMaterial,
          selectedDetail,
          finalStoredImageUrl || imageUrl,
          finalImagePath,
          materials
        );
      } catch (draftError) {
        console.error("Failed to create draft order:", draftError);
        // We don't want to fail the whole operation if just the draft creation fails
      }
    }

    return {
      imageUrl,
      storedImageUrl: finalStoredImageUrl,
      imagePath: finalImagePath,
      optimizedPrompt,
    };
  } catch (error: any) {
    console.error("Image selection error:", error);
    throw error;
  }
};
