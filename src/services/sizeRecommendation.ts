
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { SizeRecommendationParams, SizeRecommendationResult } from "@/types/customize";

export const getRecommendedSize = async (params: SizeRecommendationParams): Promise<SizeRecommendationResult | null> => {
  try {
    const { clothingType, gender, height, weight, materials, style, fit, customMeasurements } = params;
    
    // Prepare the payload for the Edge Function
    const payload = {
      type: clothingType,
      gender,
      height,
      weight,
      material: materials?.[0] || "",
      style,
      fit,
      customMeasurements
    };
    
    console.log("Sending size recommendation request:", payload);
    
    // Call the Edge Function
    const { data, error } = await supabase.functions.invoke("size-recommendation", {
      body: payload
    });
    
    if (error) {
      console.error("Size recommendation error:", error);
      toast({
        title: "사이즈 추천 오류",
        description: error.message || "사이즈를 추천하는데 실패했습니다.",
        variant: "destructive",
      });
      return null;
    }
    
    console.log("Size recommendation response:", data);
    
    // Transform the response to match our expected format
    if (data) {
      return {
        recommendedSize: data.사이즈 || "M",
        measurements: data.사이즈표 || {},
        debugInfo: data.debugLogs || {},
        clothingType: data.카테고리 || clothingType,
        gender: data.성별 === "남성" ? "men" : "women"
      };
    }
    
    return null;
  } catch (err: any) {
    console.error("Size recommendation error:", err);
    toast({
      title: "사이즈 추천 오류",
      description: err.message || "사이즈를 추천하는데 실패했습니다.",
      variant: "destructive",
    });
    return null;
  }
};
