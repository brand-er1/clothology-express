import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { adminRpc, totalOf, type OrderRow } from "@/services/adminApi";
import { dateTime, num, ORDER_STATE, PAYMENT_STATUS, REFUND_STATUS, won } from "@/lib/admin/format";
import {
  DataTable, DefinitionGrid, EmptyState, ErrorBanner, FilterChips, LoadingBlock, MappedBadge, Notice, PageHeader, Pager, Panel,
  SearchInput, StatusBadge, Td,
} from "@/components/admin/shell/ui";
import { ReasonDialog, type ReasonDialogState } from "@/components/admin/shell/ReasonDialog";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { useAdminContext } from "@/components/admin/shell/AdminContext";

const PAGE = 30;
const STATES = ["all", "payment_pending", "paid", "in_production", "ready_to_ship", "shipping", "delivered", "cancelled", "refunded"] as const;

type OrderDetail = Record<string, unknown> & {
  id: string; order_number: string; participant_email: string; pii_visible: boolean;
  orderer_name: string; orderer_phone: string; orderer_email: string | null; recipient_name: string; recipient_phone: string;
  postal_code: string | null; shipping_address: string | null; shipping_address_detail: string | null; delivery_message: string | null;
  funding: { product_name: string; brand_name: string | null; cloth_type: string; image_url: string };
  selected_color: string; selected_size: string; quantity: number; unit_price: number; total_amount: number;
  participation_status: string; order_state: string; payment_provider: string; payment_type: string; payment_status: string;
  payment_method_type: string | null; payment_approved_at: string | null; production_stage: string; shipping_status: string;
  courier: string | null; tracking_number: string | null; cancellation_reason: string | null; created_at: string;
  refund_requests: { id: string; status: string; amount: number; reason: string; created_at: string }[];
  history: { action: string; admin_name: string; reason: string | null; created_at: string }[];
};

export const OrderSheet = ({ orderId, onClose, onChanged }: { orderId: string | null; onClose: () => void; onChanged?: () => void }) => {
  const { can } = useAdminContext();
  const [dialog, setDialog] = useState<ReasonDialogState>(null);
  const { data: o, loading, error, reload } = useAdminQuery(
    () => (orderId ? adminRpc<OrderDetail>("admin_get_order_detail", { p_participation_id: orderId }) : Promise.resolve(null)), [orderId],
  );
  const hasOpenRefund = o?.refund_requests.some((r) => !["rejected", "completed"].includes(r.status));

  return (
    <Sheet open={Boolean(orderId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader><SheetTitle>주문 상세</SheetTitle></SheetHeader>
        {error && <ErrorBanner message={error} onRetry={reload} />}
        {loading || !o ? <LoadingBlock /> : (
          <div className="mt-4 grid gap-4">
            <div className="flex items-center gap-3">
              <img src={o.funding.image_url} alt="" className="h-16 w-16 rounded-xl border object-cover" />
              <div className="min-w-0">
                <p className="font-mono text-xs text-stone-400">{o.order_number}</p>
                <p className="truncate font-extrabold">{o.funding.product_name}</p>
                <div className="mt-1 flex flex-wrap gap-1"><MappedBadge map={ORDER_STATE} value={o.order_state} /><StatusBadge tone={o.payment_type === "MOCK" ? "amber" : "blue"}>{o.payment_type === "MOCK" ? "모의결제" : "실결제"}</StatusBadge></div>
              </div>
            </div>
            {!o.pii_visible && <Notice tone="stone">배송·연락처 정보는 개인정보 열람 권한이 있는 관리자에게만 표시됩니다.</Notice>}
            <Panel title="주문 정보"><DefinitionGrid items={[
              { label: "주문일", value: dateTime(o.created_at) },
              { label: "브랜드", value: o.funding.brand_name },
              { label: "옵션 · 사이즈", value: `${o.selected_color} / ${o.selected_size}` },
              { label: "수량 · 단가", value: `${num(o.quantity)}장 × ${won(o.unit_price)}` },
              { label: "주문 금액", value: <b>{won(o.total_amount)}</b> },
              { label: "결제 상태", value: <MappedBadge map={PAYMENT_STATUS} value={o.payment_status} /> },
              { label: "결제수단", value: o.payment_provider === "mock" ? "모의결제" : `${o.payment_provider} ${o.payment_method_type ?? ""}` },
              { label: "결제일", value: dateTime(o.payment_approved_at) },
            ]} /></Panel>
            <Panel title="주문자 · 배송지"><DefinitionGrid items={[
              { label: "주문자", value: o.orderer_name },
              { label: "연락처", value: o.orderer_phone },
              { label: "회원 이메일", value: o.participant_email },
              { label: "수령인", value: `${o.recipient_name ?? "-"} ${o.recipient_phone ?? ""}` },
              { label: "배송지", value: [o.postal_code && `(${o.postal_code})`, o.shipping_address, o.shipping_address_detail].filter(Boolean).join(" ") || "-" },
              { label: "배송 메시지", value: o.delivery_message },
              { label: "택배사 · 송장", value: o.tracking_number ? `${o.courier ?? ""} ${o.tracking_number}` : "미등록" },
              { label: "취소 사유", value: o.cancellation_reason },
            ]} /></Panel>
            <div className="flex flex-wrap gap-2">
              {can("orders.manage") && o.participation_status === "pledged" && o.payment_status === "paid" && (
                <Button size="sm" variant="outline" onClick={() => setDialog({
                  title: "주문 확정", confirmLabel: "확정", reasonLabel: "메모",
                  onConfirm: (reason) => adminRpc("admin_set_order_status", { p_participation_id: o.id, p_status: "confirmed", p_reason: reason }),
                })}>주문 확정</Button>
              )}
              {can("refunds.request") && o.payment_status === "paid" && o.participation_status !== "cancelled" && !hasOpenRefund && (
                <Button size="sm" variant="outline" className="text-rose-600" onClick={() => setDialog({
                  title: "취소/환불 요청 등록", confirmLabel: "요청 등록", reasonLabel: "환불 사유", destructive: true,
                  description: "환불 요청이 등록되면 Super Admin 승인 후 처리됩니다. 실결제는 PG 연동 전까지 자동 환불되지 않습니다.",
                  onConfirm: (reason) => adminRpc("admin_create_refund_request", { p_participation_id: o.id, p_reason: reason }),
                  successMessage: "환불 요청을 등록했습니다",
                })}>취소/환불 요청</Button>
              )}
            </div>
            {o.refund_requests.length > 0 && (
              <Panel title="환불 요청" bodyClassName="p-0"><ul className="divide-y divide-stone-100">{o.refund_requests.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm"><span className="truncate">{r.reason}</span><MappedBadge map={REFUND_STATUS} value={r.status} /></li>
              ))}</ul></Panel>
            )}
            {o.history.length > 0 && (
              <Panel title="처리 이력" bodyClassName="p-0"><ul className="divide-y divide-stone-100">{o.history.map((h, i) => (
                <li key={i} className="px-4 py-2.5 text-xs"><b>{h.action}</b> · {h.admin_name} · {dateTime(h.created_at)}{h.reason ? ` · ${h.reason}` : ""}</li>
              ))}</ul></Panel>
            )}
          </div>
        )}
        <ReasonDialog state={dialog} onClose={() => setDialog(null)} onDone={() => { void reload(); onChanged?.(); }} />
      </SheetContent>
    </Sheet>
  );
};

