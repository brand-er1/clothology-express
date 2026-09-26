import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { dispatchNotificationJobs } from "../_shared/notificationDispatch.ts";

/**
 * 알림 발송 디스패처 (펀딩 성공 SMS/알림톡 등)
 *
 * 성공 판정과 발송 작업 생성은 DB(서버)가 한다. 이 함수는 이미 만들어진 대기 작업만 발송하므로
 * 새로고침·중복 호출·동시 호출에도 같은 문자가 두 번 나가지 않는다.
 *
 * 호출 경로
 *  - 모의결제 완료 직후(프론트엔드, 로그인 사용자) : { fundingId }
 *  - 카카오페이 승인 직후(kakaopay-approve 내부 호출)
 *  - 관리자 재발송 직후(알림 발송 내역 화면)        : { logId }
 *  - (선택) Supabase Cron 으로 주기 호출            : {}  → 남은 대기 작업 처리
 *
 * Body: { fundingId?: string, logId?: string }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST만 지원합니다." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authorization = req.headers.get("Authorization") ?? "";

  // 로그인 사용자 또는 서버(service role, 예: Cron) 호출만 허용
  const isServiceCall = serviceKey.length > 0 && authorization === `Bearer ${serviceKey}`;
  if (!isServiceCall) {
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data, error } = await userClient.auth.getUser();
    if (error || !data?.user) return json({ error: "로그인이 필요합니다." }, 401);
  }

  const body = await req.json().catch(() => ({})) as { fundingId?: unknown; logId?: unknown };
  const fundingId = typeof body.fundingId === "string" && UUID.test(body.fundingId) ? body.fundingId : null;
  const logId = typeof body.logId === "string" && UUID.test(body.logId) ? body.logId : null;

  try {
    const admin = createClient(supabaseUrl, serviceKey);
    const summary = await dispatchNotificationJobs(admin, { fundingId, logId, limit: 20 });
    if (summary.errors.length) console.error("dispatch-notifications", summary.errors);
    // 수신자 번호/내용은 응답에 넣지 않는다.
    return json({ claimed: summary.claimed, sent: summary.sent, failed: summary.failed });
  } catch (error) {
    console.error("dispatch-notifications error", error);
    return json({ error: "알림 발송 처리 중 오류가 발생했습니다." }, 500);
  }
});
