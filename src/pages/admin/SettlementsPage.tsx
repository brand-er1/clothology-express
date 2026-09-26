import { useRef, useState } from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { adminRpc, type SettlementRow } from "@/services/adminApi";
import { dateOnly, dateTime, FUNDING_PHASE, num, SETTLEMENT_STATUS, won } from "@/lib/admin/format";
import { DataTable, EmptyState, ErrorBanner, FilterChips, KpiCard, LoadingBlock, MappedBadge, Notice, PageHeader, Panel, SearchInput, Td } from "@/components/admin/shell/ui";
import { ReasonDialog, type ReasonDialogState } from "@/components/admin/shell/ReasonDialog";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { useAdminContext } from "@/components/admin/shell/AdminContext";

type Candidate = { funding_id: string; product_name: string; brand_name: string | null; creator_name: string | null; phase: string; current_orders: number; moq: number; gmv: number; end_at: string | null };

const Line = ({ label, value, minus, strong }: { label: string; value: number; minus?: boolean; strong?: boolean }) => (
  <div className={`flex items-center justify-between py-1.5 text-sm ${strong ? "border-t border-stone-200 pt-2.5 text-base font-black" : ""}`}>
    <span className={strong ? "" : "text-stone-600"}>{label}</span>
    <span className="tabular-nums">{minus && value > 0 ? "− " : ""}{won(value)}</span>
  </div>
);

