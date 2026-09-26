import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { adminRpc, type ProductionBoardRow } from "@/services/adminApi";
import { cn } from "@/lib/utils";
import { dateTime, num, PRODUCTION_STAGES, productionLabel } from "@/lib/admin/format";
import { EmptyState, ErrorBanner, LoadingBlock, Notice, PageHeader, Panel, StatusBadge } from "@/components/admin/shell/ui";
import { ReasonDialog, type ReasonDialogState } from "@/components/admin/shell/ReasonDialog";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { useAdminContext } from "@/components/admin/shell/AdminContext";

type Log = { id: string; from_stage: string | null; to_stage: string; note: string | null; image_urls: string[]; changed_by_name: string; changed_by_role: string; created_at: string };

const stageIndex = (key: string | null) => PRODUCTION_STAGES.findIndex((s) => s.key === key);

const Stepper = ({ current }: { current: string | null }) => {
  const idx = stageIndex(current);
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1">
      {PRODUCTION_STAGES.map((stage, i) => (
        <li key={stage.key} className="flex shrink-0 items-center gap-1">
          <span className={cn("flex h-6 items-center gap-1 rounded-full px-2 text-[10px] font-bold",
            i < idx ? "bg-[#741b2b]/10 text-[#741b2b]" : i === idx ? "bg-[#741b2b] text-white" : "bg-stone-100 text-stone-400")}>
            {i < idx && <Check className="h-3 w-3" />}{stage.label}
          </span>
          {i < PRODUCTION_STAGES.length - 1 && <span className={cn("h-px w-3", i < idx ? "bg-[#741b2b]/40" : "bg-stone-200")} />}
        </li>
      ))}
    </ol>
  );
};

const ProductionSheet = ({ row, onClose, onChanged }: { row: ProductionBoardRow | null; onClose: () => void; onChanged: () => void }) => {
  const { can } = useAdminContext();
  const [dialog, setDialog] = useState<ReasonDialogState>(null);
  const draft = useRef({ images: "", notify: false });
  const logs = useAdminQuery(() => (row ? adminRpc<Log[]>("list_funding_production_logs", { p_funding_id: row.funding_id }) : Promise.resolve([])), [row?.funding_id, row?.production_status]);
  if (!row) return null;

  const change = (stage: string) => {
    draft.current = { images: "", notify: ["fabric_contact", "shipping", "delivered"].includes(stage) };
    setDialog({
      title: `제작 단계 변경 → ${productionLabel(stage)}`, confirmLabel: "변경", reasonRequired: false, reasonLabel: "메모",
      description: "변경 내용은 참여 주문의 제작 단계(구매자 화면)에 함께 반영되며 이력이 저장됩니다.",
      extra: (
        <div className="grid gap-2">
          <label className="grid gap-1 text-xs font-bold text-stone-600">첨부 이미지 URL (쉼표로 구분, 최대 10장)
            <Input placeholder="https://..." onChange={(e) => { draft.current.images = e.target.value; }} /></label>
          <label className="flex items-center gap-2 text-sm"><Checkbox defaultChecked={draft.current.notify} onCheckedChange={(v) => { draft.current.notify = v === true; }} />참여자에게 제작 진행 알림 발송</label>
        </div>
      ),
      onConfirm: (note) => adminRpc("admin_update_production_stage", {
        p_funding_id: row.funding_id, p_stage: stage, p_note: note || null,
        p_image_urls: draft.current.images.split(",").map((s) => s.trim()).filter((s) => /^https?:\/\//.test(s)).slice(0, 10),
        p_notify_participants: draft.current.notify,
      }),
      successMessage: "제작 단계를 변경했습니다",
    });
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader><SheetTitle>제작 진행 · {row.product_name}</SheetTitle></SheetHeader>
        <div className="mt-4 grid gap-4">
          <Stepper current={row.production_status} />
          <Notice tone="stone">제작자는 원단 컨택 ~ 검수/포장 단계만 앞으로 진행할 수 있고, 펀딩 성공 확정·배송·배송완료와 단계 되돌리기는 관리자만 가능합니다.</Notice>
          {can("production.manage") && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PRODUCTION_STAGES.map((stage) => (
                <Button key={stage.key} size="sm" variant={stage.key === row.production_status ? "default" : "outline"} disabled={stage.key === row.production_status}
                  className={stage.key === row.production_status ? "bg-[#741b2b]" : ""} onClick={() => change(stage.key)}>{stage.label}</Button>
              ))}
            </div>
          )}
          <Panel title="단계 변경 이력" bodyClassName="p-0">
            {logs.loading ? <LoadingBlock /> : !(logs.data?.length) ? <EmptyState title="이력이 없습니다" /> : (
              <ol className="divide-y divide-stone-100">{logs.data!.map((log) => (
                <li key={log.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5"><b>{productionLabel(log.to_stage)}</b><StatusBadge tone={log.changed_by_role === "creator" ? "violet" : "wine"}>{log.changed_by_role === "creator" ? "제작자" : "관리자"}</StatusBadge></div>
                  <p className="text-xs text-stone-500">{log.changed_by_name} · {dateTime(log.created_at)}</p>
                  {log.note && <p className="mt-1 text-xs text-stone-700">{log.note}</p>}
                  {log.image_urls.length > 0 && <div className="mt-2 flex gap-1.5">{log.image_urls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt="" className="h-14 w-14 rounded-lg border object-cover" /></a>)}</div>}
                </li>
              ))}</ol>
            )}
          </Panel>
        </div>
        <ReasonDialog state={dialog} onClose={() => setDialog(null)} onDone={() => { onChanged(); onClose(); }} />
      </SheetContent>
    </Sheet>
  );
};

