import { supabase } from "@/lib/supabase";

// 판매자 센터(/seller) 조회 · 처리. 모든 seller_* RPC 는 서버에서 auth.uid() 의 펀딩만 다루므로
// 이 파일은 권한을 판단하지 않는다. 금액(실결제/모의결제 구분 포함)도 서버가 계산한 값을 그대로 쓴다.

const rpc = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) throw new Error(error.message || "요청을 처리하지 못했습니다.");
  return data as T;
};

export type Granularity = "day" | "week" | "month";

export type SellerKpis = {
  total_sales: number;
  paid_amount: number;
  refunded_amount: number;
  mock_amount: number;
  mock_orders: number;
  settlement_scheduled: number;
  settlement_completed: number;
  unsettled_paid_amount: number;
  active_fundings: number;
  ended_fundings: number;
  pending_fundings: number;
  total_fundings: number;
  total_orders: number;
  active_orders: number;
  cancelled_orders: number;
  refunded_orders: number;
  open_refund_requests: number;
  paid_quantity: number;
  average_rating: number;
  review_count: number;
  new_reviews_7d: number;
  unanswered_reviews: number;
  pending_inquiries: number;
};

export type SellerSeriesPoint = {
  date: string;
  real_amount: number;
  mock_amount: number;
  orders: number;
  quantity: number;
  refunded_amount: number;
};

export type SellerProductStat = {
  funding_id: string;
  product_name: string;
  brand_name: string | null;
  image_url: string | null;
  phase: string;
  price: number | null;
  moq: number;
  current_orders: number;
  progress: number;
  real_amount: number;
  mock_amount: number;
  paid_quantity: number;
  orders: number;
  average_rating: number;
  review_count: number;
  series: { date: string; real_amount: number; quantity: number }[];
};

export type SellerBrandStat = {
  brand_id: string | null;
  brand_name: string;
  fundings: number;
  real_amount: number;
  paid_quantity: number;
};

export type SellerDashboard = {
  range: { from: string; to: string; granularity: Granularity };
  kpis: SellerKpis;
  series: SellerSeriesPoint[];
  products: SellerProductStat[];
  brands: SellerBrandStat[];
};

export const fetchSellerDashboard = (granularity: Granularity = "day") =>
  rpc<SellerDashboard>("seller_get_dashboard", { p_granularity: granularity });

export type SellerProduct = {
  id: string;
  product_name: string;
  brand_id: string | null;
  brand_name: string | null;
  image_url: string | null;
  cloth_type: string;
  material: string;
  price: number | null;
  color_options: string[];
  size_options: string[];
  color_count: number;
  moq: number;
  current_orders: number;
  progress: number;
  funding_days: number;
  status: string;
  admin_comment: string | null;
  phase: string;
  start_at: string | null;
  end_at: string | null;
  early_closed: boolean;
  early_closed_at: string | null;
  closed_at: string | null;
  suspended_at: string | null;
  production_status: string | null;
  production_label: string;
  production_updated_at: string | null;
  success_at: string | null;
  created_at: string;
  updated_at: string;
  real_paid_orders: number;
  real_amount: number;
  mock_orders: number;
  pending_payment_orders: number;
  review_count: number;
  average_rating: number;
  pending_inquiries: number;
  can_edit: boolean;
  can_request_early_close: boolean;
  can_advance_production: boolean;
};

export const fetchSellerProducts = () => rpc<SellerProduct[]>("seller_list_products");

export type SellerOrderStatus =
  | "all" | "paid" | "pending" | "cancelled" | "refund_requested" | "preparing" | "shipped" | "delivered" | "failed";
export type SellerPaymentType = "all" | "real" | "mock";

