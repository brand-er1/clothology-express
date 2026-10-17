import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck, ChevronDown, EyeOff, ImagePlus, Loader2, Lock, MessageCircleQuestion, PenLine, ShieldCheck, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  ANSWER_ROLE_LABEL, INQUIRY_TYPES, INQUIRY_TYPE_LABEL, MAX_INQUIRY_IMAGES,
  answerFundingInquiry, createFundingInquiry, deleteMyFundingInquiry, fetchFundingInquiries, fetchMyLegacyFundingInquiries,
  setFundingInquiryStatus, signInquiryImages, updateMyFundingInquiry, validateInquiryImage,
  type FundingInquiry, type InquiryFilter, type InquiryList, type InquiryType, type LegacyFundingInquiry,
} from "@/services/fundingInquiries";

const PAGE_SIZE = 10;

const LEGACY_STATUS: Record<LegacyFundingInquiry["status"], string> = {
  open: "접수", in_progress: "확인 중", waiting_customer: "답변 대기", resolved: "답변 완료", closed: "종료",
};

const formatDate = (value: string) => new Date(value).toLocaleDateString("ko-KR");
const errorText = (error: unknown) => (error instanceof Error ? error.message : undefined);

// ---------------------------------------------------------------------------
// 문의 작성 · 수정
// ---------------------------------------------------------------------------

type EditorTarget = { mode: "create" } | { mode: "edit"; inquiry: FundingInquiry };

