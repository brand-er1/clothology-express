export type AdminGeneratedImageStatus = "image_only" | "funding" | "direct";

export type AdminGeneratedImage = {
  id: string;
  user_id: string;
  image_url: string | null;
  image_path: string | null;
  cloth_type: string | null;
  material: string | null;
  detail: string | null;
  prompt: string;
  generation_prompt: string | null;
  created_at: string;
  brand_name: string | null;
  customer_name: string | null;
  username: string | null;
  phone_number: string | null;
  conversion_status: AdminGeneratedImageStatus;
};
