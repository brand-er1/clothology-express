import { describe, expect, it } from "vitest";
import { buildSalesWorkbook, buildSellerOrderSheet, cancelStatusLabel, paymentKindLabel, SELLER_ORDER_HEADERS } from "./seller-export";
import type { SellerDashboard, SellerOrder } from "@/services/seller";

const order = (overrides: Partial<SellerOrder>): SellerOrder => ({
  id: "o1", funding_id: "f1", brand_id: null, order_number: "BRANDER-1", funding_name: "후드", brand_name: "ALPHA",
  buyer_name: "김구매", recipient_name: "김구매", color: "black", size: "M", quantity: 2, unit_price: 50000, total_amount: 100000,
  order_status: "confirmed", payment_status: "paid", payment_provider: "ksnet", payment_approved_at: "2026-10-20T01:00:00Z",
  payment_cancelled_at: null, ordered_at: "2026-10-20T00:50:00Z", status_group: "paid", production_stage: "production",
  shipping_status: "preparing", tracking_number: null, courier: null, refund_request_status: null, refund_requested_at: null,
  pg_refund_status: null, cancellation_reason: null, is_mock: false, is_real_paid: true, is_cancelled: false, is_refunded: false,
  address: "서울 강남구 1", ...overrides,
});

describe("seller order export", () => {
  it("labels mock payments so they are never read as revenue", () => {
    expect(paymentKindLabel(order({ is_mock: true, payment_provider: "mock" }))).toBe("모의결제(매출 제외)");
    expect(paymentKindLabel(order({}))).toBe("실결제");
  });

  it("summarises cancel / refund state", () => {
    expect(cancelStatusLabel(order({ is_refunded: true, is_cancelled: true }))).toBe("환불 완료");
    expect(cancelStatusLabel(order({ is_cancelled: true }))).toBe("취소");
    expect(cancelStatusLabel(order({ refund_request_status: "requested" }))).toBe("환불 요청");
    expect(cancelStatusLabel(order({}))).toBe("-");
  });

  it("totals only real, active payments in the footer", () => {
    const sheet = buildSellerOrderSheet([
      order({}),
      order({ id: "o2", is_mock: true, payment_provider: "mock", is_real_paid: false, total_amount: 50000 }),
      order({ id: "o3", is_cancelled: true, is_real_paid: false, total_amount: 70000 }),
    ]);
    expect(sheet.rows[0]).toEqual([...SELLER_ORDER_HEADERS]);
    expect(sheet.rows).toHaveLength(1 + 3 + 3);
    expect(String(sheet.rows[5][0])).toContain("실결제 완료 1건 · 100,000원");
    // 주문번호 · 연락처 열은 텍스트 서식이라 앞자리 0 이 지워지지 않는다.
    expect(sheet.textColumns).toContain(0);
  });
});

describe("sales workbook", () => {
  it("builds product, period and brand sheets", () => {
    const dashboard = {
      range: { from: "2026-10-01", to: "2026-10-30", granularity: "day" },
      kpis: {} as SellerDashboard["kpis"],
      series: [{ date: "2026-10-20", real_amount: 100000, mock_amount: 50000, orders: 1, quantity: 2, refunded_amount: 0 }],
      products: [{
        funding_id: "f1", product_name: "후드", brand_name: "ALPHA", image_url: null, phase: "funding", price: 50000, moq: 20,
        current_orders: 3, progress: 15, real_amount: 100000, mock_amount: 50000, paid_quantity: 2, orders: 1,
        average_rating: 4.5, review_count: 2, series: [],
      }],
      brands: [{ brand_id: "b1", brand_name: "ALPHA", fundings: 1, real_amount: 100000, paid_quantity: 2 }],
    } satisfies SellerDashboard;
    const sheets = buildSalesWorkbook(dashboard);
    expect(sheets.map((sheet) => sheet.name)).toEqual(["상품별 판매", "기간별 추이", "브랜드별"]);
    expect(sheets[0].rows[1].slice(0, 5)).toEqual(["후드", "ALPHA", 2, 100000, 50000]);
    expect(sheets[1].rows[0][0]).toBe("일");
  });
});