const InquiryEditorDialog = ({ fundingId, target, signed, onClose, onSaved }: {
  fundingId: string;
  target: EditorTarget | null;
  signed: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const editing = target?.mode === "edit" ? target.inquiry : null;
  const [inquiryType, setInquiryType] = useState<InquiryType>("size_fit");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [keepPaths, setKeepPaths] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInquiryType(editing?.inquiry_type ?? "size_fit");
    setTitle(editing?.title ?? "");
    setContent(editing?.content ?? "");
    setIsPrivate(editing?.is_private ?? false);
    setKeepPaths(editing?.image_paths ?? []);
    setFiles([]);
  }, [target, editing]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const imageCount = keepPaths.length + files.length;
  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      const invalid = validateInquiryImage(file);
      if (invalid) { toast({ title: invalid, variant: "destructive" }); continue; }
      if (keepPaths.length + next.length >= MAX_INQUIRY_IMAGES) {
        toast({ title: `사진은 최대 ${MAX_INQUIRY_IMAGES}장까지 첨부할 수 있습니다.`, variant: "destructive" });
        break;
      }
      next.push(file);
    }
    setFiles(next);
    if (fileInput.current) fileInput.current.value = "";
  };

  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  const invalid = trimmedTitle.length < 2 || trimmedTitle.length > 100 || trimmedContent.length < 5 || trimmedContent.length > 3000;

  const submit = async () => {
    if (!target || invalid) return;
    setSaving(true);
    const draft = { inquiryType, title: trimmedTitle, content: trimmedContent, isPrivate, keepPaths, files };
    try {
      if (editing) {
        await updateMyFundingInquiry(editing.id, draft);
        toast({ title: "문의를 수정했습니다" });
      } else {
        await createFundingInquiry(fundingId, draft);
        toast({ title: "문의를 등록했습니다", description: "제작자가 확인 후 답변을 남겨드립니다." });
      }
      onSaved();
      onClose();
    } catch (error) {
      toast({ title: editing ? "문의를 수정하지 못했습니다" : "문의를 등록하지 못했습니다", description: errorText(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto rounded-none border-black/10 bg-[#f6f3ee]">
        <DialogHeader>
          <DialogTitle>{editing ? "문의 수정하기" : "상품 문의하기"}</DialogTitle>
          <DialogDescription>답변이 등록되기 전까지 수정·삭제할 수 있습니다.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <div>
            <p className="text-sm font-semibold">문의 유형 <span className="text-red-600">*</span></p>
            <div className="mt-2 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="문의 유형">
              {INQUIRY_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  role="radio"
                  aria-checked={inquiryType === type.value}
                  onClick={() => setInquiryType(type.value)}
                  className={cn("min-h-10 border px-3 text-left text-sm transition",
                    inquiryType === type.value ? "border-brand bg-brand text-white" : "border-black/15 bg-white text-stone-700 hover:border-brand/50")}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="inquiry-title" className="text-sm font-semibold">제목 <span className="text-red-600">*</span></label>
            <Input id="inquiry-title" value={title} onChange={(event) => setTitle(event.target.value.slice(0, 100))}
              placeholder="예: 175cm 에 L 사이즈가 맞을까요?" className="mt-2 rounded-none border-black/15 bg-white" />
          </div>
          <div>
            <label htmlFor="inquiry-content" className="text-sm font-semibold">문의 내용 <span className="text-red-600">*</span></label>
            <Textarea id="inquiry-content" value={content} onChange={(event) => setContent(event.target.value.slice(0, 3000))} rows={6}
              placeholder="궁금한 내용을 5자 이상 남겨주세요. 연락처·주소 등 개인정보는 적지 마세요."
              className="mt-2 resize-y rounded-none border-black/15 bg-white" />
            <p className="mt-1 text-right text-xs text-stone-400">{trimmedContent.length}/3000</p>
          </div>
          <div>
            <p className="text-sm font-semibold">사진 첨부 <span className="font-normal text-stone-400">(선택 · 최대 {MAX_INQUIRY_IMAGES}장 · 장당 5MB)</span></p>
            <div className="mt-2 flex flex-wrap gap-2">
              {keepPaths.map((path, index) => (
                <div key={path} className="relative h-20 w-20 overflow-hidden border border-black/10 bg-white">
                  {signed[path] && <img src={signed[path]} alt={`첨부 사진 ${index + 1}`} className="h-full w-full object-cover" />}
                  <button type="button" aria-label={`첨부 사진 ${index + 1} 삭제`} onClick={() => setKeepPaths((current) => current.filter((item) => item !== path))}
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {previews.map((url, index) => (
                <div key={url} className="relative h-20 w-20 overflow-hidden border border-black/10 bg-white">
                  <img src={url} alt={`새 첨부 사진 ${index + 1}`} className="h-full w-full object-cover" />
                  <button type="button" aria-label={`새 첨부 사진 ${index + 1} 삭제`} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {imageCount < MAX_INQUIRY_IMAGES && (
                <button type="button" onClick={() => fileInput.current?.click()}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 border border-dashed border-black/25 bg-white text-xs text-stone-500 hover:border-brand hover:text-brand">
                  <ImagePlus className="h-5 w-5" />사진 추가
                </button>
              )}
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => addFiles(event.target.files)} />
            </div>
          </div>
          <label className="flex items-center justify-between gap-4 border border-black/10 bg-white px-4 py-3">
            <span>
              <span className="flex items-center gap-1.5 text-sm font-semibold"><Lock className="h-4 w-4 text-brand" />비공개 문의</span>
              <span className="mt-0.5 block text-xs text-stone-500">켜면 나와 담당 제작자, BRAND-ER 관리자만 내용을 볼 수 있습니다.</span>
            </span>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} aria-label="비공개 문의" />
          </label>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-none" disabled={saving} onClick={onClose}>취소</Button>
          <Button className="rounded-none bg-brand hover:bg-brand-dark" disabled={saving || invalid} onClick={() => void submit()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? "수정 완료" : "문의 등록"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// 제작자 답변
// ---------------------------------------------------------------------------

const AnswerBox = ({ inquiry, onSaved }: { inquiry: FundingInquiry; onSaved: () => void }) => {
  const [editing, setEditing] = useState(!inquiry.answer);
  const [content, setContent] = useState(inquiry.answer?.content ?? "");
  const [saving, setSaving] = useState(false);
  const lockedByAdmin = inquiry.answer?.role === "admin";

  useEffect(() => {
    setEditing(!inquiry.answer);
    setContent(inquiry.answer?.content ?? "");
  }, [inquiry.answer]);

  const save = async () => {
    setSaving(true);
    try {
      await answerFundingInquiry(inquiry.id, content.trim());
      toast({ title: inquiry.answer ? "답변을 수정했습니다" : "답변을 등록했습니다", description: inquiry.answer ? undefined : "문의 작성자에게 알림을 보냈습니다." });
      onSaved();
    } catch (error) {
      toast({ title: "답변을 저장하지 못했습니다", description: errorText(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    setSaving(true);
    try {
      await setFundingInquiryStatus(inquiry.id, inquiry.status === "answered" ? "pending" : "answered");
      onSaved();
    } catch (error) {
      toast({ title: "상태를 바꾸지 못했습니다", description: errorText(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 border-t border-dashed border-black/15 pt-4">
      {editing && !lockedByAdmin ? (
        <div className="grid gap-2">
          <label htmlFor={`answer-${inquiry.id}`} className="text-xs font-semibold text-stone-600">제작자 답변 작성</label>
          <Textarea id={`answer-${inquiry.id}`} value={content} onChange={(event) => setContent(event.target.value.slice(0, 3000))} rows={4}
            placeholder="고객에게 보일 답변을 입력해주세요." className="resize-y rounded-none border-black/15 bg-white" />
          <div className="flex flex-wrap justify-end gap-2">
            {inquiry.answer && <Button size="sm" variant="outline" className="rounded-none" disabled={saving} onClick={() => setEditing(false)}>취소</Button>}
            <Button size="sm" className="rounded-none bg-brand hover:bg-brand-dark" disabled={saving || content.trim().length < 2} onClick={() => void save()}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}{inquiry.answer ? "답변 수정" : "답변 등록"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {lockedByAdmin && <span className="mr-auto text-xs text-stone-500">BRAND-ER 관리자가 답변한 문의입니다.</span>}
          {!lockedByAdmin && <Button size="sm" variant="outline" className="rounded-none" disabled={saving} onClick={() => setEditing(true)}><PenLine className="mr-1.5 h-3.5 w-3.5" />답변 수정</Button>}
          <Button size="sm" variant="outline" className="rounded-none" disabled={saving} onClick={() => void toggleStatus()}>
            {inquiry.status === "answered" ? "미답변으로 표시" : "답변 완료로 표시"}
          </Button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 문의 한 건
// ---------------------------------------------------------------------------

const InquiryItem = ({ inquiry, canAnswer, signed, onEdit, onDelete, onChanged }: {
  inquiry: FundingInquiry;
  canAnswer: boolean;
  signed: Record<string, string>;
  onEdit: (inquiry: FundingInquiry) => void;
  onDelete: (inquiry: FundingInquiry) => void;
  onChanged: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const answered = inquiry.status === "answered";
  return (
    <li className="border-b border-black/10">
      <button type="button" onClick={() => inquiry.can_view && setOpen((value) => !value)} aria-expanded={open}
        className={cn("grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-4 text-left", inquiry.can_view ? "cursor-pointer" : "cursor-default")}>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
            <span className={cn("px-1.5 py-0.5", answered ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
              {answered ? "답변 완료" : "미답변"}
            </span>
            <span className="bg-black/5 px-1.5 py-0.5 text-stone-600">{INQUIRY_TYPE_LABEL[inquiry.inquiry_type] ?? "기타 문의"}</span>
            {inquiry.is_hidden && <span className="inline-flex items-center gap-1 bg-rose-50 px-1.5 py-0.5 text-rose-700"><EyeOff className="h-3 w-3" />숨김 처리됨</span>}
          </span>
          <span className={cn("text-wrap-anywhere mt-2 flex items-center gap-1.5 text-sm font-semibold", !inquiry.can_view && "text-stone-400")}>
            {inquiry.is_private && <Lock className="h-3.5 w-3.5 shrink-0 text-stone-400" aria-label="비공개" />}
            {inquiry.title}
          </span>
          <span className="mt-1 flex flex-wrap gap-x-2 text-xs text-stone-500">
            <span>{inquiry.nickname}{inquiry.is_mine ? " (나)" : ""}</span>
            <span aria-hidden>·</span>
            <time dateTime={inquiry.created_at}>{formatDate(inquiry.created_at)}</time>
          </span>
        </span>
        {inquiry.can_view && <ChevronDown className={cn("mt-1 h-4 w-4 text-stone-400 transition", open && "rotate-180")} />}
      </button>

      {open && inquiry.can_view && (
        <div className="pb-5">
          {inquiry.is_hidden && (
            <p className="mb-3 bg-rose-50 px-3 py-2 text-xs text-rose-700">BRAND-ER 운영 정책에 따라 다른 고객에게 보이지 않도록 숨김 처리된 문의입니다.</p>
          )}
          <p className="text-wrap-anywhere whitespace-pre-wrap bg-white/70 px-4 py-3 text-sm leading-7">{inquiry.content}</p>
          {inquiry.image_paths.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {inquiry.image_paths.map((path, index) => signed[path] ? (
                <a key={path} href={signed[path]} target="_blank" rel="noreferrer" className="shrink-0">
                  <img src={signed[path]} alt={`문의 첨부 사진 ${index + 1}`} loading="lazy" className="h-24 w-24 border border-black/10 object-cover" />
                </a>
              ) : (
                <span key={path} className="flex h-24 w-24 shrink-0 items-center justify-center border border-black/10 bg-white text-[11px] text-stone-400">사진</span>
              ))}
            </div>
          )}
          {inquiry.is_mine && inquiry.can_edit && (
            <div className="mt-3 flex gap-3 text-xs">
              <button type="button" onClick={() => onEdit(inquiry)} className="inline-flex items-center gap-1 text-stone-500 hover:text-brand"><PenLine className="h-3.5 w-3.5" />수정</button>
              <button type="button" onClick={() => onDelete(inquiry)} className="inline-flex items-center gap-1 text-stone-500 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" />삭제</button>
            </div>
          )}

          {inquiry.answer && (
            <div className="mt-4 border-l-2 border-brand bg-brand/5 px-4 py-3">
              <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-brand">
                {inquiry.answer.role === "admin" ? <ShieldCheck className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
                {ANSWER_ROLE_LABEL[inquiry.answer.role]}
                <span className="font-normal text-stone-500">
                  {formatDate(inquiry.answer.answered_at)}
                  {inquiry.answer.updated_at && inquiry.answer.updated_at !== inquiry.answer.answered_at ? " · 수정됨" : ""}
                </span>
              </p>
              <p className="text-wrap-anywhere mt-2 whitespace-pre-wrap text-sm leading-7">{inquiry.answer.content}</p>
            </div>
          )}
          {!inquiry.answer && !canAnswer && <p className="mt-4 text-xs text-stone-500">제작자가 확인 후 답변을 남겨드립니다.</p>}
          {canAnswer && <AnswerBox inquiry={inquiry} onSaved={onChanged} />}
        </div>
      )}
    </li>
  );
};

// ---------------------------------------------------------------------------
// 패널
// ---------------------------------------------------------------------------

export const FundingInquiriesPanel = ({ fundingId, loginReturnTo }: { fundingId: string; loginReturnTo: string }) => {
  const [filter, setFilter] = useState<InquiryFilter>("all");
  const [type, setType] = useState<InquiryType | null>(null);
  const [data, setData] = useState<InquiryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [legacy, setLegacy] = useState<LegacyFundingInquiry[]>([]);

  const signRows = useCallback(async (rows: FundingInquiry[]) => {
    const paths = rows.filter((row) => row.can_view).flatMap((row) => row.image_paths);
    const urls = await signInquiryImages(paths);
    setSigned((current) => ({ ...current, ...urls }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFundingInquiries(fundingId, filter, type, PAGE_SIZE, 0);
      setData(result);
      void signRows(result.rows);
    } catch (loadError) {
      setError(errorText(loadError) ?? "문의를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [fundingId, filter, type, signRows]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void fetchMyLegacyFundingInquiries(fundingId).then(setLegacy); }, [fundingId]);

  const loadMore = async () => {
    if (!data) return;
    setLoadingMore(true);
    try {
      const result = await fetchFundingInquiries(fundingId, filter, type, PAGE_SIZE, data.rows.length);
      setData({ ...result, rows: [...data.rows, ...result.rows] });
      void signRows(result.rows);
    } catch (moreError) {
      toast({ title: "문의를 더 불러오지 못했습니다", description: errorText(moreError), variant: "destructive" });
    } finally {
      setLoadingMore(false);
    }
  };

  const remove = async (inquiry: FundingInquiry) => {
    if (!window.confirm("문의를 삭제할까요? 삭제한 문의는 복구할 수 없습니다.")) return;
    try {
      await deleteMyFundingInquiry(inquiry.id);
      toast({ title: "문의를 삭제했습니다" });
      void load();
    } catch (deleteError) {
      toast({ title: "문의를 삭제하지 못했습니다", description: errorText(deleteError), variant: "destructive" });
    }
  };

  const viewer = data?.viewer;
  const filters: { value: InquiryFilter; label: string }[] = [
    { value: "all", label: "전체" },
    ...(viewer?.logged_in ? [{ value: "mine" as const, label: "내 문의" }] : []),
    { value: "pending", label: viewer?.can_answer ? `미답변 ${data?.pending ?? 0}` : "미답변" },
    { value: "answered", label: "답변 완료" },
  ];

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-black/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xl font-bold tracking-[-0.02em]"><MessageCircleQuestion className="h-5 w-5 text-brand" />상품 문의</p>
          <p className="mt-1 text-sm text-stone-500">
            {viewer?.can_answer
              ? "내 펀딩에 등록된 문의입니다. 비공개 문의도 확인하고 답변할 수 있습니다."
              : "사이즈·원단·제작·배송 등 궁금한 점을 제작자에게 직접 물어보세요."}
          </p>
        </div>
        {viewer?.can_ask && (
          <Button className="rounded-none bg-brand hover:bg-brand-dark" onClick={() => setEditor({ mode: "create" })}>
            <PenLine className="mr-1.5 h-4 w-4" />문의 작성하기
          </Button>
        )}
        {viewer && !viewer.logged_in && (
          <p className="text-sm text-stone-500">
            <Link to={loginReturnTo} className="font-semibold text-brand underline-offset-4 hover:underline">로그인</Link> 후 문의를 남길 수 있습니다.
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="문의 필터">
          {filters.map((option) => (
            <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}
              className={cn("min-h-9 px-3.5 text-sm font-semibold transition",
                filter === option.value ? "bg-[#211b1c] text-white" : "border border-black/10 bg-white/60 text-stone-600 hover:bg-white")}>
              {option.label}
            </button>
          ))}
        </div>
        <select value={type ?? ""} onChange={(event) => setType((event.target.value || null) as InquiryType | null)} aria-label="문의 유형"
          className="min-h-9 border border-black/10 bg-white/60 px-3 text-sm text-stone-700">
          <option value="">전체 유형</option>
          {INQUIRY_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      {error ? (
        <div className="py-12 text-center text-sm text-stone-500">
          {error} <button type="button" className="ml-1 font-semibold text-brand" onClick={() => void load()}>다시 시도</button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-stone-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />문의를 불러오는 중입니다</div>
      ) : !data || data.rows.length === 0 ? (
        <div className="py-14 text-center text-sm text-stone-500">
          <MessageCircleQuestion className="mx-auto mb-3 h-8 w-8 text-brand/40" />
          {filter === "mine" ? "이 펀딩에 남긴 문의가 없습니다." : "아직 등록된 문의가 없습니다."}
        </div>
      ) : (
        <>
          <ul className="mt-2 border-t border-black/10">
            {data.rows.map((inquiry) => (
              <InquiryItem key={inquiry.id} inquiry={inquiry} canAnswer={Boolean(viewer?.can_answer)} signed={signed}
                onEdit={(item) => setEditor({ mode: "edit", inquiry: item })} onDelete={(item) => void remove(item)} onChanged={() => void load()} />
            ))}
          </ul>
          {data.rows.length < data.total && (
            <div className="mt-6 text-center">
              <Button variant="outline" className="rounded-none border-black/20 bg-transparent" disabled={loadingMore} onClick={() => void loadMore()}>
                {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}문의 더보기 ({data.rows.length}/{data.total})
              </Button>
            </div>
          )}
        </>
      )}

      {legacy.length > 0 && (
        <div className="mt-10">
          <p className="text-sm font-semibold">이전에 고객센터로 접수한 문의</p>
          <p className="mt-1 text-xs text-stone-500">BRAND-ER 고객센터에서 확인 후 안내드립니다.</p>
          <ul className="mt-3 divide-y divide-black/10 border-y border-black/10">
            {legacy.map((item) => (
              <li key={item.id} className="py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-wrap-anywhere font-semibold">{item.subject}</p>
                  <span className={cn("shrink-0 px-1.5 py-0.5 text-[11px] font-bold",
                    ["resolved", "closed"].includes(item.status) ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                    {LEGACY_STATUS[item.status] ?? item.status}
                  </span>
                </div>
                <p className="text-wrap-anywhere mt-1 line-clamp-2 text-stone-500">{item.content}</p>
                <p className="mt-1 text-xs text-stone-400">{formatDate(item.created_at)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <InquiryEditorDialog fundingId={fundingId} target={editor} signed={signed} onClose={() => setEditor(null)} onSaved={() => void load()} />
    </div>
  );
};
