
import { supabase } from '@/lib/supabase';
import { SizeRecommendationParams, SizeRecommendationResult } from '@/types/customize';

export async function getSizeRecommendation(params: SizeRecommendationParams): Promise<SizeRecommendationResult> {
  try {
    const { data, error } = await supabase.functions.invoke('size-recommendation', {
      body: params,
    });

    if (error) {
      console.error('Error fetching size recommendation:', error);
      throw new Error(error.message);
    }

    // Include the debug information in the response
    return {
      recommendedSize: data.recommendedSize || '?',
      measurements: data.measurements || {},
      debugInfo: data.debug || null, // Include all debug info
      clothingType: data.clothingType, // Include the clothing type
      gender: data.gender // Include the gender
    };
  } catch (error: any) {
    console.error('Error in size recommendation service:', error);
    throw new Error(`Failed to get size recommendation: ${error.message}`);
  }
}
