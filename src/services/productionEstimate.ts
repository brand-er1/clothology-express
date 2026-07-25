import { supabase } from "@/lib/supabase";
import type {
  ProductionEstimateResult,
  UploadedArtworkAnalysis,
} from "@/types/productionEstimate";

interface AnalyzeProductionEstimateParams {
  imageUrl: string;
  selectedType: string;
  selectedMaterial: string;
  designContext?: string;
  uploadedArtwork?: UploadedArtworkAnalysis | null;
}

const estimateRequestCache = new Map<
  string,
  Promise<ProductionEstimateResult>
>();

export const analyzeProductionEstimate = async ({
  imageUrl,
  selectedType,
  selectedMaterial,
  designContext = "",
  uploadedArtwork = null,
}: AnalyzeProductionEstimateParams): Promise<ProductionEstimateResult> => {
  const cacheKey = JSON.stringify([
    imageUrl,
    selectedType,
    selectedMaterial,
    designContext,
    uploadedArtwork,
  ]);
  const cachedRequest = estimateRequestCache.get(cacheKey);
  if (cachedRequest) return cachedRequest;

  const request = (async () => {
    const { data, error } = await supabase.functions.invoke(
      "analyze-production-estimate",
      {
        body: {
          imageUrl,
          selectedType,
          selectedMaterial,
          designContext,
          uploadedArtwork,
        },
      },
    );

    if (error) {
      throw new Error(error.message || "자동 견적 분석에 실패했습니다.");
    }

    if (!data?.estimate) {
      throw new Error(data?.error || "견적 결과를 불러오지 못했습니다.");
    }

    return data.estimate as ProductionEstimateResult;
  })();

  estimateRequestCache.set(cacheKey, request);

  try {
    return await request;
  } catch (error) {
    estimateRequestCache.delete(cacheKey);
    throw error;
  }
};
