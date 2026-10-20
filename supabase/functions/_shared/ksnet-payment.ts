import { cancelKsnetPayment, confirmKsnetTransaction, type KsnetApproval, type KsnetAuthResult } from "./ksnet.ts";

export type PaymentDb = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;
};
type Gateway = {
  confirm: (reference: string, amount: number) => Promise<KsnetApproval>;
  cancel: (tid: string) => Promise<void>;
};
const gateway: Gateway = { confirm: confirmKsnetTransaction, cancel: cancelKsnetPayment };
type Claim = {
  claimed: boolean;
  operation_id: string;
  participation_id: string;
  funding_id: string;
  amount: number;
  tid: string | null;
};
type Operation = { state: string; tid: string | null };

async function rpc<T>(db: PaymentDb, name: string, args: Record<string, unknown>): Promise<T> {
  const result = await db.rpc(name, args);
  if (result.error) throw new Error(`${name}: ${result.error.message}`);
  return result.data as T;
}

const finish = (db: PaymentDb, id: string, outcome: string, payload: Record<string, unknown> = {}) =>
  rpc(db, "finish_ksnet_operation", { p_operation_id: id, p_outcome: outcome, p_payload: payload });

async function requireReview(db: PaymentDb, claim: Claim, error: unknown, payload: Record<string, unknown> = {}) {
  const detail = { ...payload, error: error instanceof Error ? error.message : String(error) };
  // Keep the durable claim even if this write fails; never reopen a possibly charged order.
  console.error("KSNET 결과 확인 필요", { operationId: claim.operation_id, participationId: claim.participation_id, ...detail });
  try {
    await finish(db, claim.operation_id, "review_required", detail);
  } catch (recordError) {
    console.error("KSNET 확인 필요 기록 실패 — 기존 처리 잠금 유지", recordError);
  }
}

async function compensate(db: PaymentDb, claim: Claim, approval: KsnetApproval, pg: Gateway, reason: string) {
  let refundConfirmed = false;
  try {
    await pg.cancel(approval.tid);
    refundConfirmed = true;
    await finish(db, claim.operation_id, "cancelled", { refund_confirmed: true, auto_cancelled: true, reason });
  } catch (error) {
    await requireReview(db, claim, error, { tid: approval.tid, refund_confirmed: refundConfirmed, reason });
  }
}

/** One durable DB claim per order, acquired BEFORE any external approval call. */
export async function processKsnetReturn(db: PaymentDb, auth: KsnetAuthResult, pg: Gateway = gateway): Promise<string | null> {
  if (auth.cancelled) {
    await rpc(db, "cancel_unapproved_ksnet_payment", { p_participation_id: auth.participationId });
    return null;
  }
  const claim = await rpc<Claim>(db, "claim_ksnet_operation", {
    p_participation_id: auth.participationId, p_kind: "confirm", p_comm_con_id: auth.commConId,
  });
  if (!claim.claimed) return null;

  let approval: KsnetApproval;
  try {
    approval = await pg.confirm(auth.commConId, claim.amount);
  } catch (error) {
    // A lost response does not mean that the card was not charged.
    await requireReview(db, claim, error, { stage: "confirm" });
    return null;
  }
  if (!approval.approved) {
    await finish(db, claim.operation_id, "failed", { stage: "confirm", message: approval.message });
    return null;
  }
  if (!approval.tid) {
    await requireReview(db, claim, "승인 응답에 거래번호가 없습니다.", { stage: "confirm" });
    return null;
  }
  const receipt = { tid: approval.tid, order_no: approval.orderNo, amount: approval.amount, auth_no: approval.authNo, message: approval.message };
  try {
    await rpc(db, "record_ksnet_approval", { p_operation_id: claim.operation_id, p_tid: approval.tid, p_payload: receipt });
  } catch (error) {
    // A duplicate TID may belong to another order. Never cancel it blindly.
    await requireReview(db, claim, error, { ...receipt, stage: "record_approval" });
    return null;
  }

  if (approval.orderNo !== claim.participation_id || approval.amount !== claim.amount) {
    await compensate(db, claim, approval, pg, "승인 주문번호 또는 금액 불일치");
    return null;
  }
  try {
    await finish(db, claim.operation_id, "paid");
  } catch (error) {
    // The transaction may have committed but its HTTP response was lost.
    // Read the durable result before deciding whether to reverse the charge.
    try {
      const operation = await rpc<Operation>(db, "get_ksnet_operation", { p_operation_id: claim.operation_id });
      if (operation?.state === "succeeded") return claim.funding_id;
      if (operation?.state !== "processing") throw new Error("결제 확정 상태를 확인할 수 없습니다.");
    } catch (readError) {
      await requireReview(db, claim, readError, { ...receipt, stage: "finalize" });
      return null;
    }
    await compensate(db, claim, approval, pg, error instanceof Error ? error.message : "주문 확정 실패");
    return null;
  }
  return claim.funding_id;
}

/** Buyer and creator refunds use the same claim, including cancellation before payment. */
export async function cancelKsnetOrder(db: PaymentDb, input: {
  participationId: string; actorId: string; source: "participant" | "creator"; reason: string;
}, pg: Gateway = gateway) {
  const claim = await rpc<Claim>(db, "claim_ksnet_operation", {
    p_participation_id: input.participationId, p_kind: "refund", p_actor_id: input.actorId,
    p_source: input.source, p_reason: input.reason,
  });
  if (!claim.claimed) return { success: true, already_cancelled: true, refunded: false, funding_id: claim.funding_id };
  let refundConfirmed = false;
  try {
    if (claim.tid) {
      await pg.cancel(claim.tid);
      refundConfirmed = true;
    }
    await finish(db, claim.operation_id, "cancelled", { reason: input.reason, refund_confirmed: refundConfirmed });
    return { success: true, refunded: refundConfirmed, funding_id: claim.funding_id, payment_provider: "ksnet" };
  } catch (error) {
    await requireReview(db, claim, error, { tid: claim.tid, refund_confirmed: refundConfirmed, stage: "refund" });
    throw new Error("환불 결과를 확인 중입니다. 관리자에게 문의해주세요.");
  }
}
