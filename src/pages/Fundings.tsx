import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchApprovedFundings, fetchMyFundings } from "@/services/funding";
import { supabase } from "@/lib/supabase";
import type { Funding, FundingStatus } from "@/types/funding";
import { ArrowRight, ArrowUpRight, Loader2, Plus, Sparkles } from "lucide-react";

const statusLabel: Record<FundingStatus, string> = {
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

const getCustomerCopy = (funding: Funding) => {
  const description = funding.description?.trim();
  if (description && !description.includes("디자인 특징:") && !description.includes("목표 인원이")) {
    return description;
  }
  return `${funding.material} 소재로 완성한 BRAND-ER 리미티드 ${funding.cloth_type} 컬렉션`;
};

const FundingCards = ({ fundings, isMine = false }: { fundings: Funding[]; isMine?: boolean }) => {
  if (!fundings.length) {
    return (
      <div className="border-y border-black/10 py-24 text-center">
        <Sparkles className="mx-auto mb-5 h-8 w-8 text-brand/60" />
        <h3 className="font-serif text-2xl font-medium text-[#211b1c]">새로운 컬렉션을 준비하고 있습니다.</h3>
        <p className="mt-3 text-sm text-stone-500">곧 공개될 BRAND-ER의 다음 드롭을 기다려주세요.</p>
        <Button asChild variant="outline" className="mt-7 rounded-none border-stone-400 bg-transparent px-6">
          <Link to="/customize">내 디자인 출시하기</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4 xl:gap-x-7 xl:gap-y-16">
      {fundings.map((funding) => {
        const progress = Math.min(100, Math.round((funding.current_orders / funding.moq) * 100));
        const remaining = Math.max(0, funding.moq - funding.current_orders);

        return (
          <Link key={funding.id} to={`/fundings/${funding.id}`} className="group block min-w-0">
            <article>
              <div className="relative aspect-[4/5] overflow-hidden bg-[#e9e7e3]">
                <img
                  src={funding.image_url}
                  alt={funding.product_name}
                  className="h-full w-full object-contain p-3 transition duration-700 ease-out group-hover:scale-[1.045] sm:p-5"
                />
                <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3 sm:p-4">
                  <span className="bg-[#f5f3ef]/90 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#2a2223] backdrop-blur-sm">
                    Limited order
                  </span>
                  {isMine && (
                    <Badge className="rounded-none border-0 bg-brand px-2.5 py-1.5 text-[10px] text-white hover:bg-brand">
                      {statusLabel[funding.status]}
                    </Badge>
                  )}
                </div>
                <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/10">
                  <div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className="pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand sm:text-xs">
                      BRAND-ER · {funding.cloth_type}
                    </p>
                    <h3 className="mt-1.5 truncate text-sm font-semibold text-[#1f191a] sm:text-base">
                      {funding.product_name}
                    </h3>
                  </div>
                  <ArrowUpRight className="mt-1 hidden h-4 w-4 shrink-0 text-stone-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand sm:block" />
                </div>
                <p className="mt-1.5 line-clamp-1 text-xs text-stone-500 sm:text-sm">{getCustomerCopy(funding)}</p>
                <p className="mt-3 text-sm font-bold text-[#1f191a] sm:text-base">
                  {funding.price ? `${funding.price.toLocaleString("ko-KR")}원` : "가격 준비 중"}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-stone-500 sm:text-xs">
                  <span>{remaining > 0 ? `제작 확정까지 ${remaining}장` : "제작 확정"}</span>
                  <span>{funding.current_orders}/{funding.moq} orders</span>
                </div>
              </div>
            </article>
          </Link>
        );
      })}
    </div>
  );
};

const Fundings = () => {
  const [approved, setApproved] = useState<Funding[]>([]);
  const [mine, setMine] = useState<Funding[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<CollectionFilter>("ALL");
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

  const featured = approved[0];

  return (
    <div className="min-h-screen bg-[#f3f1ed] text-[#211b1c]">
      <Header />
      <main className="pb-24 pt-16 sm:pt-[72px]">
        <section className="border-b border-black/10">
          <div className="mx-auto grid min-h-[560px] max-w-[1440px] lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col justify-center px-5 py-16 sm:px-8 lg:px-12 lg:py-24 xl:px-16">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand">Brand-er limited collection</p>
              <h1 className="mt-6 font-serif text-[clamp(3.25rem,7vw,7.2rem)] font-normal leading-[0.88] tracking-[-0.055em] text-[#241d1e]">
                WEAR<br />THE NEXT.
              </h1>
              <p className="mt-7 max-w-lg text-base leading-7 text-stone-600 sm:text-lg">
                아직 세상에 없는 옷을 가장 먼저 만나보세요.<br className="hidden sm:block" />
                주문이 모인 만큼만 국내에서 정성껏 제작합니다.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <a href="#collection" className="inline-flex h-12 items-center bg-brand px-6 text-sm font-bold text-white transition hover:bg-brand-dark">
                  신상품 보기 <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <Link to="/customize" className="inline-flex h-12 items-center text-sm font-semibold text-stone-600 transition hover:text-brand">
                  내 디자인 출시하기 <Plus className="ml-1.5 h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="relative min-h-[420px] overflow-hidden bg-[#d9d5cf] lg:min-h-[560px]">
              {featured ? (
                <Link to={`/fundings/${featured.id}`} className="group absolute inset-0">
                  <img
                    src={featured.image_url}
                    alt={featured.product_name}
                    className="h-full w-full object-contain p-8 transition duration-700 group-hover:scale-[1.035] sm:p-12 lg:p-16"
                  />
                  <div className="absolute left-5 top-5 bg-brand px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white sm:left-8 sm:top-8">
                    New drop 01
                  </div>
                  <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-4 bg-[#f3f1ed]/92 p-4 backdrop-blur-md sm:inset-x-8 sm:bottom-8 sm:p-5">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand">Featured collection</p>
                      <p className="mt-1 truncate text-base font-bold sm:text-lg">{featured.product_name}</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold sm:text-base">
                      {featured.price ? `${featured.price.toLocaleString("ko-KR")}원` : "Coming soon"}
                    </p>
                  </div>
                </Link>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-serif text-[32vw] leading-none text-[#c8c2bb] lg:text-[18rem]">B</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="collection" className="mx-auto max-w-[1440px] scroll-mt-20 px-4 py-14 sm:px-8 sm:py-20 lg:px-12 xl:px-16">
          <div className="flex flex-col gap-7 border-b border-black/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand">Latest collection</p>
              <h2 className="mt-3 font-serif text-4xl font-normal tracking-[-0.035em] sm:text-5xl">
                지금 만날 수 있는 컬렉션
              </h2>
            </div>
            {isAuthenticated && (
              <div className="flex items-center gap-1 text-sm">
                <button
                  type="button"
                  onClick={() => setView("shop")}
                  className={`border-b px-3 py-2 font-semibold transition ${view === "shop" ? "border-brand text-brand" : "border-transparent text-stone-400 hover:text-stone-700"}`}
                >
                  SHOP
                </button>
                <button
                  type="button"
                  onClick={() => setView("mine")}
                  className={`border-b px-3 py-2 font-semibold transition ${view === "mine" ? "border-brand text-brand" : "border-transparent text-stone-400 hover:text-stone-700"}`}
                >
                  내가 만든 컬렉션
                </button>
              </div>
            )}
          </div>

          <div className="mb-9 flex gap-1 overflow-x-auto border-b border-black/10 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {collectionFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                className={`shrink-0 px-4 py-2 text-sm font-semibold transition ${activeFilter === filter.value ? "bg-[#211b1c] text-white" : "text-stone-500 hover:bg-black/5 hover:text-[#211b1c]"}`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex h-72 items-center justify-center text-sm text-stone-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-brand" /> 컬렉션을 준비하고 있습니다
            </div>
          ) : (
            <FundingCards fundings={visibleFundings} isMine={view === "mine"} />
          )}
        </section>

        <section className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12 xl:px-16">
          <div className="grid overflow-hidden bg-[#211819] text-white lg:grid-cols-[1fr_auto]">
            <div className="px-6 py-10 sm:px-10 sm:py-14">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/50">Made only when chosen</p>
              <h2 className="mt-4 max-w-2xl font-serif text-3xl font-normal leading-tight sm:text-5xl">
                선택받은 옷만 만들고,<br />오래 입을 옷만 남깁니다.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-white/60 sm:text-base">
                선주문 수량만큼 생산해 불필요한 재고를 줄이고, 브랜더가 샘플 검수부터 생산과 배송까지 관리합니다.
              </p>
            </div>
            <div className="flex min-w-72 items-end justify-start px-6 pb-10 sm:px-10 lg:justify-center lg:pb-14 lg:pr-14">
              <Link to="/customize" className="inline-flex h-12 items-center border border-white/40 px-6 text-sm font-bold transition hover:bg-white hover:text-[#211819]">
                나의 컬렉션 만들기 <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Fundings;
