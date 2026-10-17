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
import { ReviewPhotoViewer, type PhotoViewerState } from "@/components/funding/FundingReviewParts";
import { REPORT_REASON_LABEL, reviewImageUrl, type ReviewReportReason } from "@/services/fundingReviews";

type Report = { id: string; reporter_name: string; target_type: string; target_id: string; target_summary: string | null; target_state: string | null; reason: string | null; status: string; resolution_note: string | null; action_taken: string | null; reviewed_by_name: string | null; created_at: string };
type Comment = { id: string; post_id: string; post_title: string; author_name: string; content: string; is_deleted: boolean; deleted_reason: string | null; deleted_by_name: string | null; deleted_at: string | null; report_count: number; created_at: string };
type Post = { id: string; title: string; author_name: string; cover_image_url: string | null; report_count: number; moderation_status: string; admin_note: string | null; created_at: string };
type Ticket = Paged & { id: string; user_name: string; user_email: string | null; order_number: string | null; category: string; subject: string; content: string; status: string; priority: string; assigned_to_name: string | null; admin_memo: string | null; created_at: string };

type FundingReviewRow = Paged & {
  id: string; funding_id: string; funding_name: string; nickname: string; order_number: string | null; rating: number; content: string;
  image_paths: string[]; purchase_type: "real" | "mock"; status: "visible" | "hidden" | "removed"; is_public: boolean;
  moderation_reason: string | null; moderated_by_name: string | null; report_count: number; pending_report_count: number;
  created_at: string; edited_at: string | null;
};
type FundingReviewReport = {
  id: string; review_id: string; funding_id: string; funding_name: string; review_nickname: string; review_rating: number;
  review_content: string; review_image_paths: string[]; review_status: string; reporter_name: string; reason: ReviewReportReason;
  detail: string | null; status: string; action_taken: string; resolution_note: string | null; reviewed_by_name: string | null; created_at: string;
};
const REVIEW_STATUS = {
  visible: { label: "노출", tone: "green" as const }, hidden: { label: "숨김", tone: "amber" as const }, removed: { label: "삭제(보관)", tone: "red" as const },
};
const REVIEW_ACTION: Record<string, string> = { none: "조치 없음", hide_review: "숨김", remove_review: "삭제(보관)" };

const ReviewThumbs = ({ paths, onOpen }: { paths: string[]; onOpen: (index: number) => void }) => paths.length ? (
  <div className="mt-1 flex gap-1">{paths.map((path, index) => (
    <button key={path} type="button" onClick={() => onOpen(index)} aria-label={`리뷰 사진 ${index + 1} 보기`}>
      <img src={reviewImageUrl(path)} alt="" loading="lazy" className="h-9 w-9 rounded object-cover" />
    </button>
  ))}</div>
) : null;

