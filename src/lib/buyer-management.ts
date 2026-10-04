import type { XlsxSheet } from "@/lib/xlsx";
import { formatKst } from "@/lib/order-export";

// 펀딩 구매자 관리(제작자 · 관리자 공용): 상태 분류, 필터, 집계, 엑셀 시트.
// 행 데이터는 get_funding_buyers / export_funding_buyers / admin_*_buyers RPC 가 돌려주는 형식 그대로다.

export type BuyerStatusGroup = "paid" | "pending" | "cancelled";

export type BuyerRow = {
  id: string;
  funding_id: string;
  brand_id: string | null;
  creator_id: string | null;
  participant_id: string;
  order_number: string | null;
  funding_name: string | null;
  brand_name: string | null;
  creator_name: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  buyer_email: string | null;
  color: string | null;
  size: string | null;
  quantity: number;
  unit_price: number | null;
  total_amount: number | null;
  order_status: string | null;
  payment_status: string | null;
  payment_type: string | null;
  payment_provider: string | null;
  payment_approved_at: string | null;
  ordered_at: string | null;
  status_group: BuyerStatusGroup;
  production_stage: string | null;
  shipping_status: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  postal_code: string | null;
  address: string | null;
  address_detail: string | null;
  delivery_message: string | null;
  tracking_number: string | null;
  courier: string | null;
};

export type BuyerStatusFilter = "all" | BuyerStatusGroup | "preparing" | "shipped" | "delivered";

export const BUYER_STATUS_FILTERS: { value: BuyerStatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "paid", label: "결제 완료" },
  { value: "pending", label: "결제 대기" },
  { value: "cancelled", label: "취소/환불" },
  { value: "preparing", label: "배송 준비" },
  { value: "shipped", label: "배송 중" },
  { value: "delivered", label: "배송 완료" },
];

export type BuyerFilter = {
  status: BuyerStatusFilter;
  size: string;
  color: string;
  search: string;
};

export const EMPTY_BUYER_FILTER: BuyerFilter = { status: "all", size: "all", color: "all", search: "" };

const digitsOf = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

// 서버 _funding_buyer_rows 의 필터와 같은 규칙
export const matchesBuyerStatus = (row: BuyerRow, status: BuyerStatusFilter) => {
  switch (status) {
    case "all": return true;
    case "paid":
    case "pending":
    case "cancelled": return row.status_group === status;
    default: return row.status_group === "paid" && row.shipping_status === status;
  }
};

export const matchesBuyerSearch = (row: BuyerRow, search: string) => {
  const keyword = search.trim().toLocaleLowerCase("ko-KR");
  if (!keyword) return true;
  const text = [row.buyer_name, row.recipient_name, row.order_number]
    .some((value) => value?.toLocaleLowerCase("ko-KR").includes(keyword));
  if (text) return true;
  const digits = digitsOf(keyword);
  return digits.length >= 3 && [row.buyer_phone, row.recipient_phone].some((phone) => digitsOf(phone).includes(digits));
};

export const filterBuyers = (rows: BuyerRow[], filter: BuyerFilter) =>
  rows.filter((row) =>
    matchesBuyerStatus(row, filter.status)
    && (filter.size === "all" || row.size === filter.size)
    && (filter.color === "all" || row.color === filter.color)
    && matchesBuyerSearch(row, filter.search));

export type BuyerSummary = {
  /** 취소/환불을 제외한 주문의 고유 구매자 수 */
  buyers: number;
  orders: number;
  /** 결제 완료 · 미취소 수량 합계 */
  quantity: number;
  paid: number;
  pending: number;
  cancelled: number;
};

export const summarizeBuyers = (rows: BuyerRow[]): BuyerSummary => ({
  buyers: new Set(rows.filter((row) => row.status_group !== "cancelled").map((row) => row.participant_id)).size,
  orders: rows.length,
  quantity: rows.filter((row) => row.status_group === "paid").reduce((sum, row) => sum + Number(row.quantity ?? 0), 0),
  paid: rows.filter((row) => row.status_group === "paid").length,
  pending: rows.filter((row) => row.status_group === "pending").length,
  cancelled: rows.filter((row) => row.status_group === "cancelled").length,
});

