import { adminRpc, type AnalyticsData } from "@/services/adminApi";
import { num, pct, won } from "@/lib/admin/format";
import { ErrorBanner, KpiCard, LoadingBlock, PageHeader, Panel } from "@/components/admin/shell/ui";
import { PeriodFilter, usePeriod } from "@/components/admin/shell/PeriodFilter";
import { RankBars, TrendChart } from "@/components/admin/shell/TrendChart";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";

const AnalyticsPage = () => {
  const periodState = usePeriod("30d");
  const { period } = periodState;
  const { data, loading, error, reload } = useAdminQuery(
    () => adminRpc<AnalyticsData>("admin_get_analytics", { p_from: period.from, p_to: period.to }), [period.from, period.to],
  );
  const t = data?.totals ?? {};
  const locked = data ? !data.finance_visible : false;
  const series = data?.series ?? [];
  const byGmv = (rows: { name: string; gmv: number | null; orders: number }[]) =>
    rows.map((r) => ({ name: r.name, value: Number(data?.finance_visible ? r.gmv ?? 0 : r.orders), sub: `${num(r.orders)}건` }));
  const valueLabel = (v: number) => (data?.finance_visible ? won(v) : `${num(v)}건`);

  return (
    <div>
      <PageHeader eyebrow="Analytics" title="플랫폼 통계" description="방문(DAU/WAU/MAU)은 사이트 방문 기록 기준, 거래 지표는 결제 승인 기준입니다." actions={<PeriodFilter state={periodState} />} />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading && !data ? <LoadingBlock /> : data && (
        <div className="grid gap-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <KpiCard label="DAU" value={num(t.dau)} hint={`회원 ${num(t.dau_members)}`} />
            <KpiCard label="WAU" value={num(t.wau)} />
            <KpiCard label="MAU" value={num(t.mau)} hint={`회원 ${num(t.mau_members)}`} />
            <KpiCard label="신규 가입자" value={num(t.new_signups)} />
            <KpiCard label="제작자 증가" value={num(t.new_creators)} hint={`브랜드 +${num(t.new_brands)}`} />
            <KpiCard label="펀딩 생성" value={num(t.fundings_created)} />
            <KpiCard label="펀딩 승인률" value={pct(t.funding_approval_rate)} />
            <KpiCard label="펀딩 성공률" value={pct(t.funding_success_rate)} hint="기간 내 종료 펀딩 기준" />
            <KpiCard label="참여자 수" value={num(t.participants)} hint={`주문 ${num(t.orders)}건`} />
            <KpiCard label="구매 전환율" value={pct(t.conversion_rate, 2)} hint={`방문자 ${num(t.visitors)}`} />
            <KpiCard emphasis label="GMV" value={won(t.gmv)} locked={locked} />
            <KpiCard label="플랫폼 매출(수수료)" value={won(t.platform_revenue)} locked={locked} hint={t.commission_rate != null ? `수수료율 ${t.commission_rate}%` : undefined} />
            <KpiCard label="평균 주문금액" value={won(t.aov)} locked={locked} />
            <KpiCard label="환불률" value={pct(t.refund_rate, 2)} locked={locked} hint={t.refunds != null ? `환불 ${won(t.refunds)}` : undefined} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="일별 방문자(DAU)"><TrendChart data={series} dataKey="dau" label="방문자" /></Panel>
            {data.finance_visible && <Panel title="일별 GMV"><TrendChart data={series} dataKey="gmv" label="GMV" money /></Panel>}
            <Panel title="일별 신규 가입"><TrendChart data={series} dataKey="signups" label="신규 가입" kind="bar" /></Panel>
            <Panel title="일별 주문"><TrendChart data={series} dataKey="orders" label="주문" kind="bar" /></Panel>
            <Panel title="일별 펀딩 생성"><TrendChart data={series} dataKey="fundings_created" label="펀딩 생성" kind="bar" /></Panel>
            {data.finance_visible && <Panel title="일별 환불 금액"><TrendChart data={series} dataKey="refunds" label="환불" money kind="bar" /></Panel>}
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="브랜드별 매출 TOP 10">{data.rankings.brands.length ? <RankBars rows={byGmv(data.rankings.brands)} valueLabel={valueLabel} /> : <p className="text-sm text-stone-400">데이터 없음</p>}</Panel>
            <Panel title="펀딩별 매출 TOP 10">{data.rankings.fundings.length ? <RankBars rows={byGmv(data.rankings.fundings)} valueLabel={valueLabel} /> : <p className="text-sm text-stone-400">데이터 없음</p>}</Panel>
            <Panel title="제작자별 실적 TOP 10">{data.rankings.creators.length ? <RankBars rows={data.rankings.creators.map((c) => ({ name: c.name, value: Number(data.finance_visible ? c.gmv ?? 0 : c.orders), sub: `펀딩 ${c.fundings} · 참여 ${c.participants}명` }))} valueLabel={valueLabel} /> : <p className="text-sm text-stone-400">데이터 없음</p>}</Panel>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
