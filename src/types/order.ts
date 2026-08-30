
export type Order = {
  id: string;
  created_at: string;
  user_id: string | null;
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
  request_source?: "ai_design" | "design_upload" | "ready_made_group_wear" | "virtual_fitting_3d" | string;
  request_title?: string | null;
  requested_quantity?: number | null;
  estimate_snapshot?: import("./productionEstimate").ProductionEstimateResult | null;
  admin_comment?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  /** Set instead of a linked account when a visitor submitted without logging in
   * (currently only possible for request_source "ready_made_group_wear"). */
  guest_name?: string | null;
  guest_phone?: string | null;
  /** WYSIWYG capture of the ready-made group wear editor at submission time — the garment +
   * customer-placed design exactly as configured, not the raw uploaded artwork. Only set for
   * request_source "ready_made_group_wear"; back_preview_url is null when nothing was placed
   * on the back. */
  front_preview_url?: string | null;
  back_preview_url?: string | null;
  ready_made_design_data?: import("./readyMadeOrder").ReadyMadeOrderDesignData | null;
  /** Gender/size/per-slot garment summary when this order came from the 3D 가상피팅 flow
   * ("현재 착용 의류 전체 견적받기" → 제작의뢰). See src/lib/fitting-preview.ts. Only set for
   * request_source "virtual_fitting_3d". */
  fitting_state?: import("@/types/fitting").FittingStateSnapshot | null;
  /** 3D mannequin screenshot or AI 피팅 photoreal render URL captured at submission time. */
  fitting_preview_url?: string | null;
};
