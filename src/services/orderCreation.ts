
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { clothTypes, styleOptions, pocketOptions, colorOptions, fitOptions } from "@/lib/customize-constants";
import { Material, CustomMeasurements, SizeTableItem } from "@/types/customize";

// Function to create a draft order when generating an image
export const createDraftOrder = async (
  selectedType: string,
  selectedMaterial: string,
  selectedStyle: string,
  selectedPocket: string,
  selectedColor: string,
  selectedDetail: string,
  selectedFit: string,
  storedImageUrl: string | null, // Changed parameter name to reflect its usage
  imagePath: string | null,
  materials: Material[]
) => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    
    if (!user) {
      console.log("User not logged in, can't save draft");
      return false;
    }

    const selectedClothType = clothTypes.find(type => type.id === selectedType)?.name;
    
    // Find material by ID, handling both built-in and custom materials
    const selectedMaterialObj = materials.find(material => material.id === selectedMaterial);
    const selectedMaterialName = selectedMaterialObj?.name;
    
    const selectedStyleName = styleOptions.find(style => style.value === selectedStyle)?.label;
    const selectedPocketName = pocketOptions.find(pocket => pocket.value === selectedPocket)?.label;
    const selectedColorName = colorOptions.find(color => color.value === selectedColor)?.label;
    const selectedFitName = fitOptions.find(fit => fit.value === selectedFit)?.label;

    // Extract custom detail text and avoid duplicating option information
    let customDetailText = selectedDetail || '';
    
    // Remove any option-specific text that will be saved separately
    if (selectedStyleName) {
      customDetailText = customDetailText.replace(new RegExp(`스타일\\s*:\\s*${selectedStyleName}`, 'g'), '');
    }
    if (selectedPocketName) {
      customDetailText = customDetailText.replace(new RegExp(`포켓\\s*:\\s*${selectedPocketName}`, 'g'), '');
    }
    if (selectedColorName) {
      customDetailText = customDetailText.replace(new RegExp(`색상\\s*:\\s*${selectedColorName}`, 'g'), '');
    }
    if (selectedFitName) {
      customDetailText = customDetailText.replace(new RegExp(`핏\\s*:\\s*${selectedFitName}`, 'g'), '');
    }
    
    // Clean up any extra commas, line breaks or whitespace
    customDetailText = customDetailText.replace(/,+/g, ',').replace(/\n+/g, '\n').trim();
    
    // Create a formatted description with the selections
    let detailDesc = '';
    if (customDetailText) detailDesc += customDetailText + '\n';
    if (selectedStyleName) detailDesc += `스타일: ${selectedStyleName}\n`;
    if (selectedPocketName && selectedPocket !== 'none') detailDesc += `포켓: ${selectedPocketName}\n`;
    if (selectedColorName) detailDesc += `색상: ${selectedColorName}\n`;
    if (selectedFitName) detailDesc += `핏: ${selectedFitName}`;
    
    detailDesc = detailDesc.trim();

    // Get public URL from storage if we have the path but no stored URL
    if (!storedImageUrl && imagePath) {
      try {
        const { data: publicUrlData } = supabase.storage
          .from('generated_images')
          .getPublicUrl(imagePath);
        
        if (publicUrlData && publicUrlData.publicUrl) {
          storedImageUrl = publicUrlData.publicUrl;
          console.log("Retrieved stored image URL from path:", storedImageUrl);
        }
      } catch (urlError) {
        console.error("Failed to get public URL for stored image:", urlError);
      }
    }

    // Use the edge function to save the draft order
    const { data: orderData, error: orderError } = await supabase.functions.invoke('save-order', {
      body: {
        userId: user.id,
        clothType: selectedClothType,
        material: selectedMaterialName,
        detailDescription: detailDesc,
        generatedImageUrl: storedImageUrl, // Use ONLY the stored image URL
        imagePath: imagePath,
        status: 'draft' // Set as draft initially
      }
    });

    if (orderError) {
      console.error("Draft order creation failed:", orderError);
      return false;
    }

    console.log("Draft order created:", orderData);
    return true;
  } catch (error: any) {
    console.error("Draft order creation error:", error);
    return false;
  }
};

