import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, ImagePlus, Loader2, MessageSquareText, PenLine, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  MAX_REVIEW_IMAGES, REVIEW_BLOCK_LABEL, createFundingInquiry, createFundingReview, deleteMyFundingReview,
  fetchFundingReviews, fetchMyFundingInquiries, fetchMyReviewEligibility, reviewImageUrl, validateReviewImage,
  type FundingInquiry, type FundingReview, type ReviewEligibility, type ReviewSort, type ReviewSummary,
} from "@/services/fundingReviews";

const PAGE_SIZE = 10;

const SORTS: { value: ReviewSort; label: string }[] = [
  { value: "latest", label: "최신순" },
  { value: "rating_desc", label: "별점 높은순" },
  { value: "rating_asc", label: "별점 낮은순" },
];

const INQUIRY_STATUS: Record<FundingInquiry["status"], string> = {
  open: "접수", in_progress: "확인 중", waiting_customer: "답변 대기", resolved: "답변 완료", closed: "종료",
};

export const Stars = ({ value, className }: { value: number; className?: string }) => (
  <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`별점 ${value}점`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} className={cn("h-4 w-4", n <= Math.round(value) ? "fill-brand text-brand" : "fill-stone-200 text-stone-200")} />
    ))}
  </span>
);

const formatRating = (value: number) => (Number.isFinite(value) ? value.toFixed(1) : "0.0");

/** 리뷰 요약: ★ 4.8 · 리뷰 27개 */
export const ReviewSummaryInline = ({ summary, onClick }: { summary: ReviewSummary | null; onClick?: () => void }) => {
  if (!summary) return null;
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-brand">
      <Star className="h-4 w-4 fill-brand text-brand" />
      <strong className="text-[#211b1c]">{formatRating(Number(summary.average))}</strong>
      <span>리뷰 {Number(summary.count).toLocaleString("ko-KR")}개</span>
    </button>
  );
};

// ---------------------------------------------------------------------------
// 리뷰 작성
// ---------------------------------------------------------------------------

