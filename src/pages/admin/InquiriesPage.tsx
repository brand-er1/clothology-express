import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, EyeOff, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { adminRpc } from "@/services/adminApi";
import {
  ANSWER_ROLE_LABEL, INQUIRY_TYPES, INQUIRY_TYPE_LABEL, answerFundingInquiry, setFundingInquiryStatus, signInquiryImages,
  type AnswerRole, type InquiryStatus, type InquiryType,
} from "@/services/fundingInquiries";
import { FUNDING_PHASE, dateTime, errorMessage, num, type Tone } from "@/lib/admin/format";
import {
  DataTable, DefinitionGrid, EmptyState, ErrorBanner, FilterChips, LoadingBlock, Notice, PageHeader, Pager, Panel, SearchInput, StatusBadge, Td,
} from "@/components/admin/shell/ui";
import { ReasonDialog, type ReasonDialogState } from "@/components/admin/shell/ReasonDialog";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { useAdminContext } from "@/components/admin/shell/AdminContext";

type StatusFilter = "all" | "pending" | "answered" | "hidden";

type InquiryRow = {
  id: string;
  funding_id: string;
  funding_name: string;
  brand_name: string | null;
  creator_id: string;
  creator_name: string | null;
  author_id: string;
  nickname: string;
  author_username: string | null;
  author_name: string | null;
  inquiry_type: InquiryType;
  title: string;
  is_private: boolean;
  is_hidden: boolean;
  status: InquiryStatus;
  answer_role: AnswerRole | null;
  image_count: number;
  created_at: string;
  answered_at: string | null;
};

type InquiryListResult = {
  total: number;
  counts: Record<StatusFilter, number>;
  rows: InquiryRow[];
};

type InquiryDetail = Omit<InquiryRow, "image_count" | "answer_role" | "answered_at"> & {
  funding_status: string;
  content: string;
  image_paths: string[];
  hidden_reason: string | null;
  hidden_at: string | null;
  hidden_by_name: string | null;
  updated_at: string;
  answer: { content: string; role: AnswerRole; author_name: string | null; answered_at: string; updated_at: string | null } | null;
  can_manage: boolean;
  can_moderate: boolean;
};

type Option = { id: string; name: string };
type FilterOptions = { creators: Option[]; brands: Option[]; fundings: Option[] };

const PAGE_SIZE = 30;

const STATUS_BADGE: Record<InquiryStatus, { label: string; tone: Tone }> = {
  pending: { label: "미답변", tone: "amber" },
  answered: { label: "답변 완료", tone: "green" },
};

const selectClass = "h-9 min-w-0 rounded-xl border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-700";

