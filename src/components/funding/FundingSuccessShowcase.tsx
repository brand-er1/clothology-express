import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageSquareText } from "lucide-react";
import { fetchFundingSuccessShowcase } from "@/services/funding";
import { fetchFundingReviews, reviewImageUrl, type FundingReview, type ReviewSummary } from "@/services/fundingReviews";
import { buildFundingSuccessStories, getFundingDetailHref } from "@/lib/funding-success-stories";
import { Stars } from "@/components/funding/FundingReviewsSection";
import type { FundingSuccessStory } from "@/types/funding";
import { Reveal } from "@/components/portfolio/ScrollReveal";

export const FundingSuccessBadge = ({ className = "" }: { className?: string }) => (
  <span className={`inline-flex items-center gap-1.5 bg-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white ${className}`}>
    Funding success
  </span>
);

type StoryReviews = { summary: ReviewSummary; latest: FundingReview | null };

// 카드의 3칸 지표에 들어가도록 금액은 만원 단위로 줄인다(예: 1,950,000원 → 195만원).
const formatCompactWon = (value: number) =>
  value >= 100_000_000
    ? `${(value / 100_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억원`
    : value >= 10_000
      ? `${Math.round(value / 10_000).toLocaleString("ko-KR")}만원`
      : `${value.toLocaleString("ko-KR")}원`;

const formatShortDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
};

