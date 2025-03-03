
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { clothTypes, styleOptions, pocketOptions, colorOptions } from "@/lib/customize-constants";
import { Material, CustomMeasurements, SizeTableItem } from "@/types/customize";

export const createOrder = async (
  selectedType: string,
  selectedMaterial: string,
  selectedStyle: string,
  selectedPocket: string,
  selectedColor: string,
  selectedDetail: string,
  selectedSize: string,
  customMeasurements: CustomMeasurements,
  generatedImageUrl: string | null,
  imagePath: string | null,
  materials: Material[],
  sizeTableData?: SizeTableItem[]
) => {
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
  const selectedMaterialName = materials.find(material => material.id === selectedMaterial)?.name;
  const selectedStyleName = styleOptions.find(style => style.value === selectedStyle)?.label;
  const selectedPocketName = pocketOptions.find(pocket => pocket.value === selectedPocket)?.label;
  const selectedColorName = colorOptions.find(color => color.value === selectedColor)?.label;

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

  const { error } = await supabase.from('orders').insert({
    user_id: user.id,
    cloth_type: selectedClothType,
    material: selectedMaterialName,
    style: selectedStyleName,
    pocket_type: selectedPocketName,
    color: selectedColorName,
    detail_description: selectedDetail,
    size: selectedSize,
    measurements: measurementsData, // Use the prepared measurements data
    generated_image_url: generatedImageUrl,
    image_path: imagePath, // Store the path in the storage bucket
  });

  if (error) {
    console.error("Order creation failed:", error);
    toast({
      title: "주문 실패",
      description: "주문 생성 중 오류가 발생했습니다. 다시 시도해주세요.",
      variant: "destructive",
    });
    return false;
  }

  toast({
    title: "주문 완료",
    description: "주문이 성공적으로 접수되었습니다.",
  });
  
  return true;
};
