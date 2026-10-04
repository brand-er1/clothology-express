import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Flag, PauseCircle, PlayCircle, StopCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { adminRpc, fetchFundingClosures, totalOf, type EarlyCloseLogRow, type FundingClosureRow, type FundingRow } from "@/services/adminApi";
import { supabase } from "@/lib/supabase";
import { dateOnly, dateTime, FUNDING_CLOSE_TYPE, FUNDING_PHASE, num, pct, productionLabel, SETTLEMENT_STATUS, won } from "@/lib/admin/format";
import {
  DataTable, DefinitionGrid, EmptyState, ErrorBanner, FilterChips, KpiCard, LoadingBlock, MappedBadge, Notice, PageHeader,
  Pager, Panel, SearchInput, StatusBadge, Td,
} from "@/components/admin/shell/ui";
import { ReasonDialog, type ReasonDialogState } from "@/components/admin/shell/ReasonDialog";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { ColorOrderSummary } from "@/components/funding/ColorOrderSummary";
import { useAdminContext } from "@/components/admin/shell/AdminContext";
import { EarlyCloseConfirmBody } from "@/components/funding/FundingEarlyCloseCard";

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

const FundingClosurePanel = ({ closure, creatorName, creatorEmail }: { closure: FundingClosureRow; creatorName: string | null; creatorEmail: string | null }) => (
  <Panel title={<div className="flex flex-wrap items-center gap-2">종료 방식 <MappedBadge map={FUNDING_CLOSE_TYPE} value={closure.close_type} /></div>}>
    <DefinitionGrid items={closure.early_closed ? [
      { label: "조기 마감 여부", value: closure.closed_by_role === "admin" ? "예 (관리자 조기 마감)" : "예 (제작자 조기 마감)" },
      { label: "마감 시간", value: dateTime(closure.early_closed_at) },
      { label: "원래 종료일", value: dateTime(closure.original_end_date) },
      { label: "결과", value: closure.succeeded ? "펀딩 성공 · 조기 마감" : "목표 미달 · 조기 마감" },
      { label: "최종 수량 · 달성률", value: `${num(closure.final_quantity ?? closure.early_closed_quantity)}장 / 목표 ${num(closure.target_quantity)}장${closure.final_achievement_rate != null ? ` · ${pct(Number(closure.final_achievement_rate))}` : ""}` },
      { label: "최종 참여자 · 매출", value: closure.final_participant_count != null ? `${num(closure.final_participant_count)}명 · ${won(closure.final_amount)}` : "-" },
      { label: closure.closed_by_role === "admin" ? "마감한 관리자" : "마감한 제작자", value: `${closure.early_closed_by_name ?? (closure.closed_by_role === "admin" ? "-" : creatorName) ?? "-"}${(closure.early_closed_by_email ?? (closure.closed_by_role === "admin" ? null : creatorEmail)) ? ` · ${closure.early_closed_by_email ?? creatorEmail}` : ""}` },
      ...(closure.close_reason ? [{ label: "조기 마감 사유", value: closure.close_reason }] : []),
    ] : [
      { label: "조기 마감 여부", value: "아니오" },
      { label: "종료 시간", value: dateTime(closure.closed_at) },
    ]} />
  </Panel>
);

