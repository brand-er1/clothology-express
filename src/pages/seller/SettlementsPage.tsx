import {
  DataTable, EmptyState, ErrorBanner, KpiCard, LoadingBlock, MappedBadge, Notice, PageHeader, Panel, Td,
} from "@/components/admin/shell/ui";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { dateOnly, FUNDING_PHASE, num, SETTLEMENT_STATUS, won } from "@/lib/admin/format";
import { fetchSellerSettlements } from "@/services/seller";

const SettlementsPage = () => {
  const { data, loading, error, reload } = useAdminQuery(fetchSellerSettlements, []);
  const settlements = data?.settlements ?? [];
  const sum = (status: string[]) => settlements.filter((s) => status.includes(s.status)).reduce((acc, s) => acc + Number(s.final_amount), 0);

  return (
    <div>
      <PageHeader eyebrow="Settlement" title="정산 관리" description="펀딩별 정산서와 지급 상태를 확인합니다. 정산서는 펀딩 종료 후 관리자가 생성합니다." />
      <Notice tone="stone">
        최종 정산금 = (실결제 거래액 − 실결제 취소/환불) − 플랫폼 수수료 − 제작비 − 기타 차감. 모의결제는 실제 입금이 없으므로 정산 대상이 아닙니다.
        현재 기본 수수료율은 {data ? `${Number(data.commission_rate)}%` : "-"} 입니다.
      </Notice>
      {error && <div className="mt-4"><ErrorBanner message={error} onRetry={reload} /></div>}
      {loading && !data ? <LoadingBlock /> : data && (
        <div className="mt-4 grid gap-5">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard emphasis label="정산 예정" value={won(sum(["pending", "scheduled"]))} />
            <KpiCard label="정산 완료" value={won(sum(["completed"]))} />
            <KpiCard label="보류" value={won(sum(["on_hold"]))} />
            <KpiCard label="정산서 미생성 실결제" value={won(data.unsettled.reduce((acc, u) => acc + Number(u.real_amount), 0))} hint="수수료 · 제작비 차감 전" />
          </section>

          <Panel title="정산서" bodyClassName="p-0">
            {settlements.length === 0 ? <EmptyState title="아직 생성된 정산서가 없습니다" description="펀딩이 종료되고 제작이 확정되면 관리자가 정산서를 생성합니다." /> : (
              <DataTable minWidth={1100} head={["펀딩", "상태", "실결제 거래액", "취소 · 환불", "수수료", "제작비 · 기타", "최종 정산금", "지급 예정일"]}>
                {settlements.map((s) => (
                  <tr key={s.id} className="align-top hover:bg-stone-50">
                    <Td>
                      <p className="max-w-[220px] truncate font-semibold">{s.funding_name}</p>
                      {s.mock_amount > 0 && <p className="text-[11px] text-amber-700">모의결제 {won(s.mock_amount)} 정산 제외</p>}
                    </Td>
                    <Td>
                      <MappedBadge map={SETTLEMENT_STATUS} value={s.status} />
                      {s.status === "on_hold" && s.hold_reason && <p className="mt-1 max-w-[160px] text-[11px] text-rose-600">{s.hold_reason}</p>}
                    </Td>
                    <Td className="tabular-nums">{won(s.gross_amount)}</Td>
                    <Td className="tabular-nums">−{won(s.refund_amount)}</Td>
                    <Td className="tabular-nums">−{won(s.platform_fee)} <span className="text-[11px] text-stone-400">({Number(s.commission_rate)}%)</span></Td>
                    <Td className="tabular-nums">−{won(Number(s.production_cost) + Number(s.other_deductions))}</Td>
                    <Td className="font-black tabular-nums text-[#741b2b]">{won(s.final_amount)}</Td>
                    <Td className="text-xs">{s.status === "completed" ? `완료 ${dateOnly(s.completed_at)}` : dateOnly(s.scheduled_date)}</Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Panel>

          <Panel title="정산 대기 중인 펀딩" description="정산서가 아직 없는 펀딩의 현재 실결제 금액입니다 (예상치)." bodyClassName="p-0">
            {data.unsettled.length === 0 ? <EmptyState title="대기 중인 펀딩이 없습니다" /> : (
              <DataTable minWidth={640} head={["펀딩", "상태", "실결제 완료", "결제 주문", "모의결제(제외)"]}>
                {data.unsettled.map((u) => (
                  <tr key={u.funding_id} className="hover:bg-stone-50">
                    <Td className="font-semibold">{u.funding_name}</Td>
                    <Td><MappedBadge map={FUNDING_PHASE} value={u.phase} /></Td>
                    <Td className="tabular-nums">{won(u.real_amount)}</Td>
                    <Td className="tabular-nums">{num(u.paid_orders)}건</Td>
                    <Td className="tabular-nums text-stone-400">{won(u.mock_amount)}</Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
};

export default SettlementsPage;
