export const fabricFeelingOptions = [
  "부드러운 느낌",
  "탄탄한 느낌",
  "얇고 시원한 느낌",
  "두껍고 따뜻한 느낌",
  "신축성 있는 느낌",
  "잘 모르겠어요",
] as const;

export type FabricFeeling = (typeof fabricFeelingOptions)[number];

export type FabricSwatchStatus =
  | "pending"
  | "in_review"
  | "recommended"
  | "completed";

export interface FabricSwatchRequest {
  id: string;
  user_id: string;
  requester_email: string;
  requester_name: string | null;
  fabric_feeling: FabricFeeling;
  color_names: string[];
  reference_image_path: string | null;
  requested_minimum_count: number;
  status: FabricSwatchStatus;
  admin_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFabricSwatchRequestInput {
  fabricFeeling: FabricFeeling;
  colorNames: string[];
  referenceImage: File | null;
}
