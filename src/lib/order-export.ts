import type { XlsxSheet } from "@/lib/xlsx";

// 펀딩 주문(참여자) 엑셀 내보내기 공통 형식. 제작자 펀딩 관리 화면과 관리자 주문 관리가 함께 쓴다.

export type OrderExportRow = {
  orderNumber: string | null;
  orderedAt: string | null;
  paidAt: string | null;
  productName: string | null;
  brandName?: string | null;
  color: string | null;
  size: string | null;
  quantity: number;
  unitPrice: number | null;
  totalAmount: number | null;
  /** REAL(실결제) | MOCK(모의결제) */
  paymentType: string | null;
  paymentProvider: string | null;
  paymentStatus: string | null;
  orderStatus: string | null;
  ordererName: string | null;
  ordererPhone: string | null;
  ordererEmail: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  postalCode: string | null;
  address: string | null;
  addressDetail: string | null;
  deliveryMessage: string | null;
  productionStage: string | null;
  shippingStatus: string | null;
  trackingNumber: string | null;
};

const PAYMENT_STATUS: Record<string, string> = { paid: "결제 완료", ready: "결제 대기", unpaid: "미결제", cancelled: "취소", failed: "실패" };
const ORDER_STATUS: Record<string, string> = { pledged: "참여", confirmed: "확정", fulfilled: "완료", cancelled: "취소" };
const PRODUCTION: Record<string, string> = {
  funding: "펀딩 중", fabric_sourcing: "원단 준비", sampling: "샘플 제작", production: "본 생산",
  inspection_packing: "검수·포장", shipping_ready: "출고 준비", delivered: "배송 완료",
};
const SHIPPING: Record<string, string> = { preparing: "배송 준비", shipped: "배송 중", delivered: "배송 완료" };

const label = (map: Record<string, string>, value: string | null) => (value ? map[value] ?? value : "");

/** 한국 시간 "YYYY-MM-DD HH:mm" */
export const formatKst = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16).replace("T", " ");
};

/** 생산 수량에 포함되는 주문: 결제 완료 + 미취소 */
export const isValidOrder = (row: Pick<OrderExportRow, "paymentStatus" | "orderStatus">) =>
  row.paymentStatus === "paid" && row.orderStatus !== "cancelled";

const ORDER_HEADERS = [
  "주문번호", "주문일시", "결제일시", "상품", "브랜드", "컬러", "사이즈", "수량", "단가", "주문금액",
  "결제구분", "결제상태", "주문상태", "주문자", "주문자 연락처", "주문자 이메일",
  "수령인", "수령인 연락처", "우편번호", "주소", "상세주소", "배송메모", "제작단계", "배송상태", "송장번호",
];

export const buildOrderSheet = (rows: OrderExportRow[], includeBrand = true): XlsxSheet => {
  const headers = includeBrand ? ORDER_HEADERS : ORDER_HEADERS.filter((header) => header !== "브랜드");
  return {
    name: "주문 목록",
    header: true,
    rows: [
      headers,
      ...rows.map((row) => {
        const values = [
          row.orderNumber, formatKst(row.orderedAt), formatKst(row.paidAt), row.productName, row.brandName ?? "",
          row.color, row.size, row.quantity, row.unitPrice, row.totalAmount,
          row.paymentType === "MOCK" ? "모의결제" : row.paymentProvider === "none" ? "결제 전(사전 참여)" : `실결제${row.paymentProvider ? `(${row.paymentProvider})` : ""}`,
          label(PAYMENT_STATUS, row.paymentStatus), label(ORDER_STATUS, row.orderStatus),
          row.ordererName, row.ordererPhone, row.ordererEmail,
          row.recipientName, row.recipientPhone, row.postalCode, row.address, row.addressDetail, row.deliveryMessage,
          label(PRODUCTION, row.productionStage), label(SHIPPING, row.shippingStatus), row.trackingNumber,
        ];
        return includeBrand ? values : values.filter((_, index) => index !== 4);
      }),
    ],
  };
};

/** 생산 발주용: 컬러 × 사이즈 수량표(결제 완료·미취소 주문만) */
export const buildQuantitySheet = (rows: OrderExportRow[], sizeOrder: string[] = [], colorOrder: string[] = []): XlsxSheet => {
  const valid = rows.filter(isValidOrder);
  const sizes = Array.from(new Set([...sizeOrder, ...valid.map((row) => row.size ?? "-")])).filter((size) => valid.some((row) => (row.size ?? "-") === size));
  const colors = Array.from(new Set([...colorOrder, ...valid.map((row) => row.color ?? "-")])).filter((color) => valid.some((row) => (row.color ?? "-") === color));
  const count = (color: string | null, size: string | null) =>
    valid.filter((row) => (color === null || (row.color ?? "-") === color) && (size === null || (row.size ?? "-") === size)).reduce((sum, row) => sum + row.quantity, 0);
  return {
    name: "컬러·사이즈별 수량",
    header: true,
    rows: [
      ["컬러 \\ 사이즈", ...sizes, "합계"],
      ...colors.map((color) => [color, ...sizes.map((size) => count(color, size)), count(color, null)]),
      ["합계", ...sizes.map((size) => count(null, size)), count(null, null)],
      [],
      ["* 결제 완료 · 미취소 주문 기준 (결제 대기/취소 제외)"],
    ],
  };
};

export const exportFileDate = () => formatKst(new Date().toISOString()).slice(0, 10);
