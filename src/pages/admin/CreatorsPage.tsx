import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Instagram } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SafeBrandImage } from "@/components/brand/SafeBrandImage";
import { adminRpc, type CreatorRow } from "@/services/adminApi";
import { ACCOUNT_STATUS, BRAND_REVIEW, BRAND_STATUS, dateOnly, FUNDING_PHASE, num, won } from "@/lib/admin/format";
import {
  DataTable, DefinitionGrid, EmptyState, ErrorBanner, KpiCard, LoadingBlock, MappedBadge, PageHeader, Panel, SearchInput, Td,
} from "@/components/admin/shell/ui";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";

type Detail = { fundings: { id: string; product_name: string; phase: string; current_orders: number; moq: number; created_at: string }[] };

const CreatorSheet = ({ creator, onClose }: { creator: CreatorRow | null; onClose: () => void }) => {
  const { data } = useAdminQuery(
    () => (creator ? adminRpc<Detail>("admin_get_member_detail", { p_user_id: creator.user_id }) : Promise.resolve(null)),
    [creator?.user_id],
  );
  return (
    <Sheet open={Boolean(creator)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader><SheetTitle>제작자 상세</SheetTitle></SheetHeader>
        {creator && (
          <div className="mt-4 grid gap-4">
            <div className="flex items-center gap-3">
              <SafeBrandImage src={creator.profile_image_url} alt={creator.display_name} kind="profile" className="h-14 w-14" />
              <div className="min-w-0">
                <p className="text-lg font-extrabold">{creator.display_name}</p>
                <p className="text-xs text-stone-500">{creator.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <KpiCard label="진행 펀딩" value={num(creator.active_fundings)} />
              <KpiCard label="완료 펀딩" value={num(creator.completed_fundings)} />
              <KpiCard label="누적 참여자" value={num(creator.total_participants)} />
              <KpiCard label="누적 거래액" value={won(creator.gmv)} />
            </div>
            <DefinitionGrid items={[
              { label: "브랜드명", value: creator.brand_name },
              { label: "브랜드 상태", value: creator.brand_status ? <MappedBadge map={BRAND_STATUS} value={creator.brand_status} /> : "-" },
              { label: "브랜드 소개", value: creator.bio },
              { label: "등록일", value: dateOnly(creator.created_at) },
              { label: "SNS", value: creator.instagram_url ? <a className="inline-flex items-center gap-1 text-[#741b2b] underline" href={creator.instagram_url} target="_blank" rel="noreferrer"><Instagram className="h-3.5 w-3.5" />Instagram</a> : "-" },
              { label: "웹사이트", value: creator.website_url ? <a className="inline-flex items-center gap-1 text-[#741b2b] underline" href={creator.website_url} target="_blank" rel="noreferrer">{creator.website_url}<ExternalLink className="h-3 w-3" /></a> : "-" },
            ]} />
            <Panel title="펀딩 이력" bodyClassName="p-0">
              {!data?.fundings?.length ? <EmptyState title="펀딩이 없습니다" /> : (
                <ul className="divide-y divide-stone-100">{data.fundings.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <Link to={`/admin/fundings?q=${encodeURIComponent(f.product_name)}`} className="truncate font-semibold hover:underline">{f.product_name}</Link>
                    <span className="flex items-center gap-2 text-xs text-stone-500">{f.current_orders}/{f.moq}<MappedBadge map={FUNDING_PHASE} value={f.phase} /></span>
                  </li>))}</ul>
              )}
            </Panel>
            <Link to={`/admin/members?id=${creator.user_id}`} className="text-sm font-bold text-[#741b2b]">회원 계정 관리로 이동 →</Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

const CreatorsPage = () => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CreatorRow | null>(null);
  const { data, loading, error, reload } = useAdminQuery(() => adminRpc<CreatorRow[]>("admin_list_creators", { p_search: search || null }), [search]);
  const rows = useMemo(() => data ?? [], [data]);

  return (
    <div>
      <PageHeader eyebrow="Creators" title="제작자 관리" description="제작자 프로필, 브랜드, 펀딩 실적을 확인합니다." />
      <Panel bodyClassName="p-0" title={<SearchInput value={search} onChange={setSearch} placeholder="제작자명, 브랜드명, 이메일" />}>
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="등록된 제작자가 없습니다" /> : (
          <DataTable minWidth={1000} head={["제작자", "브랜드", "브랜드 상태", "진행", "완료", "누적 참여자", "누적 거래액", "계정", "등록일"]}>
            {rows.map((row) => (
              <tr key={row.user_id} className="cursor-pointer hover:bg-stone-50" onClick={() => setSelected(row)}>
                <Td><div className="flex items-center gap-2"><SafeBrandImage src={row.profile_image_url} alt={row.display_name} kind="profile" className="h-9 w-9" /><div className="min-w-0"><p className="truncate font-bold">{row.display_name}</p><p className="truncate text-[11px] text-stone-400">{row.email}</p></div></div></Td>
                <Td className="font-semibold">{row.brand_name || "-"}</Td>
                <Td><div className="flex gap-1">{row.brand_status && <MappedBadge map={BRAND_STATUS} value={row.brand_status} />}{row.brand_review_status && row.brand_review_status !== "approved" && <MappedBadge map={BRAND_REVIEW} value={row.brand_review_status} />}</div></Td>
                <Td className="tabular-nums">{num(row.active_fundings)}</Td>
                <Td className="tabular-nums">{num(row.completed_fundings)}</Td>
                <Td className="tabular-nums">{num(row.total_participants)}</Td>
                <Td className="font-bold tabular-nums">{won(row.gmv)}</Td>
                <Td><MappedBadge map={ACCOUNT_STATUS} value={row.account_status} /></Td>
                <Td className="text-xs">{dateOnly(row.created_at)}</Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
      <CreatorSheet creator={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default CreatorsPage;
