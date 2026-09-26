import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { adminRpc, totalOf, type RefundRow } from "@/services/adminApi";
import { dateTime, PG_REFUND_STATUS, REFUND_STATUS, won } from "@/lib/admin/format";
import { DataTable, DefinitionGrid, EmptyState, ErrorBanner, FilterChips, LoadingBlock, MappedBadge, Notice, PageHeader, Pager, Panel, SearchInput, StatusBadge, Td } from "@/components/admin/shell/ui";
import { ReasonDialog, type ReasonDialogState } from "@/components/admin/shell/ReasonDialog";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { useAdminContext } from "@/components/admin/shell/AdminContext";

const PAGE = 30;
const STATUSES = ["all", "requested", "reviewing", "approved", "processing", "completed", "rejected"] as const;
type Event = { id: string; from_status: string | null; to_status: string; note: string | null; actor_name: string | null; created_at: string };

const RefundSheet = ({ refund, onClose, onChanged }: { refund: RefundRow | null; onClose: () => void; onChanged: () => void }) => {
  const { can } = useAdminContext();
  const [dialog, setDialog] = useState<ReasonDialogState>(null);
  const confirmedRef = useRef(false);
  const { data: events } = useAdminQuery(
    () => (refund ? adminRpc<Event[]>("admin_get_refund_events", { p_refund_id: refund.id }) : Promise.resolve([])), [refund?.id, refund?.status],
  );
  if (!refund) return null;

  const transition = (to: string, title: string, opts: { required?: boolean; destructive?: boolean } = {}) => {
    confirmedRef.current = false;
    setDialog({
      title, confirmLabel: title, destructive: opts.destructive, reasonRequired: opts.required ?? false,
      reasonLabel: to === "rejected" ? "반려 사유" : "처리 메모",
      description: to === "completed"
        ? (refund.is_mock_payment
          ? "모의결제 건입니다. 완료 시 주문이 취소 상태로 보관되고(삭제 아님) 펀딩 참여 수량이 차감되며 구매자에게 알림이 발송됩니다."
          : "실결제 건입니다. BRAND-ER 는 PG 환불 API 를 자동 실행하지 않습니다. PG(카카오페이) 관리자 콘솔에서 환불을 먼저 완료한 뒤 확인해주세요.")
        : undefined,
      extra: to === "completed" && !refund.is_mock_payment
        ? <label className="flex items-center gap-2 text-sm font-semibold text-rose-700"><Checkbox onCheckedChange={(v) => { confirmedRef.current = v === true; }} />PG 콘솔에서 환불 완료를 확인했습니다</label>
        : undefined,
      onConfirm: (note) => adminRpc("admin_transition_refund", { p_refund_id: refund.id, p_to_status: to, p_note: note || null, p_pg_manual_confirmed: confirmedRef.current }),
      successMessage: "환불 상태를 변경했습니다",
    });
  };

  const manage = can("refunds.manage");
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader><SheetTitle>환불 요청 상세</SheetTitle></SheetHeader>
        <div className="mt-4 grid gap-4">
          <div className="flex flex-wrap items-center gap-2"><MappedBadge map={REFUND_STATUS} value={refund.status} /><StatusBadge tone={refund.is_mock_payment ? "amber" : "blue"}>{refund.is_mock_payment ? "모의결제" : "실결제"}</StatusBadge></div>
          <DefinitionGrid items={[
            { label: "주문번호", value: <span className="font-mono text-xs">{refund.order_number}</span> },
            { label: "펀딩", value: refund.product_name },
            { label: "고객", value: refund.user_name },
            { label: "환불 금액", value: <b>{won(refund.amount)}</b> },
            { label: "요청자", value: `${refund.requested_by_name ?? "-"} (${refund.requested_by_role})` },
            { label: "요청일", value: dateTime(refund.created_at) },
            { label: "PG 환불 상태", value: PG_REFUND_STATUS[refund.pg_refund_status] ?? refund.pg_refund_status },
            { label: "처리일", value: dateTime(refund.processed_at) },
          ]} />
          <Panel title="환불 사유"><p className="whitespace-pre-wrap text-sm">{refund.reason}</p>{refund.rejection_reason && <p className="mt-2 text-sm text-rose-600">반려 사유: {refund.rejection_reason}</p>}</Panel>
          <div className="flex flex-wrap gap-2">
            {refund.status === "requested" && can("refunds.request") && <Button size="sm" variant="outline" onClick={() => transition("reviewing", "검토 시작")}>검토 시작</Button>}
            {["requested", "reviewing"].includes(refund.status) && manage && <>
              <Button size="sm" className="bg-[#741b2b] hover:bg-[#551220]" onClick={() => transition("approved", "환불 승인")}>승인</Button>
              <Button size="sm" variant="outline" className="text-rose-600" onClick={() => transition("rejected", "환불 반려", { required: true, destructive: true })}>반려</Button>
            </>}
            {refund.status === "approved" && manage && <Button size="sm" variant="outline" onClick={() => transition("processing", "환불 처리 시작")}>환불 처리 시작</Button>}
            {refund.status === "processing" && manage && <Button size="sm" className="bg-[#741b2b] hover:bg-[#551220]" onClick={() => transition("completed", "환불 완료")}>환불 완료</Button>}
            {!manage && ["requested", "reviewing"].includes(refund.status) && <Notice tone="stone">승인/반려는 Super Admin 권한이 필요합니다.</Notice>}
          </div>
          <Panel title="처리 이력" bodyClassName="p-0">
            <ol className="divide-y divide-stone-100">{(events ?? []).map((e) => (
              <li key={e.id} className="px-4 py-2.5 text-xs"><p className="font-bold">{e.from_status ? `${REFUND_STATUS[e.from_status]?.label ?? e.from_status} → ` : ""}{REFUND_STATUS[e.to_status]?.label ?? e.to_status}</p><p className="text-stone-500">{e.actor_name} · {dateTime(e.created_at)}{e.note ? ` · ${e.note}` : ""}</p></li>
            ))}</ol>
          </Panel>
        </div>
        <ReasonDialog state={dialog} onClose={() => setDialog(null)} onDone={() => { onChanged(); onClose(); }} />
      </SheetContent>
    </Sheet>
  );
};

