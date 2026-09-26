import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Ban, BadgeCheck, RotateCcw, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { adminRpc, manageMember, totalOf, type MemberRow } from "@/services/adminApi";
import { ACCOUNT_STATUS, dateOnly, dateTime, FUNDING_PHASE, num, ORDER_STATE, won } from "@/lib/admin/format";
import { ROLE_LABEL } from "@/lib/admin/permissions";
import {
  DataTable, DefinitionGrid, EmptyState, ErrorBanner, FilterChips, LoadingBlock, MappedBadge, Notice, PageHeader,
  Pager, Panel, SearchInput, StatusBadge, Td,
} from "@/components/admin/shell/ui";
import { ReasonDialog, type ReasonDialogState } from "@/components/admin/shell/ReasonDialog";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { useAdminContext } from "@/components/admin/shell/AdminContext";

const PAGE = 30;
type Filter = "all" | "buyer" | "creator" | "suspended" | "staff";

type MemberDetail = {
  id: string; email: string; created_at: string; last_sign_in_at: string | null; banned_until: string | null;
  full_name: string | null; username: string | null; phone_number: string | null; address: string | null;
  pii_visible: boolean; account_type: string; account_status: string; account_status_reason: string | null;
  creator_approved_at: string | null; admin_role: string | null; last_active_at: string | null;
  brand: { brand_name: string; status: string } | null;
  creator_profile: { display_name: string } | null;
  fundings: { id: string; product_name: string; phase: string; current_orders: number; moq: number }[];
  orders: { id: string; order_number: string; product_name: string; total_amount: number; order_state: string; created_at: string; payment_provider: string }[];
  status_history: { action: string; admin_name: string; reason: string; created_at: string }[];
  cs_tickets: number;
};

const MemberDetailSheet = ({ userId, onClose, onChanged }: { userId: string | null; onClose: () => void; onChanged: () => void }) => {
  const { can } = useAdminContext();
  const [dialog, setDialog] = useState<ReasonDialogState>(null);
  const { data, loading, error, reload } = useAdminQuery(
    () => (userId ? adminRpc<MemberDetail>("admin_get_member_detail", { p_user_id: userId }) : Promise.resolve(null)),
    [userId],
  );

  const setStatus = (status: string, title: string, destructive = false) => setDialog({
    title, destructive, confirmLabel: title,
    description: status === "suspended"
      ? "정지 시 이용이 차단되고 Supabase Auth 로그인도 차단됩니다. 기존 주문·결제 기록은 유지됩니다."
      : status === "restricted" ? "이용 제한 시 펀딩 참여·개설, 커뮤니티 글/댓글 작성이 차단됩니다." : undefined,
    onConfirm: (reason) => manageMember({ action: "set_status", userId: userId!, status, reason }),
    successMessage: "회원 상태를 변경했습니다",
  });

  return (
    <Sheet open={Boolean(userId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader><SheetTitle>회원 상세</SheetTitle></SheetHeader>
        {error && <ErrorBanner message={error} onRetry={reload} />}
        {loading || !data ? <LoadingBlock /> : (
          <div className="mt-4 grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-extrabold">{data.full_name || data.username || data.email}</p>
              <MappedBadge map={ACCOUNT_STATUS} value={data.account_status} />
              {data.admin_role && <StatusBadge tone="wine">{ROLE_LABEL[data.admin_role as keyof typeof ROLE_LABEL]}</StatusBadge>}
              {data.creator_profile && <StatusBadge tone="violet">제작자</StatusBadge>}
            </div>
            {!data.pii_visible && <Notice tone="stone">개인정보 열람 권한이 없어 연락처·주소가 마스킹되었습니다.</Notice>}
            <DefinitionGrid items={[
              { label: "회원 ID", value: <span className="font-mono text-xs">{data.id}</span> },
              { label: "이메일", value: data.email },
              { label: "닉네임", value: data.username },
              { label: "연락처", value: data.phone_number },
              { label: "주소", value: data.address },
              { label: "회원 유형", value: data.account_type === "buyer" ? "일반(구매) 회원" : "제작 가능 회원" },
              { label: "가입일", value: dateTime(data.created_at) },
              { label: "마지막 활동", value: dateTime(data.last_active_at || data.last_sign_in_at) },
              { label: "브랜드", value: data.brand ? `${data.brand.brand_name} (${data.brand.status})` : "-" },
              { label: "제작자 승인일", value: dateOnly(data.creator_approved_at) },
              { label: "상태 사유", value: data.account_status_reason },
              { label: "CS 문의", value: `${num(data.cs_tickets)}건` },
            ]} />
            <Notice tone="blue">비밀번호와 인증 토큰은 관리자에게도 제공되지 않습니다.</Notice>

            {can("members.manage") && (
              <div className="flex flex-wrap gap-2">
                {data.account_status !== "active" && <Button size="sm" variant="outline" onClick={() => setStatus("active", "정상 상태로 복구")}><RotateCcw className="mr-1 h-4 w-4" />정지/제한 해제</Button>}
                {data.account_status !== "restricted" && <Button size="sm" variant="outline" onClick={() => setStatus("restricted", "이용 제한")}><ShieldOff className="mr-1 h-4 w-4" />이용 제한</Button>}
                {data.account_status !== "suspended" && <Button size="sm" variant="outline" className="text-rose-600" onClick={() => setStatus("suspended", "계정 정지", true)}><Ban className="mr-1 h-4 w-4" />계정 정지</Button>}
                {data.account_type === "buyer" && (
                  <Button size="sm" className="bg-[#741b2b] hover:bg-[#551220]" onClick={() => setDialog({
                    title: "제작자 권한 승인", reasonLabel: "승인 메모", confirmLabel: "승인",
                    description: "구매 전용 회원을 제작 가능 회원(seller)으로 전환합니다.",
                    onConfirm: (reason) => manageMember({ action: "approve_creator", userId: userId!, reason }),
                    successMessage: "제작자 권한을 승인했습니다",
                  })}><BadgeCheck className="mr-1 h-4 w-4" />제작자 권한 승인</Button>
                )}
              </div>
            )}

            <Panel title={`생성한 펀딩 ${data.fundings.length}`} bodyClassName="p-0">
              {data.fundings.length === 0 ? <EmptyState title="생성한 펀딩이 없습니다" /> : (
                <ul className="divide-y divide-stone-100">{data.fundings.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="truncate font-semibold">{f.product_name}</span>
                    <span className="flex items-center gap-2 text-xs text-stone-500">{f.current_orders}/{f.moq}<MappedBadge map={FUNDING_PHASE} value={f.phase} /></span>
                  </li>))}</ul>
              )}
            </Panel>
            <Panel title={`주문·참여 ${data.orders.length}`} bodyClassName="p-0">
              {data.orders.length === 0 ? <EmptyState title="주문 내역이 없습니다" /> : (
                <ul className="divide-y divide-stone-100">{data.orders.map((o) => (
                  <li key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-4 py-2.5 text-sm">
                    <div className="min-w-0"><p className="truncate font-semibold">{o.product_name}</p><p className="font-mono text-[11px] text-stone-400">{o.order_number}</p></div>
                    <div className="text-right"><p className="font-bold">{won(o.total_amount)}</p><MappedBadge map={ORDER_STATE} value={o.order_state} /></div>
                  </li>))}</ul>
              )}
            </Panel>
            <Panel title="상태 변경 이력" bodyClassName="p-0">
              {data.status_history.length === 0 ? <EmptyState title="변경 이력이 없습니다" /> : (
                <ul className="divide-y divide-stone-100">{data.status_history.map((h, i) => (
                  <li key={i} className="px-4 py-2.5 text-xs"><p className="font-bold text-stone-700">{h.action} · {h.admin_name}</p><p className="text-stone-500">{h.reason} · {dateTime(h.created_at)}</p></li>
                ))}</ul>
              )}
            </Panel>
          </div>
        )}
        <ReasonDialog state={dialog} onClose={() => setDialog(null)} onDone={() => { void reload(); onChanged(); }} />
      </SheetContent>
    </Sheet>
  );
};

