
export type Order = {
  id: string;
  created_at: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  cloth_type: string;
  material: string;
  style: string;
  pocket_type: string;
  color: string;
  detail_description: string;
  size: string;
  measurements: Record<string, number> | null;
  generated_image_url: string;
  image_path?: string | null;
  admin_comment?: string;
};
