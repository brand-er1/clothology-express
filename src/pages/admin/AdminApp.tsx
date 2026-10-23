import { Suspense, type ReactNode } from "react";
import { lazyWithReload } from "@/lib/lazyWithReload";
import { Link, Route, Routes } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { AdminContextProvider, useAdminContext } from "@/components/admin/shell/AdminContext";
import { AdminLayout } from "@/components/admin/shell/AdminLayout";
import { Forbidden, LoadingBlock } from "@/components/admin/shell/ui";
import type { AdminPermission } from "@/lib/admin/permissions";

const DashboardPage = lazyWithReload(() => import("./DashboardPage"));
const MembersPage = lazyWithReload(() => import("./MembersPage"));
const CreatorsPage = lazyWithReload(() => import("./CreatorsPage"));
const BrandsPage = lazyWithReload(() => import("./BrandsPage"));
const FundingsPage = lazyWithReload(() => import("./FundingsPage"));
const OrdersPage = lazyWithReload(() => import("./OrdersPage"));
const BuyersPage = lazyWithReload(() => import("./BuyersPage"));
const PaymentsPage = lazyWithReload(() => import("./PaymentsPage"));
const RefundsPage = lazyWithReload(() => import("./RefundsPage"));
const SettlementsPage = lazyWithReload(() => import("./SettlementsPage"));
const ProductionPage = lazyWithReload(() => import("./ProductionPage"));
const ShippingPage = lazyWithReload(() => import("./ShippingPage"));
const ContentPage = lazyWithReload(() => import("./ContentPage"));
const NotificationsPage = lazyWithReload(() => import("./NotificationsPage"));
const NotificationLogsPage = lazyWithReload(() => import("./NotificationLogsPage"));
const AnalyticsPage = lazyWithReload(() => import("./AnalyticsPage"));
const AdminsPage = lazyWithReload(() => import("./AdminsPage"));
const AuditLogPage = lazyWithReload(() => import("./AuditLogPage"));
const SettingsPage = lazyWithReload(() => import("./SettingsPage"));
const LegacyToolsPage = lazyWithReload(() => import("./LegacyToolsPage"));
const AiUsagePage = lazyWithReload(() => import("./AiUsagePage"));
const InquiriesPage = lazyWithReload(() => import("./InquiriesPage"));
const AiDesignsPage = lazyWithReload(() => import("./AiDesignsPage"));
const ReviewsPage = lazyWithReload(() => import("./ReviewsPage"));
const MagazinePage = lazyWithReload(() => import("./MagazinePage"));

// 메뉴 가드는 UX 용이다. 실제 데이터 접근은 각 RPC 가 서버에서 다시 거부한다.
const Guard = ({ anyOf, children }: { anyOf: AdminPermission[]; children: ReactNode }) => {
  const { can } = useAdminContext();
  if (!anyOf.some((permission) => can(permission))) return <Forbidden permission={anyOf.join(" / ")} />;
  return <>{children}</>;
};

const NotAdmin = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#f6f3ef] px-4">
    <div className="max-w-md rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#741b2b]/10"><ShieldAlert className="h-6 w-6 text-[#741b2b]" /></span>
      <h1 className="mt-4 text-xl font-extrabold">관리자 전용 페이지입니다</h1>
      <p className="mt-2 text-sm text-stone-500">관리자 권한이 있는 계정으로 로그인해야 접근할 수 있습니다.</p>
      <Link to="/" className="mt-6 inline-flex rounded-xl bg-[#741b2b] px-4 py-2 text-sm font-bold text-white">BRAND-ER 홈으로</Link>
    </div>
  </div>
);

const AdminRoutes = () => {
  const { context, loading } = useAdminContext();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f6f3ef] text-sm text-stone-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />관리자 권한 확인 중...</div>;
  }
  if (!context?.is_admin) return <NotAdmin />;

  return (
    <AdminLayout>
      <Suspense fallback={<LoadingBlock />}>
        <Routes>
          <Route index element={<Guard anyOf={["dashboard.view"]}><DashboardPage /></Guard>} />
          <Route path="analytics" element={<Guard anyOf={["analytics.view"]}><AnalyticsPage /></Guard>} />
          <Route path="members" element={<Guard anyOf={["members.view"]}><MembersPage /></Guard>} />
          <Route path="creators" element={<Guard anyOf={["creators.view"]}><CreatorsPage /></Guard>} />
          <Route path="brands" element={<Guard anyOf={["brands.view"]}><BrandsPage /></Guard>} />
          <Route path="fundings" element={<Guard anyOf={["fundings.view"]}><FundingsPage /></Guard>} />
          <Route path="inquiries" element={<Guard anyOf={["cs.view"]}><InquiriesPage /></Guard>} />
          <Route path="ai-designs" element={<Guard anyOf={["members.view"]}><AiDesignsPage /></Guard>} />
          <Route path="reviews" element={<Guard anyOf={["content.view"]}><ReviewsPage /></Guard>} />
          <Route path="orders" element={<Guard anyOf={["orders.view"]}><OrdersPage /></Guard>} />
          <Route path="buyers" element={<Guard anyOf={["orders.pii"]}><BuyersPage /></Guard>} />
          <Route path="payments" element={<Guard anyOf={["payments.view"]}><PaymentsPage /></Guard>} />
          <Route path="refunds" element={<Guard anyOf={["refunds.view"]}><RefundsPage /></Guard>} />
          <Route path="settlements" element={<Guard anyOf={["settlements.view"]}><SettlementsPage /></Guard>} />
          <Route path="production" element={<Guard anyOf={["production.view"]}><ProductionPage /></Guard>} />
          <Route path="shipping" element={<Guard anyOf={["shipping.view"]}><ShippingPage /></Guard>} />
          <Route path="magazine" element={<Guard anyOf={["content.view"]}><MagazinePage /></Guard>} />
          <Route path="content" element={<Guard anyOf={["content.view", "reports.manage", "cs.view"]}><ContentPage /></Guard>} />
          <Route path="notifications" element={<Guard anyOf={["notifications.send"]}><NotificationsPage /></Guard>} />
          <Route path="notification-logs" element={<Guard anyOf={["notifications.send"]}><NotificationLogsPage /></Guard>} />
          <Route path="admins" element={<Guard anyOf={["admins.manage"]}><AdminsPage /></Guard>} />
          <Route path="audit" element={<Guard anyOf={["audit.view"]}><AuditLogPage /></Guard>} />
          <Route path="ai-usage" element={<Guard anyOf={["ai_usage.view"]}><AiUsagePage /></Guard>} />
          <Route path="settings" element={<Guard anyOf={["settings.view"]}><SettingsPage /></Guard>} />
          <Route path="tools/*" element={<Guard anyOf={["legacy.tools"]}><LegacyToolsPage /></Guard>} />
          <Route path="*" element={<Forbidden permission="존재하지 않는 메뉴" />} />
        </Routes>
      </Suspense>
    </AdminLayout>
  );
};

const AdminApp = () => (
  <AdminContextProvider>
    <AdminRoutes />
  </AdminContextProvider>
);

export default AdminApp;
