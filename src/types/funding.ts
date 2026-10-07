import type { TrademarkScreening } from "@/types/trademark";
import type { BrandWithCreator } from "@/types/brand";

export type FundingStatus = "draft" | "pending" | "approved" | "rejected" | "closed";
export type FundingParticipationStatus = "pledged" | "confirmed" | "cancelled" | "fulfilled";
export type FundingPaymentStatus = "unpaid" | "ready" | "paid" | "cancelled" | "failed";
export type FundingPaymentProvider = "none" | "kakaopay" | "mock";
export type FundingPaymentType = "MOCK" | "REAL";
export type FundingMeasurements = Record<string, unknown>;

export type ProductionStage =
  | "funding"
  | "fabric_sourcing"
  | "sampling"
  | "production"
  | "inspection_packing"
  | "shipping_ready"
  | "delivered";

export const PRODUCTION_STAGE_ORDER: ProductionStage[] = [
  "funding",
  "fabric_sourcing",
  "sampling",
  "production",
  "inspection_packing",
  "shipping_ready",
  "delivered",
];

export const PRODUCTION_STAGE_LABEL: Record<ProductionStage, string> = {
  funding: "펀딩중",
  fabric_sourcing: "원단 컨택",
  sampling: "샘플 제작",
  production: "본생산",
  inspection_packing: "검수·포장",
  shipping_ready: "배송 준비",
  delivered: "배송 완료",
};

export type ShippingStatus = "preparing" | "shipped" | "delivered";

export const SHIPPING_STATUS_LABEL: Record<ShippingStatus, string> = {
  preparing: "배송 준비중",
  shipped: "배송중",
  delivered: "배송 완료",
};

export type ShippingDetails = {
  ordererName: string;
  ordererPhone: string;
  ordererEmail: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address: string;
  addressDetail: string;
  deliveryMessage: string;
  agreePrivacy: boolean;
};

export type Funding = {
  id: string;
  creator_id: string;
  brand_id: string | null;
  brand?: BrandWithCreator | null;
  product_name: string;
  cloth_type: string;
  material: string;
  color: string | null;
  size: string;
  color_options: string[];
  size_options: string[];
  measurements: FundingMeasurements | null;
  image_url: string;
  image_path: string | null;
  trademark_screening_id: string | null;
  trademark_screening_required: boolean;
  trademark_screening?: TrademarkScreening | null;
  description: string | null;
  moq: number;
  current_orders: number;
  price: number | null;
  estimate_direct_unit_min: number | null;
  estimate_direct_unit_max: number | null;
  estimate_development_total: number | null;
  fabric_unit_cost: number;
  funding_days: number;
  status: FundingStatus;
  admin_comment: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  sample_image_url: string | null;
  sample_image_path: string | null;
  sample_note: string | null;
  sample_shared_at: string | null;
  /** 서버(DB 트리거)가 판정한 펀딩 단계. 프론트엔드는 표시만 한다. */
  funding_status?: "funding" | "success" | "production";
  success_at?: string | null;
  final_quantity?: number | null;
  success_participant_count?: number | null;
  /** 펀딩 성공팀 노출 설정. 관리자 RPC(admin_set_funding_success_showcase)만 변경한다. */
  success_showcase_visible?: boolean;
  success_showcase_category?: string | null;
  success_showcase_rate?: number | null;
  success_showcase_summary?: string | null;
  /** 제작자 조기 마감 기록. 서버 함수(creator_early_close_funding)만 변경한다. */
  early_closed?: boolean;
  early_closed_at?: string | null;
  early_closed_by?: string | null;
  early_closed_quantity?: number | null;
  closed_at?: string | null;
  suspended_at?: string | null;
  is_hidden?: boolean;
  production_status?: string | null;
  production_updated_at?: string | null;
};

