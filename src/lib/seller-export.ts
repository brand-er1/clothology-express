import type { XlsxSheet } from "@/lib/xlsx";
import { formatKst } from "@/lib/order-export";
import type { SellerDashboard, SellerOrder } from "@/services/seller";

// 판매자 센터 엑셀. 행 데이터는 seller_export_orders / seller_get_dashboard 결과 그대로다.
// 모의결제는 "결제 구분" 열로 따로 표시하고 매출 합계에 넣지 않는다.

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: "미결제", ready: "결제 대기", paid: "결제 완료", cancelled: "결제 취소", failed: "결제 실패",
};
const SHIPPING_LABEL: Record<string, string> = { preparing: "배송 준비", shipped: "배송중", delivered: "배송 완료" };
const PRODUCTION_LABEL: Record<string, string> = {
  funding: "펀딩중", fabric_sourcing: "원단 컨택", sampling: "샘플 제작", production: "본생산",
  inspection_packing: "검수·포장", shipping_ready: "배송 준비", delivered: "배송 완료",
};
const REFUND_LABEL: Record<string, string> = {
  requested: "환불 요청", reviewing: "검토중", approved: "승인", rejected: "반려", processing: "환불 처리중", completed: "환불 완료",
};

export const paymentKindLabel = (row: Pick<SellerOrder, "is_mock" | "payment_provider">) =>
  row.is_mock ? "모의결제(매출 제외)" : row.payment_provider === "none" ? "결제 없음" : "실결제";

/** 취소·환불 상태 한 줄 요약 */
export const cancelStatusLabel = (row: Pick<SellerOrder, "is_refunded" | "is_cancelled" | "refund_request_status">) => {
  if (row.is_refunded) return "환불 완료";
  if (row.is_cancelled) return "취소";
  if (row.refund_request_status) return REFUND_LABEL[row.refund_request_status] ?? row.refund_request_status;
  return "-";
};

export const SELLER_ORDER_HEADERS = [
  "주문번호", "상품명", "브랜드", "결제 구분", "구매자", "연락처", "이메일", "컬러", "사이즈", "수량", "판매가", "결제금액",
  "주문일", "결제 상태", "결제 승인일", "제작 단계", "배송 상태", "취소·환불", "수령인", "배송 연락처", "우편번호",
  "주소", "상세 주소", "배송 요청사항", "택배사", "운송장 번호",
] as const;

const col = (header: (typeof SELLER_ORDER_HEADERS)[number]) => SELLER_ORDER_HEADERS.indexOf(header);

export const sellerOrderRow = (row: SellerOrder) => [
  row.order_number, row.funding_name, row.brand_name, paymentKindLabel(row), row.buyer_name, row.buyer_phone ?? null,
  row.buyer_email ?? null, row.color, row.size, Number(row.quantity ?? 0), row.unit_price, row.total_amount,
  formatKst(row.ordered_at), PAYMENT_STATUS_LABEL[row.payment_status ?? ""] ?? row.payment_status, formatKst(row.payment_approved_at),
  PRODUCTION_LABEL[row.production_stage ?? ""] ?? row.production_stage ?? "-", SHIPPING_LABEL[row.shipping_status ?? ""] ?? "-",
  cancelStatusLabel(row), row.recipient_name, row.recipient_phone ?? null, row.postal_code ?? null, row.address ?? null,
  row.address_detail ?? null, row.delivery_message ?? null, row.courier, row.tracking_number,
];

export const buildSellerOrderSheet = (rows: SellerOrder[]): XlsxSheet => {
  const real = rows.filter((row) => row.is_real_paid);
  return {
    name: "주문 목록",
    header: true,
    textColumns: (["주문번호", "연락처", "배송 연락처", "우편번호", "운송장 번호", "사이즈"] as const).map(col),
    amountColumns: (["판매가", "결제금액"] as const).map(col),
    rows: [
      [...SELLER_ORDER_HEADERS],
      ...rows.map(sellerOrderRow),
      [],
      [`* 실결제 완료 ${real.length}건 · ${real.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0).toLocaleString("ko-KR")}원 (모의결제 · 취소 · 결제 대기 제외)`],
      ["* 취소 · 환불 주문은 배송하지 않으므로 연락처와 주소를 포함하지 않습니다."],
    ],
  };
};

/** 판매 데이터: 상품별 · 기간별 · 브랜드별 */
export const buildSalesWorkbook = (dashboard: SellerDashboard): XlsxSheet[] => {
  const unit = { day: "일", week: "주(시작일)", month: "월" }[dashboard.range.granularity];
  return [
    {
      name: "상품별 판매",
      header: true,
      amountColumns: [3, 4, 5],
      rows: [
        ["상품명", "브랜드", "판매 수량(실결제)", "실결제 매출", "모의결제(매출 제외)", "판매가", "주문 수", "목표 달성률(%)", "평균 평점", "리뷰 수"],
        ...dashboard.products.map((p) => [
          p.product_name, p.brand_name ?? "-", p.paid_quantity, p.real_amount, p.mock_amount, p.price, p.orders,
          Number(p.progress), Number(p.average_rating), p.review_count,
        ]),
      ],
    },
    {
      name: "기간별 추이",
      header: true,
      amountColumns: [1, 2, 5],
      rows: [
        [unit, "실결제 매출", "모의결제(매출 제외)", "주문 수", "판매 수량", "환불 금액"],
        ...dashboard.series.map((s) => [s.date, s.real_amount, s.mock_amount, s.orders, s.quantity, s.refunded_amount]),
      ],
    },
    {
      name: "브랜드별",
      header: true,
      amountColumns: [2],
      rows: [
        ["브랜드", "펀딩 수", "실결제 매출", "판매 수량"],
        ...dashboard.brands.map((b) => [b.brand_name, b.fundings, b.real_amount, b.paid_quantity]),
      ],
    },
  ];
};

export const sellerFileName = (kind: string, date: string) => `BRAND-ER_판매자센터_${kind}_${date}.xlsx`;
