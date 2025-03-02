
import { supabase } from "@/lib/supabase";

export interface SizeRecommendationParams {
  gender: 'men' | 'women';
  height: number;
  type: string;
  fit?: 'regular' | 'loose' | 'skinny';
}

export async function getSizeRecommendation(params: SizeRecommendationParams): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('size-recommendation', {
      body: params
    });

    if (error) throw error;
    return data.recommendation;
  } catch (error) {
    console.error('Error getting size recommendation:', error);
    throw error;
  }
}
