import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  cancelKsnetPayment,
  confirmKsnetTransaction,
  parseKsnetAuthResult,
} from "../_shared/ksnet.ts";
import { dispatchNotificationsSafely } from "../_shared/notificationDispatch.ts";

// KSPay 결제창이 카드 인증을 끝내고 **브라우저가 POST 로 돌아오는** 곳(sndReply).
//
// JWT 검증을 끈다(config.toml). KSPay 는 Supabase JWT 를 모른다.
// 그래서 여기서 믿는 건 두 가지뿐이다: 추측 불가능한 참여 ID, 그리고 우리가 DB 금액으로
// 직접 건 KSNET 승인 응답. 결제창이 보낸 값으로 결제를 확정하지 않는다.
//
// PC 에서는 여기가 팝업 안이다. 부모 창을 결과 화면으로 옮기고 팝업은 닫는다.

const resultUrl = (participationId?: string) => {
  const base = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "");
  const query = participationId ? `?participationId=${encodeURIComponent(participationId)}` : "";
  return `${base}/payments/ksnet/result${query}`;
};

const handoff = (url: string) => {
  const safe = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return new Response(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${safe}">
<title>결제 처리 중</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;padding:40px;text-align:center;color:#57534e">
<p>결제 결과를 확인하고 있습니다…</p>
<script>
(function () {
  var url = ${JSON.stringify(url)};
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.location.replace(url);
      window.close();
      return;
    }
  } catch (e) { /* 다른 출처면 opener 접근이 막힌다. 아래로 떨어진다 */ }
  location.replace(url);
})();
</script>
</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return handoff(resultUrl());

  const auth = parseKsnetAuthResult(await req.text(), req.url);
  if (!auth) {
    console.error("ksnet-return: 알아볼 수 없는 요청");
    return handoff(resultUrl());
  }

  try {
    const db = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: participation, error } = await db
      .from("funding_participations")
      .select("id, participant_id, funding_id, payment_provider, payment_status, total_amount")
      .eq("id", auth.participationId)
      .maybeSingle();
    if (error) throw error;
    if (!participation || participation.payment_provider !== "ksnet") {
      console.error("ksnet-return: 참여 없음", { participationId: auth.participationId });
      return handoff(resultUrl());
    }

    const done = () => handoff(resultUrl(participation.id));

    // 결제창에서 취소를 눌렀다. 승인을 걸 게 없다.
    if (auth.cancelled) {
      if (participation.payment_status === "ready") {
        await db.rpc("finalize_funding_cancellation", {
          p_participation_id: participation.id,
          p_user_id: participation.participant_id,
          p_payment_payload: { reason: "KSPay 결제창에서 취소", cancelled_without_payment: true },
        });
      }
      return done();
    }

    // 이미 확정됐으면 승인을 다시 걸지 않는다. 이중 승인은 이중 청구다.
    if (participation.payment_status !== "ready") return done();

    // ★ 승인. 금액은 우리 DB 값이다.
    const approval = await confirmKsnetTransaction(auth.commConId, participation.total_amount);

    if (!approval.approved) {
      await db.rpc("fail_funding_payment", {
        p_participation_id: participation.id,
        p_user_id: participation.participant_id,
        p_error_payload: { stage: "confirm", message: approval.message, auth_no: approval.authNo },
      });
      return done();
    }

    // KSNET 이 알려준 주문번호가 다르면 다른 거래를 승인한 것이다. 확정하지 않는다.
    if (approval.orderNo && approval.orderNo !== participation.id) {
      console.error("ksnet-return: 주문번호 불일치", { participationId: participation.id, tid: approval.tid });
      return done();
    }

    const paymentPayload = {
      tid: approval.tid,
      auth_no: approval.authNo,
      amount: approval.amount,
      message: approval.message,
    };

    const { error: tidError } = await db
      .from("funding_participations")
      .update({ payment_tid: approval.tid, updated_at: new Date().toISOString() })
      .eq("id", participation.id);
    const { error: finalizeError } = tidError
      ? { error: tidError }
      : await db.rpc("finalize_funding_payment", {
        p_participation_id: participation.id,
        p_user_id: participation.participant_id,
        p_payment_method_type: "CARD",
        p_approved_at: new Date().toISOString(),
        p_payment_payload: paymentPayload,
      });

    if (finalizeError) {
      // 돈은 승인됐는데 참여 반영에 실패했다. 승인을 되돌린다 (kakaopay-approve 와 같은 규칙).
      console.error("ksnet-return finalize", finalizeError);
      try {
        await cancelKsnetPayment(approval.tid);
        await db.rpc("finalize_funding_cancellation", {
          p_participation_id: participation.id,
          p_user_id: participation.participant_id,
          p_payment_payload: { ...paymentPayload, auto_cancelled: true },
        });
      } catch (rollbackError) {
        // 여기까지 오면 사람이 KStA 에서 직접 취소해야 한다. 찾을 수 있게 tid 를 남긴다.
        console.error("ksnet-return rollback 실패 — KStA 에서 수동 취소 필요", {
          participationId: participation.id,
          tid: approval.tid,
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        });
      }
      return done();
    }

    // 펀딩 성공 판정은 결제 트랜잭션 안에서 DB 가 이미 끝냈다. 만들어진 SMS 작업만 발송한다.
    await dispatchNotificationsSafely(db, { fundingId: participation.funding_id as string });
    return done();
  } catch (error) {
    // 500 을 주면 구매자가 흰 화면을 본다. 결과 화면이 DB 상태를 그대로 보여준다.
    console.error("ksnet-return", error);
    return handoff(resultUrl(auth.participationId));
  }
});
