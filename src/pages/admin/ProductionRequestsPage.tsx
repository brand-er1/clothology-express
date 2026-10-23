import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { OrderReviewDialog } from "@/components/admin/OrderReviewDialog";
import {
  DataTable, EmptyState, ErrorBanner, FilterChips, LoadingBlock, Notice, PageHeader, Pager, Panel, SearchInput, StatusBadge, Td,
} from "@/components/admin/shell/ui";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { dateTime, errorMessage, type Tone } from "@/lib/admin/format";
import { adminRpc } from "@/services/adminApi";
import type { Order } from "@/types/order";

type Status = "pending" | "approved" | "rejected" | "all";
type Source = "all" | "ai_design" | "design_upload" | "ready_made_group_wear";

type RequestRow = Order & {
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  is_guest: boolean;
};

type RequestList = {
  total: number;
  counts: Record<Status, number>;
  can_manage: boolean;
  can_view_pii: boolean;
  rows: RequestRow[];
};

const PAGE_SIZE = 30;

const STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "검토 대기", tone: "amber" },
  approved: { label: "제작 상담 접수", tone: "green" },
  rejected: { label: "진행 불가", tone: "red" },
};

const SOURCE_LABEL: Record<string, string> = {
  ai_design: "AI 디자인 의뢰",
  design_upload: "디자인 업로드 의뢰",
  ready_made_group_wear: "기성품 단체복",
};

/** 제작 의뢰(public.orders): AI 디자인 · 디자인 업로드 · 기성품 단체복 빠른 제작 요청 */
const ProductionRequestsPage = () => {
  const [status, setStatus] = useState<Status>("pending");
  const [source, setSource] = useState<Source>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<RequestRow | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => setPage(0), [status, source, search]);

  const { data, loading, error, reload } = useAdminQuery(
    () => adminRpc<RequestList>("admin_list_production_requests", {
      p_status: status, p_source: source, p_search: search || null, p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE,
    }),
    [status, source, search, page],
  );
  const rows = data?.rows ?? [];

  const updateStatus = async (next: "approved" | "rejected", comment: string) => {
    if (!selected) return;
    setSaving(true);
    try {
      await adminRpc("admin_set_production_request_status", { p_order_id: selected.id, p_status: next, p_comment: comment });
      toast({ title: next === "approved" ? "제작 상담 접수로 변경했습니다" : "진행 불가로 처리했습니다" });
      setSelected(null);
      void reload();
    } catch (err) {
      toast({ title: "상태를 변경하지 못했습니다", description: errorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Production requests" title="제작 의뢰"
        description="고객이 AI 디자인 · 디자인 업로드 · 기성품 단체복으로 접수한 제작 요청입니다. 상세에서 이미지 · 견적 · 고객 정보를 확인하고 처리합니다." />
      {data && !data.can_manage && <div className="mb-4"><Notice tone="stone">조회 전용 권한입니다. 상태 변경은 orders.manage 권한이 필요합니다.</Notice></div>}
      <Panel bodyClassName="p-0" title={
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput value={search} onChange={setSearch} placeholder={data?.can_view_pii ? "제목 · 품목 · 고객명 · 연락처 · 이메일" : "제목 · 품목 · 고객명"} />
            <FilterChips<Status> value={status} onChange={setStatus} options={[
              { value: "pending", label: "검토 대기", count: data?.counts.pending },
              { value: "approved", label: "상담 접수", count: data?.counts.approved },
              { value: "rejected", label: "진행 불가", count: data?.counts.rejected },
              { value: "all", label: "전체", count: data?.counts.all },
            ]} />
          </div>
          <FilterChips<Source> value={source} onChange={setSource} options={[
            { value: "all", label: "모든 유형" },
            { value: "ai_design", label: SOURCE_LABEL.ai_design },
            { value: "design_upload", label: SOURCE_LABEL.design_upload },
            { value: "ready_made_group_wear", label: SOURCE_LABEL.ready_made_group_wear },
          ]} />
        </div>
      }>
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="해당하는 제작 의뢰가 없습니다" /> : (
          <>
            <DataTable minWidth={1000} head={["상태", "유형", "의뢰 내용", "수량", "고객", "접수일", ""]}>
              {rows.map((row) => {
                const image = row.front_preview_url || row.generated_image_url;
                return (
                  <tr key={row.id} className="cursor-pointer align-top hover:bg-stone-50" onClick={() => setSelected(row)}>
                    <Td><StatusBadge tone={STATUS[row.status]?.tone ?? "neutral"}>{STATUS[row.status]?.label ?? row.status}</StatusBadge></Td>
                    <Td className="whitespace-nowrap text-xs font-semibold">{SOURCE_LABEL[row.request_source ?? ""] ?? row.request_source ?? "-"}</Td>
                    <Td>
                      <div className="flex min-w-0 items-start gap-2.5">
                        {image && <img src={image} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg border border-stone-200 object-cover" />}
                        <div className="min-w-0">
                          <p className="max-w-[320px] truncate text-sm font-bold">{row.request_title || row.cloth_type}</p>
                          <p className="text-[11px] text-stone-500">{row.cloth_type} · {row.material}{row.size ? ` · ${row.size}` : ""}</p>
                          {row.detail_description && <p className="mt-0.5 line-clamp-1 max-w-[320px] text-[11px] text-stone-400">{row.detail_description}</p>}
                        </div>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap text-xs tabular-nums">{row.requested_quantity ? `${row.requested_quantity.toLocaleString("ko-KR")}장` : "-"}</Td>
                    <Td className="whitespace-nowrap text-xs">
                      <p className="font-semibold">{row.customer_name ?? "-"}{row.is_guest && <span className="ml-1 text-[10px] font-normal text-stone-400">비회원</span>}</p>
                      <p className="text-[11px] text-stone-400">{row.customer_phone ?? ""}</p>
                    </Td>
                    <Td className="whitespace-nowrap text-xs">{dateTime(row.created_at)}</Td>
                    <Td><Button size="sm" variant="outline" className="h-7 text-xs" onClick={(event) => { event.stopPropagation(); setSelected(row); }}>상세</Button></Td>
                  </tr>
                );
              })}
            </DataTable>
            <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </Panel>
      <OrderReviewDialog
        order={selected}
        isOpen={Boolean(selected)}
        isSaving={saving}
        readOnly={!data?.can_manage}
        onOpenChange={(open) => { if (!open && !saving) setSelected(null); }}
        onUpdateStatus={updateStatus}
      />
    </div>
  );
};

export default ProductionRequestsPage;
