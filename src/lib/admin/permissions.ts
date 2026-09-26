// 관리자 등급별 권한. 서버의 public.admin_role_permissions() 와 동일하게 유지한다.
// 프런트엔드는 메뉴 표시용으로만 사용하며 실제 권한 검증은 모든 admin_* RPC 가 서버에서 수행한다.

export type AdminRole = "super_admin" | "operations_admin" | "cs_admin";

export type AdminPermission =
  | "dashboard.view" | "finance.view"
  | "members.view" | "members.manage" | "members.pii"
  | "creators.view" | "creators.manage"
  | "brands.view" | "brands.manage"
  | "fundings.view" | "fundings.manage"
  | "orders.view" | "orders.manage" | "orders.pii"
  | "payments.view"
  | "refunds.view" | "refunds.request" | "refunds.manage"
  | "settlements.view" | "settlements.manage"
  | "production.view" | "production.manage"
  | "shipping.view" | "shipping.manage"
  | "content.view" | "content.manage" | "reports.manage"
  | "cs.view" | "cs.manage"
  | "notifications.send"
  | "analytics.view"
  | "admins.manage" | "audit.view"
  | "settings.view" | "settings.manage"
  | "legacy.tools" | "legacy.settings";

const OPERATIONS: AdminPermission[] = [
  "dashboard.view",
  "members.view", "members.manage", "members.pii",
  "creators.view", "creators.manage",
  "brands.view", "brands.manage",
  "fundings.view", "fundings.manage",
  "orders.view", "orders.manage", "orders.pii",
  "production.view", "production.manage",
  "shipping.view", "shipping.manage",
  "content.view", "content.manage", "reports.manage",
  "cs.view",
  "notifications.send",
  "analytics.view",
  "legacy.tools",
];

const CS: AdminPermission[] = [
  "dashboard.view",
  "members.view", "members.pii",
  "fundings.view",
  "orders.view", "orders.pii",
  "shipping.view",
  "refunds.view", "refunds.request",
  "content.view", "reports.manage",
  "cs.view", "cs.manage",
];

const SUPER: AdminPermission[] = [
  ...OPERATIONS,
  "finance.view", "payments.view",
  "refunds.view", "refunds.request", "refunds.manage",
  "settlements.view", "settlements.manage",
  "cs.manage",
  "admins.manage", "audit.view",
  "settings.view", "settings.manage",
  "legacy.settings",
];

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  super_admin: Array.from(new Set(SUPER)),
  operations_admin: OPERATIONS,
  cs_admin: CS,
};

export const ROLE_LABEL: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  operations_admin: "Operations Admin",
  cs_admin: "CS Admin",
};

export const ROLE_DESCRIPTION: Record<AdminRole, string> = {
  super_admin: "모든 관리자 기능, 관리자 계정·권한, 결제·정산, 시스템 설정",
  operations_admin: "회원·제작자·브랜드·펀딩·주문·제작·배송·콘텐츠 운영과 운영 통계",
  cs_admin: "회원·주문·배송 조회, 문의/신고 처리, 취소·환불 요청 접수",
};

export const hasPermission = (permissions: readonly string[] | undefined, permission: AdminPermission) =>
  Boolean(permissions?.includes(permission));