export const createOrder = async (
  selectedType: string,
  selectedMaterial: string,
  selectedStyle: string,
  selectedPocket: string,
  selectedColor: string,
  selectedDetail: string,
  selectedFit: string,
  selectedSize: string,
  customMeasurements: CustomMeasurements,
  generatedImageUrl: string | null,
  imagePath: string | null,
  materials: Material[],
  sizeTableData?: SizeTableItem[]
) => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    
    if (!user) {
      toast({
        title: "로그인 필요",
        description: "주문하기 전에 로그인해주세요.",
        variant: "destructive",
      });
      return false;
    }

    const selectedClothType = clothTypes.find(type => type.id === selectedType)?.name;
    
    // Find material by ID, handling both built-in and custom materials
    const selectedMaterialObj = materials.find(material => material.id === selectedMaterial);
    const selectedMaterialName = selectedMaterialObj?.name;
    
    const selectedStyleName = styleOptions.find(style => style.value === selectedStyle)?.label;
    const selectedPocketName = pocketOptions.find(pocket => pocket.value === selectedPocket)?.label;
    const selectedColorName = colorOptions.find(color => color.value === selectedColor)?.label;
    const selectedFitName = fitOptions.find(fit => fit.value === selectedFit)?.label;

    // Extract custom detail text and avoid duplicating option information
    let customDetailText = selectedDetail || '';
    
    // Remove any option-specific text that will be saved separately
    if (selectedStyleName) {
      customDetailText = customDetailText.replace(new RegExp(`스타일\\s*:\\s*${selectedStyleName}`, 'g'), '');
    }
    if (selectedPocketName) {
      customDetailText = customDetailText.replace(new RegExp(`포켓\\s*:\\s*${selectedPocketName}`, 'g'), '');
    }
    if (selectedColorName) {
      customDetailText = customDetailText.replace(new RegExp(`색상\\s*:\\s*${selectedColorName}`, 'g'), '');
    }
    if (selectedFitName) {
      customDetailText = customDetailText.replace(new RegExp(`핏\\s*:\\s*${selectedFitName}`, 'g'), '');
    }
    
    // Clean up any extra commas, line breaks or whitespace
    customDetailText = customDetailText.replace(/,+/g, ',').replace(/\n+/g, '\n').trim();
    
    // Create a formatted description with the selections
    let detailDesc = '';
    if (customDetailText) detailDesc += customDetailText + '\n';
    if (selectedStyleName) detailDesc += `스타일: ${selectedStyleName}\n`;
    if (selectedPocketName && selectedPocket !== 'none') detailDesc += `포켓: ${selectedPocketName}\n`;
    if (selectedColorName) detailDesc += `색상: ${selectedColorName}\n`;
    if (selectedFitName) detailDesc += `핏: ${selectedFitName}`;
    
    detailDesc = detailDesc.trim();

    // Prepare measurements data
    let measurementsData = null;
    
    // If we have size table measurements from the editable table, use those
    if (sizeTableData && sizeTableData.length > 0) {
      measurementsData = {};
      sizeTableData.forEach(item => {
        measurementsData[item.key] = item.value;
      });
    } 
    // Otherwise, use custom measurements if custom size was selected
    else if (selectedSize === 'custom' && Object.keys(customMeasurements).length > 0) {
      measurementsData = customMeasurements;
    }

    // Always try to use storage URL first
    let finalImageUrl = null;
    
    // If we have an image path, get the storage URL
    if (imagePath) {
      try {
        const { data: publicUrlData } = await supabase.storage
          .from('generated_images')
          .getPublicUrl(imagePath);
        
        if (publicUrlData && publicUrlData.publicUrl) {
          finalImageUrl = publicUrlData.publicUrl;
          console.log("Using stored image public URL:", finalImageUrl);
        }
      } catch (urlError) {
        console.error("Failed to get public URL for stored image:", urlError);
        // Fall back to the provided URL
        finalImageUrl = generatedImageUrl;
      }
    } else {
      // If no image path, use the provided URL
      finalImageUrl = generatedImageUrl;
    }

    console.log("Creating order with data:", {
      user_id: user.id,
      cloth_type: selectedClothType,
      material: selectedMaterialName,
      detail_description: detailDesc.trim(),
      size: selectedSize,
      measurements: measurementsData,
      generated_image_url: finalImageUrl,
      image_path: imagePath,
    });

    // Use the edge function to save the order
    const { data: orderData, error: orderError } = await supabase.functions.invoke('save-order', {
      body: {
        userId: user.id,
        clothType: selectedClothType,
        material: selectedMaterialName,
        detailDescription: detailDesc.trim(),
        size: selectedSize,
        measurements: measurementsData,
        generatedImageUrl: finalImageUrl, // Use the proper storage URL
        imagePath: imagePath,
        status: 'pending' // Set as pending for review
      }
    });

    if (orderError) {
      console.error("Order creation failed:", orderError);
      toast({
        title: "주문 실패",
        description: `주문 생성 중 오류가 발생했습니다: ${orderError.message}`,
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "주문 완료",
      description: "주문이 성공적으로 접수되었습니다.",
    });
    
    return true;
  } catch (error: any) {
    console.error("Order creation error:", error);
    toast({
      title: "주문 실패",
      description: "주문 처리 중 예상치 못한 오류가 발생했습니다.",
      variant: "destructive",
    });
    return false;
  }
};
