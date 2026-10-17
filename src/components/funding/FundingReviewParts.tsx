import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  MAX_REVIEW_IMAGES, MAX_REVIEW_LENGTH, MIN_REVIEW_LENGTH, QUALITY_FEEDBACK_LABEL, SIZE_FEEDBACK_LABEL,
  createFundingReview, formatRating, reviewImageUrl, updateMyFundingReview, validateReviewImage,
  type QualityFeedback, type ReviewSummary, type ReviewTarget, type SizeFeedback,
} from "@/services/fundingReviews";

// 리뷰 공용 UI: 별점 · 작성/수정 다이얼로그 · 사진 뷰어 · 사이즈/품질 요약

export const Stars = ({ value, className, size = "h-4 w-4" }: { value: number; className?: string; size?: string }) => (
  <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`별점 ${value}점`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} className={cn(size, n <= Math.round(value) ? "fill-brand text-brand" : "fill-stone-200 text-stone-200")} />
    ))}
  </span>
);

/** 사이즈 · 품질 평가 칩 */
export const FeedbackChips = ({ size, quality }: { size: SizeFeedback | null; quality: QualityFeedback | null }) => {
  if (!size && !quality) return null;
  return (
    <dl className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
      {size && (
        <div className="inline-flex items-center gap-1 border border-black/10 bg-white/70 px-2 py-0.5">
          <dt className="text-stone-400">사이즈</dt><dd className="font-semibold text-[#211b1c]">{SIZE_FEEDBACK_LABEL[size]}</dd>
        </div>
      )}
      {quality && (
        <div className="inline-flex items-center gap-1 border border-black/10 bg-white/70 px-2 py-0.5">
          <dt className="text-stone-400">품질</dt><dd className="font-semibold text-[#211b1c]">{QUALITY_FEEDBACK_LABEL[quality]}</dd>
        </div>
      )}
    </dl>
  );
};

