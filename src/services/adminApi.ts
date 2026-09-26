import { supabase } from "@/lib/supabase";
import type { AdminPermission, AdminRole } from "@/lib/admin/permissions";

// 모든 관리자 데이터는 SECURITY DEFINER RPC(admin_*)를 통해서만 조회/변경한다.
// 각 RPC 는 서버에서 호출자의 관리자 권한을 다시 검증하므로 이 파일은 권한을 판단하지 않는다.

type RpcArgs = Record<string, unknown>;

export async function adminRpc<T>(name: string, args: RpcArgs = {}): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) throw error;
  return data as T;
}

export type AdminContext = {
  is_admin: boolean;
  user_id?: string;
  role?: AdminRole;
  display_name?: string;
  permissions?: AdminPermission[];
};

export type Paged = { total_count?: number | string };

export type DashboardData = {
  from: string;
  to: string;
  finance_visible: boolean;
  counts: Record<string, number | null>;
  money: Record<string, number> | null;
  series: { date: string; signups: number; orders: number; gmv: number | null; refunds: number | null; visitors: number }[];
  phase_breakdown: Record<string, number>;
};

export type AnalyticsData = {
  finance_visible: boolean;
  totals: Record<string, number | null>;
  series: Record<string, number | string | null>[];
  rankings: {
    brands: { id: string; name: string; orders: number; gmv: number | null; quantity: number }[];
    fundings: { id: string; name: string; orders: number; gmv: number | null; quantity: number; achievement_rate: number }[];
    creators: { id: string; name: string; fundings: number; orders: number; gmv: number | null; participants: number }[];
  };
};

export type MemberRow = Paged & {
  id: string; full_name: string | null; username: string | null; email: string | null; created_at: string;
  last_active_at: string | null; account_type: string; is_creator: boolean; brand_id: string | null;
  brand_name: string | null; participated_fundings: number; created_fundings: number; order_count: number;
  order_amount: number; account_status: string; admin_role: AdminRole | null;
};

export type CreatorRow = {
  user_id: string; display_name: string; profile_image_url: string | null; bio: string | null; email: string | null;
  account_status: string; brand_id: string | null; brand_name: string | null; brand_status: string | null;
  brand_review_status: string | null; instagram_url: string | null; website_url: string | null; created_at: string;
  active_fundings: number; completed_fundings: number; total_fundings: number; total_participants: number; gmv: number;
};

export type BrandRow = {
  id: string; brand_name: string; brand_logo_url: string | null; short_description: string | null; description: string | null;
  instagram_url: string | null; website_url: string | null; owner_user_id: string; creator_name: string | null;
  creator_image_url: string | null; status: string; review_status: string; review_reason: string | null;
  status_reason: string | null; created_at: string; funding_count: number; active_funding_count: number;
  follower_count: number; gmv: number;
};

export type FundingRow = Paged & {
  id: string; product_name: string; image_url: string; creator_id: string; creator_name: string; brand_id: string | null;
  brand_name: string | null; price: number | null; moq: number; current_orders: number; achievement_rate: number;
  gmv: number; participant_count: number; start_at: string | null; end_at: string | null; status: string; phase: string;
  is_hidden: boolean; suspended_at: string | null; suspension_reason: string | null; production_status: string | null;
  admin_comment: string | null; created_at: string;
};

export type OrderRow = Paged & {
  id: string; order_number: string | null; participant_id: string; orderer_name: string | null; orderer_phone: string | null;
  funding_id: string; product_name: string; brand_name: string | null; selected_color: string; selected_size: string;
  quantity: number; unit_price: number; total_amount: number; payment_provider: string; payment_type: string;
  payment_status: string; participation_status: string; order_state: string; production_stage: string;
  shipping_status: string; tracking_number: string | null; created_at: string;
};

export type PaymentRow = Paged & {
  id: string; payment_number: string | null; order_number: string | null; participant_id: string; user_name: string;
  funding_id: string; product_name: string; amount: number; payment_provider: string; payment_method: string;
  is_mock: boolean; payment_status: string; pg_status: string; paid_at: string | null; cancelled_at: string | null;
  is_cancelled: boolean; refund_status: string | null; created_at: string;
};

