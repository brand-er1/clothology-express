import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Camera, Flag, Loader2, Lock, MessageSquareText, PenLine, Star, Trash2, Truck } from "lucide-react";
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
  FeedbackChips, ReviewImages, ReviewPhotoViewer, ReviewSummaryBlock, ReviewWriteDialog, Stars, type PhotoViewerState,
} from "@/components/funding/FundingReviewParts";
import {
  REPORT_REASON_LABEL, REVIEW_BLOCK_LABEL, createFundingInquiry, formatRating, formatReviewDate, deleteMyFundingReview, fetchFundingReviews,
  fetchMyFundingInquiries, fetchMyReviewEligibility, reportFundingReview, reviewImageUrl,
  type FundingInquiry, type FundingReview, type ReviewEligibility, type ReviewPhoto, type ReviewReportReason,
  type ReviewSort, type ReviewSummary, type ReviewTarget,
} from "@/services/fundingReviews";

export { Stars };

const PAGE_SIZE = 10;

const SORTS: { value: ReviewSort; label: string }[] = [
  { value: "latest", label: "최신순" },
  { value: "rating_desc", label: "별점 높은순" },
  { value: "rating_asc", label: "별점 낮은순" },
];

const INQUIRY_STATUS: Record<FundingInquiry["status"], string> = {
  open: "접수", in_progress: "확인 중", waiting_customer: "답변 대기", resolved: "답변 완료", closed: "종료",
};

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

const orderLabel = (order: Pick<ReviewEligibility, "selected_color" | "selected_size" | "quantity">) =>
  `구매 옵션 · ${order.selected_color} / ${order.selected_size} · ${order.quantity}장`;

const toReviewTarget = (order: ReviewEligibility): ReviewTarget => ({
  participationId: order.participation_id,
  label: orderLabel(order),
  review: order.review,
});

// ---------------------------------------------------------------------------
// 신고
// ---------------------------------------------------------------------------

