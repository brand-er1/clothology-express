import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { WatermarkOverlay } from "@/components/WatermarkOverlay";
import { fetchApprovedFundings, fetchMyFundings } from "@/services/funding";
import { supabase } from "@/lib/supabase";
import type { Funding, FundingStatus } from "@/types/funding";
import { ArrowRight, Loader2 } from "lucide-react";
import { FreeTeeEventBanner } from "@/components/funding/FreeTeeEvent";
import { FlickerFlame, NewDropEventBanner, fireGradientClassName, useNewDropCountdown, useNewDropIds } from "@/components/funding/NewDropPromo";
import { FundingProductCard, ProgressLine, formatWon } from "@/components/funding/FundingProductCard";
import { Reveal } from "@/components/portfolio/ScrollReveal";

const statusLabel: Record<FundingStatus, string> = {
  draft: "준비 중",
  pending: "승인 대기",
  approved: "판매 중",
  rejected: "수정 필요",
  closed: "판매 종료",
};

type CollectionFilter = "ALL" | "TOP" | "OUTER" | "BOTTOM" | "KNIT";

const collectionFilters: { value: CollectionFilter; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "TOP", label: "상의" },
  { value: "OUTER", label: "아우터" },
  { value: "BOTTOM", label: "하의" },
  { value: "KNIT", label: "니트" },
];

const getCollectionFilter = (funding: Funding): CollectionFilter => {
  const type = funding.cloth_type.toLowerCase();
  if (/니트|knit/.test(type)) return "KNIT";
  if (/자켓|재킷|점퍼|패딩|베스트|outer|jacket/.test(type)) return "OUTER";
  if (/팬츠|바지|스커트|레깅스|타이즈|bottom|pants/.test(type)) return "BOTTOM";
  return "TOP";
};

const isCollectionFilter = (value: string | null): value is CollectionFilter =>
  collectionFilters.some((filter) => filter.value === value);