// 펀딩 리뷰 신고: 기각/확인은 reports.manage, 숨김·삭제 조치는 content.manage 가 추가로 필요(서버에서도 검증)
const FundingReviewReportsTab = () => {
  const { can } = useAdminContext();
  const [status, setStatus] = useState("pending");
  const [dialog, setDialog] = useState<ReasonDialogState>(null);
  const [viewer, setViewer] = useState<PhotoViewerState>(null);
  const { data, loading, error, reload } = useAdminQuery(() => adminRpc<FundingReviewReport[]>("admin_list_funding_review_reports", { p_status: status }), [status]);
  const resolve = (r: FundingReviewReport, next: "reviewed" | "dismissed", action: string, title: string) => setDialog({
    title, confirmLabel: title, reasonRequired: action !== "none", reasonLabel: "처리 메모", destructive: action !== "none",
    description: action !== "none" ? "리뷰는 soft delete 로 보관되며 공개 목록·평균 별점에서 즉시 제외되고, 작성자에게 사유가 포함된 알림이 발송됩니다. 같은 리뷰의 다른 미처리 신고도 함께 처리됩니다." : undefined,
    onConfirm: (note) => adminRpc("admin_resolve_funding_review_report", { p_report_id: r.id, p_status: next, p_note: note || null, p_action: action }),
  });
  return (
    <Panel bodyClassName="p-0" title={<FilterChips value={status} onChange={setStatus} options={[{ value: "pending", label: "미처리" }, { value: "reviewed", label: "조치완료" }, { value: "dismissed", label: "기각" }, { value: "all", label: "전체" }]} />}>
      {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
      {loading && !data ? <LoadingBlock /> : !data?.length ? <EmptyState title="리뷰 신고가 없습니다" /> : (
        <DataTable minWidth={1100} head={["펀딩", "신고된 리뷰", "신고 사유", "신고자", "리뷰 상태", "처리 상태", "신고일", "처리"]}>
          {data.map((r) => (
            <tr key={r.id} className="hover:bg-stone-50">
              <Td className="max-w-[160px] truncate text-xs">{r.funding_name}</Td>
              <Td className="max-w-[300px]">
                <p className="text-[11px] text-stone-400">{r.review_nickname} · ★{r.review_rating}</p>
                <p className="line-clamp-2 text-sm">{r.review_content}</p>
                <ReviewThumbs paths={r.review_image_paths} onOpen={(index) => setViewer({ paths: r.review_image_paths, index })} />
              </Td>
              <Td className="max-w-[200px] text-xs"><p className="font-semibold">{REPORT_REASON_LABEL[r.reason] ?? r.reason}</p>{r.detail && <p className="line-clamp-2 text-stone-500">{r.detail}</p>}</Td>
              <Td className="text-xs">{r.reporter_name}</Td>
              <Td><MappedBadge map={REVIEW_STATUS} value={r.review_status} /></Td>
              <Td><MappedBadge map={REPORT_STATUS} value={r.status} />{r.status !== "pending" && <p className="mt-0.5 max-w-[160px] truncate text-[10px] text-stone-400">{REVIEW_ACTION[r.action_taken] ?? r.action_taken}{r.resolution_note ? ` · ${r.resolution_note}` : ""}{r.reviewed_by_name ? ` · ${r.reviewed_by_name}` : ""}</p>}</Td>
              <Td className="text-xs">{dateTime(r.created_at)}</Td>
              <Td>{r.status === "pending" && can("reports.manage") && (
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => resolve(r, "dismissed", "none", "기각")}>기각</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => resolve(r, "reviewed", "none", "확인 완료")}>확인</Button>
                  {can("content.manage") && r.review_status === "visible" && <>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-rose-600" onClick={() => resolve(r, "reviewed", "hide_review", "리뷰 숨김")}>숨김</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-rose-600" onClick={() => resolve(r, "reviewed", "remove_review", "리뷰 삭제")}>삭제</Button>
                  </>}
                </div>
              )}</Td>
            </tr>
          ))}
        </DataTable>
      )}
      <ReasonDialog state={dialog} onClose={() => setDialog(null)} onDone={reload} />
      <ReviewPhotoViewer state={viewer} onClose={() => setViewer(null)} />
    </Panel>
  );
};