/** 카드 안 리뷰 미리보기: 평균 별점 · 리뷰 수 · 최신 리뷰 한 줄(사진이 있으면 썸네일). */
const ReviewPreview = ({ reviews }: { reviews: StoryReviews | null | undefined }) => {
  // undefined: 아직 불러오는 중, null: 불러오지 못함(카드 나머지는 그대로 보여준다)
  if (reviews === undefined) return <div className="h-[4.5rem] animate-pulse bg-black/[0.04]" aria-hidden />;
  const count = Number(reviews?.summary.count ?? 0);
  if (!reviews || count === 0) {
    return (
      <p className="flex min-h-[3rem] items-center gap-2 text-xs text-stone-500">
        <MessageSquareText className="h-4 w-4 shrink-0 text-brand/40" />아직 등록된 리뷰가 없습니다
      </p>
    );
  }
  const latest = reviews.latest;
  const photo = latest?.image_paths[0];
  return (
    <div>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <Stars value={Number(reviews.summary.average)} className="[&_svg]:h-3.5 [&_svg]:w-3.5" />
        <span className="font-semibold text-[#211b1c]">{Number(reviews.summary.average).toFixed(1)}</span>
        <span className="text-stone-500">리뷰 {count.toLocaleString("ko-KR")}개</span>
      </p>
      {latest && (
        <div className="mt-2.5 flex gap-3">
          {photo && (
            <img src={reviewImageUrl(photo)} alt="" loading="lazy" decoding="async" className="h-14 w-14 shrink-0 border border-black/10 object-cover" />
          )}
          <div className="min-w-0">
            <p className="text-wrap-anywhere line-clamp-2 text-[13px] leading-5 text-[#211b1c]">“{latest.content}”</p>
            <p className="mt-1 truncate text-[11px] text-stone-400">
              {latest.nickname} · {formatShortDate(latest.created_at)}
              {latest.verified_purchase && <span className="ml-1 font-semibold text-emerald-700">구매 인증</span>}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const SuccessStoryCard = ({ story, reviews }: { story: FundingSuccessStory; reviews: StoryReviews | null | undefined }) => (
  <Link
    to={getFundingDetailHref(story.fundingId, "reviews")}
    aria-label={`${story.brandName} ${story.productName} 상품 정보와 구매자 리뷰 보기`}
    className="group flex h-full min-w-0 flex-col border border-black/10 bg-white/60 transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_18px_40px_-28px_rgba(33,27,28,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
  >
    <div className="relative aspect-square overflow-hidden bg-[#ebe7e1]">
      <img
        src={story.thumbnail}
        alt={`${story.brandName} ${story.productName}`}
        loading="lazy"
        decoding="async"
        className="img-zoom h-full w-full object-contain p-[6%] mix-blend-multiply"
      />
      <div className="absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3 sm:p-4">
        <FundingSuccessBadge />
        <span className="max-w-[55%] truncate bg-[#211b1c] px-2 py-1 text-[10px] font-semibold tracking-[0.04em] text-white">
          {story.productionLabel}
        </span>
      </div>
    </div>

    <div className="flex flex-1 flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {story.brandLogo && (
            <img src={story.brandLogo} alt="" loading="lazy" className="h-6 w-6 shrink-0 rounded-full border border-black/10 object-cover" />
          )}
          <p className="truncate font-display text-xs font-semibold uppercase tracking-[0.14em] text-[#211b1c]">{story.brandName}</p>
        </div>
        <p className="shrink-0 text-[11px] text-stone-500">{story.category}</p>
      </div>
      <h3 className="text-wrap-anywhere mt-2 line-clamp-2 text-base font-semibold leading-snug tracking-[-0.02em]">{story.productName}</h3>
      {story.creatorName && <p className="mt-1 truncate text-xs text-stone-500">제작자 {story.creatorName}</p>}

      <dl className="mt-4 grid grid-cols-3 gap-2 border-y border-black/10 py-3">
        <div className="min-w-0">
          <dt className="text-[11px] text-stone-500">달성률</dt>
          <dd className="mt-0.5 font-display text-lg font-semibold leading-tight tracking-[-0.03em] text-brand">
            {story.fundingRate.toLocaleString("ko-KR")}<span className="text-xs">%</span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] text-stone-500">참여</dt>
          <dd className="mt-0.5 truncate text-sm font-semibold leading-7 tabular-nums">
            {story.participantCount != null ? `${story.participantCount.toLocaleString("ko-KR")}명` : `${story.quantity.toLocaleString("ko-KR")}장`}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] text-stone-500">펀딩 금액</dt>
          <dd className="mt-0.5 truncate text-sm font-semibold leading-7 tabular-nums">
            {story.fundingAmount != null ? formatCompactWon(story.fundingAmount) : "-"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex-1">
        <ReviewPreview reviews={reviews} />
      </div>

      <span className="cta-text mt-4 self-start">
        <span className="link-draw">상품 정보 · 구매자 리뷰 보기</span> <ArrowRight className="h-4 w-4" />
      </span>
    </div>
  </Link>
);

/** 메인 '펀딩 성공팀' 섹션. 노출할 성공 펀딩이 없거나 불러오지 못하면 섹션을 그리지 않는다. */
export const FundingSuccessShowcase = () => {
  const [stories, setStories] = useState<FundingSuccessStory[]>([]);
  const [reviews, setReviews] = useState<Record<string, StoryReviews | null>>({});

  useEffect(() => {
    let active = true;
    fetchFundingSuccessShowcase()
      .then((fundings) => {
        if (!active) return;
        const next = buildFundingSuccessStories(fundings);
        setStories(next);
        // 리뷰 요약(평균 · 개수)과 최신 리뷰 1개는 기존 get_funding_reviews RPC 로 카드별로 읽는다.
        next.forEach((story) => {
          fetchFundingReviews(story.fundingId, "latest", 1)
            .then((result) => ({ summary: result.summary, latest: result.rows[0] ?? null }))
            .catch(() => null)
            .then((value) => {
              if (active) setReviews((current) => ({ ...current, [story.fundingId]: value }));
            });
        });
      })
      .catch((error) => {
        console.error("Failed to load funding success showcase:", error);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!stories.length) return null;

  return (
    <section id="success-teams" className="page-shell scroll-mt-20 pb-24 sm:pb-32 lg:pb-40">
      <div className="grid gap-6 border-t border-black/10 pt-10 lg:grid-cols-12 lg:items-end lg:pt-14">
        <Reveal className="lg:col-span-5">
          <p className="eyebrow">Funding success</p>
          <h2 className="display-section mt-4">펀딩 성공팀</h2>
        </Reveal>
        <Reveal delayMs={120} className="lg:col-span-5 lg:col-start-7">
          <p className="text-sm leading-7 text-stone-600 sm:text-[15px]">
            아이디어에서 시작해 실제 제작까지.
            <br />
            BRAND-ER와 함께 펀딩에 성공한 브랜드와 실제 구매자 리뷰를 만나보세요.
          </p>
        </Reveal>
      </div>

      {/* 모바일은 가로 슬라이드, 태블릿부터는 그리드로 확장된다. */}
      <ul className="-mx-5 mt-12 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:mx-0 sm:mt-16 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 lg:gap-8 [&::-webkit-scrollbar]:hidden">
        {stories.map((story, index) => (
          <li key={story.fundingId} className="w-[82%] max-w-[22rem] shrink-0 snap-start sm:w-auto sm:max-w-none">
            <Reveal delayMs={index * 90} className="h-full">
              <SuccessStoryCard story={story} reviews={reviews[story.fundingId]} />
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
};
