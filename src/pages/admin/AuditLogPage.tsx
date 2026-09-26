import { Fragment, useState } from "react";
import { adminRpc, totalOf, type AuditRow } from "@/services/adminApi";
import { dateTime } from "@/lib/admin/format";
import { ROLE_LABEL, type AdminRole } from "@/lib/admin/permissions";
import { DataTable, EmptyState, ErrorBanner, FilterChips, LoadingBlock, PageHeader, Pager, Panel, SearchInput, StatusBadge, Td } from "@/components/admin/shell/ui";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";

const PAGE = 50;
const GROUPS = [
  { value: "", label: "전체" }, { value: "funding.", label: "펀딩" }, { value: "member.", label: "회원" }, { value: "brand.", label: "브랜드" },
  { value: "order.", label: "주문" }, { value: "shipping.", label: "배송" }, { value: "production.", label: "제작" }, { value: "refund.", label: "환불" },
  { value: "settlement.", label: "정산" }, { value: "settings.", label: "설정" }, { value: "admin.", label: "관리자 권한" },
  { value: "content.", label: "콘텐츠" }, { value: "notification.", label: "알림" }, { value: "row_", label: "직접 변경" },
];

const Json = ({ value }: { value: unknown }) => value ? (
  <pre className="max-h-48 overflow-auto rounded-lg bg-stone-50 p-2 text-[10px] leading-4 text-stone-700">{JSON.stringify(value, null, 2)}</pre>
) : <span className="text-stone-300">-</span>;

const AuditLogPage = () => {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const { data, loading, error, reload } = useAdminQuery(
    () => adminRpc<AuditRow[]>("admin_list_audit_logs", { p_search: search || null, p_action: group || null, p_limit: PAGE, p_offset: page * PAGE }),
    [search, group, page],
  );
  const rows = data ?? [];
  return (
    <div>
      <PageHeader eyebrow="Audit" title="Audit Log" description="관리자 작업 기록(수정·삭제 불가). 행을 눌러 변경 전/후 값을 확인하세요." />
      <Panel bodyClassName="p-0" title={
        <div className="flex flex-col gap-2">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="관리자, 대상, 작업, 사유" />
          <FilterChips value={group} onChange={(v) => { setGroup(v); setPage(0); }} options={GROUPS} />
        </div>
      }>
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="기록이 없습니다" /> : (
          <DataTable minWidth={1000} head={["시각", "관리자", "작업", "대상", "사유"]}>
            {rows.map((row) => (
              <Fragment key={row.id}>
                <tr className="cursor-pointer hover:bg-stone-50" onClick={() => setOpen(open === row.id ? null : row.id)}>
                  <Td className="whitespace-nowrap text-xs tabular-nums">{dateTime(row.created_at)}</Td>
                  <Td><p className="text-sm font-semibold">{row.admin_name}</p>{row.admin_role && <p className="text-[10px] text-stone-400">{ROLE_LABEL[row.admin_role as AdminRole] ?? row.admin_role}</p>}</Td>
                  <Td><StatusBadge tone={row.action.startsWith("row_") ? "amber" : "wine"}>{row.action}</StatusBadge></Td>
                  <Td className="max-w-[260px] text-xs"><p className="truncate font-semibold">{row.target_label ?? "-"}</p><p className="truncate font-mono text-[10px] text-stone-400">{row.target_type} · {row.target_id}</p></Td>
                  <Td className="max-w-[260px] truncate text-xs">{row.reason ?? "-"}</Td>
                </tr>
                {open === row.id && (
                  <tr className="bg-stone-50/60">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div><p className="mb-1 text-[11px] font-bold text-stone-500">변경 전</p><Json value={row.before_data} /></div>
                        <div><p className="mb-1 text-[11px] font-bold text-stone-500">변경 후</p><Json value={row.after_data} /></div>
                      </div>
                      {row.metadata && Object.keys(row.metadata).length > 0 && <div className="mt-2"><Json value={row.metadata} /></div>}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </DataTable>
        )}
        <Pager page={page} pageSize={PAGE} total={totalOf(rows)} onPage={setPage} />
      </Panel>
    </div>
  );
};

export default AuditLogPage;
