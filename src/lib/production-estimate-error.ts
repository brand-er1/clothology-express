export type ProductionEstimateErrorReason =
  | "no_source_image"
  | "image_conversion_failed"
  | "network_error"
  | "server_error"
  | "design_not_found"
  | "unknown";

interface DescribedError {
  reason: ProductionEstimateErrorReason;
  message: string;
}

/**
 * Turns whatever `analyzeProductionEstimate` (or the image-resolution step before it) threw into
 * one of a small set of causes a visitor can actually act on, instead of a single generic
 * "자동 견적을 불러오지 못했습니다". `supabase.functions.invoke` throws a typed FunctionsError
 * subclass (`error.name`) we can tell apart without guessing from message text.
 */
export const describeProductionEstimateError = (error: unknown): DescribedError => {
  const name = error instanceof Error ? (error as Error & { name?: string }).name : undefined;
  const reasonFromError = (error as { reason?: ProductionEstimateErrorReason } | null)?.reason;

  if (reasonFromError === "no_source_image") {
    return {
      reason: "no_source_image",
      message: "원본 의류 이미지를 찾을 수 없습니다. 옷을 다시 선택하거나 이미지를 다시 업로드해주세요.",
    };
  }
  if (reasonFromError === "image_conversion_failed") {
    return {
      reason: "image_conversion_failed",
      message: "이미지 변환에 실패했습니다. 다시 시도하거나 이미지를 다시 업로드해주세요.",
    };
  }
  if (name === "FunctionsFetchError") {
    return {
      reason: "network_error",
      message: "네트워크 오류로 견적 서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해주세요.",
    };
  }
  if (name === "FunctionsHttpError" || name === "FunctionsRelayError") {
    return {
      reason: "server_error",
      message: "견적 서버 호출에 실패했습니다. 잠시 후 다시 시도해주세요.",
    };
  }
  return {
    reason: "unknown",
    message: error instanceof Error && error.message ? error.message : "자동 견적 분석에 실패했습니다.",
  };
};
