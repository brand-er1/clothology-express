import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { OrderReviewDialog } from "@/components/admin/OrderReviewDialog";
import { ProductionConversionPanel } from "@/components/admin/ProductionConversionPanel";
import {
  DataTable, EmptyState, ErrorBanner, FilterChips, LoadingBlock, Notice, PageHeader, Pager, Panel, SearchInput, StatusBadge, Td,
} from "@/components/admin/shell/ui";
import { PeriodFilter, usePeriod } from "@/components/admin/shell/PeriodFilter";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { dateTime, errorMessage, type Tone } from "@/lib/admin/format";
import { CONSULT_STATUSES, CONSULT_STATUS_LABEL, isConsultStatus, PRODUCTION_CTA_LABEL, type ConsultStatus } from "@/lib/production-request";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { adminRpc } from "@/services/adminApi";
import type { Order } from "@/types/order";

type StatusFilter = ConsultStatus | "all";
type Source = "all" | "production_inquiry" | "ai_design" | "design_upload" | "ready_made_group_wear";

type RequestRow = Order & {
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  is_guest: boolean;
  admin_memo: string | null;
  memo_updated_at: string | null;
};

type RequestList = {
  total: number;
  counts: Partial<Record<StatusFilter, number>>;
  can_manage: boolean;
  can_view_pii: boolean;
  rows: RequestRow[];
};

const PAGE_SIZE = 30;

const CONSULT_TONE: Record<ConsultStatus, Tone> = {
  received: "amber",
  consulting: "blue",
  quote_sent: "violet",
  contracted: "wine",
  in_production: "green",
  completed: "neutral",
  not_contracted: "red",
};

const SOURCE_LABEL: Record<string, string> = {
  production_inquiry: "간편 제작 의뢰",
  ai_design: "AI 디자인 의뢰",
  design_upload: "디자인 업로드 의뢰",
  ready_made_group_wear: "기성품 단체복",
};

const consultOf = (row: Pick<Order, "consult_status" | "status">): ConsultStatus =>
  isConsultStatus(row.consult_status) ? row.consult_status : row.status === "approved" ? "consulting" : row.status === "rejected" ? "not_contracted" : "received";

const thumbnailOf = (row: RequestRow) =>
  row.front_preview_url ||
  row.generated_image_url ||
  (row.reference_image_paths?.[0] ? supabase.storage.from("generated_images").getPublicUrl(row.reference_image_paths[0]).data.publicUrl : null);

const quantityOf = (row: RequestRow) => {
  const label = typeof row.inquiry_meta?.quantity_label === "string" ? row.inquiry_meta.quantity_label : null;
  if (label) return label;
  return row.requested_quantity ? `${row.requested_quantity.toLocaleString("ko-KR")}장` : "-";
};

