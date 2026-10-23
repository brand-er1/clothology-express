import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, ClipboardList, Factory, History, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { FundingEarlyCloseButton } from "@/components/funding/FundingEarlyCloseCard";
import {
  EmptyState, ErrorBanner, FilterChips, LoadingBlock, MappedBadge, Notice, PageHeader, Panel, StatusBadge,
} from "@/components/admin/shell/ui";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { dateOnly, dateTime, FUNDING_PHASE, num, PRODUCTION_STAGES, productionLabel } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import {
  advanceProductionStage, CREATOR_PRODUCTION_STAGES, fetchProductionLogs, fetchSellerProducts, type SellerProduct,
} from "@/services/seller";
import type { Funding } from "@/types/funding";

type Filter = "active" | "ended" | "production" | "all";

const stageRank = (stage: string | null) => PRODUCTION_STAGES.findIndex((s) => s.key === stage);

/** 기존 조기 마감 버튼이 읽는 필드만 채운다. 실제 허용 여부는 creator_early_close_funding 이 판단한다. */
const asFunding = (p: SellerProduct) => ({
  id: p.id, status: p.status, early_closed: p.early_closed, suspended_at: p.suspended_at, reviewed_at: p.start_at,
  funding_days: p.funding_days, current_orders: p.current_orders, moq: p.moq, success_at: p.success_at,
}) as unknown as Funding;

/** 펀딩 중 → 원단 컨택 → … → 배송 완료 */
const ProductionStepper = ({ current }: { current: string | null }) => {
  const rank = stageRank(current);
  const steps = [{ key: "funding", label: "펀딩 중" }, ...PRODUCTION_STAGES.filter((s) => s.key !== "funding_success")];
  return (
    <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="제작 진행 단계">
      {steps.map((step, index) => {
        const done = step.key === "funding" ? rank >= 0 : rank >= stageRank(step.key);
        const active = step.key === "funding" ? rank < 0 : current === step.key;
        return (
          <li key={step.key} className="flex shrink-0 items-center gap-1">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold",
              active ? "bg-[#741b2b] text-white" : done ? "bg-[#741b2b]/10 text-[#741b2b]" : "bg-stone-100 text-stone-400")}>
              {done && !active && <Check className="h-3 w-3" />}{step.label}
            </span>
            {index < steps.length - 1 && <ChevronRight className="h-3 w-3 text-stone-300" />}
          </li>
        );
      })}
    </ol>
  );
};

