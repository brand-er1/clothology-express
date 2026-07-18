export type FundingStatus = "pending" | "approved" | "rejected" | "closed";
export type FundingParticipationStatus = "pledged" | "confirmed" | "cancelled" | "fulfilled";

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
  created_at: string;
};
