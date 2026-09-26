import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SafeBrandImage } from "@/components/brand/SafeBrandImage";
import { adminRpc, type BrandRow } from "@/services/adminApi";
import { BRAND_REVIEW, BRAND_STATUS, dateOnly, num, won } from "@/lib/admin/format";
import { DataTable, EmptyState, ErrorBanner, FilterChips, LoadingBlock, MappedBadge, Notice, PageHeader, Panel, SearchInput, Td } from "@/components/admin/shell/ui";
import { ReasonDialog, type ReasonDialogState } from "@/components/admin/shell/ReasonDialog";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { useAdminContext } from "@/components/admin/shell/AdminContext";

type Status = "all" | "pending" | "active" | "suspended" | "rejected";

const ACTION = {
  approve: { title: "브랜드 승인", required: false, destructive: false },
  reject: { title: "브랜드 반려", required: true, destructive: true },
  suspend: { title: "브랜드 정지", required: true, destructive: true },
  restore: { title: "브랜드 복구", required: false, destructive: false },
} as const;

const BrandsPage = () => {
  const { can } = useAdminContext();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [dialog, setDialog] = useState<ReasonDialogState>(null);
  const { data, loading, error, reload } = useAdminQuery(
    () => adminRpc<BrandRow[]>("admin_list_brands", { p_search: search || null, p_status: status }), [search, status],
  );
  const rows = data ?? [];

  const act = (brand: BrandRow, action: keyof typeof ACTION) => setDialog({
    title: `${ACTION[action].title} · ${brand.brand_name}`,
    confirmLabel: ACTION[action].title,
    destructive: ACTION[action].destructive,
    reasonRequired: ACTION[action].required,
    reasonLabel: action === "reject" ? "반려 사유" : action === "suspend" ? "정지 사유" : "메모",
    description: action === "reject" || action === "suspend"
      ? "정지된 브랜드로는 새 펀딩을 만들 수 없습니다. 기존 펀딩·주문 데이터는 유지되며 브랜드 소유자에게 사이트 알림이 발송됩니다." : undefined,
    onConfirm: (reason) => adminRpc("admin_moderate_brand", { p_brand_id: brand.id, p_action: action, p_reason: reason }),
    successMessage: `${ACTION[action].title} 완료`,
  });

  return (
    <div>
      <PageHeader eyebrow="Brands" title="브랜드 관리" description="브랜드명은 대소문자·공백을 정규화해 중복 등록이 차단됩니다." />
      <Panel bodyClassName="p-0" title={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="브랜드명, 제작자명" />
          <FilterChips value={status} onChange={(v) => setStatus(v as Status)} options={[
            { value: "all", label: "전체" }, { value: "pending", label: "검수대기" }, { value: "active", label: "운영중" },
            { value: "suspended", label: "정지" }, { value: "rejected", label: "반려" },
          ]} />
        </div>
      }>
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="브랜드가 없습니다" /> : (
          <DataTable minWidth={1150} head={["브랜드", "제작자", "상태", "검수", "펀딩(진행)", "팔로워", "거래액", "등록일", "관리"]}>
            {rows.map((b) => (
              <tr key={b.id} className="hover:bg-stone-50">
                <Td><div className="flex items-center gap-2"><SafeBrandImage src={b.brand_logo_url} alt={b.brand_name} kind="logo" className="h-10 w-10" /><div className="min-w-0 max-w-[240px]"><p className="truncate font-bold">{b.brand_name}</p><p className="truncate text-[11px] text-stone-400">{b.short_description || "소개 없음"}</p></div></div></Td>
                <Td className="text-xs font-semibold">{b.creator_name || "-"}</Td>
                <Td><MappedBadge map={BRAND_STATUS} value={b.status} />{b.status_reason && <p className="mt-1 max-w-[160px] truncate text-[11px] text-stone-400" title={b.status_reason}>{b.status_reason}</p>}</Td>
                <Td><MappedBadge map={BRAND_REVIEW} value={b.review_status} />{b.review_reason && b.review_status === "rejected" && <p className="mt-1 max-w-[160px] truncate text-[11px] text-rose-500" title={b.review_reason}>{b.review_reason}</p>}</Td>
                <Td className="tabular-nums">{num(b.funding_count)} ({num(b.active_funding_count)})</Td>
                <Td className="tabular-nums">{num(b.follower_count)}</Td>
                <Td className="font-bold tabular-nums">{won(b.gmv)}</Td>
                <Td className="text-xs">{dateOnly(b.created_at)}</Td>
                <Td>
                  {can("brands.manage") ? (
                    <div className="flex flex-wrap gap-1">
                      {b.review_status !== "approved" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => act(b, "approve")}>승인</Button>}
                      {b.review_status !== "rejected" && <Button size="sm" variant="outline" className="h-7 text-xs text-rose-600" onClick={() => act(b, "reject")}>반려</Button>}
                      {b.status === "active" && <Button size="sm" variant="outline" className="h-7 text-xs text-rose-600" onClick={() => act(b, "suspend")}>정지</Button>}
                      {b.status !== "active" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => act(b, "restore")}>복구</Button>}
                    </div>
                  ) : <span className="text-xs text-stone-400">조회 전용</span>}
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
      <div className="mt-3"><Notice tone="stone">신규 브랜드 검수 방식은 시스템 설정의 <b>brand_requires_review</b> 로 전환할 수 있습니다. 기본값(false)은 기존과 동일하게 등록 즉시 운영됩니다.</Notice></div>
      <ReasonDialog state={dialog} onClose={() => setDialog(null)} onDone={reload} />
    </div>
  );
};

export default BrandsPage;