const FeedbackBars = <T extends string>({ title, labels, counts }: {
  title: string; labels: Record<T, string>; counts: Record<T, number> | undefined;
}) => {
  const entries = Object.entries(labels) as [T, string][];
  const total = entries.reduce((sum, [key]) => sum + Number(counts?.[key] ?? 0), 0);
  const top = total ? entries.reduce((best, entry) => (Number(counts?.[entry[0]] ?? 0) > Number(counts?.[best[0]] ?? 0) ? entry : best)) : null;
  return (
    <div className="min-w-0">
      <p className="flex items-baseline justify-between gap-2 text-xs text-stone-500">
        <span className="font-semibold text-[#211b1c]">{title}</span>
        <span>{top ? `${top[1]} ${Math.round((Number(counts?.[top[0]] ?? 0) / total) * 100)}%` : "평가 없음"}</span>
      </p>
      <ul className="mt-2 grid gap-1">
        {entries.map(([key, label]) => {
          const value = Number(counts?.[key] ?? 0);
          return (
            <li key={key} className="grid grid-cols-[4.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-[11px] text-stone-500">
              <span>{label}</span>
              <span className="h-1.5 bg-black/10"><span className="block h-1.5 bg-brand/70" style={{ width: total ? `${(value / total) * 100}%` : 0 }} /></span>
              <span className="text-right tabular-nums">{value}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/** 평균 별점 · 개수 · 별점 분포 · 사이즈/품질 분포 */
export const ReviewSummaryBlock = ({ summary, note }: { summary: ReviewSummary | null; note?: string }) => {
  const count = Number(summary?.count ?? 0);
  const average = Number(summary?.average ?? 0);
  return (
    <div className="grid gap-8 border-b border-black/10 pb-8 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-start">
      <div>
        <p className="flex items-center gap-2 text-4xl font-bold tracking-[-0.03em]">
          <Star className="h-8 w-8 fill-brand text-brand" />{formatRating(average)}
        </p>
        <Stars value={average} className="mt-2" />
        <p className="mt-2 text-sm text-stone-500">리뷰 {count.toLocaleString("ko-KR")}개{note ? ` · ${note}` : ""}</p>
      </div>
      <ul className="grid gap-1.5" aria-label="별점 분포">
        {[5, 4, 3, 2, 1].map((score) => {
          const value = Number(summary?.distribution?.[String(score)] ?? 0);
          return (
            <li key={score} className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-xs text-stone-500">
              <span>{score}점</span>
              <span className="h-1.5 bg-black/10"><span className="block h-1.5 bg-brand" style={{ width: count ? `${(value / count) * 100}%` : 0 }} /></span>
              <span className="text-right tabular-nums">{value}</span>
            </li>
          );
        })}
      </ul>
      <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-1">
        <FeedbackBars title="사이즈" labels={SIZE_FEEDBACK_LABEL} counts={summary?.size} />
        <FeedbackBars title="품질" labels={QUALITY_FEEDBACK_LABEL} counts={summary?.quality} />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 사진 뷰어
// ---------------------------------------------------------------------------

export type PhotoViewerState = { paths: string[]; index: number; caption?: string } | null;

export const ReviewPhotoViewer = ({ state, onClose }: { state: PhotoViewerState; onClose: () => void }) => {
  const [index, setIndex] = useState(0);
  useEffect(() => { setIndex(state?.index ?? 0); }, [state]);
  const paths = state?.paths ?? [];
  const move = (delta: number) => setIndex((current) => (current + delta + paths.length) % paths.length);
  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-3xl gap-3 rounded-none border-black/10 bg-[#f6f3ee] p-3 sm:p-5"
        onKeyDown={(event) => {
          if (paths.length < 2) return;
          if (event.key === "ArrowLeft") move(-1);
          if (event.key === "ArrowRight") move(1);
        }}
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="text-base">리뷰 사진</DialogTitle>
          <DialogDescription>{state?.caption ?? ""} {paths.length > 1 ? `${index + 1} / ${paths.length}` : ""}</DialogDescription>
        </DialogHeader>
        {paths[index] && (
          <div className="relative flex items-center justify-center bg-[#ebe7e1]">
            <img src={reviewImageUrl(paths[index])} alt={`리뷰 사진 ${index + 1}`} className="max-h-[70vh] w-auto object-contain" />
            {paths.length > 1 && (
              <>
                <button type="button" aria-label="이전 사진" onClick={() => move(-1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white hover:bg-black/75">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" aria-label="다음 사진" onClick={() => move(1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white hover:bg-black/75">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        )}
        {paths.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {paths.map((path, i) => (
              <button key={path} type="button" aria-label={`${i + 1}번째 사진 보기`} onClick={() => setIndex(i)}
                className={cn("h-14 w-14 shrink-0 border-2", i === index ? "border-brand" : "border-transparent opacity-70 hover:opacity-100")}>
                <img src={reviewImageUrl(path)} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

/** 리뷰 첨부 사진 썸네일 줄 */
export const ReviewImages = ({ paths, nickname, onOpen }: { paths: string[]; nickname: string; onOpen: (index: number) => void }) => {
  if (!paths.length) return null;
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
      {paths.map((path, index) => (
        <button key={path} type="button" onClick={() => onOpen(index)} className="shrink-0 overflow-hidden border border-black/10 bg-[#ebe7e1]"
          aria-label={`${nickname}님의 리뷰 사진 ${index + 1} 크게 보기`}>
          <img src={reviewImageUrl(path)} alt={`${nickname}님의 리뷰 사진 ${index + 1}`} loading="lazy"
            className="h-24 w-24 object-cover transition duration-300 hover:scale-105 sm:h-28 sm:w-28" />
        </button>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 작성 / 수정
// ---------------------------------------------------------------------------

const ChoiceGroup = <T extends string>({ label, value, options, onChange }: {
  label: string; value: T | null; options: Record<T, string>; onChange: (value: T | null) => void;
}) => (
  <div>
    <p className="text-sm font-semibold">{label} <span className="font-normal text-stone-400">(선택)</span></p>
    <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={label}>
      {(Object.entries(options) as [T, string][]).map(([key, text]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(value === key ? null : key)}
          className={cn("min-h-10 border text-sm font-semibold transition",
            value === key ? "border-brand bg-brand text-white" : "border-black/15 bg-white text-stone-600 hover:border-brand hover:text-brand")}
        >
          {text}
        </button>
      ))}
    </div>
  </div>
);

export const ReviewWriteDialog = ({ target, onClose, onSaved }: {
  target: ReviewTarget | null; onClose: () => void; onSaved: () => void;
}) => {
  const editing = Boolean(target?.review);
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [sizeFeedback, setSizeFeedback] = useState<SizeFeedback | null>(null);
  const [qualityFeedback, setQualityFeedback] = useState<QualityFeedback | null>(null);
  const [keptPaths, setKeptPaths] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRating(target?.review?.rating ?? 0);
    setContent(target?.review?.content ?? "");
    setSizeFeedback(target?.review?.size_feedback ?? null);
    setQualityFeedback(target?.review?.quality_feedback ?? null);
    setKeptPaths(target?.review?.image_paths ?? []);
    setFiles([]);
  }, [target]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const photoCount = keptPaths.length + files.length;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      const invalid = validateReviewImage(file);
      if (invalid) { toast({ title: invalid, variant: "destructive" }); continue; }
      if (keptPaths.length + next.length >= MAX_REVIEW_IMAGES) {
        toast({ title: `사진은 최대 ${MAX_REVIEW_IMAGES}장까지 첨부할 수 있습니다.`, variant: "destructive" });
        break;
      }
      next.push(file);
    }
    setFiles(next);
    if (fileInput.current) fileInput.current.value = "";
  };

  const trimmed = content.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_REVIEW_LENGTH;
  const invalid = rating < 1 || trimmed.length < MIN_REVIEW_LENGTH || trimmed.length > MAX_REVIEW_LENGTH;

  const submit = async () => {
    if (!target || invalid) return;
    setSaving(true);
    const input = { rating, content: trimmed, keptPaths, newImages: files, sizeFeedback, qualityFeedback };
    try {
      if (target.review) await updateMyFundingReview(target.review.id, input);
      else await createFundingReview(target.participationId, input);
      toast({ title: editing ? "리뷰를 수정했습니다" : "리뷰를 등록했습니다", description: editing ? undefined : "소중한 구매 후기 감사합니다." });
      onSaved();
      onClose();
    } catch (error) {
      toast({
        title: editing ? "리뷰를 수정하지 못했습니다" : "리뷰를 등록하지 못했습니다",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto rounded-none border-black/10 bg-[#f6f3ee]">
        <DialogHeader>
          <DialogTitle>{editing ? "리뷰 수정하기" : "리뷰 작성하기"}</DialogTitle>
          <DialogDescription>{target?.label}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <div>
            <p className="text-sm font-semibold">별점 <span className="text-red-600">*</span></p>
            <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="별점">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}점`}
                  onClick={() => setRating(n)} className="rounded p-1 transition hover:scale-110">
                  <Star className={cn("h-8 w-8", n <= rating ? "fill-brand text-brand" : "fill-stone-200 text-stone-300")} />
                </button>
              ))}
              <span className="ml-2 text-sm text-stone-500">{rating ? `${rating}점` : "선택해주세요"}</span>
            </div>
          </div>
          <div>
            <label htmlFor="review-content" className="text-sm font-semibold">리뷰 내용 <span className="text-red-600">*</span></label>
            <Textarea
              id="review-content"
              value={content}
              onChange={(event) => setContent(event.target.value.slice(0, MAX_REVIEW_LENGTH))}
              maxLength={MAX_REVIEW_LENGTH}
              rows={6}
              placeholder={`핏, 사이즈, 원단 느낌 등 실제 착용 후기를 ${MIN_REVIEW_LENGTH}자 이상 남겨주세요.`}
              className="mt-2 resize-y rounded-none border-black/15 bg-white"
            />
            <p className={cn("mt-1 text-right text-xs", tooShort ? "text-red-600" : "text-stone-400")}>
              {trimmed.length.toLocaleString("ko-KR")}/{MAX_REVIEW_LENGTH.toLocaleString("ko-KR")}{tooShort ? ` · ${MIN_REVIEW_LENGTH}자 이상 입력해주세요` : ""}
            </p>
          </div>
          <ChoiceGroup label="사이즈 만족도" value={sizeFeedback} options={SIZE_FEEDBACK_LABEL} onChange={setSizeFeedback} />
          <ChoiceGroup label="품질 만족도" value={qualityFeedback} options={QUALITY_FEEDBACK_LABEL} onChange={setQualityFeedback} />
          <div>
            <p className="text-sm font-semibold">사진 첨부 <span className="font-normal text-stone-400">(선택 · 최대 {MAX_REVIEW_IMAGES}장 · JPG/PNG/WEBP · 장당 5MB)</span></p>
            <div className="mt-2 flex flex-wrap gap-2">
              {keptPaths.map((path, index) => (
                <div key={path} className="relative h-20 w-20 overflow-hidden border border-black/10 bg-white">
                  <img src={reviewImageUrl(path)} alt={`첨부된 사진 ${index + 1}`} className="h-full w-full object-cover" />
                  <button type="button" aria-label={`첨부된 사진 ${index + 1} 빼기`}
                    onClick={() => setKeptPaths((current) => current.filter((item) => item !== path))}
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {previews.map((url, index) => (
                <div key={url} className="relative h-20 w-20 overflow-hidden border border-black/10 bg-white">
                  <img src={url} alt={`새 사진 ${index + 1}`} className="h-full w-full object-cover" />
                  <button type="button" aria-label={`새 사진 ${index + 1} 삭제`}
                    onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {photoCount < MAX_REVIEW_IMAGES && (
                <button type="button" onClick={() => fileInput.current?.click()}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 border border-dashed border-black/25 bg-white text-xs text-stone-500 hover:border-brand hover:text-brand">
                  <ImagePlus className="h-5 w-5" />사진 추가
                </button>
              )}
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => addFiles(event.target.files)} />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-none" disabled={saving} onClick={onClose}>취소</Button>
          <Button className="rounded-none bg-brand hover:bg-brand-dark" disabled={saving || invalid} onClick={() => void submit()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? "수정 완료" : "리뷰 등록"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
