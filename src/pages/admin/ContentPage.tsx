import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminRpc, totalOf, type Paged } from "@/services/adminApi";
import { CS_CATEGORY, CS_STATUS, dateTime, REPORT_STATUS } from "@/lib/admin/format";
import { DataTable, EmptyState, ErrorBanner, FilterChips, LoadingBlock, MappedBadge, Notice, PageHeader, Panel, SearchInput, StatusBadge, Td } from "@/components/admin/shell/ui";
import { ReasonDialog, type ReasonDialogState } from "@/components/admin/shell/ReasonDialog";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { useAdminContext } from "@/components/admin/shell/AdminContext";

type Report = { id: string; reporter_name: string; target_type: string; target_id: string; target_summary: string | null; target_state: string | null; reason: string | null; status: string; resolution_note: string | null; action_taken: string | null; reviewed_by_name: string | null; created_at: string };
type Comment = { id: string; post_id: string; post_title: string; author_name: string; content: string; is_deleted: boolean; deleted_reason: string | null; deleted_by_name: string | null; deleted_at: string | null; report_count: number; created_at: string };
type Post = { id: string; title: string; author_name: string; cover_image_url: string | null; report_count: number; moderation_status: string; admin_note: string | null; created_at: string };
type Ticket = Paged & { id: string; user_name: string; user_email: string | null; order_number: string | null; category: string; subject: string; content: string; status: string; priority: string; assigned_to_name: string | null; admin_memo: string | null; created_at: string };

const TARGET = { post: "게시물", comment: "댓글", user: "회원" } as Record<string, string>;
const POST_STATUS = { visible: { label: "노출", tone: "green" as const }, hidden: { label: "숨김", tone: "amber" as const }, removed: { label: "삭제(보관)", tone: "red" as const } };

