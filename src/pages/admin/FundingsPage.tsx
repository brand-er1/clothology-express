import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, PauseCircle, PlayCircle, StopCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { adminRpc, totalOf, type FundingRow } from "@/services/adminApi";
import { dateOnly, dateTime, FUNDING_PHASE, num, pct, productionLabel, SETTLEMENT_STATUS, won } from "@/lib/admin/format";
import {
  DataTable, DefinitionGrid, EmptyState, ErrorBanner, FilterChips, KpiCard, LoadingBlock, MappedBadge, Notice, PageHeader,
  Pager, Panel, SearchInput, StatusBadge, Td,
} from "@/components/admin/shell/ui";
import { ReasonDialog, type ReasonDialogState } from "@/components/admin/shell/ReasonDialog";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { useAdminContext } from "@/components/admin/shell/AdminContext";

const PAGE = 30;
const PHASES = ["all", "pending", "funding", "approved", "succeeded", "failed", "in_production", "shipping", "completed", "suspended", "rejected"] as const;

type Detail = {
  funding: Record<string, unknown> & { id: string; product_name: string; image_url: string; description: string | null; cloth_type: string; material: string; moq: number; price: number | null; current_orders: number; status: string; is_hidden: boolean; suspended_at: string | null; suspension_reason: string | null; admin_comment: string | null; reviewed_at: string | null; created_at: string; color_options: string[]; size_options: string[]; production_status: string | null };
  phase: string; end_at: string | null;
  creator: { display_name: string } | null; creator_email: string | null;
  brand: { brand_name: string; status: string } | null;
  trademark: { decision: string; reason: string } | null;
  metrics: { paid_orders: number; participants: number; quantity: number; gmv: number; mock_amount: number; refunded_amount: number; cancelled_orders: number; shipped: number; delivered: number };
  production_logs: { id: string; to_stage: string; note: string | null; changed_by_name: string; changed_by_role: string; created_at: string; image_urls: string[] }[];
  settlement: { status: string; final_amount: number } | null;
  history: { action: string; admin_name: string; reason: string | null; created_at: string }[];
};

