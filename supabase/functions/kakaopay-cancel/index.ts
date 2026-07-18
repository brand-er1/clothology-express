import {
  callKakaoPay,
  corsHeaders,
  errorMessage,
  getKakaoPayCid,
  getSupabaseClients,
  jsonResponse,
} from "../_shared/kakaopay.ts";

type CancelRequest = {
  participationId?: string;
  reason?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user, serviceClient } = await getSupabaseClients(req);
    const body = (await req.json()) as CancelRequest;
    if (!body.participationId) {
      return jsonResponse({ error: "취소할 펀딩 참여 내역을 선택해주세요." }, 400);
    }

    const { data: participation, error } = await serviceClient
      .from("funding_participations")
      .select("id, participant_id, funding_id, status, payment_provider, payment_status, payment_tid, total_amount")
      .eq("id", body.participationId)
      .eq("participant_id", user.id)
      .single();
    if (error || !participation) throw new Error("취소할 펀딩 참여 내역을 찾을 수 없습니다.");

    if (participation.status === "fulfilled") {
      throw new Error("이미 제작 처리가 완료된 참여 건은 취소할 수 없습니다.");
    }
    if (participation.status === "cancelled" && participation.payment_status === "cancelled") {
      return jsonResponse({ success: true, already_cancelled: true });
    }

    let kakaoPayload: Record<string, unknown> = {
      reason: body.reason || "사용자 펀딩 참여 취소",
      cancelled_without_payment: participation.payment_status !== "paid",
    };

    if (participation.payment_provider === "kakaopay" && participation.payment_status === "paid") {
      if (!participation.payment_tid) throw new Error("카카오페이 결제번호를 찾을 수 없습니다.");
      const cancellation = await callKakaoPay("/online/v1/payment/cancel", {
        cid: getKakaoPayCid(),
        tid: participation.payment_tid,
        cancel_amount: participation.total_amount,
        cancel_tax_free_amount: 0,
      });
      kakaoPayload = {
        aid: cancellation.aid,
        tid: cancellation.tid,
        status: cancellation.status,
        canceled_at: cancellation.canceled_at,
        canceled_amount: cancellation.canceled_amount,
      };
    }

    const { error: finalizeError } = await serviceClient.rpc("finalize_funding_cancellation", {
      p_participation_id: participation.id,
      p_user_id: user.id,
      p_payment_payload: kakaoPayload,
    });
    if (finalizeError) throw finalizeError;

    return jsonResponse({
      success: true,
      refunded: participation.payment_status === "paid",
      funding_id: participation.funding_id,
    });
  } catch (error) {
    console.error("kakaopay-cancel", error);
    return jsonResponse({ error: errorMessage(error) }, 400);
  }
});