// ---------------------------------------------------------------------------
// 생산 수량 (결제 완료 · 미취소 주문만)
// ---------------------------------------------------------------------------

export type ProductionCell = { color: string; size: string; quantity: number };

export type ProductionSummary = {
  sizes: string[];
  colors: string[];
  bySize: { key: string; quantity: number }[];
  byColor: { key: string; quantity: number }[];
  /** matrix[color][size] */
  matrix: Record<string, Record<string, number>>;
  total: number;
};

const STANDARD_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "XXL", "3XL", "XXXL", "4XL", "5XL", "FREE", "F"];

/** 펀딩에 등록된 순서 → 표준 의류 사이즈 순서 → 숫자 → 가나다 */
export const sortSizes = (sizes: string[], preferred: string[] = []) => {
  const rank = (size: string) => {
    const own = preferred.indexOf(size);
    if (own >= 0) return own;
    const standard = STANDARD_SIZES.indexOf(size.toUpperCase());
    if (standard >= 0) return 1000 + standard;
    const numeric = Number.parseFloat(size);
    return Number.isFinite(numeric) ? 2000 + numeric : 1_000_000;
  };
  return [...sizes].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "ko-KR"));
};

export const productionFromCells = (cells: ProductionCell[], sizeOrder: string[] = [], colorOrder: string[] = []): ProductionSummary => {
  const matrix: Record<string, Record<string, number>> = {};
  const sizeTotals = new Map<string, number>();
  const colorTotals = new Map<string, number>();
  let total = 0;
  for (const cell of cells) {
    const quantity = Number(cell.quantity ?? 0);
    if (!quantity) continue;
    matrix[cell.color] ??= {};
    matrix[cell.color][cell.size] = (matrix[cell.color][cell.size] ?? 0) + quantity;
    sizeTotals.set(cell.size, (sizeTotals.get(cell.size) ?? 0) + quantity);
    colorTotals.set(cell.color, (colorTotals.get(cell.color) ?? 0) + quantity);
    total += quantity;
  }
  const sizes = sortSizes(Array.from(sizeTotals.keys()), sizeOrder);
  const colors = Array.from(colorTotals.keys()).sort((a, b) => {
    const ia = colorOrder.indexOf(a);
    const ib = colorOrder.indexOf(b);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib);
    return (colorTotals.get(b) ?? 0) - (colorTotals.get(a) ?? 0) || a.localeCompare(b, "ko-KR");
  });
  return {
    sizes,
    colors,
    bySize: sizes.map((key) => ({ key, quantity: sizeTotals.get(key) ?? 0 })),
    byColor: colors.map((key) => ({ key, quantity: colorTotals.get(key) ?? 0 })),
    matrix,
    total,
  };
};

export const buildProductionSummary = (rows: BuyerRow[], sizeOrder: string[] = [], colorOrder: string[] = []) =>
  productionFromCells(
    rows.filter((row) => row.status_group === "paid").map((row) => ({ color: row.color ?? "-", size: row.size ?? "-", quantity: row.quantity })),
    sizeOrder,
    colorOrder,
  );

// ---------------------------------------------------------------------------
// 표시용 라벨
// ---------------------------------------------------------------------------

export const paymentStatusLabel = (row: Pick<BuyerRow, "status_group" | "payment_status" | "payment_approved_at">) => {
  if (row.status_group === "cancelled") return row.payment_approved_at ? "환불(취소)" : "취소";
  if (row.status_group === "paid") return "결제 완료";
  return row.payment_status === "failed" ? "결제 실패" : "결제 대기";
};

const SHIPPING_LABEL: Record<string, string> = { preparing: "배송 준비", shipped: "배송 중", delivered: "배송 완료" };

/** 결제 완료 주문만 배송 단계가 의미 있다. 그 외는 "-" */
export const shippingStatusLabel = (row: Pick<BuyerRow, "status_group" | "shipping_status">) =>
  row.status_group === "paid" && row.shipping_status ? SHIPPING_LABEL[row.shipping_status] ?? row.shipping_status : "-";