const FundingSheet = ({ fundingId, onClose, onChanged }: { fundingId: string | null; onClose: () => void; onChanged: () => void }) => {
  const { can } = useAdminContext();
  const manage = can("fundings.manage");
  const [dialog, setDialog] = useState<ReasonDialogState>(null);
  const reviewValues = useRef({ moq: 0, price: 0 });
  const notifyRef = useRef(true);
  const { data, loading, error, reload } = useAdminQuery(
    () => (fundingId ? adminRpc<Detail>("admin_get_funding_detail", { p_funding_id: fundingId }) : Promise.resolve(null)), [fundingId],
  );
  const done = () => { void reload(); onChanged(); };
  const f = data?.funding;

  const openApprove = () => {
    if (!f) return;
    reviewValues.current = { moq: f.moq, price: f.price ?? 0 };
    setDialog({
      title: "펀딩 승인", confirmLabel: "승인하고 공개", reasonRequired: false, reasonLabel: "승인 메모(선택)",
      description: "승인하면 즉시 공개되어 참여를 받을 수 있습니다. 상표 검수 결과도 함께 확정됩니다.",
      extra: (
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs font-bold text-stone-600">MOQ(목표 수량)
            <Input type="number" min={20} defaultValue={f.moq} onChange={(e) => { reviewValues.current.moq = Number(e.target.value); }} /></label>
          <label className="grid gap-1 text-xs font-bold text-stone-600">판매가(원)
            <Input type="number" min={1} defaultValue={f.price ?? ""} onChange={(e) => { reviewValues.current.price = Number(e.target.value); }} /></label>
        </div>
      ),
      onConfirm: (reason) => adminRpc("admin_review_funding", {
        p_funding_id: f.id, p_decision: "approved", p_reason: reason || null,
        p_moq: reviewValues.current.moq, p_price: reviewValues.current.price,
      }),
      successMessage: "펀딩을 승인했습니다",
    });
  };

  return (
    <Sheet open={Boolean(fundingId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader><SheetTitle>펀딩 상세</SheetTitle></SheetHeader>
        {error && <ErrorBanner message={error} onRetry={reload} />}
        {loading || !data || !f ? <LoadingBlock /> : (
          <div className="mt-4 grid gap-4">
            <div className="flex gap-3">
              <img src={f.image_url} alt={f.product_name} className="h-24 w-24 shrink-0 rounded-xl border border-stone-200 object-cover" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5"><MappedBadge map={FUNDING_PHASE} value={data.phase} />{f.is_hidden && <StatusBadge>비공개</StatusBadge>}</div>
                <p className="mt-1 text-lg font-extrabold">{f.product_name}</p>
                <p className="text-xs text-stone-500">{data.brand?.brand_name ?? "브랜드 미지정"} · {data.creator?.display_name ?? data.creator_email}</p>
                <Link to={`/fundings/${f.id}`} target="_blank" className="mt-1 inline-block text-xs font-bold text-[#741b2b]">서비스 화면에서 보기 ↗</Link>
              </div>
            </div>

            {manage && (
              <div className="flex flex-wrap gap-2">
                {f.status === "pending" && <>
                  <Button size="sm" className="bg-[#741b2b] hover:bg-[#551220]" onClick={openApprove}><ThumbsUp className="mr-1 h-4 w-4" />승인</Button>
                  <Button size="sm" variant="outline" className="text-rose-600" onClick={() => setDialog({
                    title: "펀딩 반려", destructive: true, confirmLabel: "반려", reasonLabel: "반려 사유",
                    description: "반려 사유는 제작자에게 사이트 알림으로 전달됩니다.",
                    onConfirm: (reason) => adminRpc("admin_review_funding", { p_funding_id: f.id, p_decision: "rejected", p_reason: reason }),
                    successMessage: "펀딩을 반려했습니다",
                  })}><ThumbsDown className="mr-1 h-4 w-4" />반려</Button>
                </>}
                {["approved", "closed"].includes(f.status) && (
                  <Button size="sm" variant="outline" onClick={() => setDialog({
                    title: f.is_hidden ? "공개로 전환" : "비공개로 전환", confirmLabel: f.is_hidden ? "공개" : "비공개",
                    onConfirm: (reason) => adminRpc("admin_set_funding_visibility", { p_funding_id: f.id, p_hidden: !f.is_hidden, p_reason: reason }),
                    successMessage: "공개 상태를 변경했습니다",
                  })}>{f.is_hidden ? <><Eye className="mr-1 h-4 w-4" />공개</> : <><EyeOff className="mr-1 h-4 w-4" />비공개</>}</Button>
                )}
                {f.status === "approved" && !f.suspended_at && (
                  <Button size="sm" variant="outline" onClick={() => setDialog({
                    title: "펀딩 종료", confirmLabel: "종료", reasonLabel: "종료 사유",
                    description: "새 참여를 마감합니다. 참여·주문 데이터는 유지됩니다.",
                    onConfirm: (reason) => adminRpc("admin_close_funding", { p_funding_id: f.id, p_reason: reason }),
                  })}><StopCircle className="mr-1 h-4 w-4" />종료</Button>
                )}
                {["approved", "closed"].includes(f.status) && !f.suspended_at && (
                  <Button size="sm" variant="outline" className="text-rose-600" onClick={() => { notifyRef.current = true; setDialog({
                    title: "운영 중단", destructive: true, confirmLabel: "운영 중단", reasonLabel: "중단 사유",
                    description: "새 참여가 즉시 차단됩니다. 기존 참여자·주문·결제 데이터는 삭제되지 않으며, 환불은 환불 관리에서 처리합니다.",
                    extra: <label className="flex items-center gap-2 text-sm"><Checkbox defaultChecked onCheckedChange={(v) => { notifyRef.current = v === true; }} />참여자 전원에게 사이트 알림 발송</label>,
                    onConfirm: (reason) => adminRpc("admin_suspend_funding", { p_funding_id: f.id, p_reason: reason, p_notify_participants: notifyRef.current }),
                    successMessage: "펀딩을 운영 중단했습니다",
                  }); }}><PauseCircle className="mr-1 h-4 w-4" />운영 중단</Button>
                )}
                {f.suspended_at && (
                  <Button size="sm" variant="outline" onClick={() => setDialog({
                    title: "운영 재개", confirmLabel: "재개", reasonLabel: "재개 사유",
                    onConfirm: (reason) => adminRpc("admin_resume_funding", { p_funding_id: f.id, p_reason: reason }),
                  })}><PlayCircle className="mr-1 h-4 w-4" />운영 재개</Button>
                )}
              </div>
            )}
            {f.suspended_at && <Notice>운영 중단 · {dateTime(f.suspended_at)} · 사유: {f.suspension_reason}</Notice>}
            {data.trademark && data.trademark.decision !== "clear" && <Notice>상표 검수: {data.trademark.decision} — {data.trademark.reason}</Notice>}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <KpiCard label="달성률" value={pct(f.moq ? (f.current_orders / f.moq) * 100 : 0)} hint={`${num(f.current_orders)} / ${num(f.moq)}장`} />
              <KpiCard label="총 거래액" value={won(data.metrics.gmv)} hint={`모의결제 ${won(data.metrics.mock_amount)}`} />
              <KpiCard label="참여자" value={num(data.metrics.participants)} hint={`유효 주문 ${num(data.metrics.paid_orders)}건`} />
              <KpiCard label="환불" value={won(data.metrics.refunded_amount)} hint={`취소 ${num(data.metrics.cancelled_orders)}건`} />
            </div>
            <DefinitionGrid items={[
              { label: "판매가", value: won(f.price) },
              { label: "옵션", value: `${f.color_options.join(", ")} / ${f.size_options.join(", ")}` },
              { label: "소재 · 종류", value: `${f.material} · ${f.cloth_type}` },
              { label: "시작일 · 종료일", value: `${dateOnly(f.reviewed_at)} ~ ${dateOnly(data.end_at)}` },
              { label: "제작 단계", value: productionLabel(f.production_status) },
              { label: "배송", value: `배송중 ${num(data.metrics.shipped)} · 완료 ${num(data.metrics.delivered)}` },
              { label: "정산", value: data.settlement ? <MappedBadge map={SETTLEMENT_STATUS} value={data.settlement.status} /> : "미생성" },
              { label: "관리자 코멘트", value: f.admin_comment },
            ]} />
            {f.description && <Panel title="상세 설명"><p className="whitespace-pre-wrap text-sm text-stone-700">{f.description}</p></Panel>}
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <Link className="rounded-lg bg-stone-100 px-3 py-2" to={`/admin/orders?funding=${f.id}`}>참여자·주문 보기</Link>
              <Link className="rounded-lg bg-stone-100 px-3 py-2" to={`/admin/production?funding=${f.id}`}>제작 진행 관리</Link>
              <Link className="rounded-lg bg-stone-100 px-3 py-2" to={`/admin/shipping?funding=${f.id}`}>배송 관리</Link>
            </div>
            <Panel title="관리 이력" bodyClassName="p-0">
              {data.history.length === 0 ? <EmptyState title="관리 이력이 없습니다" /> : (
                <ul className="divide-y divide-stone-100">{data.history.map((h, i) => (
                  <li key={i} className="px-4 py-2.5 text-xs"><p className="font-bold">{h.action} · {h.admin_name}</p><p className="text-stone-500">{h.reason ?? ""} · {dateTime(h.created_at)}</p></li>
                ))}</ul>
              )}
            </Panel>
          </div>
        )}
        <ReasonDialog state={dialog} onClose={() => setDialog(null)} onDone={done} />
      </SheetContent>
    </Sheet>
  );
};

const FundingsPage = () => {
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [phase, setPhase] = useState<string>(params.get("phase") ?? "all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const { data, loading, error, reload } = useAdminQuery(
    () => adminRpc<FundingRow[]>("admin_list_fundings", { p_search: search || null, p_phase: phase, p_limit: PAGE, p_offset: page * PAGE }),
    [search, phase, page],
  );
  const rows = data ?? [];

  return (
    <div>
      <PageHeader eyebrow="Fundings" title="펀딩 관리" description="승인 대기 펀딩이 목록 상단에 표시됩니다. 행을 눌러 승인·반려·공개·중단을 처리하세요." />
      <Panel bodyClassName="p-0" title={
        <div className="flex flex-col gap-2">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="펀딩명, 제작자, 브랜드" />
          <FilterChips value={phase} onChange={(v) => { setPhase(v); setPage(0); }} options={PHASES.map((key) => ({ value: key, label: key === "all" ? "전체" : FUNDING_PHASE[key].label }))} />
        </div>
      }>
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="조건에 맞는 펀딩이 없습니다" /> : (
          <DataTable minWidth={1250} head={["펀딩", "제작자 · 브랜드", "판매가", "목표", "현재", "달성률", "총 거래액", "시작일", "종료일", "상태"]}>
            {rows.map((row) => (
              <tr key={row.id} className="cursor-pointer hover:bg-stone-50" onClick={() => setSelected(row.id)}>
                <Td><div className="flex items-center gap-2"><img src={row.image_url} alt="" className="h-11 w-11 rounded-lg border border-stone-200 object-cover" loading="lazy" /><p className="max-w-[220px] truncate font-bold">{row.product_name}</p></div></Td>
                <Td className="text-xs"><p className="font-semibold">{row.creator_name}</p><p className="text-stone-400">{row.brand_name ?? "브랜드 미지정"}</p></Td>
                <Td className="tabular-nums">{won(row.price)}</Td>
                <Td className="tabular-nums">{num(row.moq)}</Td>
                <Td className="tabular-nums">{num(row.current_orders)}</Td>
                <Td>
                  <div className="w-24"><p className="text-xs font-bold tabular-nums">{pct(row.achievement_rate)}</p>
                    <div className="mt-1 h-1.5 rounded-full bg-stone-100"><div className="h-1.5 rounded-full bg-[#741b2b]" style={{ width: `${Math.min(100, Number(row.achievement_rate))}%` }} /></div></div>
                </Td>
                <Td className="font-bold tabular-nums">{won(row.gmv)}</Td>
                <Td className="text-xs">{dateOnly(row.start_at)}</Td>
                <Td className="text-xs">{dateOnly(row.end_at)}</Td>
                <Td><div className="flex flex-wrap gap-1"><MappedBadge map={FUNDING_PHASE} value={row.phase} />{row.is_hidden && <StatusBadge>비공개</StatusBadge>}</div></Td>
              </tr>
            ))}
          </DataTable>
        )}
        <Pager page={page} pageSize={PAGE} total={totalOf(rows)} onPage={setPage} />
      </Panel>
      <FundingSheet fundingId={selected} onClose={() => setSelected(null)} onChanged={reload} />
    </div>
  );
};

export default FundingsPage;