const FundingReviewsTab = () => {
  const { can } = useAdminContext();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<ReasonDialogState>(null);
  const [viewer, setViewer] = useState<PhotoViewerState>(null);
  const { data, loading, error, reload } = useAdminQuery(
    () => adminRpc<FundingReviewRow[]>("admin_list_funding_reviews", { p_status: status === "reported" ? "all" : status, p_reported_only: status === "reported", p_search: search || null }),
    [status, search],
  );
  const rows = useMemo(() => data ?? [], [data]);
  const moderate = (r: FundingReviewRow, next: "visible" | "hidden" | "removed", title: string) => setDialog({
    title, confirmLabel: title, reasonRequired: next !== "visible", destructive: next === "removed",
    description: next === "visible" ? "리뷰를 다시 공개합니다. 평균 별점·리뷰 수에 다시 포함됩니다." : "soft delete 로 데이터는 보관되며 공개 목록·평균 별점에서 즉시 제외됩니다. 작성자에게 사유가 포함된 알림이 발송됩니다.",
    onConfirm: (reason) => adminRpc("admin_moderate_funding_review", { p_review_id: r.id, p_status: next, p_reason: reason || null }),
  });
  return (
    <Panel bodyClassName="p-0" title={
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="리뷰 내용, 닉네임, 펀딩명, 주문번호" />
        <FilterChips value={status} onChange={setStatus} options={[{ value: "all", label: "전체" }, { value: "reported", label: "신고 미처리" }, { value: "visible", label: "노출" }, { value: "hidden", label: "숨김" }, { value: "removed", label: "삭제(보관)" }]} />
      </div>
    }>
      {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
      {loading && !data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="리뷰가 없습니다" /> : (
        <DataTable minWidth={1150} head={["펀딩", "리뷰", "작성자", "구매", "신고", "상태", "작성일", "관리"]}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-stone-50">
              <Td className="max-w-[160px] truncate text-xs">{r.funding_name}</Td>
              <Td className="max-w-[320px]">
                <p className="text-[11px] text-stone-400">★{r.rating}{r.edited_at ? " · 수정됨" : ""}</p>
                <p className={`line-clamp-2 text-sm ${r.status !== "visible" ? "text-stone-400" : ""}`}>{r.content}</p>
                <ReviewThumbs paths={r.image_paths} onOpen={(index) => setViewer({ paths: r.image_paths, index })} />
              </Td>
              <Td className="text-xs"><p>{r.nickname}</p><p className="font-mono text-[10px] text-stone-400">{r.order_number ?? "-"}</p></Td>
              <Td><StatusBadge tone={r.purchase_type === "mock" ? "amber" : "blue"}>{r.purchase_type === "mock" ? "모의결제" : "실결제"}</StatusBadge></Td>
              <Td className="tabular-nums text-xs">{r.report_count}{r.pending_report_count > 0 && <span className="ml-1 font-bold text-rose-600">(미처리 {r.pending_report_count})</span>}</Td>
              <Td><MappedBadge map={REVIEW_STATUS} value={r.status} />{!r.is_public && r.status === "visible" && <p className="mt-0.5 text-[10px] text-stone-400">비공개(집계 제외)</p>}{r.moderation_reason && <p className="mt-0.5 max-w-[160px] truncate text-[10px] text-stone-400">{r.moderated_by_name} · {r.moderation_reason}</p>}</Td>
              <Td className="text-xs">{dateTime(r.created_at)}</Td>
              <Td>{can("content.manage") && <div className="flex gap-1">
                {r.status !== "visible" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => moderate(r, "visible", "공개 복구")}>복구</Button>}
                {r.status === "visible" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => moderate(r, "hidden", "숨김")}>숨김</Button>}
                {r.status !== "removed" && <Button size="sm" variant="outline" className="h-7 text-xs text-rose-600" onClick={() => moderate(r, "removed", "삭제")}>삭제</Button>}
              </div>}</Td>
            </tr>
          ))}
        </DataTable>
      )}
      <div className="px-4 pb-3 text-[11px] text-stone-400">총 {totalOf(rows)}건</div>
      <ReasonDialog state={dialog} onClose={() => setDialog(null)} onDone={reload} />
      <ReviewPhotoViewer state={viewer} onClose={() => setViewer(null)} />
    </Panel>
  );
};

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
    can("content.view") && { key: "review-reports", label: "리뷰 신고", node: <FundingReviewReportsTab /> },
    can("content.view") && { key: "reviews", label: "펀딩 리뷰", node: <FundingReviewsTab /> },
    can("cs.view") && { key: "tickets", label: "CS 문의", node: <TicketsTab /> },
    can("content.view") && { key: "comments", label: "댓글", node: <CommentsTab /> },
    can("content.manage") && { key: "posts", label: "게시물", node: <PostsTab /> },
  ].filter(Boolean) as { key: string; label: string; node: JSX.Element }[];

  return (
    <div>
      <PageHeader eyebrow="Content & CS" title="콘텐츠 · 신고 · 문의" description="댓글/게시물/리뷰 삭제는 soft delete 로 처리되며 삭제한 관리자·시각·사유가 기록됩니다." />
      <div className="mb-3"><Notice tone="stone">펀딩 구매 리뷰는 [리뷰 신고] · [펀딩 리뷰] 탭에서 관리합니다. 숨김·삭제는 soft delete 로 보관되며 평균 별점·리뷰 수는 공개 리뷰 기준으로 즉시 다시 계산됩니다.</Notice></div>
      <Tabs defaultValue={tabs[0]?.key}>
        <TabsList className="mb-3">{tabs.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}</TabsList>
        {tabs.map((t) => <TabsContent key={t.key} value={t.key}>{t.node}</TabsContent>)}
      </Tabs>
    </div>
  );
};

export default ContentPage;
