import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, EyeOff, Info, Loader2, Lock, MessageSquareText, XCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { FundingManageTabs } from "@/components/funding/FundingManageTabs";
import {
  FeedbackChips, ReviewImages, ReviewPhotoViewer, ReviewSummaryBlock, Stars, type PhotoViewerState,
} from "@/components/funding/FundingReviewParts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ReviewAccessError, fetchCreatorFundingReviews, formatReviewDate, type CreatorReview, type CreatorReviewsResult,
} from "@/services/fundingReviews";

type Filter = "all" | "photo" | "low" | "hidden";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "photo", label: "포토 리뷰" },
  { value: "low", label: "별점 1~2점" },
  { value: "hidden", label: "비공개" },
];

const matches = (review: CreatorReview, filter: Filter) => {
  if (filter === "photo") return review.image_paths.length > 0;
  if (filter === "low") return review.rating <= 2;
  if (filter === "hidden") return !review.is_public;
  return true;
};

// 제작자 전용 리뷰 확인 화면. 조회만 가능하며 리뷰 수정·삭제 기능은 제공하지 않는다(서버에도 해당 권한 없음).
const FundingReviewsManage = () => {
  const { id } = useParams();
  const [data, setData] = useState<CreatorReviewsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [viewer, setViewer] = useState<PhotoViewerState>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      setData(await fetchCreatorFundingReviews(id));
      setDenied(null);
    } catch (error) {
      if (error instanceof ReviewAccessError) setDenied(error.message);
      else setLoadError(error instanceof Error ? error.message : "리뷰를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => (data?.rows ?? []).filter((review) => matches(review, filter)), [data, filter]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#f6f3ee]"><Header />
        <div className="flex min-h-screen items-center justify-center text-stone-500"><Loader2 className="mr-2 h-6 w-6 animate-spin text-brand" />리뷰를 불러오는 중입니다</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#f6f3ee]"><Header />
        <main className="page-shell max-w-xl pb-16 pt-28 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10">
            {denied ? <Lock className="h-5 w-5 text-brand" /> : <XCircle className="h-5 w-5 text-brand" />}
          </span>
          <h1 className="mt-4 text-xl font-bold">{denied ? "리뷰를 볼 수 없습니다" : "리뷰를 불러오지 못했습니다"}</h1>
          <p className="mt-2 text-sm text-stone-500">{denied ? "펀딩 리뷰 관리 화면은 펀딩을 개설한 제작자 본인과 관리자만 볼 수 있습니다." : loadError}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {!denied && <Button variant="outline" className="rounded-full" onClick={() => void load()}>다시 시도</Button>}
            <Button asChild className="rounded-full bg-brand hover:bg-brand-dark"><Link to="/my-fundings">내 펀딩으로</Link></Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f3ee]">
      <Header />
      <main className="page-shell max-w-[1080px] pb-16 pt-20 sm:pt-24 md:pb-24">
        <Link to="/my-fundings" className="mb-5 inline-flex items-center text-sm text-stone-500 hover:text-stone-900">
          <ArrowLeft className="mr-1 h-4 w-4" /> 내 펀딩으로 돌아가기
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">개설자 전용 · 조회</Badge>
        </div>
        <h1 className="text-wrap-anywhere mt-3 text-2xl font-bold tracking-[-0.03em] md:text-4xl">{data.funding.product_name}</h1>
        <p className="mt-2 text-stone-500">구매 리뷰 확인</p>

        <FundingManageTabs fundingId={data.funding.id} className="mb-6 mt-6" />

        <p className="mb-8 flex items-start gap-2 border border-black/10 bg-white/60 px-4 py-3 text-xs leading-5 text-stone-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          리뷰는 배송이 완료된 실제 구매자만 작성하며, 제작자는 리뷰를 수정하거나 삭제할 수 없습니다.
          부적절한 리뷰는 상세페이지의 [신고]로 접수하면 BRAND-ER 운영팀이 확인합니다.
        </p>

        <ReviewSummaryBlock summary={data.summary} note="공개 리뷰 기준" />

        <div className="mt-8 flex flex-wrap gap-1.5" role="group" aria-label="리뷰 필터">
          {FILTERS.map((option) => (
            <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}
              className={cn("min-h-9 px-3.5 text-sm font-semibold transition",
                filter === option.value ? "bg-[#211b1c] text-white" : "border border-black/10 bg-white/60 text-stone-600 hover:bg-white")}>
              {option.label} <span className="ml-0.5 text-xs opacity-70">{(data.rows ?? []).filter((review) => matches(review, option.value)).length}</span>
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="py-14 text-center text-sm text-stone-500">
            <MessageSquareText className="mx-auto mb-3 h-8 w-8 text-brand/40" />
            {data.rows.length === 0 ? "아직 작성된 리뷰가 없습니다." : "조건에 맞는 리뷰가 없습니다."}
          </div>
        ) : (
          <ul>
            {rows.map((review) => (
              <li key={review.id} className={cn("border-b border-black/10 py-6", !review.is_public && "opacity-70")}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars value={review.rating} />
                  {review.purchase_type === "real" ? (
                    <span className="inline-flex items-center gap-1 bg-brand/10 px-1.5 py-0.5 text-[11px] font-bold text-brand"><BadgeCheck className="h-3.5 w-3.5" />구매 인증</span>
                  ) : (
                    <span className="bg-stone-100 px-1.5 py-0.5 text-[11px] font-bold text-stone-500">모의결제 참여</span>
                  )}
                  {!review.is_public && (
                    <span className="inline-flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-700">
                      <EyeOff className="h-3.5 w-3.5" />{review.status === "hidden" ? "운영 정책으로 숨김" : "비공개(집계 제외)"}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
                  <span className="font-semibold text-[#211b1c]">{review.nickname}</span>
                  <span aria-hidden>·</span>
                  <time dateTime={review.created_at}>{formatReviewDate(review.created_at)}</time>
                  {review.edited_at && <span className="text-stone-400">(수정됨)</span>}
                  {review.order_number && <span className="font-mono text-[11px] text-stone-400">{review.order_number}</span>}
                </div>
                <p className="mt-1 text-xs text-stone-500">구매 옵션 · 컬러 {review.selected_color ?? "-"} · 사이즈 {review.selected_size ?? "-"}{review.quantity ? ` · ${review.quantity}장` : ""}</p>
                <FeedbackChips size={review.size_feedback} quality={review.quality_feedback} />
                <p className="text-wrap-anywhere mt-3 whitespace-pre-wrap text-sm leading-7 text-[#211b1c]">{review.content}</p>
                <ReviewImages paths={review.image_paths} nickname={review.nickname}
                  onOpen={(index) => setViewer({ paths: review.image_paths, index, caption: `${review.nickname}님의 리뷰` })} />
              </li>
            ))}
          </ul>
        )}
      </main>
      <ReviewPhotoViewer state={viewer} onClose={() => setViewer(null)} />
    </div>
  );
};

export default FundingReviewsManage;