const ProductionPage = () => {
  const [params] = useSearchParams();
  const focus = params.get("funding");
  const [selected, setSelected] = useState<ProductionBoardRow | null>(null);
  const { data, loading, error, reload } = useAdminQuery(() => adminRpc<ProductionBoardRow[]>("admin_list_production_board"), []);
  const rows = (data ?? []).filter((r) => !focus || r.funding_id === focus);

  return (
    <div>
      <PageHeader eyebrow="Production" title="제작 진행 관리" description="펀딩 성공 → 원단 컨택 → 패턴/샘플 → 샘플 확인 → 본생산 → 검수/포장 → 배송 준비 → 배송중 → 배송완료" />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading && !data ? <LoadingBlock /> : rows.length === 0 ? <Panel><EmptyState title="제작 대상 펀딩이 없습니다" description="목표 수량을 달성한 펀딩이 여기에 표시됩니다." /></Panel> : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <button key={row.funding_id} type="button" onClick={() => setSelected(row)} className="grid gap-3 rounded-2xl border border-stone-200/80 bg-white p-4 text-left shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition hover:border-[#741b2b]/40 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)_auto] md:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <img src={row.image_url} alt="" className="h-12 w-12 rounded-xl border object-cover" loading="lazy" />
                <div className="min-w-0"><p className="truncate font-bold">{row.product_name}</p><p className="truncate text-xs text-stone-500">{row.brand_name ?? "-"} · {row.creator_name ?? "-"}</p></div>
              </div>
              <div className="min-w-0"><Stepper current={row.production_status} />{row.last_note && <p className="mt-1 truncate text-xs text-stone-500">최근 메모: {row.last_note}</p>}</div>
              <div className="flex gap-4 text-center text-xs">
                <div><p className="text-stone-400">주문</p><p className="font-black tabular-nums">{num(row.active_orders)}</p></div>
                <div><p className="text-stone-400">수량</p><p className="font-black tabular-nums">{num(row.quantity)}</p></div>
                <div><p className="text-stone-400">배송완료</p><p className="font-black tabular-nums">{num(row.delivered)}</p></div>
              </div>
            </button>
          ))}
        </div>
      )}
      <ProductionSheet row={selected} onClose={() => setSelected(null)} onChanged={reload} />
    </div>
  );
};

export default ProductionPage;