export type SellerOrder = {
  id: string;
  funding_id: string;
  brand_id: string | null;
  order_number: string | null;
  funding_name: string | null;
  brand_name: string | null;
  buyer_name: string | null;
  recipient_name: string | null;
  buyer_phone_masked?: string | null;
  color: string | null;
  size: string | null;
  quantity: number;
  unit_price: number | null;
  total_amount: number | null;
  order_status: string | null;
  payment_status: string | null;
  payment_provider: string | null;
  payment_approved_at: string | null;
  payment_cancelled_at: string | null;
  ordered_at: string | null;
  status_group: "paid" | "pending" | "cancelled";
  production_stage: string | null;
  shipping_status: string | null;
  tracking_number: string | null;
  courier: string | null;
  refund_request_status: string | null;
  refund_requested_at: string | null;
  pg_refund_status: string | null;
  cancellation_reason: string | null;
  is_mock: boolean;
  is_real_paid: boolean;
  is_cancelled: boolean;
  is_refunded: boolean;
  // 엑셀 다운로드(seller_export_orders)에만 들어오는 배송 정보
  buyer_phone?: string | null;
  buyer_email?: string | null;
  recipient_phone?: string | null;
  postal_code?: string | null;
  address?: string | null;
  address_detail?: string | null;
  delivery_message?: string | null;
};

export type SellerOrderFilter = {
  fundingId: string | null;
  search: string;
  status: SellerOrderStatus;
  paymentType: SellerPaymentType;
};

export type SellerOrderList = {
  total: number;
  counts: { all: number; paid: number; pending: number; cancelled: number; mock: number };
  rows: SellerOrder[];
};

const orderArgs = (filter: SellerOrderFilter) => ({
  p_funding_id: filter.fundingId,
  p_search: filter.search.trim() || null,
  p_status: filter.status,
  p_payment_type: filter.paymentType,
});

export const fetchSellerOrders = (filter: SellerOrderFilter, limit: number, offset: number) =>
  rpc<SellerOrderList>("seller_list_orders", { ...orderArgs(filter), p_limit: limit, p_offset: offset });

/** 배송 처리용 전체 정보. 서버가 다운로드 기록을 남긴다. */
export const exportSellerOrders = (filter: SellerOrderFilter) =>
  rpc<{ rows: SellerOrder[]; count: number }>("seller_export_orders", orderArgs(filter));

// ---------------------------------------------------------------------------
// 리뷰
// ---------------------------------------------------------------------------

export type ReplyFilter = "all" | "unanswered" | "answered";
export type SellerReviewSort = "latest" | "oldest" | "rating_desc" | "rating_asc";

export type SellerReview = {
  id: string;
  funding_id: string;
  funding_name: string;
  order_number: string | null;
  rating: number;
  content: string;
  image_paths: string[];
  nickname: string;
  selected_color: string | null;
  selected_size: string | null;
  quantity: number | null;
  fit_rating: "small" | "true_to_size" | "large" | null;
  quality_rating: number | null;
  delivery_rating: number | null;
  verified_purchase: boolean;
  purchase_type: "paid" | "mock";
  status: "visible" | "hidden";
  pending_reports: number;
  created_at: string;
  edited_at: string | null;
  seller_reply: { content: string; replied_at: string; updated_at: string | null } | null;
};

export type SellerReviewStats = {
  count: number;
  average: number;
  distribution: Record<string, number>;
  unanswered: number;
  new_7d: number;
  photo_count: number;
  mock_count: number;
  hidden: number;
  reported_pending: number;
};

export type SellerReviewList = { total: number; stats: SellerReviewStats; rows: SellerReview[] };

export const fetchSellerReviews = (params: {
  fundingId: string | null; rating: number | null; reply: ReplyFilter; sort: SellerReviewSort; limit: number; offset: number;
}) => rpc<SellerReviewList>("seller_list_reviews", {
  p_funding_id: params.fundingId,
  p_rating: params.rating,
  p_reply_filter: params.reply,
  p_sort: params.sort,
  p_limit: params.limit,
  p_offset: params.offset,
});