const ReviewReportDialog = ({ review, onClose, onReported }: {
  review: FundingReview | null; onClose: () => void; onReported: () => void;
}) => {
  const [reason, setReason] = useState<ReviewReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setReason(null); setDetail(""); }, [review]);

  const submit = async () => {
    if (!review || !reason) return;
    setSaving(true);
    try {
      await reportFundingReview(review.id, reason, detail.trim());
      toast({ title: "신고를 접수했습니다", description: "운영 정책에 따라 확인 후 처리합니다." });
      onReported();
      onClose();
    } catch (error) {
      toast({ title: "신고하지 못했습니다", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(review)} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-w-md rounded-none border-black/10 bg-[#f6f3ee]">
        <DialogHeader>
          <DialogTitle>리뷰 신고</DialogTitle>
          <DialogDescription>신고 사유를 선택해주세요. 신고 내용은 관리자만 확인합니다.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="신고 사유">
          {(Object.entries(REPORT_REASON_LABEL) as [ReviewReportReason, string][]).map(([key, label]) => (
            <button key={key} type="button" role="radio" aria-checked={reason === key} onClick={() => setReason(key)}
              className={cn("min-h-10 border px-2 text-sm font-semibold transition",
                reason === key ? "border-brand bg-brand text-white" : "border-black/15 bg-white text-stone-600 hover:border-brand")}>
              {label}
            </button>
          ))}
        </div>
        <Textarea value={detail} onChange={(event) => setDetail(event.target.value.slice(0, 500))} rows={3} maxLength={500}
          placeholder="추가 설명 (선택)" aria-label="신고 추가 설명" className="rounded-none border-black/15 bg-white" />
        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-none" disabled={saving} onClick={onClose}>취소</Button>
          <Button className="rounded-none bg-brand hover:bg-brand-dark" disabled={saving || !reason} onClick={() => void submit()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}신고하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// 리뷰 목록
// ---------------------------------------------------------------------------

const ReviewItem = ({ review, loggedIn, onEdit, onDelete, onReport, onOpenPhoto }: {
  review: FundingReview;
  loggedIn: boolean;
  onEdit: (review: FundingReview) => void;
  onDelete: (review: FundingReview) => void;
  onReport: (review: FundingReview) => void;
  onOpenPhoto: (review: FundingReview, index: number) => void;
}) => (
  <li className="border-b border-black/10 py-6">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Stars value={review.rating} />
      {review.verified_purchase ? (
        <span className="inline-flex items-center gap-1 bg-brand/10 px-1.5 py-0.5 text-[11px] font-bold text-brand">
          <BadgeCheck className="h-3.5 w-3.5" />구매 인증
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 bg-stone-100 px-1.5 py-0.5 text-[11px] font-bold text-stone-500" title="모의결제(실제 결제 없음)로 참여한 회원의 리뷰입니다">
          모의결제 참여
        </span>
      )}
      {review.is_mine && <span className="text-[11px] font-bold text-brand">내 리뷰</span>}
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
      <span className="font-semibold text-[#211b1c]">{review.nickname}</span>
      <span aria-hidden>·</span>
      <time dateTime={review.created_at}>{formatReviewDate(review.created_at)}</time>
      {review.edited_at && <span className="text-stone-400">(수정됨)</span>}
    </div>
    <p className="mt-1 text-xs text-stone-500">
      구매 옵션 · 컬러 {review.selected_color ?? "-"} · 사이즈 {review.selected_size ?? "-"}{review.quantity ? ` · ${review.quantity}장` : ""}
    </p>
    <FeedbackChips size={review.size_feedback} quality={review.quality_feedback} />
    <p className="text-wrap-anywhere mt-3 whitespace-pre-wrap text-sm leading-7 text-[#211b1c]">{review.content}</p>
    <ReviewImages paths={review.image_paths} nickname={review.nickname} onOpen={(index) => onOpenPhoto(review, index)} />
    <div className="mt-3 flex flex-wrap gap-3 text-xs">
      {review.is_mine ? (
        <>
          <button type="button" onClick={() => onEdit(review)} className="inline-flex items-center gap-1 text-stone-500 hover:text-brand">
            <PenLine className="h-3.5 w-3.5" />수정
          </button>
          <button type="button" onClick={() => onDelete(review)} className="inline-flex items-center gap-1 text-stone-400 hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" />삭제
          </button>
        </>
      ) : loggedIn && (
        review.reported_by_me ? (
          <span className="inline-flex items-center gap-1 text-stone-400"><Flag className="h-3.5 w-3.5" />신고 접수됨</span>
        ) : (
          <button type="button" onClick={() => onReport(review)} className="inline-flex items-center gap-1 text-stone-400 hover:text-red-600">
            <Flag className="h-3.5 w-3.5" />신고
          </button>
        )
      )}
    </div>
  </li>
);

/** 리뷰 작성 안내: 구매자 · 배송 전 · 모의결제 · 비구매자 · 비회원 */
const ReviewWriteNotice = ({ loggedIn, eligibility, loginReturnTo, onWrite }: {
  loggedIn: boolean; eligibility: ReviewEligibility[]; loginReturnTo: string; onWrite: (order: ReviewEligibility) => void;
}) => {
  // 취소·환불·미결제 주문은 작성 대상이 아니므로 비구매자와 같게 안내한다.
  const orders = eligibility.filter((order) => order.can_review || ["not_delivered", "already_reviewed", "mock_payment"].includes(order.block_reason ?? ""));
  const mockOnly = orders.length > 0 && orders.every((order) => order.block_reason === "mock_payment");

  if (!loggedIn || orders.length === 0) {
    return (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border border-black/10 bg-white/60 px-4 py-3 text-sm text-stone-600">
        <p className="flex items-center gap-2"><Lock className="h-4 w-4 text-brand" />구매자만 리뷰를 작성할 수 있습니다.</p>
        {!loggedIn && (
          <Link to={loginReturnTo} className="font-semibold text-brand underline-offset-4 hover:underline">구매하셨나요? 로그인</Link>
        )}
      </div>
    );
  }

  if (mockOnly) {
    return (
      <p className="mt-6 border border-black/10 bg-white/60 px-4 py-3 text-sm text-stone-600">
        모의결제(실제 결제 없음)로 참여한 주문은 실제 구매가 아니어서 리뷰를 작성할 수 없습니다.
      </p>
    );
  }

  return (
    <div className="mt-6 border border-brand/30 bg-brand/5 p-4">
      <p className="text-sm font-semibold">구매하신 상품의 리뷰를 남겨주세요</p>
      <ul className="mt-3 grid gap-2">
        {orders.filter((order) => order.block_reason !== "mock_payment").map((order) => (
          <li key={order.participation_id} className="flex flex-wrap items-center justify-between gap-2 bg-white/70 px-3 py-2 text-sm">
            <span className="min-w-0 text-stone-600">
              {order.selected_color} · {order.selected_size} · {order.quantity}장
              {order.order_number && <span className="ml-2 font-mono text-[11px] text-stone-400">{order.order_number}</span>}
            </span>
            {order.can_review ? (
              <Button size="sm" className="rounded-none bg-brand hover:bg-brand-dark" onClick={() => onWrite(order)}>
                <PenLine className="mr-1.5 h-4 w-4" />리뷰 작성하기
              </Button>
            ) : order.block_reason === "already_reviewed" ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand"><BadgeCheck className="h-4 w-4" />작성 완료</span>
            ) : (
              <span className="flex flex-col items-end gap-0.5">
                <Button size="sm" disabled className="rounded-none" aria-describedby={`wait-${order.participation_id}`}>
                  <PenLine className="mr-1.5 h-4 w-4" />리뷰 작성하기
                </Button>
                <span id={`wait-${order.participation_id}`} className="inline-flex items-center gap-1 text-[11px] text-stone-500">
                  <Truck className="h-3 w-3" />{REVIEW_BLOCK_LABEL.not_delivered}
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

const PhotoStrip = ({ photos, total, onOpen }: { photos: ReviewPhoto[]; total: number; onOpen: (index: number) => void }) => {
  if (!photos.length) return null;
  return (
    <div className="mt-8">
      <p className="flex items-center gap-1.5 text-sm font-semibold"><Camera className="h-4 w-4 text-brand" />포토 리뷰 <span className="font-normal text-stone-400">{total}</span></p>
      <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8">
        {photos.map((photo, index) => (
          <button key={`${photo.review_id}-${photo.path}`} type="button" onClick={() => onOpen(index)}
            aria-label={`포토 리뷰 ${index + 1} 크게 보기`} className="aspect-square overflow-hidden bg-[#ebe7e1]">
            <img src={reviewImageUrl(photo.path)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 hover:scale-105" />
          </button>
        ))}
      </div>
    </div>
  );
};

export const FundingReviewsPanel = ({ fundingId, loginReturnTo, onSummary }: {
  fundingId: string; loginReturnTo: string; onSummary?: (summary: ReviewSummary) => void;
}) => {
  const [sort, setSort] = useState<ReviewSort>("latest");
  const [photoOnly, setPhotoOnly] = useState(false);
  const [rows, setRows] = useState<FundingReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [photos, setPhotos] = useState<ReviewPhoto[]>([]);
  const [filteredCount, setFilteredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [eligibility, setEligibility] = useState<ReviewEligibility[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [writing, setWriting] = useState<ReviewTarget | null>(null);
  const [reporting, setReporting] = useState<FundingReview | null>(null);
  const [viewer, setViewer] = useState<PhotoViewerState>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [result, mine, session] = await Promise.all([
        fetchFundingReviews(fundingId, sort, PAGE_SIZE, 0, photoOnly),
        fetchMyReviewEligibility(fundingId).catch(() => [] as ReviewEligibility[]),
        supabase.auth.getSession(),
      ]);
      setRows(result.rows);
      setSummary(result.summary);
      setPhotos(result.photos ?? []);
      setFilteredCount(Number(result.filtered_count ?? result.summary.count));
      onSummary?.(result.summary);
      setEligibility(mine);
      setLoggedIn(Boolean(session.data.session));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "리뷰를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [fundingId, sort, photoOnly, onSummary]);

  useEffect(() => { void load(); }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const result = await fetchFundingReviews(fundingId, sort, PAGE_SIZE, rows.length, photoOnly);
      setRows((current) => [...current, ...result.rows]);
    } catch (moreError) {
      toast({ title: "리뷰를 더 불러오지 못했습니다", description: moreError instanceof Error ? moreError.message : undefined, variant: "destructive" });
    } finally {
      setLoadingMore(false);
    }
  };

  const edit = (review: FundingReview) => {
    const order = eligibility.find((item) => item.review_id === review.id);
    if (!order?.review) {
      toast({ title: "이 리뷰는 지금 수정할 수 없습니다", variant: "destructive" });
      return;
    }
    setWriting(toReviewTarget(order));
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

  const count = Number(summary?.count ?? 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">Verified reviews</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">구매 리뷰</h2>
        </div>
        <p className="text-xs text-stone-500">배송이 완료된 실제 구매 주문당 1개씩 작성됩니다</p>
      </div>

      <ReviewSummaryBlock summary={summary} />

      <ReviewWriteNotice loggedIn={loggedIn} eligibility={eligibility} loginReturnTo={loginReturnTo}
        onWrite={(order) => setWriting(toReviewTarget(order))} />

      <PhotoStrip photos={photos} total={Number(summary?.photo_count ?? 0)}
        onOpen={(index) => setViewer({ paths: photos.map((photo) => photo.path), index, caption: "포토 리뷰" })} />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="리뷰 정렬">
          {SORTS.map((option) => (
            <button key={option.value} type="button" aria-pressed={sort === option.value} onClick={() => setSort(option.value)}
              className={cn("min-h-9 px-3.5 text-sm font-semibold transition",
                sort === option.value ? "bg-[#211b1c] text-white" : "border border-black/10 bg-white/60 text-stone-600 hover:bg-white")}>
              {option.label}
            </button>
          ))}
        </div>
        <button type="button" aria-pressed={photoOnly} onClick={() => setPhotoOnly((value) => !value)}
          className={cn("inline-flex min-h-9 items-center gap-1.5 px-3.5 text-sm font-semibold transition",
            photoOnly ? "bg-brand text-white" : "border border-black/10 bg-white/60 text-stone-600 hover:bg-white")}>
          <Camera className="h-4 w-4" />포토 리뷰만
        </button>
      </div>

      {error ? (
        <div className="py-12 text-center text-sm text-stone-500">
          {error} <button type="button" className="ml-1 font-semibold text-brand" onClick={() => void load()}>다시 시도</button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-stone-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />리뷰를 불러오는 중입니다</div>
      ) : rows.length === 0 ? (
        <div className="py-14 text-center text-sm text-stone-500">
          <MessageSquareText className="mx-auto mb-3 h-8 w-8 text-brand/40" />
          {photoOnly && count > 0 ? "아직 작성된 포토 리뷰가 없습니다." : "아직 작성된 리뷰가 없습니다."}
        </div>
      ) : (
        <>
          <ul>
            {rows.map((review) => (
              <ReviewItem key={review.id} review={review} loggedIn={loggedIn} onEdit={edit} onDelete={(item) => void remove(item)}
                onReport={setReporting}
                onOpenPhoto={(item, index) => setViewer({ paths: item.image_paths, index, caption: `${item.nickname}님의 리뷰` })} />
            ))}
          </ul>
          {rows.length < filteredCount && (
            <div className="mt-6 text-center">
              <Button variant="outline" className="rounded-none border-black/20 bg-transparent" disabled={loadingMore} onClick={() => void loadMore()}>
                {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}리뷰 더보기 ({rows.length}/{filteredCount})
              </Button>
            </div>
          )}
        </>
      )}

      <ReviewWriteDialog target={writing} onClose={() => setWriting(null)} onSaved={() => void load()} />
      <ReviewReportDialog review={reporting} onClose={() => setReporting(null)} onReported={() => void load()} />
      <ReviewPhotoViewer state={viewer} onClose={() => setViewer(null)} />
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