const SettlementSheet = ({ row, onClose, onChanged }: { row: SettlementRow | null; onClose: () => void; onChanged: () => void }) => {
  const { can } = useAdminContext();
  const [dialog, setDialog] = useState<ReasonDialogState>(null);
  const edit = useRef({ production: 0, other: 0, date: "", memo: "" });
  if (!row) return null;
  const calc = row.calculation as Record<string, number | string | boolean>;
  const manage = can("settlements.manage") && row.status !== "completed";

  const setStatus = (status: string, title: string, required = false) => setDialog({
    title, confirmLabel: title, reasonRequired: required, reasonLabel: status === "on_hold" ? "보류 사유" : "메모",
    description: status === "completed" ? "정산 완료 후에는 금액을 수정할 수 없습니다. 실제 지급(계좌이체)은 BRAND-ER 재무 절차에 따라 별도로 진행됩니다." : undefined,
    onConfirm: (reason) => adminRpc("admin_set_settlement_status", { p_settlement_id: row.id, p_status: status, p_reason: reason || null }),
  });

  const openEdit = () => {
    edit.current = { production: row.production_cost, other: row.other_deductions, date: row.scheduled_date ?? "", memo: row.memo ?? "" };
    setDialog({
      title: "정산 금액 조정", confirmLabel: "저장 후 재계산", reasonLabel: "수정 사유",
      extra: (
        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-stone-600">
          <label className="grid gap-1">제작비(원)<Input type="number" min={0} defaultValue={row.production_cost} onChange={(e) => { edit.current.production = Number(e.target.value); }} /></label>
          <label className="grid gap-1">기타 차감액(원)<Input type="number" min={0} defaultValue={row.other_deductions} onChange={(e) => { edit.current.other = Number(e.target.value); }} /></label>
          <label className="grid gap-1">정산 예정일<Input type="date" defaultValue={row.scheduled_date ?? ""} onChange={(e) => { edit.current.date = e.target.value; }} /></label>
          <label className="grid gap-1">메모<Input defaultValue={row.memo ?? ""} onChange={(e) => { edit.current.memo = e.target.value; }} /></label>
        </div>
      ),
      onConfirm: (reason) => adminRpc("admin_update_settlement", {
        p_settlement_id: row.id, p_production_cost: edit.current.production, p_other_deductions: edit.current.other,
        p_scheduled_date: edit.current.date || null, p_memo: edit.current.memo || null, p_reason: reason,
      }),
      successMessage: "정산 금액을 재계산했습니다",
    });
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>정산 상세 · 계산 근거</SheetTitle></SheetHeader>
        <div className="mt-4 grid gap-4">
          <div>
            <MappedBadge map={SETTLEMENT_STATUS} value={row.status} />
            <p className="mt-1 text-lg font-extrabold">{row.product_name}</p>
            <p className="text-xs text-stone-500">{row.brand_name ?? "-"} · {row.creator_name ?? "-"} · 정산 예정일 {dateOnly(row.scheduled_date)}</p>
          </div>
          {row.mock_amount > 0 && <Notice>모의결제 금액 {won(row.mock_amount)} 이 포함되어 있습니다. 모의결제는 실제 입금이 없으므로 실제 지급 대상이 아닙니다.</Notice>}
          <Panel title="계산 근거">
            <Line label={`총 거래액 (결제 ${num(calc.paid_orders as number)}건 + 환불 ${num(calc.refunded_orders as number)}건)`} value={row.gross_amount} />
            <Line label="취소/환불 금액" value={row.refund_amount} minus />
            <Line label="정산 대상 매출" value={row.net_sales} strong />
            <Line label={`플랫폼 수수료 (${row.commission_rate}%)`} value={row.platform_fee} minus />
            <Line label="제작비" value={row.production_cost} minus />
            <Line label="기타 차감액" value={row.other_deductions} minus />
            <Line label="최종 정산금" value={row.final_amount} strong />
            <p className="mt-2 text-[11px] text-stone-400">{String(calc.formula ?? "")} · 계산 시각 {dateTime(String(calc.calculated_at ?? ""))} · 실결제 {won(row.real_amount)} / 모의 {won(row.mock_amount)}</p>
          </Panel>
          {row.hold_reason && <Notice>보류 사유: {row.hold_reason}</Notice>}
          {row.memo && <Notice tone="stone">메모: {row.memo}</Notice>}
          {manage && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={openEdit}>금액 조정</Button>
              {row.status === "pending" && <Button size="sm" variant="outline" onClick={() => setStatus("scheduled", "정산 예정 확정")}>정산 예정 확정</Button>}
              {row.status === "scheduled" && <Button size="sm" className="bg-[#741b2b] hover:bg-[#551220]" onClick={() => setStatus("completed", "정산 완료")}>정산 완료</Button>}
              {row.status !== "on_hold" && <Button size="sm" variant="outline" className="text-rose-600" onClick={() => setStatus("on_hold", "정산 보류", true)}>보류</Button>}
              {row.status === "on_hold" && <Button size="sm" variant="outline" onClick={() => setStatus("pending", "보류 해제")}>보류 해제</Button>}
              <Button size="sm" variant="ghost" onClick={() => setDialog({
                title: "최신 주문 기준 재계산", confirmLabel: "재계산", reasonRequired: false, reasonLabel: "메모",
                onConfirm: (memo) => adminRpc("admin_generate_settlement", { p_funding_id: row.funding_id, p_memo: memo || null }),
              })}><Calculator className="mr-1 h-4 w-4" />재계산</Button>
            </div>
          )}
        </div>
        <ReasonDialog state={dialog} onClose={() => setDialog(null)} onDone={() => { onChanged(); onClose(); }} />
      </SheetContent>
    </Sheet>
  );
};