const RefundsPage = () => {
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<RefundRow | null>(null);
  const { data, loading, error, reload } = useAdminQuery(
    () => adminRpc<RefundRow[]>("admin_list_refunds", { p_status: status, p_search: search || null, p_limit: PAGE, p_offset: page * PAGE }),
    [status, search, page],
  );
  const rows = data ?? [];
  return (
    <div>
      <PageHeader eyebrow="Refunds" title="취소 · 환불 관리" description="환불요청 → 검토중 → 승인/반려 → 환불처리중 → 환불완료. 모든 변경은 처리 이력과 Audit Log 에 저장됩니다." />
      <div className="mb-3"><Notice>실결제 환불은 PG 정식 연동 전까지 자동 실행되지 않습니다. 환불 요청은 주문 상세에서 등록합니다.</Notice></div>
      <Panel bodyClassName="p-0" title={
        <div className="flex flex-col gap-2">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="주문번호, 펀딩명, 고객명" />
          <FilterChips value={status} onChange={(v) => { setStatus(v); setPage(0); }} options={STATUSES.map((key) => ({ value: key, label: key === "all" ? "전체" : REFUND_STATUS[key].label }))} />
        </div>
      }>
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="환불 요청이 없습니다" /> : (
          <DataTable minWidth={1100} head={["주문번호", "고객", "펀딩", "금액", "사유", "구분", "상태", "PG 환불", "요청일"]}>
            {rows.map((row) => (
              <tr key={row.id} className="cursor-pointer hover:bg-stone-50" onClick={() => setSelected(row)}>
                <Td className="font-mono text-[11px]">{row.order_number}</Td>
                <Td className="font-semibold">{row.user_name}</Td>
                <Td className="max-w-[180px] truncate text-xs">{row.product_name}</Td>
                <Td className="font-bold tabular-nums">{won(row.amount)}</Td>
                <Td className="max-w-[220px] truncate text-xs">{row.reason}</Td>
                <Td><StatusBadge tone={row.is_mock_payment ? "amber" : "blue"}>{row.is_mock_payment ? "모의" : "실결제"}</StatusBadge></Td>
                <Td><MappedBadge map={REFUND_STATUS} value={row.status} /></Td>
                <Td className="max-w-[160px] truncate text-[11px] text-stone-500">{PG_REFUND_STATUS[row.pg_refund_status]}</Td>
                <Td className="text-xs">{dateTime(row.created_at)}</Td>
              </tr>
            ))}
          </DataTable>
        )}
        <Pager page={page} pageSize={PAGE} total={totalOf(rows)} onPage={setPage} />
      </Panel>
      <RefundSheet refund={selected} onClose={() => setSelected(null)} onChanged={reload} />
    </div>
  );
};

export default RefundsPage;
