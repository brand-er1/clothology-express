import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { cancelKsnetOrder, type PaymentDb, processKsnetReturn } from "./ksnet-payment.ts";
import type { KsnetApproval } from "./ksnet.ts";

const auth = { participationId: "order-1", commConId: "auth-1", cancelled: false };
const cancellation = { participationId: "order-1", actorId: "buyer-1", source: "participant" as const, reason: "취소 테스트" };
const approved: KsnetApproval = { approved: true, tid: "tid-1", orderNo: "order-1", amount: 2000, authNo: "123", message: "approved" };

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

// Fault-injection double. Real locking/privileges/transaction rollback are tested
// independently against PostgreSQL in scripts/payment-db-tests/.
function fixture(options: {
  approval?: Partial<KsnetApproval>; confirmError?: boolean; refundError?: boolean;
  recordError?: boolean; finalizeError?: boolean; lostCommitResponse?: boolean;
  readError?: boolean; refundWriteError?: boolean; confirmGate?: Promise<void>; refundGate?: Promise<void>;
  status?: string;
} = {}) {
  const state = { status: options.status ?? "ready", operation: "", tid: options.status === "paid" ? "tid-1" : null as string | null,
    approvals: 0, refunds: 0, counted: options.status === "paid" ? 1 : 0, receipt: {} as Record<string, unknown> };
  const db: PaymentDb = {
    rpc(name, args) {
      let data: unknown = null;
      let error: { message: string } | null = null;
      if (name === "claim_ksnet_operation") {
        if (["processing", "review_required"].includes(state.operation)) {
          if (args.p_kind === "refund") error = { message: "결제 또는 환불 결과를 확인 중입니다." };
          else data = { claimed: false };
        } else if (args.p_kind === "confirm" && state.status !== "ready" || args.p_kind === "refund" && state.status === "cancelled") {
          data = { claimed: false, funding_id: "funding-1" };
        } else {
          state.operation = "processing";
          data = { claimed: true, operation_id: "op-1", participation_id: "order-1", funding_id: "funding-1", amount: 2000,
            tid: args.p_kind === "refund" ? state.tid : null };
        }
      } else if (name === "cancel_unapproved_ksnet_payment") {
        if (state.status === "ready" && !["processing", "review_required"].includes(state.operation)) state.status = "cancelled";
      } else if (name === "record_ksnet_approval") {
        if (options.recordError) error = { message: "duplicate TID" };
        else { state.tid = String(args.p_tid); state.receipt = args.p_payload as Record<string, unknown>; }
      } else if (name === "get_ksnet_operation") {
        if (options.readError) error = { message: "connection lost" };
        else data = { state: state.operation, tid: state.tid };
      } else if (name === "finish_ksnet_operation") {
        if (["succeeded", "failed"].includes(state.operation)) return Promise.resolve({ data: null, error: null });
        if (args.p_outcome === "paid" && options.finalizeError || args.p_outcome === "cancelled" && options.refundWriteError) {
          error = { message: "DB transaction rejected" };
        } else if (args.p_outcome === "review_required") {
          state.operation = "review_required";
          state.receipt = { ...state.receipt, ...args.p_payload as Record<string, unknown> };
        } else {
          state.status = String(args.p_outcome);
          state.operation = args.p_outcome === "failed" ? "failed" : "succeeded";
          state.counted = args.p_outcome === "paid" ? 1 : 0;
          if (args.p_outcome === "paid" && options.lostCommitResponse) error = { message: "response lost after commit" };
        }
      } else throw new Error(`Unexpected RPC: ${name}`);
      return Promise.resolve({ data, error });
    },
  };
  const pg = {
    async confirm() {
      state.approvals++;
      await options.confirmGate;
      if (options.confirmError) throw new Error("PG timeout (outcome unknown)");
      return { ...approved, ...options.approval };
    },
    async cancel() {
      state.refunds++;
      await options.refundGate;
      if (options.refundError) throw new Error("Refund outcome unknown");
    },
  };
  return { state, db, pg };
}

Deno.test("정상 승인과 중복 콜백: PG 1회, 수량 1회", async () => {
  const t = fixture();
  assertEquals(await processKsnetReturn(t.db, auth, t.pg), "funding-1");
  await processKsnetReturn(t.db, auth, t.pg);
  assertEquals([t.state.status, t.state.approvals, t.state.counted], ["paid", 1, 1]);
});

Deno.test("동시 승인 요청: 첫 PG 요청이 끝나기 전에 두 번째 요청을 차단", async () => {
  const gate = deferred();
  const t = fixture({ confirmGate: gate.promise });
  const first = processKsnetReturn(t.db, auth, t.pg);
  await processKsnetReturn(t.db, { ...auth, commConId: "another-auth" }, t.pg);
  assertEquals(t.state.approvals, 1);
  gate.resolve(); await first;
  assertEquals(t.state.status, "paid");
});

Deno.test("승인 중/승인 후의 결제창 취소는 환불 없이 상태를 바꾸지 않음", async () => {
  const gate = deferred(); const t = fixture({ confirmGate: gate.promise });
  const first = processKsnetReturn(t.db, auth, t.pg);
  await processKsnetReturn(t.db, { ...auth, cancelled: true }, t.pg);
  assertEquals(t.state.status, "ready");
  gate.resolve(); await first;
  await processKsnetReturn(t.db, { ...auth, cancelled: true }, t.pg);
  assertEquals([t.state.status, t.state.refunds], ["paid", 0]);
});

