
import { supabase } from "@/lib/supabase";

export interface SizeRecommendationParams {
  gender: 'men' | 'women';
  height: number;
  type: string;
  fit?: 'regular' | 'loose' | 'skinny';
  material?: string;
  detail?: string;
  prompt?: string;
}

export interface SizeRecommendationResponse {
  성별: string;
  키: number;
  카테고리?: string;
  핏?: string;
  사이즈: string;
  사이즈표: Record<string, number>;
  debugLogs?: {
    steps: Array<{ step: string; data: any }>;
    errors: Array<string>;
    warnings: Array<string>;
    clothingType?: string;
    gptResults?: any;
    inputParams?: any;
    intermediateCalculations?: any;
  };
}

export async function getSizeRecommendation(params: SizeRecommendationParams): Promise<SizeRecommendationResponse> {
  try {
    console.log("Sending size recommendation request with params:", params);
    
    const { data, error } = await supabase.functions.invoke('size-recommendation', {
      body: params
    });

    if (error) {
      console.error('Error in size recommendation function:', error);
      throw error;
    }
    
    console.log("Size recommendation response:", data);
    return data;
  } catch (error) {
    console.error('Error getting size recommendation:', error);
    throw error;
  }
}