const AdvanceDialog = ({ product, onClose, onDone }: { product: SellerProduct | null; onClose: () => void; onDone: () => void }) => {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const next = useMemo(() => {
    if (!product) return [];
    const rank = stageRank(product.production_status);
    return CREATOR_PRODUCTION_STAGES.filter((stage) => stageRank(stage) > rank);
  }, [product]);
  const [stage, setStage] = useState<string | null>(null);
  const chosen = stage && next.includes(stage as (typeof next)[number]) ? stage : next[0] ?? null;

  const submit = async () => {
    if (!product || !chosen) return;
    setSaving(true);
    try {
      await advanceProductionStage(product.id, chosen, note.trim());
      toast({ title: `'${productionLabel(chosen)}' 단계로 변경했습니다`, description: "구매자 주문 화면의 제작 단계도 함께 갱신됩니다." });
      setNote(""); setStage(null);
      onDone(); onClose();
    } catch (error) {
      toast({ title: "제작 단계를 변경하지 못했습니다", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(product)} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>제작 단계 진행</DialogTitle>
          <DialogDescription>
            현재 단계: {productionLabel(product?.production_status)} · 제작자는 원단 컨택부터 검수/포장까지 다음 단계로만 진행할 수 있습니다.
            배송 준비 · 배송 · 배송 완료는 관리자가 처리합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2" role="radiogroup" aria-label="다음 제작 단계">
          {next.map((key) => (
            <button key={key} type="button" role="radio" aria-checked={chosen === key} onClick={() => setStage(key)}
              className={cn("rounded-xl border px-3 py-2 text-left text-sm font-semibold",
                chosen === key ? "border-[#741b2b] bg-[#741b2b]/5 text-[#741b2b]" : "border-stone-200 hover:bg-stone-50")}>
              {productionLabel(key)}
            </button>
          ))}
          <Textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3} placeholder="구매자에게 보여줄 진행 메모 (선택)" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>취소</Button>
          <Button onClick={() => void submit()} disabled={saving || !chosen} className="bg-[#741b2b] hover:bg-[#5c1522]">
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}단계 변경
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const LogsDialog = ({ product, onClose }: { product: SellerProduct | null; onClose: () => void }) => {
  const logs = useAdminQuery(() => (product ? fetchProductionLogs(product.id) : Promise.resolve([])), [product?.id]);
  return (
    <Dialog open={Boolean(product)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>제작 진행 기록</DialogTitle><DialogDescription>{product?.product_name}</DialogDescription></DialogHeader>
        {logs.loading ? <LoadingBlock /> : (logs.data ?? []).length === 0 ? <EmptyState title="기록이 없습니다" /> : (
          <ol className="grid gap-3">
            {(logs.data ?? []).map((log) => (
              <li key={log.id} className="rounded-xl border border-stone-200 p-3 text-sm">
                <p className="font-bold">{productionLabel(log.from_stage)} → {productionLabel(log.to_stage)}</p>
                <p className="mt-0.5 text-[11px] text-stone-400">{dateTime(log.created_at)} · {log.changed_by_role === "creator" ? "제작자" : "관리자"} {log.changed_by_name ?? ""}</p>
                {log.note && <p className="mt-1.5 whitespace-pre-wrap text-xs text-stone-600">{log.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
};

const FundingRow = ({ product, onAdvance, onLogs, onChanged }: {
  product: SellerProduct; onAdvance: () => void; onLogs: () => void; onChanged: () => void;
}) => {
  const daysLeft = product.end_at ? Math.ceil((new Date(product.end_at).getTime() - Date.now()) / 86_400_000) : null;
  return (
    <article className="min-w-0 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)] sm:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        {product.image_url && <img src={product.image_url} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-stone-200" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-extrabold">{product.product_name}</h3>
            <MappedBadge map={FUNDING_PHASE} value={product.phase} />
            {product.early_closed && <StatusBadge tone="violet">조기 마감</StatusBadge>}
            {product.pending_payment_orders > 0 && <StatusBadge tone="amber">결제 확인 중 {product.pending_payment_orders}</StatusBadge>}
          </div>
          <p className="mt-1 text-xs text-stone-500">
            시작 {product.start_at ? dateOnly(product.start_at) : "관리자 승인 시"} · 종료 {product.end_at ? dateOnly(product.end_at) : `승인 후 ${product.funding_days}일`}
            {product.phase === "funding" && daysLeft !== null && <b className="ml-1 text-[#741b2b]">{daysLeft > 0 ? `D-${daysLeft}` : "D-DAY"}</b>}
          </p>
          <div className="mt-3 max-w-xl">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-bold tabular-nums">{num(product.current_orders)} / {num(product.moq)}장</span>
              <span className="font-black tabular-nums text-[#741b2b]">{Number(product.progress).toFixed(0)}%</span>
            </div>
            <Progress value={Math.min(100, Number(product.progress))} className="mt-1 h-2" aria-label="목표 달성률" />
            <p className="mt-1 text-[11px] text-stone-400">결제 완료 수량만 반영 · 실결제 {num(product.real_paid_orders)}건{product.mock_orders > 0 ? ` · 모의결제 ${num(product.mock_orders)}건(매출 제외)` : ""}</p>
          </div>
          <div className="mt-3"><ProductionStepper current={product.production_status} /></div>
          {product.production_status === null && ["succeeded"].includes(product.phase) && (
            <p className="mt-2 text-[11px] text-stone-500">관리자가 펀딩 성공을 확정하면 제작 단계를 진행할 수 있습니다.</p>
          )}
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 md:w-52 md:grid-cols-1">
          <Button size="sm" variant="outline" onClick={onAdvance} disabled={!product.can_advance_production}><Factory className="mr-1.5 h-3.5 w-3.5" />제작 단계 진행</Button>
          <Button size="sm" variant="outline" onClick={onLogs}><History className="mr-1.5 h-3.5 w-3.5" />진행 기록</Button>
          <Button asChild size="sm" variant="outline"><Link to={`/fundings/${product.id}/manage`}><ClipboardList className="mr-1.5 h-3.5 w-3.5" />참여 · 배송 처리</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to={`/fundings/${product.id}/buyers`}><Users className="mr-1.5 h-3.5 w-3.5" />구매자 · 엑셀</Link></Button>
          {product.can_request_early_close && (
            <FundingEarlyCloseButton funding={asFunding(product)} onClosed={onChanged} className="col-span-2 h-9 min-h-0 text-xs md:col-span-1" />
          )}
        </div>
      </div>
    </article>
  );
};

const FundingsPage = () => {
  const [filter, setFilter] = useState<Filter>("active");
  const [advancing, setAdvancing] = useState<SellerProduct | null>(null);
  const [viewingLogs, setViewingLogs] = useState<SellerProduct | null>(null);
  const { data, loading, error, reload } = useAdminQuery(fetchSellerProducts, []);

  const group = (p: SellerProduct): Exclude<Filter, "all"> =>
    p.production_status ? "production" : ["funding", "approved", "draft", "pending", "rejected"].includes(p.phase) ? "active" : "ended";
  const rows = (data ?? []).filter((p) => filter === "all" || group(p) === filter);
  const count = (f: Exclude<Filter, "all">) => (data ?? []).filter((p) => group(p) === f).length;

  return (
    <div>
      <PageHeader eyebrow="Funding" title="펀딩 관리"
        description="목표 수량 · 기간 · 진행률을 확인하고 조기 마감과 제작 단계를 관리합니다. 목표 수량과 펀딩 기간은 상품 정보 수정에서 바꿀 수 있습니다." />
      <Notice tone="stone">
        펀딩 시작일은 관리자 승인일이고 종료일은 시작일 + 펀딩 기간입니다. 조기 마감은 목표 달성 여부와 관계없이 요청할 수 있으며,
        결제 확인 중인 주문이 있으면 서버가 마감을 보류합니다.
      </Notice>
      <div className="my-4"><FilterChips<Filter> value={filter} onChange={setFilter} options={[
        { value: "active", label: "진행 · 승인 대기", count: count("active") },
        { value: "production", label: "제작 진행", count: count("production") },
        { value: "ended", label: "종료", count: count("ended") },
        { value: "all", label: "전체", count: data?.length },
      ]} /></div>
      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading && !data ? <LoadingBlock /> : rows.length === 0 ? (
        <Panel><EmptyState title="해당하는 펀딩이 없습니다" /></Panel>
      ) : (
        <div className="grid gap-3">
          {rows.map((product) => (
            <FundingRow key={product.id} product={product} onAdvance={() => setAdvancing(product)} onLogs={() => setViewingLogs(product)} onChanged={reload} />
          ))}
        </div>
      )}
      <AdvanceDialog product={advancing} onClose={() => setAdvancing(null)} onDone={reload} />
      <LogsDialog product={viewingLogs} onClose={() => setViewingLogs(null)} />
    </div>
  );
};

export default FundingsPage;
