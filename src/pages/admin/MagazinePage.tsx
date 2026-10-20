import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ImageUp, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { dateTime, errorMessage } from "@/lib/admin/format";
import {
  DataTable, EmptyState, ErrorBanner, FilterChips, LoadingBlock, Notice, PageHeader, Panel, SearchInput, StatusBadge, Td,
} from "@/components/admin/shell/ui";
import { ReasonDialog, type ReasonDialogState } from "@/components/admin/shell/ReasonDialog";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { MagazineThumbnail } from "@/components/magazine/MagazineThumbnail";
import { formatMagazineDate, MAGAZINE_CATEGORY_LABEL, magazineArticlePath, type MagazineCategory } from "@/data/magazineArticles";
import {
  deleteMagazineArticle, listAdminMagazineArticles, removeMagazineImage, resolveThumbnail, saveMagazineArticle,
  setMagazineArticlePublished, uploadMagazineImage, type AdminMagazineArticle, type MagazineArticleInput,
} from "@/services/magazine";

type Status = "all" | "published" | "draft";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const URL_PATTERN = /^https?:\/\/\S+$/i;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

type FormState = Omit<MagazineArticleInput, "key_points"> & { key_points_text: string };

const emptyForm = (): FormState => ({
  slug: "",
  category: "press",
  title: "",
  publisher: "",
  published_at: today(),
  summary: "",
  key_points_text: "",
  brand_highlight: "",
  thumbnail_url: "",
  thumbnail_path: null,
  thumbnail_credit: "",
  external_url: "",
  is_published: false,
});

const toForm = (row: AdminMagazineArticle): FormState => ({
  slug: row.slug,
  category: row.category,
  title: row.title,
  publisher: row.publisher,
  published_at: row.published_at.slice(0, 10),
  summary: row.summary ?? "",
  key_points_text: (row.key_points ?? []).join("\n"),
  brand_highlight: row.brand_highlight ?? "",
  thumbnail_url: row.thumbnail_url ?? "",
  thumbnail_path: row.thumbnail_path,
  thumbnail_credit: row.thumbnail_credit ?? "",
  external_url: row.external_url ?? "",
  is_published: row.is_published,
});

const validate = (form: FormState): string | null => {
  if (!SLUG_PATTERN.test(form.slug.trim())) return "주소(slug)는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.";
  if (!form.title.trim()) return "기사 제목을 입력해주세요.";
  if (!form.publisher.trim()) return "언론사 이름을 입력해주세요.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.published_at)) return "발행일을 입력해주세요.";
  if (form.external_url.trim() && !URL_PATTERN.test(form.external_url.trim())) return "원문 URL 은 http:// 또는 https:// 로 시작해야 합니다.";
  if (form.thumbnail_url.trim() && !URL_PATTERN.test(form.thumbnail_url.trim())) return "썸네일 URL 은 http:// 또는 https:// 로 시작해야 합니다.";
  return null;
};