export type RefundRow = Paged & {
  id: string; participation_id: string; order_number: string | null; funding_id: string; product_name: string;
  user_id: string | null; user_name: string; amount: number; reason: string; status: string; requested_by_role: string;
  requested_by_name: string | null; payment_provider: string; is_mock_payment: boolean; pg_refund_status: string;
  admin_note: string | null; rejection_reason: string | null; processed_at: string | null; created_at: string; updated_at: string;
};

export type SettlementRow = {
  id: string; funding_id: string; product_name: string; brand_id: string | null; brand_name: string | null;
  creator_id: string | null; creator_name: string | null; gross_amount: number; refund_amount: number; net_sales: number;
  mock_amount: number; real_amount: number; commission_rate: number; platform_fee: number; production_cost: number;
  other_deductions: number; final_amount: number; scheduled_date: string | null; status: string; hold_reason: string | null;
  memo: string | null; calculation: Record<string, unknown>; completed_at: string | null; created_at: string; updated_at: string;
};

export type ProductionBoardRow = {
  funding_id: string; product_name: string; image_url: string; brand_name: string | null; creator_name: string | null;
  phase: string; production_status: string | null; production_updated_at: string | null; current_orders: number; moq: number;
  active_orders: number; quantity: number; invoiced: number; shipped: number; delivered: number; end_at: string | null;
  last_note: string | null;
};

export type ShipmentRow = Paged & {
  id: string; order_number: string | null; funding_id: string; product_name: string; recipient_name: string | null;
  recipient_phone: string | null; shipping_address: string | null; selected_color: string; selected_size: string;
  quantity: number; production_stage: string; shipping_state: string; shipping_status: string; courier: string | null;
  tracking_number: string | null; shipped_at: string | null; delivered_at: string | null; created_at: string;
};

export type AuditRow = Paged & {
  id: string; admin_id: string | null; admin_name: string | null; admin_role: string | null; action: string;
  target_type: string | null; target_id: string | null; target_label: string | null; before_data: unknown;
  after_data: unknown; reason: string | null; metadata: Record<string, unknown>; created_at: string;
};

export type AdminMemberRow = {
  user_id: string; email: string | null; display_name: string; role: AdminRole; status: string; note: string | null;
  granted_by_name: string | null; last_sign_in_at: string | null; created_at: string; updated_at: string; is_legacy: boolean;
};

export const fetchAdminContext = () => adminRpc<AdminContext>("get_my_admin_context");

export const totalOf = (rows: Paged[] | null | undefined) => Number(rows?.[0]?.total_count ?? 0);

// Supabase Auth 변경(로그인 차단/해제, 제작자 메타데이터)이 필요한 회원 조치는 Edge Function 을 통한다.
export const manageMember = async (body: {
  action: "set_status" | "approve_creator";
  userId: string;
  status?: string;
  reason: string;
}) => {
  const { data, error } = await supabase.functions.invoke("admin-manage-user", { body });
  if (error) {
    // Edge Function 미배포 등으로 호출 자체가 실패하면 DB RPC 로 상태만 우선 반영한다.
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      const payload = await context.json().catch(() => null);
      if (payload?.error) throw new Error(payload.error);
    }
    if (body.action === "set_status") {
      const result = await adminRpc("admin_set_member_status", { p_user_id: body.userId, p_status: body.status, p_reason: body.reason });
      return { result, warning: "로그인 차단(Supabase Auth) 반영은 Edge Function 배포 후 적용됩니다. 이용 제한은 DB 에 즉시 반영되었습니다." };
    }
    const result = await adminRpc("admin_approve_creator", { p_user_id: body.userId, p_reason: body.reason });
    return { result, warning: "로그인 메타데이터 동기화는 Edge Function 배포 후 적용됩니다." };
  }
  return data as { result: unknown; warning?: string };
};
