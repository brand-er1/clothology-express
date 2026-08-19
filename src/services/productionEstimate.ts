import { supabase } from "@/lib/supabase";
import type {
  ManualProductionAnalysis,
  ProductionAnalysisSnapshotItem,
  ProductionEstimateImageInput,
  ProductionEstimateResult,
  UploadedArtworkAnalysis,
} from "@/types/productionEstimate";

interface AnalyzeProductionEstimateParams {
  /** Preferred multi-image input, up to 10 images. Takes precedence over the legacy single-image params below. */
  images?: ProductionEstimateImageInput[];
  imageUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  selectedType: string;
  selectedMaterial: string;
  designContext?: string;
  uploadedArtwork?: UploadedArtworkAnalysis | null;
  manualAnalysis?: ManualProductionAnalysis | null;
  /**
   * A previously-returned `rawAnalysisSnapshot`, possibly edited to resolve one ambiguous
   * decoration technique. When present the AI analysis step is skipped entirely and the
   * estimate is rebuilt directly from these items.
   */
  rawItemsOverride?: ProductionAnalysisSnapshotItem[] | null;
  quantity?: number;
}

const estimateRequestCache = new Map<
  string,
  Promise<ProductionEstimateResult>
>();

export const analyzeProductionEstimate = async ({
  images,
  imageUrl = "",
  imageBase64 = "",
  imageMimeType = "",
  selectedType,
  selectedMaterial,
  designContext = "",
  uploadedArtwork = null,
  manualAnalysis = null,
  rawItemsOverride = null,
  quantity = 20,
}: AnalyzeProductionEstimateParams): Promise<ProductionEstimateResult> => {
  const normalizedImages =
    images && images.length > 0
      ? images
      : imageBase64 || imageUrl
        ? [{ base64: imageBase64, mimeType: imageMimeType, url: imageUrl }]
        : [];

  const cacheKey = JSON.stringify([
    normalizedImages.map((image) => [
      image.url || "",
      image.base64 ? `${image.base64.slice(0, 48)}:${image.base64.length}` : "",
      image.mimeType || "",
    ]),
    selectedType,
    selectedMaterial,
    designContext,
    uploadedArtwork,
    manualAnalysis,
    rawItemsOverride,
    quantity,
  ]);
  const cachedRequest = estimateRequestCache.get(cacheKey);
  if (cachedRequest) return cachedRequest;

  const request = (async () => {
    const { data, error } = await supabase.functions.invoke(
      "analyze-production-estimate",
      {
        body: {
          images: normalizedImages,
          selectedType,
          selectedMaterial,
          designContext,
          uploadedArtwork,
          manualAnalysis,
          rawItemsOverride,
          quantity,
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