const MembersPage = () => {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [filter, setFilter] = useState<Filter>((params.get("filter") as Filter) || "all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(params.get("id"));

  const { data, loading, error, reload } = useAdminQuery(
    () => adminRpc<MemberRow[]>("admin_list_members", { p_search: search || null, p_filter: filter, p_limit: PAGE, p_offset: page * PAGE }),
    [search, filter, page],
  );
  const rows = data ?? [];

  return (
    <div>
      <PageHeader eyebrow="Members" title="회원 관리" description="이름·닉네임·이메일·브랜드명으로 검색하고 계정 상태를 관리합니다." />
      <Panel bodyClassName="p-0" title={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="이름, 닉네임, 이메일, 브랜드명" />
          <FilterChips value={filter} onChange={(v) => { setFilter(v as Filter); setPage(0); setParams({}); }} options={[
            { value: "all", label: "전체" }, { value: "buyer", label: "일반회원" }, { value: "creator", label: "제작자" },
            { value: "suspended", label: "정지·제한" }, { value: "staff", label: "관리자" },
          ]} />
        </div>
      }>
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="조건에 맞는 회원이 없습니다" /> : (
          <DataTable minWidth={1150} head={["회원", "이메일", "가입일", "마지막 활동", "유형", "브랜드", "참여 펀딩", "생성 펀딩", "주문", "누적 주문 금액", "상태"]}>
            {rows.map((row) => (
              <tr key={row.id} className="cursor-pointer hover:bg-stone-50" onClick={() => setSelected(row.id)}>
                <Td><p className="font-bold">{row.full_name || row.username || "이름 없음"}</p><p className="text-[11px] text-stone-400">{row.username ? `@${row.username}` : row.id.slice(0, 8)}</p></Td>
                <Td className="text-xs">{row.email}</Td>
                <Td className="text-xs">{dateOnly(row.created_at)}</Td>
                <Td className="text-xs">{dateTime(row.last_active_at)}</Td>
                <Td>{row.admin_role ? <StatusBadge tone="wine">{ROLE_LABEL[row.admin_role]}</StatusBadge> : row.is_creator ? <StatusBadge tone="violet">제작자</StatusBadge> : <StatusBadge>일반</StatusBadge>}</Td>
                <Td className="text-xs">{row.brand_name || "-"}</Td>
                <Td className="tabular-nums">{num(row.participated_fundings)}</Td>
                <Td className="tabular-nums">{num(row.created_fundings)}</Td>
                <Td className="tabular-nums">{num(row.order_count)}</Td>
                <Td className="font-bold tabular-nums">{won(row.order_amount)}</Td>
                <Td><MappedBadge map={ACCOUNT_STATUS} value={row.account_status} /></Td>
              </tr>
            ))}
          </DataTable>
        )}
        <Pager page={page} pageSize={PAGE} total={totalOf(rows)} onPage={setPage} />
      </Panel>
      <MemberDetailSheet userId={selected} onClose={() => setSelected(null)} onChanged={reload} />
    </div>
  );
};

export default MembersPage;