const FundingSheet = ({ fundingId, onClose, onChanged }: { fundingId: string | null; onClose: () => void; onChanged: () => void }) => {
  const { can } = useAdminContext();
  const manage = can("fundings.manage");
  const [dialog, setDialog] = useState<ReasonDialogState>(null);
  const reviewValues = useRef({ moq: 0, price: 0 });
  const notifyRef = useRef(true);
  const { data, loading, error, reload } = useAdminQuery(
    () => (fundingId ? adminRpc<Detail>("admin_get_funding_detail", { p_funding_id: fundingId }) : Promise.resolve(null)), [fundingId],
  );
  const closure = useAdminQuery(
    async () => (fundingId ? (await fetchFundingClosures([fundingId])).get(fundingId) ?? null : null), [fundingId],
  );
  const done = () => { void reload(); void closure.reload(); onChanged(); };
  const f = data?.funding;
  // 제작자의 AI 상세페이지(있으면) — 관리자는 읽기 전용으로 열람
  const detailPage = useAdminQuery(async () => {
    if (!fundingId) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row } = await (supabase as any)
      .from("product_detail_pages")
      .select("id, published_version, updated_at")
      .eq("funding_id", fundingId)
      .maybeSingle();
    return (row ?? null) as { id: string; published_version: number; updated_at: string } | null;
  }, [fundingId]);

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
                {f.status === "approved" && !f.suspended_at && !closure.data?.early_closed && (
                  <Button size="sm" variant="outline" className="border-rose-200 text-rose-700" onClick={() => setDialog({
                    title: "펀딩을 조기 마감하시겠습니까?",
                    destructive: true,
                    confirmLabel: f.current_orders < f.moq ? "그래도 조기 마감" : "조기 마감",
                    reasonLabel: "조기 마감 사유",
                    placeholder: "예: 목표 달성으로 생산 조기 착수 (Audit Log 에 기록됩니다)",
                    extra: <EarlyCloseConfirmBody funding={f} asDialogHeader={false} />,
                    onConfirm: async (reason) => {
                      const result = await adminRpc<{ result: string; quantity: number; achievement_rate: number; notified_participants: number }>(
                        "admin_early_close_funding", { p_funding_id: f.id, p_reason: reason },
                      );
                      // 대기열에 들어간 참여자 SMS 를 바로 발송(실패해도 기존 예약 발송이 다시 처리한다)
                      void supabase.functions.invoke("dispatch-notifications", { body: { fundingId: f.id } }).catch(() => undefined);
                      return { warning: `${result.result === "success" ? "펀딩 성공" : "목표 미달"} · ${num(result.quantity)}장(${pct(Number(result.achievement_rate))}) 확정 · 참여자 ${num(result.notified_participants)}명에게 알림을 보냈습니다.` };
                    },
                    successMessage: "펀딩을 조기 마감했습니다",
                  })}><Flag className="mr-1 h-4 w-4" />펀딩 조기 마감</Button>
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
            {closure.data?.close_type && <FundingClosurePanel closure={closure.data} creatorName={data.creator?.display_name ?? null} creatorEmail={data.creator_email} />}
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
            <Panel title="컬러별 주문 수량" description="결제 완료 기준 · 생산 발주용">
              <ColorOrderSummary fundingId={f.id} />
            </Panel>
            {f.description && <Panel title="상세 설명"><p className="whitespace-pre-wrap text-sm text-stone-700">{f.description}</p></Panel>}
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <Link className="rounded-lg bg-stone-100 px-3 py-2" to={`/admin/orders?funding=${f.id}`}>참여자·주문 보기</Link>
              <Link className="rounded-lg bg-stone-100 px-3 py-2" to={`/admin/production?funding=${f.id}`}>제작 진행 관리</Link>
              <Link className="rounded-lg bg-stone-100 px-3 py-2" to={`/admin/shipping?funding=${f.id}`}>배송 관리</Link>
              {can("fundings.manage") && (
                <Link className="rounded-lg bg-stone-100 px-3 py-2" to={`/fundings/${f.id}/colors?returnTo=${encodeURIComponent(`/admin/fundings?q=${f.product_name}`)}`}>컬러 · AI 이미지 관리</Link>
              )}
              {detailPage.data && (
                <Link className="rounded-lg bg-[#741b2b]/10 px-3 py-2 text-[#741b2b]" to={`/detail-pages/${detailPage.data.id}`} target="_blank">
                  AI 상세페이지 보기 {detailPage.data.published_version ? `(적용본 v${detailPage.data.published_version})` : "(미적용)"} ↗
                </Link>
              )}
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

const EarlyCloseLogPanel = ({ onOpen, refreshKey }: { onOpen: (fundingId: string) => void; refreshKey: unknown }) => {
  const { data, loading, error, reload } = useAdminQuery(
    () => adminRpc<EarlyCloseLogRow[]>("admin_list_early_close_logs", { p_limit: 10, p_offset: 0 }), [refreshKey],
  );
  const rows = data ?? [];
  return (
    <Panel className="mb-4" bodyClassName="p-0" title="조기 마감 기록" description="누가 · 언제 조기 마감했는지와 마감 당시 최종 수치 (최근 10건)">
      {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
      {loading && !data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="조기 마감된 펀딩이 없습니다" /> : (
        <DataTable minWidth={1100} head={["펀딩", "마감 주체", "마감 시간", "원래 종료일", "결과", "최종 수량", "달성률", "참여자", "최종 매출", "사유"]}>
          {rows.map((row) => (
            <tr key={row.funding_id} className="cursor-pointer hover:bg-stone-50" onClick={() => onOpen(row.funding_id)}>
              <Td><p className="max-w-[200px] truncate font-bold">{row.product_name}</p><p className="text-xs text-stone-400">{row.brand_name ?? "브랜드 미지정"}</p></Td>
              <Td className="text-xs"><StatusBadge tone={row.closed_by_role === "admin" ? "red" : "violet"}>{row.closed_by_role === "admin" ? "관리자" : "제작자"}</StatusBadge><p className="mt-1">{row.closed_by_name}</p></Td>
              <Td className="text-xs">{dateTime(row.closed_at)}</Td>
              <Td className="text-xs">{dateOnly(row.original_end_date)}</Td>
              <Td><StatusBadge tone={row.succeeded ? "green" : "amber"}>{row.succeeded ? "목표 달성" : "목표 미달"}</StatusBadge></Td>
              <Td className="tabular-nums">{num(row.final_quantity)} / {num(row.target_quantity)}</Td>
              <Td className="font-bold tabular-nums">{pct(Number(row.final_achievement_rate))}</Td>
              <Td className="tabular-nums">{num(row.final_participant_count)}</Td>
              <Td className="font-bold tabular-nums">{won(row.final_amount)}</Td>
              <Td className="max-w-[220px] truncate text-xs text-stone-500">{row.reason ?? "-"}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </Panel>
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
  const closures = useAdminQuery(() => fetchFundingClosures(rows.map((row) => row.id)), [data]);

  return (
    <div>
      <PageHeader eyebrow="Fundings" title="펀딩 관리" description="승인 대기 펀딩이 목록 상단에 표시됩니다. 행을 눌러 승인·반려·공개·중단·조기 마감을 처리하세요." />
      <EarlyCloseLogPanel onOpen={setSelected} refreshKey={data} />
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
                <Td><div className="flex flex-wrap gap-1"><MappedBadge map={FUNDING_PHASE} value={row.phase} />{closures.data?.get(row.id)?.close_type && <MappedBadge map={FUNDING_CLOSE_TYPE} value={closures.data.get(row.id)!.close_type} />}{row.is_hidden && <StatusBadge>비공개</StatusBadge>}</div></Td>
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
