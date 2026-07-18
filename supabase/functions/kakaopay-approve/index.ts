import {
  callKakaoPay,
  corsHeaders,
  errorMessage,
  getKakaoPayCid,
  getSupabaseClients,
  jsonResponse,
} from "../_shared/kakaopay.ts";

type ApproveRequest = {
  participationId?: string;
  pgToken?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user, serviceClient } = await getSupabaseClients(req);
    const body = (await req.json()) as ApproveRequest;
    if (!body.participationId || !body.pgToken) {
      return jsonResponse({ error: "결제 승인 정보가 없습니다." }, 400);
    }

    const { data: participation, error } = await serviceClient
      .from("funding_participations")
      .select("id, funding_id, participant_id, partner_order_id, payment_tid, payment_status, total_amount")
      .eq("id", body.participationId)
      .eq("participant_id", user.id)
      .single();
    if (error || !participation) throw new Error("결제할 펀딩 참여 내역을 찾을 수 없습니다.");

    if (participation.payment_status === "paid") {
      return jsonResponse({ success: true, funding_id: participation.funding_id });
    }
    if (participation.payment_status !== "ready" || !participation.payment_tid || !participation.partner_order_id) {
      throw new Error("승인할 수 없는 결제 상태입니다.");
    }

    const kakao = await callKakaoPay("/online/v1/payment/approve", {
      cid: getKakaoPayCid(),
      tid: participation.payment_tid,
      partner_order_id: participation.partner_order_id,
      partner_user_id: user.id,
      pg_token: body.pgToken,
    });
    const safePaymentPayload = {
      aid: kakao.aid,
      tid: kakao.tid,
      cid: kakao.cid,
      partner_order_id: kakao.partner_order_id,
      payment_method_type: kakao.payment_method_type,
      approved_at: kakao.approved_at,
      amount: kakao.amount,
    };

    const { error: finalizeError } = await serviceClient.rpc("finalize_funding_payment", {
      p_participation_id: participation.id,
      p_user_id: user.id,
      p_payment_method_type: kakao.payment_method_type || null,
      p_approved_at: kakao.approved_at || new Date().toISOString(),
      p_payment_payload: safePaymentPayload,
    });
    if (finalizeError) {
      try {
        const cancellation = await callKakaoPay("/online/v1/payment/cancel", {
          cid: getKakaoPayCid(),
          tid: participation.payment_tid,
          cancel_amount: participation.total_amount,
          cancel_tax_free_amount: 0,
        });
        await serviceClient.rpc("finalize_funding_cancellation", {
          p_participation_id: participation.id,
          p_user_id: user.id,
          p_payment_payload: {
            aid: cancellation.aid,
            tid: cancellation.tid,
            status: cancellation.status,
            canceled_at: cancellation.canceled_at,
            canceled_amount: cancellation.canceled_amount,
          },
        });
      } catch (rollbackError) {
        console.error("kakaopay-approve rollback", rollbackError);
        throw new Error("결제는 승인됐지만 참여 반영에 실패했습니다. 관리자에게 결제 취소를 요청해주세요.");
      }
      throw new Error("참여 반영에 실패해 카카오페이 결제를 자동 취소했습니다. 다시 시도해주세요.");
    }

    return jsonResponse({ success: true, funding_id: participation.funding_id });
  } catch (error) {
    console.error("kakaopay-approve", error);
    return jsonResponse({ error: errorMessage(error) }, 400);
  }
});
