
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
  saveAsDraft: boolean = false, // Changed default to false since we'll save later after selection
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
    
    // Construct the generation prompt
    const prompt = `${selectedMaterialName} ${selectedClothType}, ` +
      (selectedDetail ? `${selectedDetail}, ` : '') +
      `고해상도, 프로덕트 이미지`;

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

    const imageUrls = generationData?.imageUrls; // Now this is an array of URLs
    const optimizedPrompt = generationData?.optimizedPrompt || prompt; // Get the optimized prompt from GPT

    if (!imageUrls || imageUrls.length === 0) {
      toast({
        title: "이미지 생성 실패",
        description: "이미지를 생성할 수 없습니다.",
        variant: "destructive",
      });
      return null;
    }

    // By default, we haven't saved any images to storage yet
    // Only after the user selects an image will we store it

    // Store all image information in the generated_images table
    if (imageUrls && imageUrls.length > 0 && user.id) {
      try {
        // Store image information in the generated_images table without selecting any yet
        const { data: imageData, error: imageError } = await supabase.functions.invoke(
          'save-generated-image',
          {
            body: {
              userId: user.id,
              originalImageUrls: imageUrls,
              storedImageUrl: null, // We'll update this when an image is selected
              imagePath: null, // We'll update this when an image is selected
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
    }

    return {
      imageUrls,
      selectedIndex: -1, // No image selected yet
      storedImageUrl: null,
      imagePath: null,
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

// New function to store a selected image
export const storeSelectedImage = async (
  selectedType: string,
  selectedMaterial: string,
  selectedDetail: string,
  imageUrl: string,
  allImageUrls: string[],
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

    // 선택한 이미지를 스토리지에 저장
    const selectedClothType = clothTypes.find(type => type.id === selectedType)?.name || selectedType;
    const selectedMaterialObj = materials.find(material => material.id === selectedMaterial);
    const selectedMaterialName = selectedMaterialObj?.name || selectedMaterial;

    // Store the selected image in Supabase Storage
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
    // Get the storage URL and path from the response
    const storedImageUrl = storeData?.storedImageUrl || null;
    const imagePath = storeData?.imagePath || null;
    console.log("Stored image public URL:", storedImageUrl);

    // Update the generated_images entries to mark which one was selected and add storage info
    const { data: imageData, error: imageError } = await supabase.functions.invoke(
      'save-generated-image',
      {
        body: {
          userId: user.id,
          originalImageUrls: allImageUrls,
          storedImageUrl: storedImageUrl,
          imagePath: imagePath,
          prompt: optimizedPrompt,
          clothType: selectedClothType,
          material: selectedMaterialName,
          detailDescription: selectedDetail,
          generationPrompt: optimizedPrompt,
          isSelected: selectedIndex // Index of the selected image
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
      await createDraftOrder(
        selectedType,
        selectedMaterial,
        selectedDetail,
        storedImageUrl || imageUrl,
        imagePath,
        materials
      );
    }

    return {
      imageUrl,
      storedImageUrl,
      imagePath,
      optimizedPrompt,
    };
  } catch (error: any) {
    console.error("Image selection error:", error);
    toast({
      title: "이미지 저장 실패",
      description: "선택한 이미지를 저장하는 중 오류가 발생했습니다.",
      variant: "destructive",
    });
    return null;
  }
};
