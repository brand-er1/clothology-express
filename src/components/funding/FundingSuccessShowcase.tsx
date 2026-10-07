import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { fetchFundingSuccessShowcase } from "@/services/funding";
import { buildFundingSuccessStories } from "@/lib/funding-success-stories";
import type { FundingSuccessStory } from "@/types/funding";
import { Reveal } from "@/components/portfolio/ScrollReveal";

export const FundingSuccessBadge = ({ className = "" }: { className?: string }) => (
  <span className={`inline-flex items-center gap-1.5 bg-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white ${className}`}>
    Funding success
  </span>
);

export const SuccessRate = ({ rate, size = "md" }: { rate: number; size?: "md" | "lg" }) => (
  <span
    className={`font-display font-semibold leading-none tracking-[-0.05em] text-brand ${
      size === "lg" ? "text-[clamp(4rem,10vw,7.5rem)]" : "text-[clamp(2.75rem,6vw,3.75rem)]"
    }`}
  >
    {rate.toLocaleString("ko-KR")}
    <span className="ml-0.5 text-[0.45em]">%</span>
  </span>
);

const SuccessStoryCard = ({ story }: { story: FundingSuccessStory }) => (
  <Link
    to={`/success-stories/${story.fundingId}`}
    className="group flex h-full min-w-0 flex-col border border-black/10 bg-white/60 transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_18px_40px_-28px_rgba(33,27,28,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
  >
    <div className="relative aspect-[4/5] overflow-hidden bg-[#ebe7e1]">
      <img
        src={story.thumbnail}
        alt={`${story.brandName} ${story.productName}`}
        loading="lazy"
        decoding="async"
        className="img-zoom h-full w-full object-contain p-[6%] mix-blend-multiply"
      />
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-4">
        <FundingSuccessBadge />
        <span className="bg-[#211b1c] px-2 py-1 text-[10px] font-semibold tracking-[0.04em] text-white">펀딩 성공</span>
      </div>
    </div>

    <div className="flex flex-1 flex-col p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {story.brandLogo && (
            <img src={story.brandLogo} alt="" loading="lazy" className="h-6 w-6 shrink-0 rounded-full border border-black/10 object-cover" />
          )}
          <p className="truncate font-display text-sm font-semibold uppercase tracking-[0.16em] text-[#211b1c]">{story.brandName}</p>
        </div>
        <p className="shrink-0 text-[11px] text-stone-500">{story.category}</p>
      </div>

      <div className="mt-6 flex items-end justify-between gap-3 border-t border-black/10 pt-5">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.04em] text-stone-500">펀딩 달성률</p>
          <div className="mt-2">
            <SuccessRate rate={story.fundingRate} />
          </div>
        </div>
      </div>

      <span className="cta-text mt-6 self-start">
        <span className="link-draw">성공 스토리 보기</span> <ArrowRight className="h-4 w-4" />
      </span>
    </div>
  </Link>
);

/** 메인 '펀딩 성공팀' 섹션. 노출할 성공 펀딩이 없거나 불러오지 못하면 섹션을 그리지 않는다. */
export const FundingSuccessShowcase = () => {
  const [stories, setStories] = useState<FundingSuccessStory[]>([]);

  useEffect(() => {
    let active = true;
    fetchFundingSuccessShowcase()
      .then((fundings) => {
        if (active) setStories(buildFundingSuccessStories(fundings));
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
            BRAND-ER와 함께 펀딩에 성공한 브랜드를 만나보세요.
          </p>
        </Reveal>
      </div>

      {/* 모바일은 가로 슬라이드, 태블릿부터는 그리드로 확장된다. */}
      <ul className="-mx-5 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:mx-0 sm:mt-16 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 lg:gap-8 [&::-webkit-scrollbar]:hidden">
        {stories.map((story, index) => (
          <li key={story.fundingId} className="w-[78%] shrink-0 snap-start sm:w-auto">
            <Reveal delayMs={index * 90} className="h-full">
              <SuccessStoryCard story={story} />
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
};
