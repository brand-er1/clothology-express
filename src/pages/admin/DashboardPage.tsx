import { Link } from "react-router-dom";
import {
  AlertCircle, BadgeCheck, Building2, ClipboardList, Coins, Flag, Headphones, Palette, Percent, ReceiptText,
  RotateCcw, ShoppingBag, TrendingUp, UserPlus, Users, WalletCards,
} from "lucide-react";
import { adminRpc, type DashboardData } from "@/services/adminApi";
import { FUNDING_PHASE, num, pct, won } from "@/lib/admin/format";
import { ErrorBanner, KpiCard, LoadingBlock, PageHeader, Panel, StatusBadge } from "@/components/admin/shell/ui";
import { PeriodFilter, usePeriod } from "@/components/admin/shell/PeriodFilter";
import { TrendChart } from "@/components/admin/shell/TrendChart";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { useAdminContext } from "@/components/admin/shell/AdminContext";

const DashboardPage = () => {
  const periodState = usePeriod("30d");
  const { period } = periodState;
  const { can } = useAdminContext();
  const { data, loading, error, reload } = useAdminQuery(
    () => adminRpc<DashboardData>("admin_get_dashboard", { p_from: period.from, p_to: period.to }),
    [period.from, period.to],
  );
  const c = data?.counts ?? {};
  const m = data?.money ?? null;
  const locked = data ? !data.finance_visible : false;

  const todo = [
    { label: "승인 대기 펀딩", value: c.fundings_pending, to: "/admin/fundings", icon: WalletCards, show: can("fundings.view") },
    { label: "처리 중 환불", value: c.pending_refunds, to: "/admin/refunds", icon: RotateCcw, show: can("refunds.view") },
    { label: "미처리 신고", value: c.pending_reports, to: "/admin/content", icon: Flag, show: can("content.view") },
    { label: "진행 중 CS 문의", value: c.open_cs_tickets, to: "/admin/content", icon: Headphones, show: can("cs.view") },
    { label: "검수 대기 브랜드", value: c.pending_brands, to: "/admin/brands", icon: Building2, show: can("brands.view") },
  ].filter((item) => item.show);

  return (
    <div>
      <PageHeader eyebrow="Overview" title="운영 대시보드" description="플랫폼 전체 현황을 한눈에 확인합니다. 금액은 결제 승인 시점 기준입니다."
        actions={<PeriodFilter state={periodState} />} />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading && !data ? <LoadingBlock /> : data && (
        <div className="grid gap-5">
          {todo.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {todo.map(({ label, value, to, icon: Icon }) => (
                <Link key={label} to={to} className="group flex items-center justify-between rounded-xl border border-stone-200/80 bg-white px-3 py-2.5 transition hover:border-[#741b2b]/40">
                  <span className="flex items-center gap-2 text-xs font-bold text-stone-600"><Icon className="h-4 w-4 text-[#741b2b]" />{label}</span>
                  <span className={`text-lg font-black tabular-nums ${Number(value) > 0 ? "text-[#741b2b]" : "text-stone-300"}`}>{num(value)}</span>
                </Link>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard emphasis label="총 거래액 (GMV)" value={won(m?.gmv)} icon={Coins} locked={locked}
              hint={m ? `모의 ${won(m.gmv_mock)} · 실결제 ${won(m.gmv_real)}` : undefined} />
            <KpiCard label="플랫폼 매출 (순거래액)" value={won(m?.net_sales)} icon={TrendingUp} locked={locked} hint="GMV − 취소/환불" />
            <KpiCard label="플랫폼 수수료 (예상)" value={won(m?.platform_fee)} icon={Percent} locked={locked} hint={m ? `수수료율 ${m.commission_rate}%` : undefined} />
            <KpiCard label="환불 금액" value={won(m?.refunds)} icon={RotateCcw} locked={locked} />
            <KpiCard label="정산 예정 금액" value={won(m?.settlement_scheduled)} icon={ReceiptText} locked={locked} />
            <KpiCard label="정산 완료 금액" value={won(m?.settlement_completed)} icon={BadgeCheck} locked={locked} />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <KpiCard label="전체 회원" value={num(c.members)} icon={Users} hint={`기간 신규 ${num(c.signups_in_period)}`} />
            <KpiCard label="오늘 신규 가입" value={num(c.today_signups)} icon={UserPlus} />
            <KpiCard label="전체 제작자" value={num(c.creators)} icon={Palette} />
            <KpiCard label="전체 브랜드" value={num(c.brands)} icon={Building2} />
            <KpiCard label="MAU" value={num(c.mau)} icon={Users} hint="최근 30일 순 방문자" />
            <KpiCard label="구매 전환율" value={pct(c.conversion_rate, 2)} icon={TrendingUp} hint={`기간 방문자 ${num(c.period_visitors)}`} />
            <KpiCard label="진행 중 펀딩" value={num(c.fundings_active)} icon={WalletCards} />
            <KpiCard label="승인 대기 펀딩" value={num(c.fundings_pending)} icon={AlertCircle} />
            <KpiCard label="성공한 펀딩" value={num(c.fundings_succeeded)} icon={BadgeCheck} />
            <KpiCard label="실패/중단 펀딩" value={num(c.fundings_failed)} icon={AlertCircle} />
            <KpiCard label="펀딩 성공률" value={pct(c.funding_success_rate)} icon={Percent} />
            <KpiCard label="전체 참여자" value={num(c.participants)} icon={Users} />
            <KpiCard label="전체 주문" value={num(c.orders)} icon={ClipboardList} hint={`기간 ${num(c.orders_in_period)}건`} />
            <KpiCard label="오늘 주문" value={num(c.today_orders)} icon={ShoppingBag} />
            <KpiCard label="최근 7일 매출" value={won(m?.revenue_7d)} icon={Coins} locked={locked} />
            <KpiCard label="최근 30일 매출" value={won(m?.revenue_30d)} icon={Coins} locked={locked} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {data.finance_visible && (
              <Panel title="일별 거래액" description="결제 승인 기준 (모의결제 포함)"><TrendChart data={data.series} dataKey="gmv" label="거래액" money /></Panel>
            )}
            <Panel title="일별 주문 수"><TrendChart data={data.series} dataKey="orders" label="주문" kind="bar" /></Panel>
            <Panel title="일별 신규 가입"><TrendChart data={data.series} dataKey="signups" label="신규 가입" kind="bar" /></Panel>
            <Panel title="일별 방문자"><TrendChart data={data.series} dataKey="visitors" label="방문자" /></Panel>
          </div>

          <Panel title="펀딩 단계별 현황" description="기존 status 값과 기간·목표 달성 여부로 계산한 운영 단계">
            <div className="flex flex-wrap gap-2">
              {Object.entries(FUNDING_PHASE).map(([key, meta]) => (
                <Link key={key} to={`/admin/fundings?phase=${key}`} className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 hover:border-[#741b2b]/40">
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                  <span className="text-sm font-black tabular-nums">{num(data.phase_breakdown[key] ?? 0)}</span>
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
