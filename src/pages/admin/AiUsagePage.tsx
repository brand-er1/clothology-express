import { adminRpc } from "@/services/adminApi";
import { dateTime, num } from "@/lib/admin/format";
import { DataTable, EmptyState, ErrorBanner, KpiCard, LoadingBlock, Notice, PageHeader, Panel, Td } from "@/components/admin/shell/ui";
import { PeriodFilter, usePeriod } from "@/components/admin/shell/PeriodFilter";
import { TrendChart } from "@/components/admin/shell/TrendChart";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";

type AiUsage = {
  totals: {
    image_success: number; image_failed: number; copy_success: number; copy_failed: number;
    rejected_quota: number; estimated_cost_usd: number; creators: number; pages: number;
  };
  series: { date: string; images: number; failed: number; cost: number }[];
  creators: { user_id: string; name: string; images: number; copies: number; failed: number; rejected: number; cost: number }[];
  fundings: { funding_id: string; name: string; images: number; failed: number; cost: number }[];
  recent_failures: { created_at: string; feature: string; image_type: string | null; model: string | null; error: string | null }[];
  limits: { image_daily: number; image_page: number; copy_daily: number };
};

const usd = (value: number | string | null | undefined) => `$${Number(value ?? 0).toFixed(2)}`;

const AiUsagePage = () => {
  const periodState = usePeriod("30d");
  const { period } = periodState;
  const { data, loading, error, reload } = useAdminQuery(
    () => adminRpc<AiUsage>("admin_get_ai_usage", { p_from: period.from, p_to: period.to }), [period.from, period.to],
  );
  const t = data?.totals;
  return (
    <div>
      <PageHeader eyebrow="AI Usage" title="AI 상세페이지 사용량" description="AI 카피·이미지 생성 횟수, 실패, 한도 초과, 예상 비용을 확인합니다. (Super Admin)" actions={<PeriodFilter state={periodState} />} />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading && !data ? <LoadingBlock /> : data && t && (
        <div className="grid gap-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <KpiCard emphasis label="예상 비용" value={usd(t.estimated_cost_usd)} hint="시스템 설정의 단가 기준 추정치" />
            <KpiCard label="AI 이미지 생성" value={num(t.image_success)} hint={`실패 ${num(t.image_failed)}`} />
            <KpiCard label="AI 카피 생성" value={num(t.copy_success)} hint={`실패 ${num(t.copy_failed)}`} />
            <KpiCard label="한도 초과 차단" value={num(t.rejected_quota)} />
            <KpiCard label="사용 제작자" value={num(t.creators)} />
            <KpiCard label="상세페이지" value={num(t.pages)} />
          </div>
          <Notice tone="stone">
            현재 한도: 제작자 1인 하루 이미지 {num(data.limits.image_daily)}회 · 카피 {num(data.limits.copy_daily)}회 · 상세페이지당 이미지 {num(data.limits.image_page)}회.
            한도와 단가는 시스템 설정(ai_detail_image_daily_limit 등)에서 Super Admin 이 변경합니다.
          </Notice>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="일별 AI 이미지 생성"><TrendChart data={data.series} dataKey="images" label="이미지" kind="bar" /></Panel>
            <Panel title="일별 실패"><TrendChart data={data.series} dataKey="failed" label="실패" kind="bar" /></Panel>
          </div>
          <Panel title="제작자별 사용량" bodyClassName="p-0">
            {!data.creators.length ? <EmptyState title="사용 기록이 없습니다" /> : (
              <DataTable minWidth={720} head={["제작자", "이미지", "카피", "실패", "한도 초과", "예상 비용"]}>
                {data.creators.map((row) => (
                  <tr key={row.user_id ?? row.name}>
                    <Td className="font-semibold">{row.name}</Td>
                    <Td className="tabular-nums">{num(row.images)}</Td>
                    <Td className="tabular-nums">{num(row.copies)}</Td>
                    <Td className="tabular-nums">{num(row.failed)}</Td>
                    <Td className="tabular-nums">{num(row.rejected)}</Td>
                    <Td className="font-bold tabular-nums">{usd(row.cost)}</Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Panel>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="펀딩별 사용량" bodyClassName="p-0">
              {!data.fundings.length ? <EmptyState title="펀딩에 연결된 사용 기록이 없습니다" /> : (
                <DataTable minWidth={480} head={["펀딩", "이미지", "실패", "예상 비용"]}>
                  {data.fundings.map((row) => (
                    <tr key={row.funding_id}>
                      <Td className="max-w-[240px] truncate font-semibold">{row.name}</Td>
                      <Td className="tabular-nums">{num(row.images)}</Td>
                      <Td className="tabular-nums">{num(row.failed)}</Td>
                      <Td className="tabular-nums">{usd(row.cost)}</Td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </Panel>
            <Panel title="최근 실패" bodyClassName="p-0">
              {!data.recent_failures.length ? <EmptyState title="실패 기록이 없습니다" /> : (
                <ul className="divide-y divide-stone-100">
                  {data.recent_failures.map((row, index) => (
                    <li key={index} className="px-4 py-2.5 text-xs">
                      <p className="font-semibold">{row.feature === "detail_image" ? `이미지 · ${row.image_type ?? "-"}` : "카피"} · {dateTime(row.created_at)}</p>
                      <p className="truncate text-stone-500" title={row.error ?? ""}>{row.model ?? ""} {row.error}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiUsagePage;
