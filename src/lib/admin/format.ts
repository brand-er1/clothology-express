export const won = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === "" ? "-" : `${Number(value).toLocaleString("ko-KR")}원`;

export const num = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === "" ? "-" : Number(value).toLocaleString("ko-KR");

export const pct = (value: number | string | null | undefined, digits = 1) =>
  value === null || value === undefined || value === "" ? "-" : `${Number(value).toFixed(digits)}%`;

export const compactWon = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "-";
  const abs = Math.abs(value);
  if (abs >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000) return `${Math.round(value / 10_000).toLocaleString("ko-KR")}만`;
  return value.toLocaleString("ko-KR");
};

export const dateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";

export const dateOnly = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }) : "-";

export type Tone = "neutral" | "wine" | "green" | "amber" | "red" | "blue" | "violet";

export const FUNDING_PHASE: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "작성중", tone: "neutral" },
  pending: { label: "승인대기", tone: "amber" },
  approved: { label: "승인(비공개)", tone: "blue" },
  funding: { label: "펀딩중", tone: "wine" },
  succeeded: { label: "성공", tone: "green" },
  failed: { label: "실패", tone: "red" },
  in_production: { label: "제작중", tone: "violet" },
  shipping: { label: "배송중", tone: "blue" },
  completed: { label: "완료", tone: "green" },
  suspended: { label: "중단", tone: "red" },
  rejected: { label: "반려", tone: "neutral" },
};

export const ORDER_STATE: Record<string, { label: string; tone: Tone }> = {
  payment_pending: { label: "결제대기", tone: "amber" },
  paid: { label: "결제완료", tone: "wine" },
  in_production: { label: "제작중", tone: "violet" },
  ready_to_ship: { label: "배송준비", tone: "blue" },
  shipping: { label: "배송중", tone: "blue" },
  delivered: { label: "배송완료", tone: "green" },
  cancelled: { label: "취소", tone: "neutral" },
  refunded: { label: "환불", tone: "red" },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  unpaid: { label: "미결제", tone: "neutral" },
  ready: { label: "결제 대기", tone: "amber" },
  paid: { label: "결제완료", tone: "green" },
  cancelled: { label: "취소", tone: "red" },
  failed: { label: "실패", tone: "red" },
};

export const PG_STATUS: Record<string, { label: string; tone: Tone }> = {
  not_applicable: { label: "PG 해당없음(모의)", tone: "neutral" },
  not_requested: { label: "PG 미요청", tone: "neutral" },
  ready: { label: "PG 결제준비", tone: "amber" },
  approved: { label: "PG 승인", tone: "green" },
  cancelled: { label: "PG 취소", tone: "red" },
  failed: { label: "PG 실패", tone: "red" },
};

export const REFUND_STATUS: Record<string, { label: string; tone: Tone }> = {
  requested: { label: "환불요청", tone: "amber" },
  reviewing: { label: "검토중", tone: "blue" },
  approved: { label: "승인", tone: "wine" },
  rejected: { label: "반려", tone: "neutral" },
  processing: { label: "환불처리중", tone: "violet" },
  completed: { label: "환불완료", tone: "green" },
};

export const PG_REFUND_STATUS: Record<string, string> = {
  not_started: "미시작",
  not_applicable_mock: "모의결제(PG 환불 불필요)",
  awaiting_pg_integration: "PG 연동 전 · 수동 환불 필요",
  manual_confirmed: "PG 콘솔 수동 환불 확인",
  pg_refunded: "PG 환불 완료",
};

export const SETTLEMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "정산대기", tone: "amber" },
  scheduled: { label: "정산예정", tone: "blue" },
  completed: { label: "정산완료", tone: "green" },
  on_hold: { label: "보류", tone: "red" },
};

export const PRODUCTION_STAGES = [
  { key: "funding_success", label: "펀딩 성공" },
  { key: "fabric_contact", label: "원단 컨택" },
  { key: "pattern_sample", label: "패턴/샘플 제작" },
  { key: "sample_review", label: "샘플 확인" },
  { key: "mass_production", label: "본생산" },
  { key: "inspection_packing", label: "검수/포장" },
  { key: "shipping_ready", label: "배송 준비" },
  { key: "shipping", label: "배송중" },
  { key: "delivered", label: "배송완료" },
] as const;

export const productionLabel = (key: string | null | undefined) =>
  PRODUCTION_STAGES.find((stage) => stage.key === key)?.label ?? "미시작";

export const SHIPPING_STATE: Record<string, { label: string; tone: Tone }> = {
  preparing: { label: "배송 준비", tone: "neutral" },
  invoiced: { label: "송장 등록", tone: "amber" },
  shipped: { label: "배송중", tone: "blue" },
  delivered: { label: "배송완료", tone: "green" },
};

export const ACCOUNT_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "정상", tone: "green" },
  restricted: { label: "이용제한", tone: "amber" },
  suspended: { label: "정지", tone: "red" },
  archived: { label: "보관", tone: "neutral" },
};

export const BRAND_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "운영중", tone: "green" },
  suspended: { label: "정지", tone: "red" },
  archived: { label: "보관", tone: "neutral" },
};

export const BRAND_REVIEW: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "검수대기", tone: "amber" },
  approved: { label: "승인", tone: "green" },
  rejected: { label: "반려", tone: "red" },
};

export const CS_STATUS: Record<string, { label: string; tone: Tone }> = {
  open: { label: "접수", tone: "amber" },
  in_progress: { label: "처리중", tone: "blue" },
  waiting_customer: { label: "고객 응답대기", tone: "violet" },
  resolved: { label: "해결", tone: "green" },
  closed: { label: "종료", tone: "neutral" },
};

export const CS_CATEGORY: Record<string, string> = {
  order: "주문", shipping: "배송", refund: "취소/환불", payment: "결제",
  account: "계정", funding: "펀딩", report: "신고", other: "기타",
};

export const REPORT_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "미처리", tone: "amber" },
  reviewed: { label: "조치완료", tone: "green" },
  dismissed: { label: "기각", tone: "neutral" },
};

export const errorMessage = (error: unknown) => {
  const candidate = error as { message?: string; details?: string } | null;
  return candidate?.message || (error instanceof Error ? error.message : "요청을 처리하지 못했습니다.");
};