/** 상세 다이얼로그 안의 상담 상태 · 관리자 메모 패널 */
const ConsultManagePanel = ({ row, canManage, onSaved }: { row: RequestRow; canManage: boolean; onSaved: () => void }) => {
  const [status, setStatus] = useState<ConsultStatus>(consultOf(row));
  const [memo, setMemo] = useState(row.admin_memo ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setStatus(consultOf(row)); setMemo(row.admin_memo ?? ""); }, [row]);

  const dirty = status !== consultOf(row) || memo !== (row.admin_memo ?? "");
  const entry = typeof row.inquiry_meta?.from === "string" ? row.inquiry_meta.from : null;

  const save = async () => {
    setSaving(true);
    try {
      await adminRpc("admin_update_production_request", {
        p_order_id: row.id,
        p_consult_status: status !== consultOf(row) ? status : null,
        p_memo: memo !== (row.admin_memo ?? "") ? memo : null,
      });
      toast({ title: "저장했습니다", description: `상담 상태: ${CONSULT_STATUS_LABEL[status]}` });
      onSaved();
    } catch (err) {
      toast({ title: "저장하지 못했습니다", description: errorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#741b2b]/20 bg-[#741b2b]/[0.03] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold md:text-lg">상담 진행 관리</h3>
        <p className="text-[11px] text-stone-500">
          접수 {dateTime(row.created_at)}
          {row.consult_status_updated_at && ` · 상태 변경 ${dateTime(row.consult_status_updated_at)}`}
          {entry && ` · 유입 ${PRODUCTION_CTA_LABEL[entry] ?? entry}`}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="상담 진행 상태">
        {CONSULT_STATUSES.map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={status === key}
            disabled={!canManage || saving}
            onClick={() => setStatus(key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
              status === key ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-600 hover:border-stone-400",
            )}
          >
            {CONSULT_STATUS_LABEL[key]}
          </button>
        ))}
      </div>
      <label className="mt-4 block text-xs font-bold text-stone-500" htmlFor={`memo-${row.id}`}>관리자 메모 (고객에게 보이지 않음)</label>
      <Textarea
        id={`memo-${row.id}`}
        value={memo}
        onChange={(event) => setMemo(event.target.value)}
        readOnly={!canManage}
        maxLength={5000}
        placeholder="통화 내용, 견적 금액, 샘플 일정, 다음 연락 예정일 등을 기록하세요"
        className="mt-1.5 min-h-[110px] bg-white text-sm"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-stone-400">{row.memo_updated_at ? `메모 저장 ${dateTime(row.memo_updated_at)}` : "저장된 메모 없음"}</p>
        {canManage && (
          <Button onClick={() => void save()} disabled={!dirty || saving} className="bg-[#741b2b] hover:bg-[#551220]">
            {saving ? "저장 중..." : "변경사항 저장"}
          </Button>
        )}
      </div>
    </div>
  );
};

