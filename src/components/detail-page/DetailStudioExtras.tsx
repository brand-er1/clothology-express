import { useEffect, useRef, useState } from "react";
import { History, ImagePlus, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import {
  getDetailPageErrorMessage,
  listDetailPageReferences,
  listDetailPageVersions,
  removeDetailPageReference,
  updateDetailPageReference,
  uploadDetailPageReference,
} from "@/services/detailPage";
import type {
  AiQuota,
  DetailEmphasis,
  DetailPagePublishState,
  DetailPageVersion,
  DetailReference,
  DetailReferenceKind,
  DetailUserProvidedInfo,
  ProductDetailPage,
} from "@/types/detailPage";
import { cn } from "@/lib/utils";

/* ───────── 제작자 추가 정보 (브리프) ───────── */

export const EMPHASIS_OPTIONS: Array<{ value: DetailEmphasis; label: string }> = [
  { value: "design", label: "디자인" },
  { value: "fit", label: "핏" },
  { value: "fabric", label: "소재" },
  { value: "detail", label: "디테일" },
  { value: "process", label: "제작과정" },
  { value: "scarcity", label: "희소성" },
  { value: "price", label: "가격" },
  { value: "brand_story", label: "브랜드 스토리" },
];

const BRIEF_FIELDS: Array<{ key: "oneLiner" | "highlights" | "details" | "productionNote"; label: string; placeholder: string; multiline?: boolean; max: number }> = [
  { key: "oneLiner", label: "제품 한 줄 소개", placeholder: "예: 매일 입고 싶은 무게감의 오버핏 후드", max: 80 },
  { key: "highlights", label: "강조하고 싶은 특징", placeholder: "예: 등판 대형 자수 로고, 넉넉한 캥거루 포켓", multiline: true, max: 400 },
  { key: "details", label: "디테일 (실제 있는 것만)", placeholder: "예: 등판 자수, 소매 립 조직, YKK 지퍼", multiline: true, max: 400 },
  { key: "productionNote", label: "제작 방식", placeholder: "예: 국내 봉제 공장 소량 생산, 후가공 워싱", max: 200 },
];

/**
 * Creator brief for the AI. Everything typed here is treated as a verified fact (the only
 * facts the copy may state beyond the funding/design data). Empty fields are simply not used.
 */
export const CreatorBriefForm = ({
  value,
  onChange,
}: {
  value: DetailUserProvidedInfo;
  onChange: (next: DetailUserProvidedInfo) => void;
}) => {
  const emphasis = value.emphasis ?? [];
  const toggle = (option: DetailEmphasis) =>
    onChange({ ...value, emphasis: emphasis.includes(option) ? emphasis.filter((entry) => entry !== option) : [...emphasis, option] });
  return (
    <div className="space-y-4">
      {BRIEF_FIELDS.map((field) => {
        const id = `brief-${field.key}`;
        const current = (value[field.key] as string | undefined) ?? "";
        return (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={id} className="text-xs font-semibold text-stone-700">{field.label}</Label>
            {field.multiline ? (
              <Textarea id={id} value={current} maxLength={field.max} placeholder={field.placeholder}
                onChange={(event) => onChange({ ...value, [field.key]: event.target.value })}
                className="min-h-[72px] rounded-md text-base sm:text-sm" />
            ) : (
              <Input id={id} value={current} maxLength={field.max} placeholder={field.placeholder}
                onChange={(event) => onChange({ ...value, [field.key]: event.target.value })}
                className="h-11 rounded-md text-base sm:text-sm" />
            )}
          </div>
        );
      })}
      <div>
        <p className="text-xs font-semibold text-stone-700">강조할 요소 <span className="font-normal text-stone-400">(복수 선택)</span></p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EMPHASIS_OPTIONS.map((option) => {
            const active = emphasis.includes(option.value);
            return (
              <button key={option.value} type="button" aria-pressed={active} onClick={() => toggle(option.value)}
                className={cn("h-9 rounded-full border px-3 text-xs font-semibold transition", active ? "border-brand bg-brand text-white" : "border-stone-300 bg-white text-stone-600 hover:border-stone-500")}>
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ───────── 참고자료 업로드 ───────── */

export const REFERENCE_KIND_LABEL: Record<DetailReferenceKind, string> = {
  sample: "실제 샘플",
  fabric: "원단",
  detail: "디테일",
  wearing: "착용 사진",
  reference: "레퍼런스",
  logo: "로고",
  brand: "브랜드 이미지",
};

/**
 * Reference photos the AI may use for this page's images (sample/fabric/detail/worn/logo...).
 * Stored in the creator's own storage folder and linked to the page + its funding.
 */
export const ReferenceUploader = ({ page }: { page: Pick<ProductDetailPage, "id" | "fundingId"> }) => {
  const [references, setReferences] = useState<DetailReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<DetailReferenceKind>("sample");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    listDetailPageReferences(page.id)
      .then((rows) => { if (!cancelled) setReferences(rows); })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page.id]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 6)) {
        const created = await uploadDetailPageReference(page, file, kind);
        setReferences((current) => [...current, created]);
      }
    } catch (error) {
      toast({ title: "참고자료를 올리지 못했어요", description: getDetailPageErrorMessage(error), variant: "destructive" });
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  const patch = async (reference: DetailReference, next: Partial<DetailReference>) => {
    setReferences((current) => current.map((entry) => (entry.id === reference.id ? { ...entry, ...next } : entry)));
    try {
      await updateDetailPageReference(reference.id, { kind: next.kind, useForGeneration: next.useForGeneration });
    } catch (error) {
      setReferences((current) => current.map((entry) => (entry.id === reference.id ? reference : entry)));
      toast({ title: "변경하지 못했어요", description: getDetailPageErrorMessage(error), variant: "destructive" });
    }
  };

  const remove = async (reference: DetailReference) => {
    try {
      await removeDetailPageReference(reference.id);
      setReferences((current) => current.filter((entry) => entry.id !== reference.id));
    } catch (error) {
      toast({ title: "삭제하지 못했어요", description: getDetailPageErrorMessage(error), variant: "destructive" });
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="참고자료 종류" value={kind} onChange={(event) => setKind(event.target.value as DetailReferenceKind)}
          className="h-11 rounded-md border border-stone-300 bg-white px-2 text-sm">
          {Object.entries(REFERENCE_KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Button type="button" variant="outline" className="h-11 rounded-md" disabled={uploading} onClick={() => input.current?.click()}>
          {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-1.5 h-4 w-4" />}
          사진 올리기
        </Button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
          onChange={(event) => void upload(event.target.files)} />
      </div>
      <p className="mt-2 text-[11px] leading-4 text-stone-500">
        JPG·PNG·WEBP (PDF는 추후 지원). 실제 샘플·원단·디테일 사진을 올리면 AI 이미지가 실제 질감과 디테일을 더 정확히 따라갑니다. 로고는 원본 그대로 보존하는 참고로만 쓰입니다.
      </p>
      {loading ? (
        <Loader2 className="mt-3 h-4 w-4 animate-spin text-stone-400" />
      ) : references.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {references.map((reference) => (
            <li key={reference.id} className="min-w-0 border border-stone-200 bg-white">
              <img src={reference.url} alt={REFERENCE_KIND_LABEL[reference.kind]} className="aspect-square w-full object-cover" loading="lazy" />
              <div className="space-y-1 p-1.5">
                <select aria-label="종류 변경" value={reference.kind}
                  onChange={(event) => void patch(reference, { kind: event.target.value as DetailReferenceKind })}
                  className="h-7 w-full rounded border border-stone-200 bg-white px-1 text-[11px]">
                  {Object.entries(REFERENCE_KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <div className="flex items-center justify-between gap-1">
                  <label className="flex items-center gap-1 text-[10px] text-stone-500">
                    <Checkbox checked={reference.useForGeneration} onCheckedChange={(v) => void patch(reference, { useForGeneration: v === true })} className="h-3.5 w-3.5" />
                    AI 참고
                  </label>
                  <button type="button" onClick={() => void remove(reference)} className="rounded p-1 text-stone-400 hover:text-red-600" aria-label="참고자료 삭제">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ───────── 버전 이력 ───────── */

const VERSION_KIND_LABEL: Record<DetailPageVersion["kind"], string> = {
  ai_generated: "AI 최초 생성",
  manual_save: "제작자 수정 (임시저장)",
  image_regenerated: "이미지 재생성",
  copy_regenerated: "카피 재작성",
  published: "상세페이지 적용",
  restore_backup: "복구 전 자동 백업",
  migrated: "기존 상세페이지",
};

export const VersionHistoryDialog = ({
  pageId,
  open,
  onOpenChange,
  onRestore,
  readOnly = false,
}: {
  pageId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (version: DetailPageVersion) => Promise<void>;
  readOnly?: boolean;
}) => {
  const [versions, setVersions] = useState<DetailPageVersion[] | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setVersions(null);
    listDetailPageVersions(pageId)
      .then(setVersions)
      .catch((error) => {
        setVersions([]);
        toast({ title: "버전 이력을 불러오지 못했어요", description: getDetailPageErrorMessage(error), variant: "destructive" });
      });
  }, [open, pageId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto rounded-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History className="h-4 w-4" />버전 이력</DialogTitle>
          <DialogDescription>
            복구하면 현재 편집본을 먼저 자동 백업한 뒤 선택한 버전으로 되돌립니다. 고객에게 보이는 적용본은 “상세페이지 적용”을 눌러야 바뀝니다.
          </DialogDescription>
        </DialogHeader>
        {!versions ? (
          <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-stone-400" />
        ) : versions.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-500">아직 저장된 버전이 없어요.</p>
        ) : (
          <ol className="divide-y divide-stone-100 border-y border-stone-100">
            {versions.map((version) => (
              <li key={version.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold">
                    Version {version.version}
                    {version.isPublished && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">적용 중</span>}
                  </p>
                  <p className="truncate text-xs text-stone-500">{VERSION_KIND_LABEL[version.kind]}{version.note && version.note !== VERSION_KIND_LABEL[version.kind] ? ` · ${version.note}` : ""}</p>
                  <p className="text-[11px] text-stone-400">{new Date(version.createdAt).toLocaleString("ko-KR")} · 섹션 {version.sectionCount}개</p>
                </div>
                {!readOnly && (
                  <Button type="button" size="sm" variant="outline" className="h-9 shrink-0 rounded-md" disabled={Boolean(restoring)}
                    onClick={async () => {
                      setRestoring(version.id);
                      try { await onRestore(version); onOpenChange(false); } finally { setRestoring(null); }
                    }}>
                    {restoring === version.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1 h-3.5 w-3.5" />}
                    복구
                  </Button>
                )}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
};

/* ───────── 게시 상태 / 사용량 ───────── */

export const PublishStateBadge = ({ state }: { state: DetailPagePublishState | null }) => {
  if (!state) return null;
  if (!state.publishedVersion) {
    return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">미적용 · 고객에게 아직 안 보임</span>;
  }
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", state.hasUnpublishedChanges ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
      적용본 v{state.publishedVersion}{state.hasUnpublishedChanges ? " · 적용 안 된 수정 있음" : " · 최신"}
    </span>
  );
};

export const QuotaNote = ({ quota, requested }: { quota: AiQuota | null; requested: number }) => {
  if (!quota) return null;
  const remaining = Math.max(0, quota.imageLimit - quota.imageUsed);
  return (
    <p className={cn("text-xs", remaining < requested ? "font-semibold text-red-600" : "text-stone-500")}>
      오늘 남은 AI 이미지 생성 {remaining} / {quota.imageLimit}회
      {remaining < requested ? ` · 선택한 ${requested}장 중 ${remaining}장까지만 생성됩니다.` : ""}
    </p>
  );
};