const FundingCards = ({
  fundings,
  isMine = false,
  highlightNewDrop = false,
  newDropIds,
}: {
  fundings: Funding[];
  isMine?: boolean;
  highlightNewDrop?: boolean;
  newDropIds: Set<string>;
}) => {
  if (!fundings.length) {
    return (
      <div className="grid gap-8 border-t border-black/10 py-20 sm:py-28 lg:grid-cols-12">
        <p className="display-number text-[6rem] text-black/10 sm:text-[9rem] lg:col-span-4">00</p>
        <div className="lg:col-span-6 lg:col-start-6 lg:self-end">
          <h3 className="text-2xl font-semibold tracking-[-0.03em] text-[#211b1c] sm:text-3xl">새로운 컬렉션을 준비하고 있습니다.</h3>
          <p className="mt-3 text-sm leading-7 text-stone-500">곧 공개될 BRAND-ER의 다음 드롭을 기다려주세요.</p>
          <Link to="/customize" className="cta-text mt-6">
            <span className="link-draw">내 디자인 출시하기</span> <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-2 gap-x-4 gap-y-14 sm:gap-x-6 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-20 xl:grid-cols-4"
      data-tutorial="fundings-grid"
    >
      {fundings.map((funding, cardIndex) => {
        const isDropItem = newDropIds.has(funding.id);

        return (
          <Reveal key={funding.id} delayMs={(cardIndex % 4) * 70} className="min-w-0">
            <FundingProductCard
              item={funding}
              to={`/fundings/${funding.id}`}
              brandName={funding.brand?.brand_name || "제작자 정보 확인 중"}
              watermark
              tutorialId={cardIndex === 0 ? "funding-card" : undefined}
              statusLabel={isMine ? statusLabel[funding.status] : undefined}
              badge={
                highlightNewDrop && isDropItem ? (
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white ${fireGradientClassName}`}>
                    <FlickerFlame className="h-3.5 w-3.5" />
                    Hot · Drop 01
                  </span>
                ) : undefined
              }
            />
          </Reveal>
        );
      })}
    </div>
  );
};

const Fundings = () => {
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get("category");
  const [approved, setApproved] = useState<Funding[]>([]);
  const [mine, setMine] = useState<Funding[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<CollectionFilter>(
    isCollectionFilter(initialFilter) ? initialFilter : "ALL",
  );
  const [view, setView] = useState<"shop" | "mine">("shop");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const signedIn = Boolean(data.session?.user);
        setIsAuthenticated(signedIn);
        const [approvedData, myData] = await Promise.all([
          fetchApprovedFundings(),
          signedIn ? fetchMyFundings() : Promise.resolve([]),
        ]);
        setApproved(approvedData);
        setMine(myData);
      } catch (error) {
        console.error("Failed to load fundings:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const visibleFundings = useMemo(() => {
    const source = view === "mine" ? mine : approved;
    if (activeFilter === "ALL") return source;
    return source.filter((funding) => getCollectionFilter(funding) === activeFilter);
  }, [activeFilter, approved, mine, view]);

  const filterCounts = useMemo(() => {
    const source = view === "mine" ? mine : approved;
    const counts: Record<CollectionFilter, number> = { ALL: source.length, TOP: 0, OUTER: 0, BOTTOM: 0, KNIT: 0 };
    source.forEach((funding) => {
      counts[getCollectionFilter(funding)] += 1;
    });
    return counts;
  }, [approved, mine, view]);

  const newDropCountdown = useNewDropCountdown();
  const newDropIds = useNewDropIds(approved);
  const featured = approved[0];

  return (
    <div className="min-h-screen bg-[#f6f3ee] text-[#211b1c]">
      <Header />
      <main className="pb-24 pt-16 sm:pt-[72px]">
        <FreeTeeEventBanner fundings={approved} />
        <NewDropEventBanner ctaHref="#collection" ctaLabel="NEW DROP 01 쇼핑하기" />

        {/* Masthead: title on the left, the featured piece large on the right — no framed boxes. */}
        <section className="page-shell pt-12 sm:pt-16 lg:pt-20">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
            <div className="flex flex-col lg:col-span-5">
              <p className="eyebrow">Brand-er funding collection</p>
              <h1 className="display-hero mt-5 font-display uppercase">
                Wear
                <br />
                the next<span className="text-brand">.</span>
              </h1>
              <p className="mt-6 max-w-md text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
                아직 세상에 없는 옷을 가장 먼저 만나보세요.
                <br className="hidden sm:block" />
                주문이 모인 만큼만 정성껏 제작합니다.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
                <a href="#collection" className="cta-primary">
                  컬렉션 보기 <ArrowRight className="h-4 w-4" />
                </a>
                <Link to="/customize" className="cta-text">
                  <span className="link-draw">내 디자인 출시하기</span> <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {!loading && (
                <dl className="mt-12 grid max-w-md grid-cols-2 gap-6 border-t border-black/10 pt-6 lg:mt-auto">
                  <div>
                    <dt className="text-xs text-stone-500">진행 중인 펀딩</dt>
                    <dd className="mt-1 font-display text-3xl font-light tracking-[-0.04em] text-[#211b1c]">{approved.length}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-stone-500">제작 확정</dt>
                    <dd className="mt-1 font-display text-3xl font-light tracking-[-0.04em] text-brand">
                      {approved.filter((funding) => funding.current_orders >= funding.moq).length}
                    </dd>
                  </div>
                </dl>
              )}
            </div>

            <div className="lg:col-span-6 lg:col-start-7">
              {featured ? (
                <Link to={`/fundings/${featured.id}`} className="group block">
                  <div className="relative aspect-[4/5] overflow-hidden bg-[#ebe7e1] sm:aspect-[5/4] lg:aspect-[6/7]">
                    <img
                      src={featured.image_url}
                      alt={featured.product_name}
                      className="img-zoom h-full w-full object-contain p-[8%] mix-blend-multiply"
                    />
                    <WatermarkOverlay />
                    <span className="absolute left-4 top-4 font-display text-[10px] font-semibold uppercase tracking-[0.22em] text-brand sm:left-6 sm:top-6">
                      {newDropCountdown ? `New drop 01 · D-${newDropCountdown.days === 0 ? "DAY" : newDropCountdown.days}` : "Featured"}
                    </span>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-end sm:gap-8">
                    <div className="min-w-0">
                      <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">{featured.brand?.brand_name || "제작자 정보 확인 중"}</p>
                      <p className="mt-1.5 text-xl font-medium tracking-[-0.02em] sm:text-2xl"><span className="link-draw">{featured.product_name}</span></p>
                      <p className="mt-1 text-sm font-semibold">{formatWon(featured.price)}</p>
                    </div>
                    <ProgressLine current={featured.current_orders} target={featured.moq} size="md" />
                  </div>
                </Link>
              ) : (
                <div className="flex aspect-[5/4] items-end bg-[#ebe7e1] p-6 lg:aspect-[6/7]">
                  <span className="display-number text-[10rem] text-black/[0.06] lg:text-[16rem]">B</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="collection" className="page-shell scroll-mt-20 pt-24 sm:pt-32 lg:pt-40">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow">Latest collection</p>
              <h2 className="display-section mt-4">
                지금 만날 수 있는 컬렉션
              </h2>
            </div>
            {isAuthenticated && (
              <div className="flex items-center gap-6 text-sm">
                <button
                  type="button"
                  onClick={() => setView("shop")}
                  className={`border-b py-2 font-medium transition-colors duration-300 ${view === "shop" ? "border-brand text-brand" : "border-transparent text-stone-400 hover:text-stone-700"}`}
                >
                  SHOP
                </button>
                <button
                  type="button"
                  onClick={() => setView("mine")}
                  className={`border-b py-2 font-medium transition-colors duration-300 ${view === "mine" ? "border-brand text-brand" : "border-transparent text-stone-400 hover:text-stone-700"}`}
                >
                  내가 만든 컬렉션
                </button>
              </div>
            )}
          </div>

          <div className="-mx-5 mb-10 mt-8 flex gap-7 overflow-x-auto border-b border-black/10 px-5 [scrollbar-width:none] sm:mx-0 sm:px-0 sm:gap-9 [&::-webkit-scrollbar]:hidden">
            {collectionFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                aria-pressed={activeFilter === filter.value}
                className={`-mb-px flex shrink-0 items-baseline gap-1.5 border-b py-3.5 text-[15px] transition-colors duration-300 ${activeFilter === filter.value ? "border-brand font-semibold text-[#211b1c]" : "border-transparent text-stone-500 hover:text-[#211b1c]"}`}
              >
                {filter.label}
                <sup className={`font-display text-[10px] ${activeFilter === filter.value ? "text-brand" : "text-stone-400"}`}>{filterCounts[filter.value]}</sup>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex h-72 items-center text-sm text-stone-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-brand" /> 컬렉션을 준비하고 있습니다
            </div>
          ) : (
            <FundingCards
              fundings={visibleFundings}
              isMine={view === "mine"}
              highlightNewDrop={Boolean(newDropCountdown) && view === "shop"}
              newDropIds={newDropIds}
            />
          )}
        </section>

        {/* Closing note set as type on the page, not as a dark box. */}
        <section className="page-shell pt-28 sm:pt-36 lg:pt-44">
          <div className="grid gap-8 border-t border-black/10 pt-10 lg:grid-cols-12 lg:gap-8">
            <p className="eyebrow lg:col-span-3">Made only when chosen</p>
            <div className="lg:col-span-6">
              <h2 className="display-section">
                선택받은 옷만 만들고,
                <br />
                오래 입을 옷만 남깁니다.
              </h2>
              <p className="mt-6 max-w-xl text-sm leading-7 text-stone-600 sm:text-base">
                선주문 수량만큼 생산해 불필요한 재고를 줄이고, 브랜더가 샘플 검수부터 생산과 배송까지 관리합니다.
              </p>
            </div>
            <div className="lg:col-span-3 lg:self-end lg:justify-self-end">
              <Link to="/customize" className="cta-primary">
                나의 컬렉션 만들기 <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Fundings;
