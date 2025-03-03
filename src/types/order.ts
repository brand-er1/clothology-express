
export type Order = {
  id: string;
  created_at: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'draft';
  cloth_type: string;
  material: string;
  style: string;
  pocket_type: string;
  color: string;
  detail_description: string;
  size: string;
  measurements: Record<string, string | number> | null;
  generated_image_url: string | null;
  image_path?: string | null;
  admin_comment?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  fit?: string | null; // Added fit property
};
