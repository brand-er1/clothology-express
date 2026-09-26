// deno-lint-ignore-file no-explicit-any
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AI usage metering shared by the detail-page functions: a quota check before calling the
 * model and a usage log row after (success / failed). Both RPCs are service-role only, so
 * clients can neither skip nor forge usage. Failures to log never fail the user's request.
 */

export type AiFeature = "detail_copy" | "detail_image";

export const precheckAiUsage = async (
  admin: any,
  userId: string,
  feature: AiFeature,
  detailPageId?: string | null,
): Promise<{ allowed: boolean; reason?: string }> => {
  const { data, error } = await admin.rpc("ai_usage_precheck", {
    p_user_id: userId,
    p_feature: feature,
    p_detail_page_id: detailPageId ?? null,
  });
  if (error) {
    // Metering must not become an outage (e.g. migration not applied yet): allow and log.
    console.error("ai_usage_precheck failed", error.message);
    return { allowed: true };
  }
  return { allowed: data?.allowed !== false, reason: data?.reason };
};

export const logAiUsage = async (
  admin: any,
  entry: {
    userId: string;
    feature: AiFeature;
    status: "success" | "failed";
    provider?: string | null;
    model?: string | null;
    detailPageId?: string | null;
    imageType?: string | null;
    latencyMs?: number | null;
    error?: string | null;
    metadata?: Record<string, unknown>;
  },
) => {
  const { error } = await admin.rpc("log_ai_usage", {
    p_user_id: entry.userId,
    p_feature: entry.feature,
    p_status: entry.status,
    p_provider: entry.provider ?? null,
    p_model: entry.model ?? null,
    p_detail_page_id: entry.detailPageId ?? null,
    p_image_type: entry.imageType ?? null,
    p_latency_ms: entry.latencyMs ?? null,
    p_error: entry.error ?? null,
    p_metadata: entry.metadata ?? {},
  });
  if (error) console.error("log_ai_usage failed", error.message);
};