const SettlementsPage = () => {
  const { can } = useAdminContext();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SettlementRow | null>(null);
  const [dialog, setDialog] = useState<ReasonDialogState>(null);
  const list = useAdminQuery(() => adminRpc<SettlementRow[]>("admin_list_settlements", { p_status: status, p_search: search || null }), [status, search]);
  const candidates = useAdminQuery(() => adminRpc<Candidate[]>("admin_list_settlement_candidates"), []);
  const rows = list.data ?? [];
  const sum = (s: string) => rows.filter((r) => r.status === s).reduce((acc, r) => acc + Number(r.final_amount), 0);
  const reloadAll = () => { void list.reload(); void candidates.reload(); };

  return (
    <div>
      <PageHeader eyebrow="Settlements" title="정산 관리" description="제작자·브랜드별 펀딩 정산. 수수료율은 정산 생성 시점의 시스템 설정 값이 고정 저장됩니다." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="정산대기" value={won(sum("pending"))} />
        <KpiCard label="정산예정" value={won(sum("scheduled"))} />
        <KpiCard label="정산완료" value={won(sum("completed"))} />
        <KpiCard label="보류" value={won(sum("on_hold"))} />
      </div>
      {(candidates.data?.length ?? 0) > 0 && (
        <Panel className="mb-4" title="정산 생성 대기 펀딩" description="목표를 달성하고 종료된 펀딩 중 아직 정산서가 없는 건" bodyClassName="p-0">
          <DataTable minWidth={800} head={["펀딩", "브랜드 · 제작자", "단계", "수량", "거래액", ""]}>
            {candidates.data!.map((c) => (
              <tr key={c.funding_id}>
                <Td className="font-bold">{c.product_name}</Td>
                <Td className="text-xs">{c.brand_name ?? "-"} · {c.creator_name ?? "-"}</Td>
                <Td><MappedBadge map={FUNDING_PHASE} value={c.phase} /></Td>
                <Td className="tabular-nums">{num(c.current_orders)}/{num(c.moq)}</Td>
                <Td className="font-bold tabular-nums">{won(c.gmv)}</Td>
                <Td>{can("settlements.manage") && <Button size="sm" className="h-7 bg-[#741b2b] text-xs hover:bg-[#551220]" onClick={() => setDialog({
                  title: "정산서 생성", confirmLabel: "생성", reasonRequired: false, reasonLabel: "메모",
                  description: "결제 완료·환불 내역으로 금액을 계산하고, 제작비는 펀딩 견적(최대 단가 × 수량 + 개발비)을 기본값으로 사용합니다. 생성 후 조정할 수 있습니다.",
                  onConfirm: (memo) => adminRpc("admin_generate_settlement", { p_funding_id: c.funding_id, p_memo: memo || null }),
                  successMessage: "정산서를 생성했습니다",
                })}>정산 생성</Button>}</Td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      )}
      <Panel bodyClassName="p-0" title={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="펀딩, 브랜드, 제작자" />
          <FilterChips value={status} onChange={setStatus} options={[{ value: "all", label: "전체" }, ...Object.entries(SETTLEMENT_STATUS).map(([value, meta]) => ({ value, label: meta.label }))]} />
        </div>
      }>
        {list.error && <div className="p-4"><ErrorBanner message={list.error} onRetry={list.reload} /></div>}
        {list.loading && !list.data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="정산 내역이 없습니다" /> : (
          <DataTable minWidth={1300} head={["브랜드", "제작자", "펀딩", "총 거래액", "취소/환불", "정산 대상 매출", "수수료", "제작비", "기타 차감", "최종 정산금", "예정일", "상태"]}>
            {rows.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-stone-50" onClick={() => setSelected(r)}>
                <Td className="font-semibold">{r.brand_name ?? "-"}</Td>
                <Td className="text-xs">{r.creator_name ?? "-"}</Td>
                <Td className="max-w-[180px] truncate text-xs">{r.product_name}</Td>
                <Td className="tabular-nums">{won(r.gross_amount)}</Td>
                <Td className="tabular-nums text-rose-600">{won(r.refund_amount)}</Td>
                <Td className="tabular-nums">{won(r.net_sales)}</Td>
                <Td className="tabular-nums">{won(r.platform_fee)} <span className="text-[10px] text-stone-400">{r.commission_rate}%</span></Td>
                <Td className="tabular-nums">{won(r.production_cost)}</Td>
                <Td className="tabular-nums">{won(r.other_deductions)}</Td>
                <Td className="font-black tabular-nums">{won(r.final_amount)}</Td>
                <Td className="text-xs">{dateOnly(r.scheduled_date)}</Td>
                <Td><MappedBadge map={SETTLEMENT_STATUS} value={r.status} /></Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
      <SettlementSheet row={selected} onClose={() => setSelected(null)} onChanged={reloadAll} />
      <ReasonDialog state={dialog} onClose={() => setDialog(null)} onDone={reloadAll} />
    </div>
  );
};

export default SettlementsPage;
