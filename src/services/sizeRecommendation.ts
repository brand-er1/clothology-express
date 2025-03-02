
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { clothTypes } from "@/lib/customize-constants";

export type SizeRecommendationResult = {
  성별: string;
  키: number;
  카테고리: string;
  핏: string;
  사이즈: string;
  사이즈표: Record<string, any>;
  debugLogs?: {
    steps: Array<{ step: string; data: any }>;
    errors: Array<string>;
    warnings: Array<string>;
  };
  error?: string;
};

export const getSizeRecommendation = async (
  gender: string,
  height: number | null,
  selectedType: string,
  selectedMaterial: string,
  selectedDetail: string,
  generatedPrompt: string
): Promise<SizeRecommendationResult> => {
  try {
    if (!height) {
      throw new Error("키 정보가 필요합니다");
    }

    console.log("Requesting size recommendation with:", {
      gender, height, selectedType, selectedMaterial, selectedDetail, generatedPrompt
    });

    const selectedClothType = clothTypes.find(type => type.id === selectedType)?.name || "";

    const { data, error } = await supabase.functions.invoke("size-recommendation", {
      body: {
        gender,
        height,
        type: selectedClothType,
        material: selectedMaterial,
        detail: selectedDetail,
        prompt: generatedPrompt
      }
    });

    if (error) {
      console.error("Size recommendation error:", error);
      throw new Error(error.message);
    }

    console.log("Size recommendation result:", data);

    if (!data) {
      throw new Error("사이즈 추천 데이터를 받지 못했습니다");
    }

    return data as SizeRecommendationResult;
  } catch (err: any) {
    console.error("Size recommendation service error:", err);
    toast({
      title: "사이즈 추천 실패",
      description: err.message || "사이즈 추천을 가져오는 데 실패했습니다",
      variant: "destructive",
    });
    
    return {
      성별: gender,
      키: height || 0,
      카테고리: selectedType,
      핏: selectedDetail,
      사이즈: "",
      사이즈표: {},
      error: err.message,
      debugLogs: {
        steps: [],
        errors: [err.message || "Unknown error"],
        warnings: []
      }
    };
  }
};
