import type { TrademarkScreening } from "@/types/trademark";

export type FundingStatus = "pending" | "approved" | "rejected" | "closed";
export type FundingParticipationStatus = "pledged" | "confirmed" | "cancelled" | "fulfilled";
export type FundingPaymentStatus = "unpaid" | "ready" | "paid" | "cancelled" | "failed";
export type FundingMeasurements = Record<string, unknown>;

export type Funding = {
  id: string;
  creator_id: string;
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
};

export type FundingParticipation = {
  id: string;
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
  payment_provider: "none" | "kakaopay";
  payment_status: FundingPaymentStatus;
  payment_approved_at: string | null;
  payment_cancelled_at: string | null;
  created_at: string;
};

export type MyFundingParticipation = FundingParticipation & {
  funding_id: string;
  product_name: string;
  image_url: string;
  funding_status: FundingStatus;
  creator_id: string;
  payment_method_type: string | null;
};

export type KakaoPayReadyResult = {
  participation_id: string;
  next_redirect_pc_url: string | null;
  next_redirect_mobile_url: string | null;
  next_redirect_app_url: string | null;
};
