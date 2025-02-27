
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

    const { data, error } = await supabase.functions.invoke('generate-optimized-image', {
      body: { prompt }
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data || !data.imageUrl) {
      throw new Error("이미지 생성에 실패했습니다");
    }

    toast({
      title: "이미지 생성 완료",
      description: "AI가 생성한 이미지가 준비되었습니다.",
    });

    return {
      imageUrl: data.imageUrl,
      prompt: data.optimizedPrompt || prompt
    };
    
  } catch (err) {
    console.error("Image generation failed:", err);
    toast({
      title: "오류",
      description: "이미지 생성에 실패했습니다. 다시 시도해주세요.",
      variant: "destructive",
    });
    throw err;
  }
};
