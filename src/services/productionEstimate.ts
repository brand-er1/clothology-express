import { supabase } from "@/lib/supabase";
import type {
  ManualProductionAnalysis,
  ProductionEstimateResult,
  UploadedArtworkAnalysis,
} from "@/types/productionEstimate";

interface AnalyzeProductionEstimateParams {
  imageUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  selectedType: string;
  selectedMaterial: string;
  designContext?: string;
  uploadedArtwork?: UploadedArtworkAnalysis | null;
  manualAnalysis?: ManualProductionAnalysis | null;
}

const estimateRequestCache = new Map<
  string,
  Promise<ProductionEstimateResult>
>();

export const analyzeProductionEstimate = async ({
  imageUrl = "",
  imageBase64 = "",
  imageMimeType = "",
  selectedType,
  selectedMaterial,
  designContext = "",
  uploadedArtwork = null,
  manualAnalysis = null,
}: AnalyzeProductionEstimateParams): Promise<ProductionEstimateResult> => {
  const cacheKey = JSON.stringify([
    imageUrl,
    imageBase64 ? `${imageBase64.slice(0, 48)}:${imageBase64.length}` : "",
    imageMimeType,
    selectedType,
    selectedMaterial,
    designContext,
    uploadedArtwork,
    manualAnalysis,
  ]);
  const cachedRequest = estimateRequestCache.get(cacheKey);
  if (cachedRequest) return cachedRequest;

  const request = (async () => {
    const { data, error } = await supabase.functions.invoke(
      "analyze-production-estimate",
      {
        body: {
          imageUrl,
          imageBase64,
          imageMimeType,
          selectedType,
          selectedMaterial,
          designContext,
          uploadedArtwork,
          manualAnalysis,
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