/** 메인 '펀딩 성공팀' 카드·성공 스토리 한 건. 기존 펀딩 행에서 만들어지며 별도로 저장하지 않는다. */
export type FundingSuccessStory = {
  fundingId: string;
  brandName: string;
  brandLogo: string | null;
  productName: string;
  thumbnail: string;
  category: string;
  /** 달성률(%). 관리자 표시값이 있으면 그 값, 없으면 최종 수량 / 목표 수량. */
  fundingRate: number;
  fundingAmount: number | null;
  participantCount: number | null;
  /** 성공 시각(success_at). 최신순 정렬 기준. */
  completedAt: string;
  description: string | null;
  status: "success";
  funding: Funding;
};

export type EarlyCloseFundingResult = {
  funding_id: string;
  status: FundingStatus;
  early_closed: true;
  early_closed_at: string;
  quantity: number;
  participants: number;
  target_quantity: number;
  result: "success" | "unmet";
  notified_participants: number;
  cancelled_pending_payments: number;
};

export type FundingPaymentIntent = {
  id: string;
  participant_id: string;
  participant_name: string;
  phone_number: string | null;
  selected_color: string;
  selected_size: string;
  quantity: number;
  status: "waiting" | "converted" | "cancelled";
  created_at: string;
};
export type CreateFundingInput = {
  productName: string;
  clothType: string;
  material: string;
  color: string;
  size: string;
  sizeOptions?: string[];
  measurements: FundingMeasurements | null;
  imageUrl: string;
  imagePath: string | null;
  description: string;
  estimateDirectUnitMin?: number | null;
  estimateDirectUnitMax?: number | null;
  estimateDevelopmentTotal?: number | null;
  trademarkScreeningId: string;
  /** Optional planned price (set from the AI detail page); editable later in the funding editor. */
  price?: number | null;
};

export type FundingParticipation = {
  id: string;
  order_number: string | null;
  participant_id: string;
  participant_name: string;
  phone_number: string | null;
  address: string | null;
  selected_color: string;
  selected_size: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  status: FundingParticipationStatus;
  payment_provider: FundingPaymentProvider;
  payment_type: FundingPaymentType;
  payment_status: FundingPaymentStatus;
  payment_approved_at: string | null;
  payment_cancelled_at: string | null;
  created_at: string;
  orderer_name: string | null;
  orderer_phone: string | null;
  orderer_email: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  postal_code: string | null;
  shipping_address: string | null;
  shipping_address_detail: string | null;
  delivery_message: string | null;
  production_stage: ProductionStage;
  shipping_status: ShippingStatus;
  tracking_number: string | null;
};

export type MyFundingParticipation = FundingParticipation & {
  funding_id: string;
  product_name: string;
  image_url: string;
  funding_status: FundingStatus;
  creator_id: string;
  payment_method_type: string | null;
  funding_moq: number;
  funding_current_orders: number;
};

export type SellerFundingDashboardRow = {
  funding_id: string;
  product_name: string;
  image_url: string;
  price: number | null;
  moq: number;
  current_orders: number;
  participant_count: number;
  funding_rate: number;
  expected_revenue: number;
  mock_revenue: number;
  real_revenue: number;
  start_date: string | null;
  end_date: string | null;
  status: FundingStatus;
};

export type SellerDashboardTotals = {
  total_expected_revenue: number;
  total_participants: number;
  total_quantity: number;
  avg_funding_rate: number;
};

export type AdminFundingOverview = {
  total_fundings: number;
  active_fundings: number;
  total_participants: number;
  total_quantity: number;
  total_mock_amount: number;
  total_real_amount: number;
  avg_funding_rate: number;
};

export type MyFundingPaymentIntent = {
  id: string;
  funding_id: string;
  participant_id: string;
  product_name: string;
  image_url: string;
  funding_status: FundingStatus;
  creator_id: string;
  selected_color: string;
  selected_size: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  status: "waiting";
  sample_image_url: string | null;
  sample_note: string | null;
  sample_shared_at: string | null;
  created_at: string;
};

export type KakaoPayReadyResult = {
  participation_id: string;
  next_redirect_pc_url: string | null;
  next_redirect_mobile_url: string | null;
  next_redirect_app_url: string | null;
};
