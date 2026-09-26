import { createSmsProvider, sendFundingSuccessSMS, type SmsProvider } from "./sms.ts";

/**
 * 알림 발송 큐 처리 (service_role 클라이언트 전용)
 *
 * 1) evaluate_funding_success   — 트리거에서 판정이 누락된 펀딩을 다시 판정(멱등, 안전망)
 * 2) claim_notification_jobs    — 대기(pending) 작업을 'sending' 으로 잠그며 가져옴(FOR UPDATE SKIP LOCKED)
 * 3) sendFundingSuccessSMS      — 발송 업체 호출
 * 4) complete_notification_job  — 결과 기록(성공 시 fundings.success_sms_sent = true)
 *
 * 성공 판정·작업 생성은 DB 가 하므로 이 함수를 여러 번/동시에 호출해도 같은 알림이 두 번 나가지 않는다.
 */

type RpcClient = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

type ClaimedJob = {
  log_id: string;
  event_type: string;
  recipient_role: "creator" | "participant";
  channel: "sms" | "alimtalk";
  phone: string;
  payload: { funding_name?: string; target_quantity?: number; quantity?: number; participants?: number };
  attempt_count: number;
};

export type DispatchSummary = { claimed: number; sent: number; failed: number; errors: string[] };

export async function dispatchNotificationJobs(
  admin: RpcClient,
  options: { fundingId?: string | null; logId?: string | null; limit?: number } = {},
  provider: SmsProvider = createSmsProvider(),
): Promise<DispatchSummary> {
  const summary: DispatchSummary = { claimed: 0, sent: 0, failed: 0, errors: [] };

  if (options.fundingId) {
    const { error } = await admin.rpc("evaluate_funding_success", { p_funding_id: options.fundingId });
    if (error) summary.errors.push(`evaluate: ${error.message}`);
  }

  const { data, error } = await admin.rpc("claim_notification_jobs", {
    p_funding_id: options.fundingId ?? null,
    p_log_id: options.logId ?? null,
    p_limit: Math.min(Math.max(options.limit ?? 20, 1), 100),
  });
  if (error) {
    summary.errors.push(`claim: ${error.message}`);
    return summary;
  }

  for (const job of (data ?? []) as ClaimedJob[]) {
    summary.claimed += 1;
    let result;
    try {
      result = job.event_type === "funding_success"
        ? await sendFundingSuccessSMS(provider, {
          to: job.phone,
          recipientRole: job.recipient_role,
          fundingName: job.payload.funding_name ?? "",
          targetQuantity: Number(job.payload.target_quantity ?? 0),
          quantity: Number(job.payload.quantity ?? 0),
          participants: Number(job.payload.participants ?? 0),
        })
        : { ok: false as const, provider: provider.name, error: `지원하지 않는 이벤트: ${job.event_type}` };
    } catch (sendError) {
      result = { ok: false as const, provider: provider.name, error: sendError instanceof Error ? sendError.message : String(sendError) };
    }

    const { error: completeError } = await admin.rpc("complete_notification_job", {
      p_log_id: job.log_id,
      p_success: result.ok,
      p_provider: result.provider,
      p_provider_message_id: result.ok ? result.messageId : null,
      p_error: result.ok ? null : result.error,
    });
    if (completeError) summary.errors.push(`complete ${job.log_id}: ${completeError.message}`);
    if (result.ok) summary.sent += 1;
    else summary.failed += 1;
  }
  return summary;
}

/** 결제 등 다른 흐름에서 호출할 때: 절대 예외를 던지지 않고, 시간 제한을 둔다. */
export async function dispatchNotificationsSafely(
  admin: RpcClient,
  options: { fundingId?: string | null },
  timeoutMs = 12_000,
): Promise<DispatchSummary | null> {
  try {
    return await Promise.race([
      dispatchNotificationJobs(admin, options),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
  } catch (error) {
    console.error("notification dispatch failed", error);
    return null;
  }
}
