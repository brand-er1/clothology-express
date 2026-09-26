import { corsHeaders, getSupabaseClients, jsonResponse } from "../_shared/kakaopay.ts";

// 관리자 회원 조치 중 Supabase Auth 변경(로그인 차단/해제, 제작자 권한 메타데이터)이 필요한 작업.
// 권한 검증과 DB 상태 변경·Audit Log 는 호출자 JWT 로 실행하는 RPC(admin_set_member_status /
// admin_approve_creator)가 담당하고, 이 함수는 RPC 가 성공한 경우에만 Service Role 로 Auth 를 갱신한다.
// Service Role Key 는 Edge Function 환경변수에만 존재하며 클라이언트로 전달되지 않는다.

type ManageUserRequest = {
  action?: "set_status" | "approve_creator";
  userId?: string;
  status?: "active" | "restricted" | "suspended" | "archived";
  reason?: string;
};

// Supabase Auth ban_duration 은 시간 단위 문자열. 약 100년 = 사실상 영구 정지(해제 시 "none").
const PERMANENT_BAN = "876000h";

const messageFromError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return "회원 조치를 처리하지 못했습니다.";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { userClient, serviceClient } = await getSupabaseClients(req);
    const body = (await req.json()) as ManageUserRequest;

    if (!body.userId || !/^[0-9a-f-]{36}$/i.test(body.userId)) {
      return jsonResponse({ error: "대상 회원을 선택해주세요." }, 400);
    }

    if (body.action === "set_status") {
      if (!body.status) return jsonResponse({ error: "변경할 상태를 선택해주세요." }, 400);

      // 1) 서버측 권한 검증 + DB 상태 변경 + Audit Log (호출자 권한으로 실행)
      const { data, error } = await userClient.rpc("admin_set_member_status", {
        p_user_id: body.userId,
        p_status: body.status,
        p_reason: body.reason ?? "",
      });
      if (error) return jsonResponse({ error: error.message }, error.code === "42501" ? 403 : 400);

      // 2) Supabase Auth 로그인 차단/해제
      const shouldBan = Boolean((data as { auth_ban?: boolean } | null)?.auth_ban);
      const { error: authError } = await serviceClient.auth.admin.updateUserById(body.userId, {
        ban_duration: shouldBan ? PERMANENT_BAN : "none",
      });
      if (authError) {
        return jsonResponse({
          result: data,
          warning: `회원 상태는 변경되었지만 로그인 차단 설정에 실패했습니다: ${authError.message}`,
        }, 207);
      }
      return jsonResponse({ result: data, authUpdated: true });
    }

    if (body.action === "approve_creator") {
      const { data, error } = await userClient.rpc("admin_approve_creator", {
        p_user_id: body.userId,
        p_reason: body.reason ?? "",
      });
      if (error) return jsonResponse({ error: error.message }, error.code === "42501" ? 403 : 400);

      // 프런트엔드 AuthGuard 가 user_metadata.account_type 을 확인하므로 Auth 메타데이터도 동기화한다.
      const { data: target, error: fetchError } = await serviceClient.auth.admin.getUserById(body.userId);
      if (fetchError || !target.user) {
        return jsonResponse({ result: data, warning: "제작자 권한은 저장되었지만 로그인 정보 동기화에 실패했습니다." }, 207);
      }
      const { error: metaError } = await serviceClient.auth.admin.updateUserById(body.userId, {
        user_metadata: { ...(target.user.user_metadata ?? {}), account_type: "seller" },
      });
      if (metaError) {
        return jsonResponse({ result: data, warning: `로그인 정보 동기화 실패: ${metaError.message}` }, 207);
      }
      return jsonResponse({ result: data, authUpdated: true });
    }

    return jsonResponse({ error: "지원하지 않는 작업입니다." }, 400);
  } catch (error) {
    console.error("admin-manage-user error:", error);
    return jsonResponse({ error: messageFromError(error) }, 500);
  }
});
