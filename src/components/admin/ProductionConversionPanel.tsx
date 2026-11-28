import { KpiCard, ErrorBanner, LoadingBlock, Panel, DataTable, Td, EmptyState } from "@/components/admin/shell/ui";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { num, pct } from "@/lib/admin/format";
import { adminRpc } from "@/services/adminApi";
import { CONSULT_STATUSES, CONSULT_STATUS_LABEL, PRODUCTION_CTA_LABEL } from "@/lib/production-request";

type Conversion = {
  funnel: { sessions: number; cta_sessions: number; ai_cta_sessions: number; form_sessions: number; submit_sessions: number; any_submit_sessions: number };
  events: { cta_clicks: number; ai_cta_clicks: number; form_views: number; submits: number };
  by_entry: { entry_path: string; sessions: number; cta_sessions: number; form_sessions: number; submit_sessions: number; conversion_rate: number | null }[];
  by_cta: { source: string; clicks: number; sessions: number; submit_sessions: number; conversion_rate: number | null }[];
  by_form_source: { source: string; views: number; submits: number; conversion_rate: number | null }[];
  consult: Record<string, number | null> & { requests: number; inquiries: number; contract_rate: number | null };
};

const rate = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : null);

/**
 * 제작 의뢰 전환 통계 — 제작 의뢰 CTA 클릭 · AI 결과 화면 CTA 클릭 · 양식 진입 · 제출 완료와
 * 유입(랜딩) 페이지별 · CTA 위치별 전환율, 기간 내 의뢰의 상담 상태(계약 전환율).
 */
export const ProductionConversionPanel = ({ from, to }: { from: string; to: string }) => {
  const { data, loading, error, reload } = useAdminQuery(
    () => adminRpc<Conversion>("admin_get_production_conversion", { p_from: from, p_to: to }),
    [from, to],
  );

  if (error) return <ErrorBanner message={error} onRetry={reload} />;
  if (loading && !data) return <LoadingBlock />;
  if (!data) return null;

  const { funnel, events, consult } = data;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="방문 세션" value={num(funnel.sessions)} />
        <KpiCard label="제작 의뢰 버튼 클릭" value={num(events.cta_clicks + events.ai_cta_clicks)} hint={`클릭 세션 ${num(funnel.cta_sessions)} · ${pct(rate(funnel.cta_sessions, funnel.sessions), 1)}`} />
        <KpiCard label="AI 결과 → 제작 의뢰 클릭" value={num(events.ai_cta_clicks)} hint={`세션 ${num(funnel.ai_cta_sessions)}`} />
        <KpiCard label="의뢰 양식 진입" value={num(events.form_views)} hint={`세션 ${num(funnel.form_sessions)}`} />
        <KpiCard emphasis label="의뢰 제출 완료" value={num(events.submits)} hint={`양식 대비 ${pct(rate(funnel.submit_sessions, funnel.form_sessions), 1)}`} />
        <KpiCard label="방문 → 제출 전환율" value={pct(rate(funnel.submit_sessions, funnel.sessions), 2)} hint={`모든 제작 의뢰 경로 ${pct(rate(funnel.any_submit_sessions, funnel.sessions), 2)}`} />
      </div>

      <Panel title="상담 진행 현황 (기간 내 접수된 모든 제작 의뢰)" description={`전체 ${num(consult.requests)}건 · 간편 제작 의뢰 ${num(consult.inquiries)}건 · 계약 전환율 ${pct(consult.contract_rate, 1)}`}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {CONSULT_STATUSES.map((status) => (
            <div key={status} className="rounded-lg border border-stone-200 px-3 py-2">
              <p className="text-[11px] font-semibold text-stone-500">{CONSULT_STATUS_LABEL[status]}</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">{num(consult[status] ?? 0)}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="유입 페이지별 제작 의뢰 전환율" description="세션이 처음 들어온 페이지 기준 (상위 15개)" bodyClassName="p-0">
          {data.by_entry.length === 0 ? <EmptyState /> : (
            <DataTable minWidth={520} head={["유입 페이지", "세션", "CTA 클릭", "양식 진입", "제출", "전환율"]}>
              {data.by_entry.map((row) => (
                <tr key={row.entry_path}>
                  <Td className="max-w-[220px] truncate font-mono text-xs">{row.entry_path}</Td>
                  <Td className="tabular-nums text-xs">{num(row.sessions)}</Td>
                  <Td className="tabular-nums text-xs">{num(row.cta_sessions)}</Td>
                  <Td className="tabular-nums text-xs">{num(row.form_sessions)}</Td>
                  <Td className="tabular-nums text-xs font-semibold">{num(row.submit_sessions)}</Td>
                  <Td className="tabular-nums text-xs font-semibold text-brand">{pct(row.conversion_rate, 2)}</Td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
        <Panel title="CTA 위치별 클릭 · 전환" description="어느 버튼에서 제작 의뢰로 넘어왔는지" bodyClassName="p-0">
          {data.by_cta.length === 0 ? <EmptyState /> : (
            <DataTable minWidth={480} head={["CTA 위치", "클릭", "클릭 세션", "제출 세션", "전환율"]}>
              {data.by_cta.map((row) => (
                <tr key={row.source}>
                  <Td className="text-xs font-semibold">{PRODUCTION_CTA_LABEL[row.source] ?? row.source}</Td>
                  <Td className="tabular-nums text-xs">{num(row.clicks)}</Td>
                  <Td className="tabular-nums text-xs">{num(row.sessions)}</Td>
                  <Td className="tabular-nums text-xs">{num(row.submit_sessions)}</Td>
                  <Td className="tabular-nums text-xs font-semibold text-brand">{pct(row.conversion_rate, 1)}</Td>
                </tr>
              ))}
            </DataTable>
          )}
          {data.by_form_source.length > 0 && (
            <div className="border-t border-stone-100 px-4 py-3 text-xs text-stone-500">
              <p className="mb-1.5 font-semibold text-stone-700">양식 진입 경로별 제출률</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {data.by_form_source.map((row) => (
                  <span key={row.source}>{PRODUCTION_CTA_LABEL[row.source] ?? row.source}: {num(row.submits)}/{num(row.views)} ({pct(row.conversion_rate, 1)})</span>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};
