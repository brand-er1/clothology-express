import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { adminRpc, totalOf, type ShipmentRow } from "@/services/adminApi";
import { dateTime, num, pct, productionLabel, SHIPPING_STATE } from "@/lib/admin/format";
import { DataTable, EmptyState, ErrorBanner, FilterChips, LoadingBlock, MappedBadge, Notice, PageHeader, Pager, Panel, SearchInput, Td } from "@/components/admin/shell/ui";
import { ReasonDialog, type ReasonDialogState } from "@/components/admin/shell/ReasonDialog";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { useAdminContext } from "@/components/admin/shell/AdminContext";

const PAGE = 50;
const COURIERS = ["CJ대한통운", "롯데택배", "한진택배", "우체국택배", "로젠택배", "경동택배"];
type Progress = { funding_id: string; product_name: string; brand_name: string | null; production_status: string | null; total_orders: number; preparing: number; invoiced: number; shipped: number; delivered: number; progress: number };

const ShippingPage = () => {
  const { can } = useAdminContext();
  const manage = can("shipping.manage");
  const [params, setParams] = useSearchParams();
  const fundingId = params.get("funding");
  const [state, setState] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [checked, setChecked] = useState<string[]>([]);
  const [dialog, setDialog] = useState<ReasonDialogState>(null);
  const invoice = useRef({ courier: COURIERS[0], tracking: "" });

  const progress = useAdminQuery(() => adminRpc<Progress[]>("admin_shipping_progress"), []);
  const list = useAdminQuery(
    () => adminRpc<ShipmentRow[]>("admin_list_shipments", { p_funding_id: fundingId, p_state: state, p_search: search || null, p_limit: PAGE, p_offset: page * PAGE }),
    [fundingId, state, search, page],
  );
  const rows = useMemo(() => list.data ?? [], [list.data]);
  const reloadAll = () => { setChecked([]); void list.reload(); void progress.reload(); };

  const openInvoice = (row: ShipmentRow) => {
    invoice.current = { courier: row.courier ?? COURIERS[0], tracking: row.tracking_number ?? "" };
    setDialog({
      title: `송장 등록 · ${row.order_number}`, confirmLabel: "송장 저장", reasonRequired: false, reasonLabel: "메모",
      extra: (
        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-stone-600">
          <label className="grid gap-1">택배사<Input list="courier-list" defaultValue={invoice.current.courier} onChange={(e) => { invoice.current.courier = e.target.value; }} />
            <datalist id="courier-list">{COURIERS.map((c) => <option key={c} value={c} />)}</datalist></label>
          <label className="grid gap-1">송장번호<Input defaultValue={invoice.current.tracking} onChange={(e) => { invoice.current.tracking = e.target.value; }} /></label>
        </div>
      ),
      onConfirm: (note) => adminRpc("admin_update_shipment", { p_participation_id: row.id, p_action: "invoice", p_courier: invoice.current.courier, p_tracking_number: invoice.current.tracking, p_note: note || null }),
      successMessage: "송장을 등록했습니다",
    });
  };

  const single = (row: ShipmentRow, action: "ship" | "deliver" | "revert_preparing") => setDialog({
    title: action === "ship" ? "배송 시작 처리" : action === "deliver" ? "배송 완료 처리" : "배송 준비로 되돌리기",
    confirmLabel: "처리", reasonRequired: action === "revert_preparing", reasonLabel: action === "revert_preparing" ? "사유" : "메모",
    description: action !== "revert_preparing" ? "구매자에게 사이트 알림이 발송됩니다." : undefined,
    onConfirm: (note) => adminRpc("admin_update_shipment", { p_participation_id: row.id, p_action: action, p_note: note || null }),
  });

  const bulk = (action: "ship" | "deliver") => setDialog({
    title: `${checked.length}건 일괄 ${action === "ship" ? "배송 시작" : "배송 완료"}`, confirmLabel: "일괄 처리", reasonRequired: false, reasonLabel: "메모",
    description: action === "ship" ? "송장이 등록되지 않은 주문은 건너뜁니다." : undefined,
    onConfirm: async (note) => {
      const result = await adminRpc<{ updated: number; failed: { error: string }[] }>("admin_bulk_update_shipments", { p_participation_ids: checked, p_action: action, p_note: note || null });
      return { warning: `${result.updated}건 처리${result.failed.length ? `, ${result.failed.length}건 실패(${result.failed[0].error})` : ""}` };
    },
  });

  return (
    <div>
      <PageHeader eyebrow="Shipping" title="배송 관리" description="배송 준비 → 송장 등록 → 배송중 → 배송완료. 펀딩별 전체 배송 진행률을 함께 확인합니다." />
      {progress.data && progress.data.length > 0 && (
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {progress.data.map((p) => (
            <button key={p.funding_id} type="button" onClick={() => { setParams({ funding: p.funding_id }); setPage(0); }}
              className={`rounded-2xl border bg-white p-4 text-left transition hover:border-[#741b2b]/40 ${fundingId === p.funding_id ? "border-[#741b2b]" : "border-stone-200/80"}`}>
              <div className="flex items-center justify-between gap-2"><p className="truncate font-bold">{p.product_name}</p><span className="text-sm font-black tabular-nums text-[#741b2b]">{pct(p.progress)}</span></div>
              <p className="text-xs text-stone-500">{p.brand_name ?? "-"} · 제작 {productionLabel(p.production_status)}</p>
              <div className="mt-2 h-2 rounded-full bg-stone-100"><div className="h-2 rounded-full bg-[#741b2b]" style={{ width: `${p.progress}%` }} /></div>
              <p className="mt-2 text-[11px] text-stone-500">준비 {num(p.preparing)} · 송장 {num(p.invoiced)} · 배송중 {num(p.shipped)} · 완료 {num(p.delivered)} / 총 {num(p.total_orders)}</p>
            </button>
          ))}
        </div>
      )}
      {fundingId && <div className="mb-3"><Notice tone="blue">선택한 펀딩의 주문만 표시 중입니다. <button className="font-bold underline" onClick={() => setParams({})}>전체 보기</button></Notice></div>}
      <Panel bodyClassName="p-0" title={
        <div className="flex flex-col gap-2">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="주문번호, 수령인, 송장번호, 펀딩" />
          <FilterChips value={state} onChange={(v) => { setState(v); setPage(0); }} options={[{ value: "all", label: "전체" }, ...Object.entries(SHIPPING_STATE).map(([value, meta]) => ({ value, label: meta.label }))]} />
        </div>
      } actions={manage && checked.length > 0 ? (
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => bulk("ship")}>선택 배송 시작</Button><Button size="sm" className="bg-[#741b2b] hover:bg-[#551220]" onClick={() => bulk("deliver")}>선택 배송 완료</Button></div>
      ) : undefined}>
        {list.error && <div className="p-4"><ErrorBanner message={list.error} onRetry={list.reload} /></div>}
        {list.loading && !list.data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="배송 대상 주문이 없습니다" /> : (
          <DataTable minWidth={1250} head={[
            manage ? <Checkbox key="all" checked={checked.length > 0 && checked.length === rows.length} onCheckedChange={(v) => setChecked(v === true ? rows.map((r) => r.id) : [])} aria-label="전체 선택" /> : "",
            "주문번호", "펀딩", "수령인", "배송지", "옵션", "수량", "상태", "택배사 · 송장", "처리",
          ]}>
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-stone-50">
                <Td>{manage && <Checkbox checked={checked.includes(row.id)} onCheckedChange={(v) => setChecked((prev) => v === true ? [...prev, row.id] : prev.filter((id) => id !== row.id))} aria-label="선택" />}</Td>
                <Td className="font-mono text-[11px]">{row.order_number}</Td>
                <Td className="max-w-[160px] truncate text-xs">{row.product_name}</Td>
                <Td className="text-xs"><p className="font-semibold">{row.recipient_name ?? "-"}</p><p className="text-stone-400">{row.recipient_phone}</p></Td>
                <Td className="max-w-[240px] truncate text-xs" >{row.shipping_address}</Td>
                <Td className="text-xs">{row.selected_color}/{row.selected_size}</Td>
                <Td className="tabular-nums">{num(row.quantity)}</Td>
                <Td><MappedBadge map={SHIPPING_STATE} value={row.shipping_state} /><p className="mt-0.5 text-[10px] text-stone-400">{dateTime(row.delivered_at || row.shipped_at)}</p></Td>
                <Td className="text-xs">{row.tracking_number ? `${row.courier ?? ""} ${row.tracking_number}` : "-"}</Td>
                <Td>{manage && (
                  <div className="flex flex-wrap gap-1">
                    {row.shipping_state !== "delivered" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openInvoice(row)}>송장</Button>}
                    {row.shipping_state === "invoiced" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => single(row, "ship")}>배송시작</Button>}
                    {row.shipping_state === "shipped" && <Button size="sm" className="h-7 bg-[#741b2b] text-xs hover:bg-[#551220]" onClick={() => single(row, "deliver")}>배송완료</Button>}
                    {row.shipping_state === "shipped" && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => single(row, "revert_preparing")}>되돌리기</Button>}
                  </div>
                )}</Td>
              </tr>
            ))}
          </DataTable>
        )}
        <Pager page={page} pageSize={PAGE} total={totalOf(rows)} onPage={setPage} />
      </Panel>
      <ReasonDialog state={dialog} onClose={() => setDialog(null)} onDone={reloadAll} />
    </div>
  );
};

export default ShippingPage;
