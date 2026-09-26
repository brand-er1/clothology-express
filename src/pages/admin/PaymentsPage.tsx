import { useState } from "react";
import { adminRpc, totalOf, type PaymentRow } from "@/services/adminApi";
import { dateTime, PAYMENT_STATUS, PG_STATUS, REFUND_STATUS, won } from "@/lib/admin/format";
import { DataTable, EmptyState, ErrorBanner, FilterChips, LoadingBlock, MappedBadge, Notice, PageHeader, Pager, Panel, SearchInput, StatusBadge, Td } from "@/components/admin/shell/ui";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { OrderSheet } from "./OrdersPage";

const PAGE = 30;

const PaymentsPage = () => {
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const { data, loading, error, reload } = useAdminQuery(
    () => adminRpc<PaymentRow[]>("admin_list_payments", { p_search: search || null, p_provider: provider, p_status: status, p_limit: PAGE, p_offset: page * PAGE }),
    [search, provider, status, page],
  );
  const rows = data ?? [];

  return (
    <div>
      <PageHeader eyebrow="Payments" title="결제 관리" description="모의결제와 실결제(카카오페이)를 구분하고, 플랫폼 결제 상태와 PG 상태를 분리해 보여줍니다." />
      <div className="mb-3"><Notice>관리자 화면에서는 PG 결제 취소/환불 API 를 호출하지 않습니다. 환불은 <b>환불 관리</b>에서 요청·승인 절차를 거치며, 실결제는 PG 관리자 콘솔에서 직접 환불 후 확인 처리합니다.</Notice></div>
      <Panel bodyClassName="p-0" title={
        <div className="flex flex-col gap-2">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="결제번호(TID), 주문번호, 사용자, 펀딩" />
          <div className="flex flex-wrap gap-3">
            <FilterChips value={provider} onChange={(v) => { setProvider(v); setPage(0); }} options={[{ value: "all", label: "전체 수단" }, { value: "mock", label: "모의결제" }, { value: "kakaopay", label: "카카오페이" }]} />
            <FilterChips value={status} onChange={(v) => { setStatus(v); setPage(0); }} options={[{ value: "all", label: "전체 상태" }, { value: "paid", label: "결제완료" }, { value: "ready", label: "대기" }, { value: "cancelled", label: "취소" }, { value: "failed", label: "실패" }]} />
          </div>
        </div>
      }>
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="결제 내역이 없습니다" /> : (
          <DataTable minWidth={1250} head={["결제번호", "주문번호", "사용자", "펀딩", "결제금액", "결제수단", "구분", "결제 상태", "PG 상태", "결제일", "취소/환불"]}>
            {rows.map((row) => (
              <tr key={row.id} className="cursor-pointer hover:bg-stone-50" onClick={() => setSelected(row.id)}>
                <Td className="max-w-[160px] truncate font-mono text-[11px]">{row.payment_number}</Td>
                <Td className="font-mono text-[11px]">{row.order_number}</Td>
                <Td className="font-semibold">{row.user_name}</Td>
                <Td className="max-w-[180px] truncate text-xs">{row.product_name}</Td>
                <Td className="font-bold tabular-nums">{won(row.amount)}</Td>
                <Td className="text-xs">{row.payment_method}</Td>
                <Td><StatusBadge tone={row.is_mock ? "amber" : "blue"}>{row.is_mock ? "모의결제" : "실결제"}</StatusBadge></Td>
                <Td><MappedBadge map={PAYMENT_STATUS} value={row.payment_status} /></Td>
                <Td><MappedBadge map={PG_STATUS} value={row.pg_status} /></Td>
                <Td className="text-xs">{dateTime(row.paid_at)}</Td>
                <Td className="text-xs">{row.is_cancelled ? <StatusBadge tone="red">취소됨</StatusBadge> : row.refund_status ? <MappedBadge map={REFUND_STATUS} value={row.refund_status} /> : "-"}</Td>
              </tr>
            ))}
          </DataTable>
        )}
        <Pager page={page} pageSize={PAGE} total={totalOf(rows)} onPage={setPage} />
      </Panel>
      <OrderSheet orderId={selected} onClose={() => setSelected(null)} onChanged={reload} />
    </div>
  );
};

export default PaymentsPage;
