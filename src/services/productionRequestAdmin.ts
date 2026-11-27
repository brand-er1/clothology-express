import { adminRpc } from "@/services/adminApi";
import type { ProductionProgressStatus } from "../../supabase/functions/_shared/productionRequest";

// 관리자 제작의뢰(기존 '제작 의뢰' 메뉴) — 상세 · 진행 상태 · 내부 메모 · 미확인 건수.
// 모든 RPC 가 서버에서 orders.view / orders.manage / orders.pii 권한을 다시 확인한다.

export type ProductionRequestDetail = {
  order_id: string;
  request_source: string;
  status: "pending" | "approved" | "rejected";
  admin_comment: string | null;
  created_at: string;
  progress_status: ProductionProgressStatus;
  progress_updated_at: string | null;
  checked_at: string | null;
  can_manage: boolean;
  can_view_pii: boolean;
  image_url: string | null;
  image_path: string | null;
  request: {
    contact_name: string;
    contact_phone: string;
    quantity: number | null;
    quantity_undecided: boolean;
    budget: string | null;
    customer_request: string | null;
    ai_prompt: string | null;
    design_brief: string | null;
    design_id: string | null;
    image_source_url: string | null;
    entry_point: string;
    entry_path: string | null;
    privacy_consent_version: string;
    privacy_consented_at: string;
    created_at: string;
  } | null;
  /** is_guest 면 나머지 값은 비어 있다 */
  account: {
    is_guest: boolean;
    user_id?: string;
    email?: string | null;
    username?: string | null;
    full_name?: string | null;
    phone_number?: string | null;
    account_type?: string | null;
    signed_up_at?: string | null;
  };
  /** orders.pii 권한이 없으면 null */
  memos: { id: string; body: string; author_name: string | null; created_at: string }[] | null;
};

export type ProductionRequestSummary = { unread_count: number; ai_request_count: number; today_count: number };

/** 상세 조회. 이 호출로 해당 의뢰가 '확인함'으로 기록되어 미확인 건수에서 빠진다. */
export const getProductionRequest = (orderId: string) =>
  adminRpc<ProductionRequestDetail>("admin_get_production_request", { p_order_id: orderId });

export const updateProductionProgress = (orderId: string, progress: ProductionProgressStatus, comment: string | null) =>
  adminRpc<{ id: string; progress_status: ProductionProgressStatus; status: string }>("admin_update_production_request_progress", {
    p_order_id: orderId, p_progress: progress, p_comment: comment,
  });

export const addProductionMemo = (orderId: string, body: string) =>
  adminRpc<{ id: string; body: string; author_name: string | null; created_at: string }>("admin_add_production_request_memo", {
    p_order_id: orderId, p_body: body,
  });

export const getProductionRequestSummary = () => adminRpc<ProductionRequestSummary>("admin_production_request_summary");

/** 유입 경로 표시 */
export const ENTRY_POINT_LABEL: Record<string, string> = {
  customize_step4_generated: "AI 이미지 생성 페이지 · 생성 결과 화면",
  customize_step5_edit: "AI 이미지 생성 페이지 · 디자인 수정 화면",
  ai_image_generator: "AI 이미지 생성 페이지",
};

export const ACCOUNT_TYPE_LABEL: Record<string, string> = { seller: "제작자(판매자) 회원", buyer: "구매자 회원" };

/** 관리자 화면 이벤트: 상세를 열거나 상태를 바꾸면 사이드바 배지를 바로 다시 센다. */
export const PRODUCTION_SUMMARY_REFRESH_EVENT = "brander:production-summary-refresh";
export const requestProductionSummaryRefresh = () => window.dispatchEvent(new Event(PRODUCTION_SUMMARY_REFRESH_EVENT));