Deno.test("결제창 취소가 먼저 확정되면 늦은 승인 콜백은 PG를 호출하지 않음", async () => {
  const t = fixture();
  await processKsnetReturn(t.db, { ...auth, cancelled: true }, t.pg);
  await processKsnetReturn(t.db, auth, t.pg);
  assertEquals([t.state.status, t.state.approvals], ["cancelled", 0]);
});

for (const approval of [{ orderNo: "wrong-order" }, { orderNo: "" }, { amount: 1000 }]) {
  Deno.test(`승인 정보 불일치 시 거래번호 보존 후 자동 환불: ${JSON.stringify(approval)}`, async () => {
    const t = fixture({ approval });
    await processKsnetReturn(t.db, auth, t.pg);
    assertEquals([t.state.status, t.state.refunds, t.state.tid, t.state.counted], ["cancelled", 1, "tid-1", 0]);
  });
}

Deno.test("불일치 자동 환불 실패: 거래번호와 확인 필요 기록 유지", async () => {
  const t = fixture({ approval: { orderNo: "wrong-order" }, refundError: true });
  await processKsnetReturn(t.db, auth, t.pg);
  await processKsnetReturn(t.db, auth, t.pg);
  assertEquals([t.state.status, t.state.operation, t.state.tid, t.state.approvals], ["ready", "review_required", "tid-1", 1]);
});

Deno.test("승인 네트워크 오류: 실패로 단정하거나 승인 재시도하지 않음", async () => {
  const t = fixture({ confirmError: true });
  await processKsnetReturn(t.db, auth, t.pg);
  await processKsnetReturn(t.db, auth, t.pg);
  assertEquals([t.state.status, t.state.operation, t.state.approvals], ["ready", "review_required", 1]);
});

Deno.test("명시적인 승인 거절: 수량을 늘리지 않고 실패 확정", async () => {
  const t = fixture({ approval: { approved: false } });
  await processKsnetReturn(t.db, auth, t.pg);
  assertEquals([t.state.status, t.state.refunds, t.state.counted], ["failed", 0, 0]);
});

Deno.test("다른 주문의 거래번호 중복 감지: 해당 거래를 임의 환불하지 않음", async () => {
  const t = fixture({ recordError: true });
  await processKsnetReturn(t.db, auth, t.pg);
  assertEquals([t.state.operation, t.state.refunds, t.state.receipt.tid], ["review_required", 0, "tid-1"]);
});

Deno.test("승인 후 DB 확정 실패: 저장된 거래번호로 자동 환불", async () => {
  const t = fixture({ finalizeError: true });
  await processKsnetReturn(t.db, auth, t.pg);
  assertEquals([t.state.status, t.state.refunds, t.state.tid], ["cancelled", 1, "tid-1"]);
});

Deno.test("확정 커밋 후 응답 유실: 이미 결제된 주문을 자동 환불하지 않음", async () => {
  const t = fixture({ lostCommitResponse: true });
  assertEquals(await processKsnetReturn(t.db, auth, t.pg), "funding-1");
  assertEquals([t.state.status, t.state.refunds], ["paid", 0]);
});

Deno.test("확정 결과 조회까지 실패: 재승인/환불 없이 확인 필요 상태 유지", async () => {
  const t = fixture({ finalizeError: true, readError: true });
  await processKsnetReturn(t.db, auth, t.pg);
  assertEquals([t.state.operation, t.state.refunds], ["review_required", 0]);
});

Deno.test("구매자와 판매자의 동시 환불: PG 취소는 한 번만 호출", async () => {
  const gate = deferred(); const t = fixture({ status: "paid", refundGate: gate.promise });
  const first = cancelKsnetOrder(t.db, cancellation, t.pg);
  await assertRejects(() => cancelKsnetOrder(t.db, { ...cancellation, source: "creator", actorId: "seller-1" }, t.pg));
  gate.resolve(); await first;
  assertEquals([t.state.status, t.state.refunds, t.state.counted], ["cancelled", 1, 0]);
});

Deno.test("승인 처리 중 구매자 취소 차단", async () => {
  const gate = deferred(); const t = fixture({ confirmGate: gate.promise });
  const first = processKsnetReturn(t.db, auth, t.pg);
  await assertRejects(() => cancelKsnetOrder(t.db, cancellation, t.pg));
  gate.resolve(); await first;
  assertEquals([t.state.status, t.state.refunds], ["paid", 0]);
});

Deno.test("환불 실패: paid 유지, 재시도로 중복 취소하지 않음", async () => {
  const t = fixture({ status: "paid", refundError: true });
  await assertRejects(() => cancelKsnetOrder(t.db, cancellation, t.pg));
  await assertRejects(() => cancelKsnetOrder(t.db, cancellation, t.pg));
  assertEquals([t.state.status, t.state.operation, t.state.refunds], ["paid", "review_required", 1]);
});

Deno.test("환불 성공 후 DB 실패: 환불 확인 기록 보존", async () => {
  const t = fixture({ status: "paid", refundWriteError: true });
  await assertRejects(() => cancelKsnetOrder(t.db, cancellation, t.pg));
  assertEquals([t.state.operation, t.state.receipt.refund_confirmed, t.state.refunds], ["review_required", true, 1]);
});

Deno.test("미결제 주문 취소: PG 취소 없이 확정", async () => {
  const t = fixture();
  const result = await cancelKsnetOrder(t.db, cancellation, t.pg);
  assertEquals([t.state.status, result.refunded, t.state.refunds], ["cancelled", false, 0]);
});