export const formatKstDate = (value: string | null) => formatKst(value).slice(0, 10);

// ---------------------------------------------------------------------------
// 엑셀
// ---------------------------------------------------------------------------

// DB 에 별도 "옵션" 컬럼이 없어(컬러·사이즈만 저장) 선택 옵션 열은 만들지 않는다.
export const BUYER_EXPORT_HEADERS = [
  "주문번호", "펀딩명", "브랜드명", "제작자명", "구매자명", "연락처", "이메일",
  "선택 컬러", "선택 사이즈", "구매 수량", "개별 판매가", "총 결제금액", "결제 상태", "주문일",
  "배송 상태", "수령인", "배송 연락처", "우편번호", "배송 주소", "상세 주소", "배송 요청사항", "운송장 번호", "택배사",
] as const;

const column = (header: (typeof BUYER_EXPORT_HEADERS)[number]) => BUYER_EXPORT_HEADERS.indexOf(header);

const TEXT_COLUMNS = (["주문번호", "연락처", "배송 연락처", "우편번호", "운송장 번호", "선택 사이즈"] as const).map(column);
const AMOUNT_COLUMNS = (["개별 판매가", "총 결제금액"] as const).map(column);

export const buyerExportRow = (row: BuyerRow) => [
  row.order_number, row.funding_name, row.brand_name, row.creator_name, row.buyer_name, row.buyer_phone, row.buyer_email,
  row.color, row.size, Number(row.quantity ?? 0), row.unit_price, row.total_amount, paymentStatusLabel(row), formatKst(row.ordered_at),
  shippingStatusLabel(row), row.recipient_name, row.recipient_phone, row.postal_code, row.address, row.address_detail,
  row.delivery_message, row.tracking_number, row.courier,
];

export const buildBuyerListSheet = (rows: BuyerRow[]): XlsxSheet => ({
  name: "구매자 목록",
  header: true,
  textColumns: TEXT_COLUMNS,
  amountColumns: AMOUNT_COLUMNS,
  rows: [[...BUYER_EXPORT_HEADERS], ...rows.map(buyerExportRow)],
});

export const buildProductionSummarySheet = (rows: BuyerRow[], sizeOrder: string[] = [], colorOrder: string[] = []): XlsxSheet => {
  const summary = buildProductionSummary(rows, sizeOrder, colorOrder);
  const { sizes, colors, matrix } = summary;
  return {
    name: "생산수량 요약",
    header: true,
    textColumns: [0],
    rows: [
      ["컬러 \\ 사이즈", ...sizes, "합계"],
      ...colors.map((color) => [color, ...sizes.map((size) => matrix[color]?.[size] ?? 0), summary.byColor.find((item) => item.key === color)?.quantity ?? 0]),
      ["합계", ...sizes.map((size) => summary.bySize.find((item) => item.key === size)?.quantity ?? 0), summary.total],
      [],
      ["사이즈별", "수량"],
      ...summary.bySize.map((item) => [item.key, item.quantity]),
      [],
      ["컬러별", "수량"],
      ...summary.byColor.map((item) => [item.key, item.quantity]),
      [],
      [`* 이 파일에 포함된 주문 ${rows.length}건 중 결제 완료 · 미취소 주문 기준 (결제 대기 · 취소/환불 제외)`],
    ],
  };
};

export const buildBuyerWorkbook = (rows: BuyerRow[], sizeOrder: string[] = [], colorOrder: string[] = []): XlsxSheet[] => [
  buildBuyerListSheet(rows),
  buildProductionSummarySheet(rows, sizeOrder, colorOrder),
];

/** BRAND-ER_펀딩명_구매자목록_YYYY-MM-DD.xlsx */
export const buyerExportFileName = (label: string, date: string) => {
  // eslint-disable-next-line no-control-regex
  const safe = label.replace(/[\\/:*?"<>|\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "펀딩";
  return `BRAND-ER_${safe}_구매자목록_${date}.xlsx`;
};