const ReviewWriteDialog = ({ order, onClose, onCreated }: {
  order: ReviewEligibility | null; onClose: () => void; onCreated: () => void;
}) => {
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRating(0); setContent(""); setFiles([]);
  }, [order]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      const invalid = validateReviewImage(file);
      if (invalid) { toast({ title: invalid, variant: "destructive" }); continue; }
      if (next.length >= MAX_REVIEW_IMAGES) { toast({ title: `사진은 최대 ${MAX_REVIEW_IMAGES}장까지 첨부할 수 있습니다.`, variant: "destructive" }); break; }
      next.push(file);
    }
    setFiles(next);
    if (fileInput.current) fileInput.current.value = "";
  };

  const trimmed = content.trim();
  const invalid = rating < 1 || trimmed.length < 10 || trimmed.length > 2000;

  const submit = async () => {
    if (!order || invalid) return;
    setSaving(true);
    try {
      await createFundingReview({ participationId: order.participation_id, rating, content: trimmed, images: files });
      toast({ title: "리뷰를 등록했습니다", description: "소중한 구매 후기 감사합니다." });
      onCreated();
      onClose();
    } catch (error) {
      toast({ title: "리뷰를 등록하지 못했습니다", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(order)} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto rounded-none border-black/10 bg-[#f6f3ee]">
        <DialogHeader>
          <DialogTitle>리뷰 작성하기</DialogTitle>
          <DialogDescription>
            구매 옵션 · {order?.selected_color} / {order?.selected_size} · {order?.quantity}장
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <div>
            <p className="text-sm font-semibold">별점 <span className="text-red-600">*</span></p>
            <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="별점">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n}점`}
                  onClick={() => setRating(n)}
                  className="rounded p-1 transition hover:scale-110"
                >
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
              onChange={(event) => setContent(event.target.value.slice(0, 2000))}
              rows={6}
              placeholder="핏, 사이즈, 원단 느낌 등 실제 착용 후기를 10자 이상 남겨주세요."
              className="mt-2 resize-y rounded-none border-black/15 bg-white"
            />
            <p className={cn("mt-1 text-right text-xs", trimmed.length > 0 && trimmed.length < 10 ? "text-red-600" : "text-stone-400")}>
              {trimmed.length}/2000{trimmed.length > 0 && trimmed.length < 10 ? " · 10자 이상 입력해주세요" : ""}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold">사진 첨부 <span className="font-normal text-stone-400">(선택 · 최대 {MAX_REVIEW_IMAGES}장 · 장당 5MB)</span></p>
            <div className="mt-2 flex flex-wrap gap-2">
              {previews.map((url, index) => (
                <div key={url} className="relative h-20 w-20 overflow-hidden border border-black/10 bg-white">
                  <img src={url} alt={`첨부 사진 ${index + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label={`첨부 사진 ${index + 1} 삭제`}
                    onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {files.length < MAX_REVIEW_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 border border-dashed border-black/25 bg-white text-xs text-stone-500 hover:border-brand hover:text-brand"
                >
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
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}리뷰 등록
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// 리뷰 목록
// ---------------------------------------------------------------------------

const ReviewItem = ({ review, onDelete }: { review: FundingReview; onDelete: (review: FundingReview) => void }) => (
  <li className="border-b border-black/10 py-6">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Stars value={review.rating} />
      {review.verified_purchase && (
        <span className="inline-flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">
          <BadgeCheck className="h-3.5 w-3.5" />구매 인증
        </span>
      )}
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
      <span className="font-semibold text-[#211b1c]">{review.nickname}</span>
      <span aria-hidden>·</span>
      <time dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString("ko-KR")}</time>
    </div>
    <p className="mt-1 text-xs text-stone-500">
      구매 옵션 · 컬러 {review.selected_color ?? "-"} · 사이즈 {review.selected_size ?? "-"}{review.quantity ? ` · ${review.quantity}장` : ""}
    </p>
    <p className="text-wrap-anywhere mt-3 whitespace-pre-wrap text-sm leading-7 text-[#211b1c]">{review.content}</p>
    {review.image_paths.length > 0 && (
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {review.image_paths.map((path, index) => (
          <a key={path} href={reviewImageUrl(path)} target="_blank" rel="noreferrer" className="shrink-0">
            <img src={reviewImageUrl(path)} alt={`${review.nickname}님의 리뷰 사진 ${index + 1}`} loading="lazy" className="h-24 w-24 border border-black/10 object-cover" />
          </a>
        ))}
      </div>
    )}
    {review.is_mine && (
      <button type="button" onClick={() => onDelete(review)} className="mt-3 inline-flex items-center gap-1 text-xs text-stone-400 hover:text-red-600">
        <Trash2 className="h-3.5 w-3.5" />내 리뷰 삭제
      </button>
    )}
  </li>
);

export const FundingReviewsPanel = ({ fundingId, loginReturnTo, onSummary }: {
  fundingId: string; loginReturnTo: string; onSummary?: (summary: ReviewSummary) => void;
}) => {
  const [sort, setSort] = useState<ReviewSort>("latest");
  const [rows, setRows] = useState<FundingReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [eligibility, setEligibility] = useState<ReviewEligibility[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [writing, setWriting] = useState<ReviewEligibility | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [result, mine, session] = await Promise.all([
        fetchFundingReviews(fundingId, sort, PAGE_SIZE, 0),
        fetchMyReviewEligibility(fundingId).catch(() => [] as ReviewEligibility[]),
        supabase.auth.getSession(),
      ]);
      setRows(result.rows);
      setSummary(result.summary);
      onSummary?.(result.summary);
      setEligibility(mine);
      setLoggedIn(Boolean(session.data.session));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "리뷰를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [fundingId, sort, onSummary]);

  useEffect(() => { void load(); }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const result = await fetchFundingReviews(fundingId, sort, PAGE_SIZE, rows.length);
      setRows((current) => [...current, ...result.rows]);
    } catch (moreError) {
      toast({ title: "리뷰를 더 불러오지 못했습니다", description: moreError instanceof Error ? moreError.message : undefined, variant: "destructive" });
    } finally {
      setLoadingMore(false);
    }
  };

  const remove = async (review: FundingReview) => {
    if (!window.confirm("작성한 리뷰를 삭제할까요? 삭제한 리뷰는 복구할 수 없습니다.")) return;
    try {
      await deleteMyFundingReview(review.id);
      toast({ title: "리뷰를 삭제했습니다" });
      void load();
    } catch (deleteError) {
      toast({ title: "리뷰를 삭제하지 못했습니다", description: deleteError instanceof Error ? deleteError.message : undefined, variant: "destructive" });
    }
  };

  const reviewable = eligibility.filter((order) => order.can_review);
  const waiting = eligibility.filter((order) => order.block_reason === "not_delivered");
  const count = Number(summary?.count ?? 0);
  const average = Number(summary?.average ?? 0);

  return (
    <div>
      <div className="grid gap-6 border-b border-black/10 pb-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-center">
        <div>
          <p className="flex items-center gap-2 text-4xl font-bold tracking-[-0.03em]">
            <Star className="h-8 w-8 fill-brand text-brand" />{formatRating(average)}
          </p>
          <p className="mt-1 text-sm text-stone-500">리뷰 {count.toLocaleString("ko-KR")}개 · 실제 구매자만 작성할 수 있습니다</p>
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
      </div>

      {reviewable.length > 0 && (
        <div className="mt-6 border border-brand/30 bg-brand/5 p-4">
          <p className="text-sm font-semibold">구매하신 상품의 리뷰를 남겨주세요</p>
          <ul className="mt-3 grid gap-2">
            {reviewable.map((order) => (
              <li key={order.participation_id} className="flex flex-wrap items-center justify-between gap-2 bg-white/70 px-3 py-2 text-sm">
                <span className="min-w-0 text-stone-600">{order.selected_color} · {order.selected_size} · {order.quantity}장
                  <span className="ml-2 font-mono text-[11px] text-stone-400">{order.order_number}</span></span>
                <Button size="sm" className="rounded-none bg-brand hover:bg-brand-dark" onClick={() => setWriting(order)}>
                  <PenLine className="mr-1.5 h-4 w-4" />리뷰 작성하기
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {reviewable.length === 0 && waiting.length > 0 && (
        <p className="mt-6 border border-black/10 bg-white/60 px-4 py-3 text-sm text-stone-600">
          {REVIEW_BLOCK_LABEL.not_delivered}입니다. 상품을 받으신 뒤 리뷰를 남겨주세요.
        </p>
      )}
      {!loggedIn && (
        <p className="mt-6 text-sm text-stone-500">
          구매하셨나요? <Link to={loginReturnTo} className="font-semibold text-brand underline-offset-4 hover:underline">로그인</Link>하면 리뷰를 작성할 수 있습니다.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-1.5" role="group" aria-label="리뷰 정렬">
        {SORTS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={sort === option.value}
            onClick={() => setSort(option.value)}
            className={cn("min-h-9 px-3.5 text-sm font-semibold transition",
              sort === option.value ? "bg-[#211b1c] text-white" : "border border-black/10 bg-white/60 text-stone-600 hover:bg-white")}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="py-12 text-center text-sm text-stone-500">
          {error} <button type="button" className="ml-1 font-semibold text-brand" onClick={() => void load()}>다시 시도</button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-stone-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />리뷰를 불러오는 중입니다</div>
      ) : rows.length === 0 ? (
        <div className="py-14 text-center text-sm text-stone-500">
          <MessageSquareText className="mx-auto mb-3 h-8 w-8 text-brand/40" />아직 작성된 리뷰가 없습니다.
        </div>
      ) : (
        <>
          <ul>{rows.map((review) => <ReviewItem key={review.id} review={review} onDelete={(item) => void remove(item)} />)}</ul>
          {rows.length < count && (
            <div className="mt-6 text-center">
              <Button variant="outline" className="rounded-none border-black/20 bg-transparent" disabled={loadingMore} onClick={() => void loadMore()}>
                {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}리뷰 더보기 ({rows.length}/{count})
              </Button>
            </div>
          )}
        </>
      )}

      <ReviewWriteDialog order={writing} onClose={() => setWriting(null)} onCreated={() => void load()} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 문의 (기존 CS 문의로 접수)
// ---------------------------------------------------------------------------

export const FundingInquiryPanel = ({ fundingId, loginReturnTo }: { fundingId: string; loginReturnTo: string }) => {
  const [items, setItems] = useState<FundingInquiry[]>([]);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setLoggedIn(Boolean(data.session));
    if (data.session) setItems(await fetchMyFundingInquiries(fundingId).catch(() => []));
  }, [fundingId]);

  useEffect(() => { void load(); }, [load]);

  const invalid = subject.trim().length < 2 || content.trim().length < 2;
  const submit = async () => {
    if (invalid) return;
    setSaving(true);
    try {
      await createFundingInquiry(fundingId, subject.trim(), content.trim());
      setSubject(""); setContent("");
      toast({ title: "문의를 접수했습니다", description: "BRAND-ER 고객센터에서 확인 후 안내드립니다." });
      void load();
    } catch (error) {
      toast({ title: "문의를 접수하지 못했습니다", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loggedIn === false) {
    return (
      <div className="py-12 text-center text-sm text-stone-500">
        상품·사이즈·배송 문의는 <Link to={loginReturnTo} className="font-semibold text-brand underline-offset-4 hover:underline">로그인</Link> 후 남길 수 있습니다.
      </div>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid gap-3">
        <p className="text-sm text-stone-500">문의는 비공개로 BRAND-ER 고객센터에 접수되며, 확인 후 안내드립니다.</p>
        <Input value={subject} onChange={(event) => setSubject(event.target.value.slice(0, 200))} placeholder="제목 (예: 사이즈 문의)" aria-label="문의 제목" className="rounded-none border-black/15 bg-white" />
        <Textarea value={content} onChange={(event) => setContent(event.target.value.slice(0, 5000))} rows={5} placeholder="문의 내용을 입력해주세요." aria-label="문의 내용" className="rounded-none border-black/15 bg-white" />
        <Button className="w-full rounded-none bg-brand hover:bg-brand-dark sm:w-auto sm:justify-self-end" disabled={saving || invalid} onClick={() => void submit()}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}문의 남기기
        </Button>
      </div>
      <div>
        <p className="text-sm font-semibold">내 문의 내역</p>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-stone-400">이 펀딩에 남긴 문의가 없습니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/10 border-y border-black/10">
            {items.map((item) => (
              <li key={item.id} className="py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-wrap-anywhere font-semibold">{item.subject}</p>
                  <span className={cn("shrink-0 px-1.5 py-0.5 text-[11px] font-bold", ["resolved", "closed"].includes(item.status) ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                    {INQUIRY_STATUS[item.status] ?? item.status}
                  </span>
                </div>
                <p className="text-wrap-anywhere mt-1 line-clamp-2 text-stone-500">{item.content}</p>
                <p className="mt-1 text-xs text-stone-400">{new Date(item.created_at).toLocaleDateString("ko-KR")}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