const InquiryDetailSheet = ({ inquiryId, onClose, onChanged }: { inquiryId: string | null; onClose: () => void; onChanged: () => void }) => {
  const { data, loading, error, reload } = useAdminQuery(
    () => (inquiryId ? adminRpc<InquiryDetail>("admin_get_funding_inquiry", { p_inquiry_id: inquiryId }) : Promise.resolve(null)),
    [inquiryId],
  );
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<ReasonDialogState>(null);

  useEffect(() => {
    setAnswer(data?.answer?.content ?? "");
    setSigned({});
    if (data?.image_paths.length) void signInquiryImages(data.image_paths).then(setSigned);
  }, [data]);

  const refresh = () => { void reload(); onChanged(); };

  const saveAnswer = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await answerFundingInquiry(data.id, answer.trim());
      toast({ title: data.answer ? "답변을 수정했습니다" : "BRAND-ER 관리자 답변을 등록했습니다", description: data.answer ? undefined : "문의 작성자에게 사이트 알림을 보냈습니다." });
      refresh();
    } catch (saveError) {
      toast({ title: "답변을 저장하지 못했습니다", description: errorMessage(saveError), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await setFundingInquiryStatus(data.id, data.status === "answered" ? "pending" : "answered");
      refresh();
    } catch (statusError) {
      toast({ title: "상태를 바꾸지 못했습니다", description: errorMessage(statusError), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const moderate = (hidden: boolean) => data && setDialog({
    title: hidden ? "부적절한 문의 숨김" : "문의 숨김 해제",
    description: hidden
      ? "숨긴 문의는 공개 목록에서 사라지고 작성자·담당 제작자·관리자에게만 보입니다. 삭제되지 않으며 Audit Log 에 기록됩니다."
      : "문의를 다시 원래 공개 범위로 되돌립니다.",
    confirmLabel: hidden ? "숨김 처리" : "숨김 해제",
    destructive: hidden,
    reasonRequired: hidden,
    reasonLabel: hidden ? "숨김 사유" : "메모",
    onConfirm: (reason) => adminRpc("admin_set_funding_inquiry_hidden", { p_inquiry_id: data.id, p_hidden: hidden, p_reason: reason }),
    successMessage: hidden ? "숨김 처리했습니다" : "숨김을 해제했습니다",
  });

  return (
    <Sheet open={Boolean(inquiryId)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>문의 상세</SheetTitle>
          <SheetDescription>비공개 문의도 관리자에게는 전체 내용이 보입니다.</SheetDescription>
        </SheetHeader>
        {error && <div className="mt-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? <LoadingBlock /> : data && (
          <div className="mt-5 grid gap-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge tone={STATUS_BADGE[data.status].tone}>{STATUS_BADGE[data.status].label}</StatusBadge>
              <StatusBadge>{INQUIRY_TYPE_LABEL[data.inquiry_type]}</StatusBadge>
              {data.is_private && <StatusBadge tone="violet"><Lock className="mr-1 h-3 w-3" />비공개</StatusBadge>}
              {data.is_hidden && <StatusBadge tone="red"><EyeOff className="mr-1 h-3 w-3" />숨김</StatusBadge>}
            </div>
            <DefinitionGrid items={[
              { label: "펀딩", value: <Link to={`/fundings/${data.funding_id}?tab=inquiry`} target="_blank" className="inline-flex items-center gap-1 text-[#741b2b] hover:underline">{data.funding_name}<ArrowUpRight className="h-3.5 w-3.5" /></Link> },
              { label: "펀딩 상태", value: FUNDING_PHASE[data.funding_status]?.label ?? data.funding_status },
              { label: "브랜드", value: data.brand_name ?? "-" },
              { label: "담당 제작자", value: data.creator_name ?? "-" },
              { label: "작성자 (공개 닉네임)", value: data.nickname },
              { label: "작성자 아이디 / 이름", value: `${data.author_username ?? "-"} / ${data.author_name ?? "-"}` },
              { label: "회원 ID", value: <span className="font-mono text-xs">{data.author_id}</span> },
              { label: "작성일", value: dateTime(data.created_at) },
            ]} />
            {data.is_hidden && (
              <Notice tone="stone">숨김 사유: {data.hidden_reason ?? "-"} · {data.hidden_by_name ?? "-"} · {dateTime(data.hidden_at)}</Notice>
            )}
            <div>
              <p className="text-sm font-extrabold">{data.title}</p>
              <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-stone-50 p-3 text-sm leading-6">{data.content}</p>
              {data.image_paths.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.image_paths.map((path, index) => signed[path] ? (
                    <a key={path} href={signed[path]} target="_blank" rel="noreferrer">
                      <img src={signed[path]} alt={`첨부 사진 ${index + 1}`} className="h-24 w-24 rounded-lg border border-stone-200 object-cover" />
                    </a>
                  ) : <span key={path} className="flex h-24 w-24 items-center justify-center rounded-lg border border-stone-200 text-[11px] text-stone-400">사진</span>)}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-stone-200 p-4">
              <p className="text-xs font-bold text-stone-500">답변</p>
              {data.answer ? (
                <div className="mt-2">
                  <StatusBadge tone="wine">{ANSWER_ROLE_LABEL[data.answer.role]}</StatusBadge>
                  <span className="ml-2 text-[11px] text-stone-400">{data.answer.author_name ?? "-"} · {dateTime(data.answer.updated_at ?? data.answer.answered_at)}</span>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{data.answer.content}</p>
                </div>
              ) : <p className="mt-2 text-sm text-stone-400">아직 답변이 없습니다.</p>}
              {data.can_manage ? (
                <div className="mt-4 grid gap-2">
                  <Textarea value={answer} onChange={(event) => setAnswer(event.target.value.slice(0, 3000))} rows={5}
                    placeholder="BRAND-ER 관리자 답변으로 고객에게 표시됩니다." />
                  <div className="flex flex-wrap justify-end gap-2">
                    {data.answer && (
                      <Button size="sm" variant="outline" disabled={saving} onClick={() => void toggleStatus()}>
                        {data.status === "answered" ? "미답변으로 표시" : "답변 완료로 표시"}
                      </Button>
                    )}
                    <Button size="sm" className="bg-[#741b2b] hover:bg-[#5d1622]" disabled={saving || answer.trim().length < 2} onClick={() => void saveAnswer()}>
                      {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}{data.answer ? "관리자 답변으로 수정" : "관리자 답변 등록"}
                    </Button>
                  </div>
                </div>
              ) : <p className="mt-3 text-[11px] text-stone-400">답변 작성은 cs.manage 권한이 필요합니다.</p>}
            </div>

            {data.can_moderate && (
              <div className="flex justify-end">
                {data.is_hidden
                  ? <Button size="sm" variant="outline" onClick={() => moderate(false)}>숨김 해제</Button>
                  : <Button size="sm" variant="outline" className="text-rose-600" onClick={() => moderate(true)}><EyeOff className="mr-1 h-3.5 w-3.5" />부적절한 문의 숨김</Button>}
              </div>
            )}
          </div>
        )}
        <ReasonDialog state={dialog} onClose={() => setDialog(null)} onDone={refresh} />
      </SheetContent>
    </Sheet>
  );
};

const InquiriesPage = () => {
  const { can } = useAdminContext();
  const [params, setParams] = useSearchParams();
  const status = (["all", "pending", "answered", "hidden"].includes(params.get("status") ?? "") ? params.get("status") : "all") as StatusFilter;
  const [search, setSearch] = useState("");
  const [creator, setCreator] = useState("");
  const [brand, setBrand] = useState("");
  const [funding, setFunding] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => setPage(0), [status, search, creator, brand, funding, type, from, to]);

  const options = useAdminQuery(() => adminRpc<FilterOptions>("admin_inquiry_filter_options"), []);
  const { data, loading, error, reload } = useAdminQuery(
    () => adminRpc<InquiryListResult>("admin_list_funding_inquiries", {
      p_status: status,
      p_creator_id: creator || null,
      p_brand_id: brand || null,
      p_funding_id: funding || null,
      p_type: type || null,
      p_from: from || null,
      p_to: to || null,
      p_search: search || null,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
    }),
    [status, search, creator, brand, funding, type, from, to, page],
  );
  const counts = data?.counts;
  const rows = data?.rows ?? [];

  const setStatus = (value: StatusFilter) => {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("status"); else next.set("status", value);
    setParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader eyebrow="Customer Inquiries" title="고객 문의 관리"
        description="펀딩 상세페이지 [상품 문의]로 접수된 모든 문의와 답변 현황입니다. 제작자 답변과 BRAND-ER 관리자 답변이 구분되어 고객에게 표시됩니다." />
      {counts && counts.pending > 0 && (
        <div className="mb-4"><Notice>미답변 문의 {num(counts.pending)}건이 있습니다. 오래된 문의부터 확인해주세요.</Notice></div>
      )}
      <Panel bodyClassName="p-0" title={
        <div className="grid gap-2">
          <FilterChips value={status} onChange={(value) => setStatus(value as StatusFilter)} options={[
            { value: "all", label: "전체", count: counts?.all },
            { value: "pending", label: "미답변", count: counts?.pending },
            { value: "answered", label: "답변 완료", count: counts?.answered },
            { value: "hidden", label: "숨김", count: counts?.hidden },
          ]} />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <SearchInput value={search} onChange={setSearch} placeholder="고객 닉네임 · 아이디 · 제목" className="col-span-2 sm:w-64" />
            <select className={selectClass} value={creator} onChange={(event) => setCreator(event.target.value)} aria-label="제작자별">
              <option value="">전체 제작자</option>
              {options.data?.creators.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <select className={selectClass} value={brand} onChange={(event) => setBrand(event.target.value)} aria-label="브랜드별">
              <option value="">전체 브랜드</option>
              {options.data?.brands.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <select className={selectClass} value={funding} onChange={(event) => setFunding(event.target.value)} aria-label="펀딩별">
              <option value="">전체 펀딩</option>
              {options.data?.fundings.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <select className={selectClass} value={type} onChange={(event) => setType(event.target.value)} aria-label="문의 유형별">
              <option value="">전체 유형</option>
              {INQUIRY_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-9 rounded-xl text-xs sm:w-36" aria-label="시작일" />
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-9 rounded-xl text-xs sm:w-36" aria-label="종료일" />
          </div>
        </div>
      }>
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="조건에 맞는 문의가 없습니다" /> : (
          <>
            <DataTable minWidth={1100} head={["상태", "유형", "제목", "펀딩 · 브랜드", "작성자", "담당 제작자", "작성일", "답변"]}>
              {rows.map((row) => (
                <tr key={row.id} className="cursor-pointer hover:bg-stone-50" onClick={() => setOpenId(row.id)}>
                  <Td>
                    <StatusBadge tone={STATUS_BADGE[row.status].tone}>{STATUS_BADGE[row.status].label}</StatusBadge>
                    {row.is_hidden && <StatusBadge tone="red" className="ml-1">숨김</StatusBadge>}
                  </Td>
                  <Td className="text-xs">{INQUIRY_TYPE_LABEL[row.inquiry_type]}</Td>
                  <Td>
                    <p className="flex max-w-[260px] items-center gap-1 truncate font-bold">
                      {row.is_private && <Lock className="h-3.5 w-3.5 shrink-0 text-violet-500" aria-label="비공개" />}{row.title}
                    </p>
                    {row.image_count > 0 && <p className="text-[11px] text-stone-400">사진 {row.image_count}장</p>}
                  </Td>
                  <Td><p className="max-w-[200px] truncate text-xs font-semibold">{row.funding_name}</p><p className="text-[11px] text-stone-400">{row.brand_name ?? "-"}</p></Td>
                  <Td><p className="text-xs font-semibold">{row.nickname}</p><p className="text-[11px] text-stone-400">{row.author_username ?? "-"}</p></Td>
                  <Td className="text-xs">{row.creator_name ?? "-"}</Td>
                  <Td className="whitespace-nowrap text-xs">{dateTime(row.created_at)}</Td>
                  <Td className="text-xs">{row.answer_role ? ANSWER_ROLE_LABEL[row.answer_role] : "-"}</Td>
                </tr>
              ))}
            </DataTable>
            <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </Panel>
      {!can("cs.manage") && <p className="mt-3 text-xs text-stone-400">현재 등급은 문의 조회만 가능합니다. 답변은 CS Admin / Super Admin 이 작성할 수 있습니다.</p>}
      <InquiryDetailSheet inquiryId={openId} onClose={() => setOpenId(null)} onChanged={() => void reload()} />
    </div>
  );
};

export default InquiriesPage;
