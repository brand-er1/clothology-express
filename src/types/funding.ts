export type FundingStatus = "pending" | "approved" | "rejected" | "closed";

export type Funding = {
  id: string;
  creator_id: string;
  product_name: string;
  cloth_type: string;
  material: string;
  color: string | null;
  size: string;
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