const OrdersPage = () => {
  const [params, setParams] = useSearchParams();
  const fundingId = params.get("funding");
  const [search, setSearch] = useState("");
  const [state, setState] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const { data, loading, error, reload } = useAdminQuery(
    () => adminRpc<OrderRow[]>("admin_list_orders", { p_search: search || null, p_state: state, p_funding_id: fundingId, p_limit: PAGE, p_offset: page * PAGE }),
    [search, state, page, fundingId],
  );
  const rows = data ?? [];

  return (
    <div>
      <PageHeader eyebrow="Orders" title="주문 · 참여자 관리" description="펀딩 참여 주문 전체를 조회합니다. 주문번호·이름·전화번호·펀딩·브랜드로 검색할 수 있습니다." />
      {fundingId && <div className="mb-3"><Notice tone="blue">특정 펀딩의 참여자만 표시 중입니다. <button className="font-bold underline" onClick={() => setParams({})}>전체 보기</button></Notice></div>}
      <Panel bodyClassName="p-0" title={
        <div className="flex flex-col gap-2">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="주문번호, 이름, 전화번호, 펀딩, 브랜드" />
          <FilterChips value={state} onChange={(v) => { setState(v); setPage(0); }} options={STATES.map((key) => ({ value: key, label: key === "all" ? "전체" : ORDER_STATE[key].label }))} />
        </div>
      }>
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="주문이 없습니다" /> : (
          <DataTable minWidth={1250} head={["주문번호", "주문자", "연락처", "펀딩 · 브랜드", "옵션/사이즈", "수량", "주문 금액", "결제", "주문 상태", "주문일"]}>
            {rows.map((row) => (
              <tr key={row.id} className="cursor-pointer hover:bg-stone-50" onClick={() => setSelected(row.id)}>
                <Td className="font-mono text-[11px]">{row.order_number ?? row.id.slice(0, 8)}</Td>
                <Td className="font-semibold">{row.orderer_name}</Td>
                <Td className="text-xs tabular-nums">{row.orderer_phone ?? "-"}</Td>
                <Td className="text-xs"><p className="max-w-[200px] truncate font-semibold">{row.product_name}</p><p className="text-stone-400">{row.brand_name ?? "-"}</p></Td>
                <Td className="text-xs">{row.selected_color} / {row.selected_size}</Td>
                <Td className="tabular-nums">{num(row.quantity)}</Td>
                <Td className="font-bold tabular-nums">{won(row.total_amount)}</Td>
                <Td><div className="flex flex-col gap-1"><MappedBadge map={PAYMENT_STATUS} value={row.payment_status} /><span className="text-[10px] font-bold text-stone-400">{row.payment_type === "MOCK" ? "모의결제" : row.payment_provider}</span></div></Td>
                <Td><MappedBadge map={ORDER_STATE} value={row.order_state} /></Td>
                <Td className="text-xs">{dateTime(row.created_at)}</Td>
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

export default OrdersPage;
