
export type Order = {
  id: string;
  created_at: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'draft' | 'deleted';
  cloth_type: string;
  material: string;
  detail_description: string;
  size: string;
  measurements: Record<string, string | number> | null;
  generated_image_url: string | null;
  image_path?: string | null;
  /** Full set of reference images uploaded for a multi-image design-quote request (storage paths). */
  reference_image_paths?: string[] | null;
  request_source?: "ai_design" | "design_upload" | string;
  request_title?: string | null;
  requested_quantity?: number | null;
  estimate_snapshot?: import("./productionEstimate").ProductionEstimateResult | null;
  admin_comment?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
};