const Field = ({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) => (
  <label className="grid gap-1.5">
    <span className="text-xs font-bold text-stone-600">{label}{required && <span className="text-rose-600"> *</span>}</span>
    {children}
    {hint && <span className="text-[11px] leading-4 text-stone-400">{hint}</span>}
  </label>
);

const ArticleEditor = ({ article, open, onClose, onSaved }: {
  article: AdminMagazineArticle | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // 이번 편집에서 새로 올린 파일. 취소하거나 다른 파일로 바꾸면 정리한다.
  const uploadedPath = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(article ? toForm(article) : emptyForm());
    uploadedPath.current = null;
  }, [open, article]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const discardUpload = async () => {
    if (uploadedPath.current) await removeMagazineImage(uploadedPath.current).catch(() => undefined);
    uploadedPath.current = null;
  };

  const close = () => {
    if (saving || uploading) return;
    void discardUpload();
    onClose();
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ title: "JPG, PNG, WEBP 이미지만 올릴 수 있습니다", variant: "destructive" });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast({ title: "5MB 이하 이미지만 올릴 수 있습니다", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const path = await uploadMagazineImage(file);
      await discardUpload();
      uploadedPath.current = path;
      set("thumbnail_path", path);
    } catch (error) {
      toast({ title: "이미지를 올리지 못했습니다", description: errorMessage(error), variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const save = async () => {
    const problem = validate(form);
    if (problem) {
      toast({ title: problem, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { key_points_text, ...rest } = form;
      await saveMagazineArticle(article?.id ?? null, {
        ...rest,
        slug: rest.slug.trim(),
        key_points: key_points_text.split("\n").map((line) => line.trim()).filter(Boolean),
      });
      // 저장 성공 후, 교체된 이전 자체 호스팅 파일을 정리한다.
      if (article?.thumbnail_path && article.thumbnail_path !== form.thumbnail_path) {
        await removeMagazineImage(article.thumbnail_path).catch(() => undefined);
      }
      uploadedPath.current = null;
      toast({ title: article ? "기사를 수정했습니다" : "기사를 등록했습니다" });
      onSaved();
      onClose();
    } catch (error) {
      toast({ title: "저장하지 못했습니다", description: errorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const preview = resolveThumbnail({ thumbnail_path: form.thumbnail_path, thumbnail_url: form.thumbnail_url.trim() || null });

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{article ? "매거진 기사 수정" : "매거진 기사 등록"}</DialogTitle>
          <DialogDescription>
            원문 기사의 전문을 옮기지 말고 BRAND-ER 가 직접 작성한 요약만 입력하세요. 전체 기사는 ‘원문 기사 보기’ 버튼으로 연결됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="기사 제목" required>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={200} />
            </Field>
            <Field label="주소(slug)" required hint={`/magazine/${form.slug || "2026-10-20-publisher-topic"} · 영문 소문자·숫자·하이픈`}>
              <Input value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} maxLength={120} placeholder="2026-10-20-publisher-topic" />
            </Field>
            <Field label="언론사" required>
              <Input value={form.publisher} onChange={(e) => set("publisher", e.target.value)} maxLength={80} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="발행일" required>
                <Input type="date" value={form.published_at} onChange={(e) => set("published_at", e.target.value)} />
              </Field>
              <Field label="분류" required>
                <select
                  value={form.category}
                  onChange={(e) => set("category", e.target.value as MagazineCategory)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {Object.entries(MAGAZINE_CATEGORY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
            </div>
          </div>

          <Field label="외부 원문 URL" hint="상세페이지의 ‘원문 기사 보기’ 버튼이 이 주소로 연결됩니다.">
            <Input value={form.external_url ?? ""} onChange={(e) => set("external_url", e.target.value)} placeholder="https://" />
          </Field>

          <Field label="간략 소개(요약)" hint="목록 카드와 상세페이지 상단, 검색 결과 설명(description)에 쓰입니다. 1~2문장.">
            <Textarea value={form.summary} onChange={(e) => set("summary", e.target.value)} rows={3} maxLength={600} />
          </Field>

          <Field label="기사 주요 내용" hint="한 줄에 한 항목씩 입력합니다(최대 12개). 자체 요약으로 작성하세요.">
            <Textarea value={form.key_points_text} onChange={(e) => set("key_points_text", e.target.value)} rows={5} />
          </Field>

          <Field label="BRAND-ER 관련 핵심 내용" hint="상세페이지에서 강조 블록으로 표시됩니다.">
            <Textarea value={form.brand_highlight ?? ""} onChange={(e) => set("brand_highlight", e.target.value)} rows={3} maxLength={1000} />
          </Field>

          <div className="grid gap-4 rounded-xl border border-stone-200 p-4 sm:grid-cols-[180px_1fr]">
            <div className="overflow-hidden rounded-lg bg-stone-100">
              <MagazineThumbnail src={preview} publisher={form.publisher || "BRAND-ER"} alt="썸네일 미리보기" className="aspect-[4/3]" />
            </div>
            <div className="grid content-start gap-3">
              <Field label="썸네일 이미지 URL" hint="외부 이미지 주소. 이미지를 업로드하면 업로드한 파일이 우선합니다.">
                <Input value={form.thumbnail_url ?? ""} onChange={(e) => set("thumbnail_url", e.target.value)} placeholder="https://" />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
                <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
                  {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ImageUp className="mr-1.5 h-3.5 w-3.5" />}
                  {form.thumbnail_path ? "업로드 이미지 변경" : "이미지 업로드"}
                </Button>
                {form.thumbnail_path && (
                  <Button type="button" size="sm" variant="ghost" className="text-rose-600" onClick={() => { void discardUpload(); set("thumbnail_path", null); }}>
                    업로드 이미지 제거
                  </Button>
                )}
              </div>
              <p className="text-[11px] leading-4 text-amber-700">사용 권한이 확인된 이미지만 업로드하세요(JPG·PNG·WEBP, 5MB 이하).</p>
              <Field label="이미지 출처 표기" hint="비워 두면 언론사 이름으로 표시됩니다.">
                <Input value={form.thumbnail_credit ?? ""} onChange={(e) => set("thumbnail_credit", e.target.value)} maxLength={200} />
              </Field>
            </div>
          </div>

          <label className="flex items-center justify-between gap-4 rounded-xl border border-stone-200 px-4 py-3">
            <span>
              <span className="block text-sm font-bold">공개</span>
              <span className="text-xs text-stone-500">끄면 매거진 목록과 상세페이지에서 보이지 않습니다.</span>
            </span>
            <Switch checked={form.is_published} onCheckedChange={(checked) => set("is_published", checked)} />
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={close} disabled={saving || uploading}>취소</Button>
          <Button onClick={() => void save()} disabled={saving || uploading} className="bg-[#741b2b] hover:bg-[#5b1522]">
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{article ? "수정 저장" : "등록"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const MagazinePage = () => {
  const [status, setStatus] = useState<Status>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ open: boolean; article: AdminMagazineArticle | null }>({ open: false, article: null });
  const [dialog, setDialog] = useState<ReasonDialogState>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const { data, loading, error, reload } = useAdminQuery(() => listAdminMagazineArticles(status, search), [status, search]);
  const rows = data?.rows ?? [];
  const canManage = data?.can_manage ?? false;

  const togglePublished = async (article: AdminMagazineArticle) => {
    setToggling(article.id);
    try {
      await setMagazineArticlePublished(article.id, !article.is_published);
      toast({ title: article.is_published ? "비공개로 전환했습니다" : "공개했습니다" });
      reload();
    } catch (err) {
      toast({ title: "처리하지 못했습니다", description: errorMessage(err), variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  const remove = (article: AdminMagazineArticle) => setDialog({
    title: "기사 삭제",
    description: `‘${article.title}’ 기사를 삭제합니다. 상세페이지 주소도 더 이상 열리지 않습니다. 삭제 전 내용은 Audit Log 에 남습니다. 잠시 숨기려면 비공개 전환을 사용하세요.`,
    confirmLabel: "삭제",
    destructive: true,
    reasonLabel: "삭제 사유",
    onConfirm: (reason) => deleteMagazineArticle(article.id, reason),
    successMessage: "기사를 삭제했습니다",
  });

  return (
    <div>
      <PageHeader
        eyebrow="Magazine"
        title="매거진 관리"
        description="매거진(BRAND-ER NEWS)에 노출되는 언론보도 · 브랜드 뉴스 기사입니다. 최신 발행일 순으로 정렬됩니다."
        actions={canManage ? (
          <Button onClick={() => setEditing({ open: true, article: null })} className="bg-[#741b2b] hover:bg-[#5b1522]">
            <Plus className="mr-1.5 h-4 w-4" />기사 등록
          </Button>
        ) : undefined}
      />
      {data && !canManage && <div className="mb-4"><Notice tone="stone">조회 전용 권한입니다. 기사 등록·수정은 content.manage 권한이 필요합니다.</Notice></div>}
      <Panel bodyClassName="p-0" title={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="제목 · 언론사 · 주소" />
          <FilterChips value={status} onChange={(value) => setStatus(value as Status)} options={[
            { value: "all", label: "전체", count: data?.counts.all },
            { value: "published", label: "공개", count: data?.counts.published },
            { value: "draft", label: "비공개", count: data?.counts.draft },
          ]} />
        </div>
      }>
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="등록된 기사가 없습니다" /> : (
          <DataTable minWidth={980} head={["썸네일", "기사", "발행일", "상태", "수정일", "관리"]}>
            {rows.map((article) => (
              <tr key={article.id} className="align-top hover:bg-stone-50">
                <Td>
                  <div className="w-24 overflow-hidden rounded border border-stone-200">
                    <MagazineThumbnail src={resolveThumbnail(article)} publisher={article.publisher} alt="" className="aspect-[4/3]" />
                  </div>
                </Td>
                <Td>
                  <p className="text-[11px] font-semibold text-[#741b2b]">{MAGAZINE_CATEGORY_LABEL[article.category]} · {article.publisher}</p>
                  <p className="mt-0.5 line-clamp-2 max-w-[420px] text-sm font-bold leading-5">{article.title}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-stone-400">
                    {article.is_published ? (
                      <Link to={magazineArticlePath(article.slug)} target="_blank" className="inline-flex items-center gap-0.5 hover:text-[#741b2b]">/magazine/{article.slug}<ArrowUpRight className="h-3 w-3" /></Link>
                    ) : <span>/magazine/{article.slug}</span>}
                    {article.external_url && <a href={article.external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-[#741b2b]">원문<ArrowUpRight className="h-3 w-3" /></a>}
                  </div>
                </Td>
                <Td className="whitespace-nowrap text-xs font-semibold">{formatMagazineDate(article.published_at)}</Td>
                <Td><StatusBadge tone={article.is_published ? "green" : "neutral"}>{article.is_published ? "공개" : "비공개"}</StatusBadge></Td>
                <Td className="whitespace-nowrap text-xs">{dateTime(article.updated_at)}</Td>
                <Td>
                  {canManage ? (
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing({ open: true, article })}>수정</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={toggling === article.id} onClick={() => void togglePublished(article)}>
                        {article.is_published ? "비공개" : "공개"}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-rose-600" onClick={() => remove(article)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : <span className="text-xs text-stone-400">조회 전용</span>}
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
      <ArticleEditor article={editing.article} open={editing.open} onClose={() => setEditing({ open: false, article: null })} onSaved={reload} />
      <ReasonDialog state={dialog} onClose={() => setDialog(null)} onDone={reload} />
    </div>
  );
};

export default MagazinePage;
