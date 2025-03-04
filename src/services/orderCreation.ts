
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { clothTypes, styleOptions, pocketOptions, colorOptions, fitOptions } from "@/lib/customize-constants";
import { Material, CustomMeasurements, SizeTableItem } from "@/types/customize";

// Function to create a draft order when generating an image
export const createDraftOrder = async (
  selectedType: string,
  selectedMaterial: string,
  selectedDetail: string,
  selectedStyle: string,
  selectedPocket: string,
  selectedColor: string,
  selectedFit: string,
  generatedImageUrl: string | null,
  imagePath: string | null,
  materials: Material[]
) => {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    
    if (!user) {
      console.log("User not logged in, can't save draft");
      return false;
    }

    const selectedClothType = clothTypes.find(type => type.id === selectedType)?.name;
    
    // Find material by ID, handling both built-in and custom materials
    const selectedMaterialObj = materials.find(material => material.id === selectedMaterial);
    const selectedMaterialName = selectedMaterialObj?.name;
    
    // Extract custom detail text and avoid duplicating option information
    let customDetailText = selectedDetail || '';
    
    // Clean up any extra commas, line breaks or whitespace
    customDetailText = customDetailText.replace(/,+/g, ',').replace(/\n+/g, '\n').trim();
    
    // Create a formatted description with the selections
    let detailDesc = '';

    // Add style if selected
    if (selectedStyle) {
      const styleLabel = styleOptions.find(opt => opt.value === selectedStyle)?.label || selectedStyle;
      detailDesc += `스타일: ${styleLabel}, `;
    }

    // Add pocket if selected
    if (selectedPocket) {
      const pocketLabel = pocketOptions.find(opt => opt.value === selectedPocket)?.label || selectedPocket;
      detailDesc += `포켓: ${pocketLabel}, `;
    }

    // Add color if selected
    if (selectedColor) {
      const colorLabel = colorOptions.find(opt => opt.value === selectedColor)?.label || selectedColor;
      detailDesc += `색상: ${colorLabel}, `;
    }

    // Add fit if selected
    if (selectedFit) {
      const fitLabel = fitOptions.find(opt => opt.value === selectedFit)?.label || selectedFit;
      detailDesc += `핏: ${fitLabel}, `;
    }

    // Add custom details
    if (customDetailText) {
      detailDesc += `상세: ${customDetailText}`;
    }
    
    detailDesc = detailDesc.trim();
    if (detailDesc.endsWith(',')) {
      detailDesc = detailDesc.slice(0, -1);
    }

    // Use the edge function to save the draft order
    const { data: orderData, error: orderError } = await supabase.functions.invoke('save-order', {
      body: {
        userId: user.id,
        clothType: selectedClothType,
        material: selectedMaterialName,
        detailDescription: detailDesc,
        style: selectedStyle,
        pocket: selectedPocket,
        color: selectedColor,
        fit: selectedFit,
        generatedImageUrl: generatedImageUrl,
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
  selectedDetail: string,
  selectedStyle: string,
  selectedPocket: string,
  selectedColor: string,
  selectedFit: string,
  selectedSize: string,
  customMeasurements: CustomMeasurements,
  generatedImageUrl: string | null,
  imagePath: string | null,
  materials: Material[],
  sizeTableData?: SizeTableItem[]
) => {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    
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
    
    // Extract custom detail text and avoid duplicating option information
    let customDetailText = selectedDetail || '';
    
    // Clean up any extra commas, line breaks or whitespace
    customDetailText = customDetailText.replace(/,+/g, ',').replace(/\n+/g, '\n').trim();
    
    // Create a formatted description with the selections
    let detailDesc = '';

    // Add style if selected
    if (selectedStyle) {
      const styleLabel = styleOptions.find(opt => opt.value === selectedStyle)?.label || selectedStyle;
      detailDesc += `스타일: ${styleLabel}, `;
    }

    // Add pocket if selected
    if (selectedPocket) {
      const pocketLabel = pocketOptions.find(opt => opt.value === selectedPocket)?.label || selectedPocket;
      detailDesc += `포켓: ${pocketLabel}, `;
    }

    // Add color if selected
    if (selectedColor) {
      const colorLabel = colorOptions.find(opt => opt.value === selectedColor)?.label || selectedColor;
      detailDesc += `색상: ${colorLabel}, `;
    }

    // Add fit if selected
    if (selectedFit) {
      const fitLabel = fitOptions.find(opt => opt.value === selectedFit)?.label || selectedFit;
      detailDesc += `핏: ${fitLabel}, `;
    }

    // Add custom details
    if (customDetailText) {
      detailDesc += `상세: ${customDetailText}`;
    }
    
    detailDesc = detailDesc.trim();
    if (detailDesc.endsWith(',')) {
      detailDesc = detailDesc.slice(0, -1);
    }

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

    // 항상 스토리지 URL 사용
    let finalImageUrl = generatedImageUrl;
    
    // 이미지 경로가 있으면 스토리지에서 공개 URL 가져오기
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
        // Fall back to the original generated URL
      }
    }

    console.log("Creating order with data:", {
      user_id: user.id,
      cloth_type: selectedClothType,
      material: selectedMaterialName,
      detail_description: detailDesc.trim(),
      style: selectedStyle,
      pocket: selectedPocket,
      color: selectedColor,
      fit: selectedFit,
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
        style: selectedStyle,
        pocket: selectedPocket,
        color: selectedColor,
        fit: selectedFit,
        size: selectedSize,
        measurements: measurementsData,
        generatedImageUrl: finalImageUrl,
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
