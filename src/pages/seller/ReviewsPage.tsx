import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BadgeCheck, Flag, Loader2, MessageSquareReply, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  EmptyState, ErrorBanner, FilterChips, KpiCard, LoadingBlock, Notice, PageHeader, Pager, Panel, StatusBadge,
} from "@/components/admin/shell/ui";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { dateTime, num } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { FIT_LABEL, reviewImageUrl } from "@/services/fundingReviews";
import {
  fetchSellerProducts, fetchSellerReviews, replyToReview, reportReview, REVIEW_REPORT_REASONS,
  type ReplyFilter, type ReviewReportReason, type SellerReview, type SellerReviewSort,
} from "@/services/seller";

const PAGE_SIZE = 20;

const Stars = ({ value }: { value: number }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`별점 ${value}점`}>
    {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={cn("h-3.5 w-3.5", n <= value ? "fill-[#741b2b] text-[#741b2b]" : "fill-stone-200 text-stone-200")} />)}
  </span>
);

const ReplyDialog = ({ review, onClose, onSaved }: { review: SellerReview | null; onClose: () => void; onSaved: () => void }) => {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => setContent(review?.seller_reply?.content ?? ""), [review]);
  const trimmed = content.trim();

  const save = async () => {
    if (!review) return;
    setSaving(true);
    try {
      await replyToReview(review.id, trimmed);
      toast({ title: review.seller_reply ? "답변을 수정했습니다" : "공식 답변을 등록했습니다", description: "상품 상세페이지 리뷰 아래에 표시됩니다." });
      onSaved(); onClose();
    } catch (error) {
      toast({ title: "답변을 저장하지 못했습니다", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(review)} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{review?.seller_reply ? "공식 답변 수정" : "공식 답변 작성"}</DialogTitle>
          <DialogDescription>답변은 브랜드 이름으로 공개됩니다. 고객 개인정보(연락처 · 주소)를 적지 마세요.</DialogDescription>
        </DialogHeader>
        {review && <blockquote className="max-h-32 overflow-y-auto rounded-xl bg-stone-50 p-3 text-xs leading-5 text-stone-600"><Stars value={review.rating} /> {review.content}</blockquote>}
        <Textarea value={content} onChange={(e) => setContent(e.target.value.slice(0, 1000))} rows={6} placeholder="고객의 리뷰에 감사 인사 · 안내 · 개선 계획을 남겨주세요." />
        <p className="text-right text-xs text-stone-400">{trimmed.length}/1000</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>취소</Button>
          <Button onClick={() => void save()} disabled={saving || trimmed.length < 2} className="bg-[#741b2b] hover:bg-[#5c1522]">
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ReportDialog = ({ review, onClose, onSaved }: { review: SellerReview | null; onClose: () => void; onSaved: () => void }) => {
  const [reason, setReason] = useState<ReviewReportReason>("abusive");
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setReason("abusive"); setDetail(""); }, [review]);

  const save = async () => {
    if (!review) return;
    setSaving(true);
    try {
      await reportReview(review.id, reason, detail.trim());
      toast({ title: "신고를 접수했습니다", description: "관리자가 운영 정책에 따라 확인합니다. 신고만으로 리뷰가 숨겨지지는 않습니다." });
      onSaved(); onClose();
    } catch (error) {
      toast({ title: "신고하지 못했습니다", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(review)} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>부적절한 리뷰 신고</DialogTitle>
          <DialogDescription>낮은 별점이나 불만 내용만으로는 신고 대상이 아닙니다. 욕설 · 광고 · 개인정보 노출 등 운영 정책 위반만 신고해주세요.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="신고 사유">
          {REVIEW_REPORT_REASONS.map((option) => (
            <button key={option.value} type="button" role="radio" aria-checked={reason === option.value} onClick={() => setReason(option.value)}
              className={cn("rounded-xl border px-3 py-2 text-left text-xs font-semibold",
                reason === option.value ? "border-[#741b2b] bg-[#741b2b]/5 text-[#741b2b]" : "border-stone-200 hover:bg-stone-50")}>
              {option.label}
            </button>
          ))}
        </div>
        <Textarea value={detail} onChange={(e) => setDetail(e.target.value.slice(0, 1000))} rows={3} placeholder={reason === "other" ? "신고 사유를 입력해주세요 (필수)" : "추가 설명 (선택)"} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>취소</Button>
          <Button onClick={() => void save()} disabled={saving || (reason === "other" && !detail.trim())} variant="destructive">
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}신고하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ReviewCard = ({ review, onReply, onReport }: { review: SellerReview; onReply: () => void; onReport: () => void }) => (
  <li className="grid gap-3 border-b border-stone-100 p-4 last:border-0 sm:p-5">
    <div className="flex flex-wrap items-center gap-2">
      <Stars value={review.rating} />
      {review.verified_purchase
        ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700"><BadgeCheck className="h-3.5 w-3.5" />실구매</span>
        : <StatusBadge tone="amber">모의결제 주문</StatusBadge>}
      {review.status === "hidden" && <StatusBadge tone="red">관리자 숨김</StatusBadge>}
      {review.pending_reports > 0 && <StatusBadge tone="violet">신고 검토 중</StatusBadge>}
      {!review.seller_reply && review.status === "visible" && <StatusBadge tone="wine">미답변</StatusBadge>}
      <span className="ml-auto text-[11px] text-stone-400">{dateTime(review.created_at)}{review.edited_at ? " · 수정됨" : ""}</span>
    </div>
    <p className="text-xs text-stone-500">
      <b className="text-stone-700">{review.funding_name}</b> · {review.nickname} · {review.selected_color ?? "-"}/{review.selected_size ?? "-"}
      {review.order_number && <span className="ml-1 font-mono">{review.order_number}</span>}
    </p>
    {(review.fit_rating || review.quality_rating || review.delivery_rating) && (
      <p className="flex flex-wrap gap-x-3 text-[11px] text-stone-500">
        {review.fit_rating && <span>사이즈 · 핏 <b className="text-stone-700">{FIT_LABEL[review.fit_rating]}</b></span>}
        {review.quality_rating && <span>원단 · 품질 <b className="text-stone-700">{review.quality_rating}/5</b></span>}
        {review.delivery_rating && <span>배송 <b className="text-stone-700">{review.delivery_rating}/5</b></span>}
      </p>
    )}
    <p className="whitespace-pre-wrap break-words text-sm leading-6">{review.content}</p>
    {review.image_paths.length > 0 && (
      <div className="flex gap-2 overflow-x-auto">
        {review.image_paths.map((path) => (
          <a key={path} href={reviewImageUrl(path)} target="_blank" rel="noreferrer" className="shrink-0">
            <img src={reviewImageUrl(path)} alt="리뷰 사진" loading="lazy" className="h-20 w-20 rounded-lg border border-stone-200 object-cover" />
          </a>
        ))}
      </div>
    )}
    {review.seller_reply && (
      <div className="rounded-xl border-l-2 border-[#741b2b] bg-[#741b2b]/[0.04] p-3 text-sm">
        <p className="text-[11px] font-bold text-[#741b2b]">판매자 공식 답변 · {dateTime(review.seller_reply.updated_at ?? review.seller_reply.replied_at)}{review.seller_reply.updated_at ? " (수정)" : ""}</p>
        <p className="mt-1 whitespace-pre-wrap break-words leading-6">{review.seller_reply.content}</p>
      </div>
    )}
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={onReply}><MessageSquareReply className="mr-1.5 h-3.5 w-3.5" />{review.seller_reply ? "답변 수정" : "답변 작성"}</Button>
      <Button size="sm" variant="ghost" className="text-stone-500" onClick={onReport} disabled={review.pending_reports > 0}><Flag className="mr-1.5 h-3.5 w-3.5" />신고</Button>
    </div>
  </li>
);

const ReviewsPage = () => {
  const [params] = useSearchParams();
  const [fundingId, setFundingId] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [reply, setReply] = useState<ReplyFilter>((params.get("reply") as ReplyFilter) || "all");
  const [sort, setSort] = useState<SellerReviewSort>("latest");
  const [page, setPage] = useState(0);
  const [replying, setReplying] = useState<SellerReview | null>(null);
  const [reporting, setReporting] = useState<SellerReview | null>(null);
  useEffect(() => setPage(0), [fundingId, rating, reply, sort]);

  const products = useAdminQuery(fetchSellerProducts, []);
  const { data, loading, error, reload } = useAdminQuery(
    () => fetchSellerReviews({ fundingId, rating, reply, sort, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    [fundingId, rating, reply, sort, page],
  );
  const stats = data?.stats;

  return (
    <div>
      <PageHeader eyebrow="Reviews" title="리뷰 관리" description="내 상품에 등록된 실제 구매자 리뷰를 확인하고 공식 답변을 남깁니다." />
      <Notice tone="stone">
        공정한 리뷰를 위해 판매자는 리뷰를 삭제 · 숨김하거나 별점을 바꿀 수 없습니다. 운영 정책을 위반한 리뷰는 신고하면 관리자가 확인 후 처리합니다.
      </Notice>

      {stats && (
        <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="리뷰 통계">
          <KpiCard emphasis label="평균 평점" value={stats.count ? `★ ${Number(stats.average).toFixed(1)}` : "-"} hint={`공개 리뷰 ${num(stats.count)}개`} />
          <KpiCard label="미답변 리뷰" value={num(stats.unanswered)} />
          <KpiCard label="최근 7일 신규" value={num(stats.new_7d)} />
          <KpiCard label="사진 리뷰" value={num(stats.photo_count)} />
          <KpiCard label="모의결제 주문 리뷰" value={num(stats.mock_count)} hint="실구매 리뷰와 구분 표시" />
          <KpiCard label="신고 검토 중" value={num(stats.reported_pending)} hint={`관리자 숨김 ${num(stats.hidden)}`} />
        </section>
      )}

      {stats && stats.count > 0 && (
        <Panel className="mt-4" title="별점 분포">
          <ul className="grid gap-1.5">
            {[5, 4, 3, 2, 1].map((score) => {
              const value = Number(stats.distribution?.[String(score)] ?? 0);
              return (
                <li key={score}>
                  <button type="button" onClick={() => setRating(rating === score ? null : score)}
                    className={cn("grid w-full grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 rounded-lg px-1 py-0.5 text-xs", rating === score ? "bg-[#741b2b]/5" : "hover:bg-stone-50")}
                    aria-pressed={rating === score}>
                    <span className="text-left font-semibold text-stone-600">{score}점</span>
                    <span className="h-2 rounded-full bg-stone-100"><span className="block h-2 rounded-full bg-[#741b2b]" style={{ width: `${(value / stats.count) * 100}%` }} /></span>
                    <span className="text-right tabular-nums text-stone-500">{value}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <Panel className="mt-4" bodyClassName="p-0" title={
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <Select value={fundingId ?? "all"} onValueChange={(value) => setFundingId(value === "all" ? null : value)}>
            <SelectTrigger className="h-9 w-full rounded-xl text-sm lg:w-56"><SelectValue placeholder="전체 상품" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상품</SelectItem>
              {(products.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={rating ? String(rating) : "all"} onValueChange={(value) => setRating(value === "all" ? null : Number(value))}>
            <SelectTrigger className="h-9 w-full rounded-xl text-sm lg:w-32"><SelectValue placeholder="전체 별점" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 별점</SelectItem>
              {[5, 4, 3, 2, 1].map((n) => <SelectItem key={n} value={String(n)}>{n}점</SelectItem>)}
            </SelectContent>
          </Select>
          <FilterChips<ReplyFilter> value={reply} onChange={setReply} options={[
            { value: "all", label: "전체" }, { value: "unanswered", label: "미답변" }, { value: "answered", label: "답변 완료" },
          ]} />
          <FilterChips<SellerReviewSort> value={sort} onChange={setSort} options={[
            { value: "latest", label: "최신순" }, { value: "rating_desc", label: "평점 높은순" }, { value: "rating_asc", label: "평점 낮은순" },
          ]} />
        </div>
      }>
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? <LoadingBlock /> : (data?.rows.length ?? 0) === 0 ? (
          <EmptyState title="조건에 맞는 리뷰가 없습니다" description="배송 완료된 실제 구매 고객만 리뷰를 작성할 수 있습니다." />
        ) : (
          <>
            <ul>{data!.rows.map((review) => (
              <ReviewCard key={review.id} review={review} onReply={() => setReplying(review)} onReport={() => setReporting(review)} />
            ))}</ul>
            <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </Panel>
      <ReplyDialog review={replying} onClose={() => setReplying(null)} onSaved={reload} />
      <ReportDialog review={reporting} onClose={() => setReporting(null)} onSaved={reload} />
    </div>
  );
};

export default ReviewsPage;
