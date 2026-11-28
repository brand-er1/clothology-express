
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
  request_source?: "ai_design" | "design_upload" | "ready_made_group_wear" | string;
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
  /** 간편 제작 의뢰(request_source "production_inquiry") 양식 입력값 */
  contact_name?: string | null;
  contact_phone?: string | null;
  budget_range?: string | null;
  desired_due_date?: string | null;
  privacy_consented_at?: string | null;
  inquiry_meta?: Record<string, string | number | boolean | null> | null;
  /** 상담 진행 상태(모든 제작 의뢰 공통) — src/lib/production-request.ts CONSULT_STATUS_LABEL */
  consult_status?: import("@/lib/production-request").ConsultStatus | null;
  consult_status_updated_at?: string | null;
};
