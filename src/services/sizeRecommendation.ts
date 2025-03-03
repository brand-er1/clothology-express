
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";

export interface SizeRecommendationParams {
  gender: string;
  height: number;
  type: string;
  material?: string;
  detail?: string;
  prompt?: string;
  fit?: string;
}

export interface SizeRecommendationResult {
  성별: string;
  키: number;
  사이즈: string;
  카테고리: string;
  핏: string;
  사이즈표: Record<string, string>;
  error?: string;
}

export async function getSizeRecommendation(params: SizeRecommendationParams): Promise<SizeRecommendationResult> {
  try {
    console.log("Requesting size recommendation with params:", params);
    
    const { data, error } = await supabase.functions.invoke('size-recommendation2', {
      body: params
    });

    if (error) {
      console.error('Error getting size recommendation:', error);
      toast({
        title: "사이즈 추천 오류",
        description: "사이즈 추천을 가져오는데 실패했습니다.",
        variant: "destructive",
      });
      throw error;
    }

    console.log("Size recommendation result:", data);
    
    if (data.error) {
      console.error('Size recommendation error:', data.error);
      toast({
        title: "사이즈 추천 오류",
        description: data.error || "사이즈 추천을 가져오는데 실패했습니다.",
        variant: "destructive",
      });
      throw new Error(data.error);
    }

    return data;
  } catch (error) {
    console.error('Error getting size recommendation:', error);
    toast({
      title: "사이즈 추천 오류",
      description: "사이즈 추천을 가져오는데 실패했습니다.",
      variant: "destructive",
    });
    
    // Return a fallback size recommendation with error
    return {
      성별: "남성",
      키: 175,
      사이즈: "M",
      카테고리: "",
      핏: "레귤러",
      사이즈표: {},
      error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
    };
  }
}