export const replyToReview = (reviewId: string, content: string) =>
  rpc<{ content: string; replied_at: string; updated_at: string | null }>("seller_reply_funding_review", {
    p_review_id: reviewId, p_content: content,
  });

export type ReviewReportReason = "abusive" | "spam" | "privacy" | "false_info" | "unrelated" | "other";

export const REVIEW_REPORT_REASONS: { value: ReviewReportReason; label: string }[] = [
  { value: "abusive", label: "욕설 · 비방" },
  { value: "spam", label: "광고 · 스팸" },
  { value: "privacy", label: "개인정보 노출" },
  { value: "false_info", label: "사실과 다른 내용" },
  { value: "unrelated", label: "상품과 무관한 내용" },
  { value: "other", label: "기타" },
];

export const reportReview = (reviewId: string, reason: ReviewReportReason, detail: string) =>
  rpc<string>("seller_report_funding_review", { p_review_id: reviewId, p_reason_code: reason, p_detail: detail || null });

// ---------------------------------------------------------------------------
// 문의 · 정산 · 제작 단계
// ---------------------------------------------------------------------------

export type SellerInquiry = {
  id: string;
  funding_id: string;
  funding_name: string;
  inquiry_type: string;
  title: string;
  content: string | null;
  image_paths: string[];
  is_private: boolean;
  is_hidden: boolean;
  status: "pending" | "answered";
  nickname: string;
  created_at: string;
  answer: { content: string; role: string; answered_at: string; updated_at: string | null } | null;
};

export type SellerInquiryList = {
  total: number;
  counts: { all: number; pending: number; answered: number };
  rows: SellerInquiry[];
};

export const fetchSellerInquiries = (filter: "all" | "pending" | "answered", limit: number, offset: number) =>
  rpc<SellerInquiryList>("seller_list_inquiries", { p_filter: filter, p_limit: limit, p_offset: offset });

/** 기존 펀딩 문의 답변 RPC (제작자 본인 펀딩만 허용) */
export const answerInquiry = (inquiryId: string, content: string) =>
  rpc<unknown>("answer_funding_inquiry", { p_inquiry_id: inquiryId, p_content: content });

export type SellerSettlement = {
  id: string;
  funding_id: string;
  funding_name: string;
  gross_amount: number;
  refund_amount: number;
  net_sales: number;
  mock_amount: number;
  commission_rate: number;
  platform_fee: number;
  production_cost: number;
  other_deductions: number;
  final_amount: number;
  scheduled_date: string | null;
  status: "pending" | "scheduled" | "completed" | "on_hold";
  hold_reason: string | null;
  completed_at: string | null;
  created_at: string;
};

export type SellerSettlementList = {
  settlements: SellerSettlement[];
  unsettled: { funding_id: string; funding_name: string; phase: string; real_amount: number; mock_amount: number; paid_orders: number }[];
  commission_rate: number;
};

export const fetchSellerSettlements = () => rpc<SellerSettlementList>("seller_list_settlements");

/** 제작자가 직접 진행할 수 있는 제작 단계(서버 creator_update_production_stage 와 같은 목록) */
export const CREATOR_PRODUCTION_STAGES = [
  "fabric_contact", "pattern_sample", "sample_review", "mass_production", "inspection_packing",
] as const;

export const advanceProductionStage = (fundingId: string, stage: string, note: string) =>
  rpc<{ production_status: string }>("creator_update_production_stage", {
    p_funding_id: fundingId, p_stage: stage, p_note: note || null, p_image_urls: [],
  });

export type ProductionLog = {
  id: string;
  from_stage: string | null;
  to_stage: string;
  note: string | null;
  changed_by_name: string | null;
  changed_by_role: string;
  created_at: string;
};

export const fetchProductionLogs = (fundingId: string) =>
  rpc<ProductionLog[]>("list_funding_production_logs", { p_funding_id: fundingId });