/** 제작 의뢰(public.orders): 간편 제작 의뢰 · AI 디자인 · 디자인 업로드 · 기성품 단체복 */
const ProductionRequestsPage = () => {
  const [view, setView] = useState<"list" | "conversion">("list");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [source, setSource] = useState<Source>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const periodState = usePeriod("30d");
  useEffect(() => setPage(0), [status, source, search]);

  const { data, loading, error, reload } = useAdminQuery(
    () => adminRpc<RequestList>("admin_list_production_requests", {
      p_status: status, p_source: source, p_search: search || null, p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE,
    }),
    [status, source, search, page],
  );
  const rows = data?.rows ?? [];
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <div>
      <PageHeader eyebrow="Production requests" title="제작 의뢰"
        description="간편 제작 의뢰 · AI 디자인 · 디자인 업로드 · 기성품 단체복으로 접수된 모든 제작 요청입니다. 상세에서 이미지 · 요청사항 · 연락처를 확인하고 상담 상태와 메모를 관리합니다."
        actions={
          <div className="flex gap-1 rounded-full bg-stone-100 p-1">
            {([["list", "의뢰 목록"], ["conversion", "전환 통계"]] as const).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setView(key)}
                className={cn("rounded-full px-3.5 py-1.5 text-xs font-bold", view === key ? "bg-white text-stone-900 shadow-sm" : "text-stone-500")}>
                {label}
              </button>
            ))}
          </div>
        } />

      {view === "conversion" ? (
        <div className="grid gap-4">
          <div className="flex justify-end"><PeriodFilter state={periodState} /></div>
          <ProductionConversionPanel from={periodState.period.from} to={periodState.period.to} />
        </div>
      ) : (
        <>
          {data && !data.can_manage && <div className="mb-4"><Notice tone="stone">조회 전용 권한입니다. 상담 상태 · 메모 변경은 orders.manage 권한이 필요합니다.</Notice></div>}
          <Panel bodyClassName="p-0" title={
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <SearchInput value={search} onChange={setSearch} placeholder={data?.can_view_pii ? "제목 · 품목 · 고객명 · 브랜드명 · 연락처 · 이메일" : "제목 · 품목 · 고객명 · 브랜드명"} />
                <FilterChips<StatusFilter> value={status} onChange={setStatus} options={[
                  { value: "all", label: "전체", count: data?.counts.all },
                  ...CONSULT_STATUSES.map((key) => ({ value: key, label: CONSULT_STATUS_LABEL[key], count: data?.counts[key] })),
                ]} />
              </div>
              <FilterChips<Source> value={source} onChange={setSource} options={[
                { value: "all", label: "모든 유형" },
                { value: "production_inquiry", label: SOURCE_LABEL.production_inquiry },
                { value: "ai_design", label: SOURCE_LABEL.ai_design },
                { value: "design_upload", label: SOURCE_LABEL.design_upload },
                { value: "ready_made_group_wear", label: SOURCE_LABEL.ready_made_group_wear },
              ]} />
            </div>
          }>
            {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
            {loading && !data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="해당하는 제작 의뢰가 없습니다" /> : (
              <>
                <DataTable minWidth={1100} head={["상태", "유형", "의뢰 내용", "예상 수량", "예산 · 납기", "고객 · 연락처", "접수일", ""]}>
                  {rows.map((row) => {
                    const image = thumbnailOf(row);
                    const consult = consultOf(row);
                    return (
                      <tr key={row.id} className="cursor-pointer align-top hover:bg-stone-50" onClick={() => setSelectedId(row.id)}>
                        <Td><StatusBadge tone={CONSULT_TONE[consult]}>{CONSULT_STATUS_LABEL[consult]}</StatusBadge></Td>
                        <Td className="whitespace-nowrap text-xs font-semibold">
                          {SOURCE_LABEL[row.request_source ?? ""] ?? row.request_source ?? "-"}
                          {row.inquiry_meta?.has_ai_design && <span className="mt-0.5 block text-[10px] font-normal text-[#741b2b]">AI 디자인 첨부</span>}
                        </Td>
                        <Td>
                          <div className="flex min-w-0 items-start gap-2.5">
                            {image ? <img src={image} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg border border-stone-200 object-cover" /> : <span className="h-12 w-12 shrink-0 rounded-lg border border-dashed border-stone-200" />}
                            <div className="min-w-0">
                              <p className="max-w-[300px] truncate text-sm font-bold">{row.request_title || row.cloth_type}</p>
                              <p className="text-[11px] text-stone-500">{row.cloth_type} · {row.material}{row.size ? ` · ${row.size}` : ""}</p>
                              {row.detail_description && <p className="mt-0.5 line-clamp-1 max-w-[300px] text-[11px] text-stone-400">{row.detail_description}</p>}
                              {row.admin_memo && <p className="mt-0.5 line-clamp-1 max-w-[300px] text-[11px] text-[#741b2b]">메모: {row.admin_memo}</p>}
                            </div>
                          </div>
                        </Td>
                        <Td className="whitespace-nowrap text-xs tabular-nums">{quantityOf(row)}</Td>
                        <Td className="whitespace-nowrap text-xs">
                          <p>{row.budget_range || "-"}</p>
                          <p className="text-[11px] text-stone-400">{row.desired_due_date ? `납기 ${row.desired_due_date}` : ""}</p>
                        </Td>
                        <Td className="whitespace-nowrap text-xs">
                          <p className="font-semibold">{row.customer_name ?? "-"}{row.is_guest && <span className="ml-1 text-[10px] font-normal text-stone-400">비회원</span>}</p>
                          <p className="text-[11px] text-stone-500">{row.customer_phone ?? ""}</p>
                        </Td>
                        <Td className="whitespace-nowrap text-xs">{dateTime(row.created_at)}</Td>
                        <Td><Button size="sm" variant="outline" className="h-7 text-xs" onClick={(event) => { event.stopPropagation(); setSelectedId(row.id); }}>상세</Button></Td>
                      </tr>
                    );
                  })}
                </DataTable>
                <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
              </>
            )}
          </Panel>
        </>
      )}

      <OrderReviewDialog
        order={selected}
        isOpen={Boolean(selected)}
        isSaving={false}
        readOnly={!data?.can_manage}
        onOpenChange={(open) => { if (!open) setSelectedId(null); }}
        onUpdateStatus={async () => undefined}
        managePanel={selected ? <ConsultManagePanel row={selected} canManage={Boolean(data?.can_manage)} onSaved={() => void reload()} /> : undefined}
      />
    </div>
  );
};

export default ProductionRequestsPage;
