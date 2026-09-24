import {
  callKakaoPay,
  corsHeaders,
  errorMessage,
  getKakaoPayCid,
  getSupabaseClients,
  jsonResponse,
} from "../_shared/kakaopay.ts";

type CancelParticipationRequest = {
  participationId?: string;
  reason?: string;
};

type ParticipationRecord = {
  id: string;
  participant_id: string;
  funding_id: string;
  status: string;
  payment_provider: string;
  payment_status: string;
  payment_tid: string | null;
  total_amount: number;
};

type FundingRecord = {
  id: string;
  creator_id: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user, serviceClient } = await getSupabaseClients(req);
    const body = (await req.json()) as CancelParticipationRequest;
    const reason = body.reason?.trim() ?? "";

    if (!body.participationId) {
      return jsonResponse({ error: "취소할 참여자를 선택해주세요." }, 400);
    }
    if (reason.length < 2 || reason.length > 500) {
      return jsonResponse({ error: "취소 사유를 2자 이상 500자 이하로 입력해주세요." }, 400);
    }

    const { data: rawParticipation, error: participationError } = await serviceClient
      .from("funding_participations")
      .select("id, participant_id, funding_id, status, payment_provider, payment_status, payment_tid, total_amount")
      .eq("id", body.participationId)
      .maybeSingle();
    const participation = rawParticipation as ParticipationRecord | null;

    if (participationError) throw participationError;
    if (!participation) {
      return jsonResponse({ error: "참여 내역을 찾을 수 없습니다." }, 404);
    }

    const [{ data: rawFunding, error: fundingError }, { data: isAdmin, error: adminError }] =
      await Promise.all([
        serviceClient
          .from("fundings")
          .select("id, creator_id")
          .eq("id", participation.funding_id)
          .maybeSingle(),
        serviceClient.rpc("is_admin", { user_id: user.id }),
      ]);
    const funding = rawFunding as FundingRecord | null;

    if (fundingError) throw fundingError;
    if (adminError) throw adminError;
    if (!funding) return jsonResponse({ error: "펀딩을 찾을 수 없습니다." }, 404);
    if (funding.creator_id !== user.id && isAdmin !== true) {
      return jsonResponse({ error: "본인이 만든 펀딩의 참여자만 취소할 수 있습니다." }, 403);
    }
    if (participation.status === "fulfilled") {
      return jsonResponse({ error: "이미 제작 처리가 완료된 참여 건은 취소할 수 없습니다." }, 409);
    }
    if (participation.status === "cancelled" && participation.payment_status === "cancelled") {
      return jsonResponse({ success: true, already_cancelled: true, refunded: false });
    }

    let paymentPayload: Record<string, unknown> = {
      reason,
      cancelled_by: isAdmin === true && funding.creator_id !== user.id ? "admin" : "creator",
      cancelled_without_external_refund:
        participation.payment_provider !== "kakaopay" || participation.payment_status !== "paid",
    };

    const needsKakaoPayRefund =
      participation.payment_provider === "kakaopay" && participation.payment_status === "paid";

    if (needsKakaoPayRefund) {
      if (!participation.payment_tid) {
        throw new Error("카카오페이 결제번호를 찾을 수 없습니다.");
      }
      const cancellation = await callKakaoPay("/online/v1/payment/cancel", {
        cid: getKakaoPayCid(),
        tid: participation.payment_tid,
        cancel_amount: participation.total_amount,
        cancel_tax_free_amount: 0,
      });
      paymentPayload = {
        aid: cancellation.aid,
        tid: cancellation.tid,
        status: cancellation.status,
        canceled_at: cancellation.canceled_at,
        canceled_amount: cancellation.canceled_amount,
        reason,
        cancelled_by: isAdmin === true && funding.creator_id !== user.id ? "admin" : "creator",
      };
    }

    const { error: finalizeError } = await serviceClient.rpc(
      "finalize_creator_funding_cancellation",
      {
        p_participation_id: participation.id,
        p_actor_id: user.id,
        p_payment_payload: paymentPayload,
        p_reason: reason,
      },
    );
    if (finalizeError) throw finalizeError;

    return jsonResponse({
      success: true,
      refunded: needsKakaoPayRefund,
      payment_provider: participation.payment_provider,
      funding_id: participation.funding_id,
    });
  } catch (error) {
    console.error("creator-cancel-participation", error);
    return jsonResponse({ error: errorMessage(error) }, 400);
  }
});