const ReportsTab = () => {
  const { can } = useAdminContext();
  const [status, setStatus] = useState("pending");
  const [dialog, setDialog] = useState<ReasonDialogState>(null);
  const { data, loading, error, reload } = useAdminQuery(() => adminRpc<Report[]>("admin_list_reports", { p_status: status }), [status]);
  const resolve = (r: Report, next: "reviewed" | "dismissed", action: string, title: string) => setDialog({
    title, confirmLabel: title, reasonRequired: action !== "none", reasonLabel: "처리 메모",
    destructive: action !== "none",
    onConfirm: (note) => adminRpc("admin_resolve_report", { p_report_id: r.id, p_status: next, p_note: note || null, p_action: action }),
  });
  return (
    <Panel bodyClassName="p-0" title={<FilterChips value={status} onChange={setStatus} options={[{ value: "pending", label: "미처리" }, { value: "reviewed", label: "조치완료" }, { value: "dismissed", label: "기각" }, { value: "all", label: "전체" }]} />}>
      {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
      {loading && !data ? <LoadingBlock /> : !data?.length ? <EmptyState title="신고가 없습니다" /> : (
        <DataTable minWidth={1100} head={["유형", "신고 대상", "사유", "신고자", "대상 상태", "처리 상태", "신고일", "처리"]}>
          {data.map((r) => (
            <tr key={r.id} className="hover:bg-stone-50">
              <Td><StatusBadge>{TARGET[r.target_type] ?? r.target_type}</StatusBadge></Td>
              <Td className="max-w-[240px] truncate text-sm font-semibold">{r.target_summary || "(삭제됨)"}</Td>
              <Td className="max-w-[200px] truncate text-xs">{r.reason ?? "-"}</Td>
              <Td className="text-xs">{r.reporter_name}</Td>
              <Td className="text-xs">{r.target_state ?? "-"}</Td>
              <Td><MappedBadge map={REPORT_STATUS} value={r.status} />{r.resolution_note && <p className="mt-0.5 max-w-[160px] truncate text-[10px] text-stone-400">{r.action_taken} · {r.resolution_note}</p>}</Td>
              <Td className="text-xs">{dateTime(r.created_at)}</Td>
              <Td>{r.status === "pending" && can("reports.manage") && (
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => resolve(r, "dismissed", "none", "기각")}>기각</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => resolve(r, "reviewed", "none", "확인 완료")}>확인</Button>
                  {can("content.manage") && r.target_type === "post" && <Button size="sm" variant="outline" className="h-7 text-xs text-rose-600" onClick={() => resolve(r, "reviewed", "hide_post", "게시물 숨김")}>숨김</Button>}
                  {can("content.manage") && r.target_type === "comment" && <Button size="sm" variant="outline" className="h-7 text-xs text-rose-600" onClick={() => resolve(r, "reviewed", "delete_comment", "댓글 삭제")}>댓글 삭제</Button>}
                  {can("members.manage") && r.target_type === "user" && <Button size="sm" variant="outline" className="h-7 text-xs text-rose-600" onClick={() => resolve(r, "reviewed", "restrict_user", "회원 이용 제한")}>이용 제한</Button>}
                </div>
              )}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </Panel>
  );
};

const CommentsTab = () => {
  const { can } = useAdminContext();
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<ReasonDialogState>(null);
  const { data, loading, error, reload } = useAdminQuery(() => adminRpc<Comment[]>("admin_list_comments", { p_search: search || null }), [search]);
  return (
    <Panel bodyClassName="p-0" title={<SearchInput value={search} onChange={setSearch} placeholder="댓글 내용, 작성자, 게시물" />}>
      {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
      {loading && !data ? <LoadingBlock /> : !data?.length ? <EmptyState title="댓글이 없습니다" /> : (
        <DataTable minWidth={1000} head={["게시물", "작성자", "내용", "신고", "상태", "작성일", "관리"]}>
          {data.map((c) => (
            <tr key={c.id} className="hover:bg-stone-50">
              <Td className="max-w-[180px] truncate text-xs">{c.post_title}</Td>
              <Td className="text-xs font-semibold">{c.author_name}</Td>
              <Td className={`max-w-[320px] truncate text-sm ${c.is_deleted ? "text-stone-400 line-through" : ""}`}>{c.content || "(내용 없음)"}</Td>
              <Td className="tabular-nums">{c.report_count}</Td>
              <Td>{c.is_deleted ? <div><StatusBadge tone="red">삭제됨</StatusBadge><p className="mt-0.5 max-w-[160px] truncate text-[10px] text-stone-400">{c.deleted_by_name ?? "작성자"} · {c.deleted_reason ?? ""}</p></div> : <StatusBadge tone="green">노출</StatusBadge>}</Td>
              <Td className="text-xs">{dateTime(c.created_at)}</Td>
              <Td>{can("content.manage") && (c.is_deleted
                ? c.deleted_by_name && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDialog({ title: "댓글 복구", confirmLabel: "복구", reasonLabel: "복구 사유", onConfirm: (r) => adminRpc("admin_restore_comment", { p_comment_id: c.id, p_reason: r }) })}>복구</Button>
                : <Button size="sm" variant="outline" className="h-7 text-xs text-rose-600" onClick={() => setDialog({ title: "댓글 삭제(soft delete)", destructive: true, confirmLabel: "삭제", reasonLabel: "삭제 사유", description: "DB 에서 영구 삭제하지 않고 원문·삭제자·시각·사유를 보관합니다.", onConfirm: (r) => adminRpc("admin_soft_delete_comment", { p_comment_id: c.id, p_reason: r }) })}>삭제</Button>)}</Td>
            </tr>
          ))}
        </DataTable>
      )}
      <ReasonDialog state={dialog} onClose={() => setDialog(null)} onDone={reload} />
    </Panel>
  );
};

const PostsTab = () => {
  const [dialog, setDialog] = useState<ReasonDialogState>(null);
  const { data, loading, error, reload } = useAdminQuery(() => adminRpc<Post[]>("get_admin_community_posts"), []);
  const moderate = (p: Post, status: "visible" | "hidden" | "removed", title: string) => setDialog({
    title, confirmLabel: title, reasonRequired: status !== "visible", destructive: status === "removed",
    description: status === "removed" ? "삭제는 soft delete 로 처리되어 게시물 데이터는 보관됩니다." : undefined,
    onConfirm: (reason) => adminRpc("admin_moderate_post", { p_post_id: p.id, p_status: status, p_reason: reason || null }),
  });
  return (
    <Panel bodyClassName="p-0">
      {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
      {loading && !data ? <LoadingBlock /> : !data?.length ? <EmptyState title="게시물이 없습니다" /> : (
        <DataTable minWidth={900} head={["게시물", "작성자", "신고", "상태", "작성일", "관리"]}>
          {data.map((p) => (
            <tr key={p.id} className="hover:bg-stone-50">
              <Td><div className="flex items-center gap-2">{p.cover_image_url && <img src={p.cover_image_url} alt="" className="h-10 w-10 rounded-lg object-cover" loading="lazy" />}<span className="max-w-[260px] truncate font-semibold">{p.title}</span></div></Td>
              <Td className="text-xs">{p.author_name}</Td>
              <Td className="tabular-nums">{p.report_count}</Td>
              <Td><MappedBadge map={POST_STATUS} value={p.moderation_status} /></Td>
              <Td className="text-xs">{dateTime(p.created_at)}</Td>
              <Td><div className="flex gap-1">
                {p.moderation_status !== "visible" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => moderate(p, "visible", "노출 복구")}>복구</Button>}
                {p.moderation_status === "visible" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => moderate(p, "hidden", "숨김")}>숨김</Button>}
                {p.moderation_status !== "removed" && <Button size="sm" variant="outline" className="h-7 text-xs text-rose-600" onClick={() => moderate(p, "removed", "삭제")}>삭제</Button>}
              </div></Td>
            </tr>
          ))}
        </DataTable>
      )}
      <ReasonDialog state={dialog} onClose={() => setDialog(null)} onDone={reload} />
    </Panel>
  );
};

const TicketsTab = () => {
  const { can } = useAdminContext();
  const [status, setStatus] = useState("active");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<ReasonDialogState>(null);
  const form = useRef({ email: "", order: "", category: "order", subject: "", content: "", status: "in_progress" });
  const { data, loading, error, reload } = useAdminQuery(() => adminRpc<Ticket[]>("admin_list_cs_tickets", { p_status: status, p_search: search || null }), [status, search]);
  const rows = useMemo(() => data ?? [], [data]);

  const create = () => {
    form.current = { email: "", order: "", category: "order", subject: "", content: "", status: "in_progress" };
    setDialog({
      title: "CS 문의 등록", confirmLabel: "등록", reasonLabel: "문의 내용", placeholder: "고객 문의 내용을 입력하세요.",
      extra: (
        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-stone-600">
          <label className="grid gap-1">고객 이메일<Input onChange={(e) => { form.current.email = e.target.value; }} /></label>
          <label className="grid gap-1">주문번호(선택)<Input onChange={(e) => { form.current.order = e.target.value; }} /></label>
          <label className="grid gap-1">유형
            <select className="h-10 rounded-md border px-2 text-sm" defaultValue="order" onChange={(e) => { form.current.category = e.target.value; }}>
              {Object.entries(CS_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
          <label className="grid gap-1">제목<Input onChange={(e) => { form.current.subject = e.target.value; }} /></label>
        </div>
      ),
      onConfirm: (content) => adminRpc("admin_create_cs_ticket", { p_user_email: form.current.email || null, p_category: form.current.category, p_subject: form.current.subject, p_content: content, p_order_number: form.current.order || null }),
      successMessage: "문의를 등록했습니다",
    });
  };

  const update = (t: Ticket) => {
    form.current.status = t.status;
    setDialog({
      title: `처리 상태 변경 · ${t.subject}`, confirmLabel: "저장", reasonRequired: false, reasonLabel: "처리 메모",
      extra: (
        <div className="grid gap-2">
          <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-700">{t.content}</p>
          <select className="h-10 rounded-md border px-2 text-sm" defaultValue={t.status} onChange={(e) => { form.current.status = e.target.value; }}>
            {Object.entries(CS_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      ),
      onConfirm: (memo) => adminRpc("admin_update_cs_ticket", { p_ticket_id: t.id, p_status: form.current.status, p_admin_memo: memo || null, p_assign_to_me: true }),
    });
  };

  return (
    <Panel bodyClassName="p-0" title={
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="제목, 내용, 이메일, 주문번호" />
        <FilterChips value={status} onChange={setStatus} options={[{ value: "active", label: "진행중" }, ...Object.entries(CS_STATUS).map(([value, m]) => ({ value, label: m.label })), { value: "all", label: "전체" }]} />
      </div>
    } actions={can("cs.manage") ? <Button size="sm" className="bg-[#741b2b] hover:bg-[#551220]" onClick={create}>문의 등록</Button> : undefined}>
      {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
      {loading && !data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="문의가 없습니다" /> : (
        <DataTable minWidth={1000} head={["유형", "제목", "고객", "주문번호", "담당", "상태", "접수일", ""]}>
          {rows.map((t) => (
            <tr key={t.id} className="hover:bg-stone-50">
              <Td><StatusBadge>{CS_CATEGORY[t.category] ?? t.category}</StatusBadge></Td>
              <Td className="max-w-[260px]"><p className="truncate font-semibold">{t.subject}</p>{t.admin_memo && <p className="truncate text-[11px] text-stone-400">메모: {t.admin_memo}</p>}</Td>
              <Td className="text-xs"><p>{t.user_name}</p><p className="text-stone-400">{t.user_email}</p></Td>
              <Td className="font-mono text-[11px]">{t.order_number ?? "-"}</Td>
              <Td className="text-xs">{t.assigned_to_name ?? "-"}</Td>
              <Td><MappedBadge map={CS_STATUS} value={t.status} /></Td>
              <Td className="text-xs">{dateTime(t.created_at)}</Td>
              <Td>{can("cs.manage") && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => update(t)}>처리</Button>}</Td>
            </tr>
          ))}
        </DataTable>
      )}
      <div className="px-4 pb-3 text-[11px] text-stone-400">총 {totalOf(rows)}건</div>
      <ReasonDialog state={dialog} onClose={() => setDialog(null)} onDone={reload} />
    </Panel>
  );
};

const ContentPage = () => {
  const { can } = useAdminContext();
  const tabs = [
    can("content.view") && { key: "reports", label: "신고", node: <ReportsTab /> },
    can("cs.view") && { key: "tickets", label: "CS 문의", node: <TicketsTab /> },
    can("content.view") && { key: "comments", label: "댓글", node: <CommentsTab /> },
    can("content.manage") && { key: "posts", label: "게시물", node: <PostsTab /> },
  ].filter(Boolean) as { key: string; label: string; node: JSX.Element }[];

  return (
    <div>
      <PageHeader eyebrow="Content & CS" title="콘텐츠 · 신고 · 문의" description="댓글/게시물 삭제는 soft delete 로 처리되며 삭제한 관리자·시각·사유가 기록됩니다." />
      <div className="mb-3"><Notice tone="stone">현재 BRAND-ER 에는 별도의 상품 리뷰 기능이 없어 리뷰 관리는 제공되지 않습니다. 리뷰 기능 도입 시 같은 soft delete 구조로 추가할 수 있습니다.</Notice></div>
      <Tabs defaultValue={tabs[0]?.key}>
        <TabsList className="mb-3">{tabs.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}</TabsList>
        {tabs.map((t) => <TabsContent key={t.key} value={t.key}>{t.node}</TabsContent>)}
      </Tabs>
    </div>
  );
};

export default ContentPage;
