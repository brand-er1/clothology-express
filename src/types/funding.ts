export type FundingStatus = "pending" | "approved" | "rejected" | "closed";
export type FundingParticipationStatus = "pledged" | "confirmed" | "cancelled" | "fulfilled";
export type FundingPaymentProvider = "legacy" | "kakaopay";
export type FundingPaymentStatus = "unpaid" | "ready" | "paid" | "cancelled" | "failed";

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
  measurements: Record<string, string | number> | null;
  image_url: string;
  image_path: string | null;
  description: string | null;
  moq: number;
  current_orders: number;
  price: number | null;
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
  measurements: Record<string, string | number> | null;
  imageUrl: string;
  imagePath: string | null;
  description: string;
};

export type FundingParticipation = {
  id: string;
  participant_id: string;
  participant_name: string;
  phone_number: string | null;
  selected_color: string;
  selected_size: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  status: FundingParticipationStatus;
  payment_provider: FundingPaymentProvider;
  payment_status: FundingPaymentStatus;
  payment_method_type: string | null;
  paid_at: string | null;
  created_at: string;
};

export type MyFundingParticipation = {
  id: string;
  funding_id: string;
  funding_name: string;
  funding_image_url: string;
  funding_status: FundingStatus;
  selected_color: string;
  selected_size: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  status: FundingParticipationStatus;
  payment_provider: FundingPaymentProvider;
  payment_status: FundingPaymentStatus;
  payment_method_type: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

export type KakaoPayReadyResult = {
  participationId: string;
  nextRedirectPcUrl: string | null;
  nextRedirectMobileUrl: string | null;
  nextRedirectAppUrl: string | null;
};
