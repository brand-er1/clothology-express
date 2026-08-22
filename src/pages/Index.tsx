import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, ChevronRight, Sparkles } from "lucide-react";
import { Header } from "@/components/Header";
import { BrandMascot } from "@/components/BrandMascot";
import { fetchApprovedFundings } from "@/services/funding";
import type { Funding } from "@/types/funding";
import { getAppPath } from "@/utils/appUrl";
import { portfolioProducts } from "@/data/portfolioProducts";

type CollectionItem = Pick<
  Funding,
  | "id"
  | "product_name"
  | "image_url"
  | "cloth_type"
  | "material"
  | "current_orders"
  | "moq"
  | "price"
>;

const fallbackCollection: CollectionItem[] = [
  {
    id: "preview-jacket",
    product_name: "Burgundy Sculpted Jacket",
    image_url: getAppPath("/lovable-uploads/jacket.png"),
    cloth_type: "아우터",
    material: "소프트 터치 우븐",
    current_orders: 14,
    moq: 20,
    price: 109000,
  },
  {
    id: "preview-knit",
    product_name: "Quiet Form Sweatshirt",
    image_url: getAppPath("/lovable-uploads/sweatshirt.png"),
    cloth_type: "스웻셔츠",
    material: "헤비 코튼",
    current_orders: 12,
    moq: 20,
    price: 89000,
  },
  {
    id: "preview-shirt",
    product_name: "Essential Long Sleeve",
    image_url: getAppPath("/lovable-uploads/long_sleeve.png"),
    cloth_type: "상의",
    material: "코튼 저지",
    current_orders: 9,
    moq: 20,
    price: 79000,
  },
  {
    id: "preview-pants",
    product_name: "Relaxed Wide Pants",
    image_url: getAppPath("/lovable-uploads/long_pants.png"),
    cloth_type: "하의",
    material: "코튼 블렌드",
    current_orders: 8,
    moq: 20,
    price: 79000,
  },
];

const categories = [
  {
    name: "OUTER",
    label: "아우터",
    note: "구조적인 실루엣",
    image: "/lovable-uploads/jacket.png",
    tone: "bg-[#d8d3cd]",
  },
  {
    name: "TOPS",
    label: "상의",
    note: "매일 입는 새로운 기본",
    image: "/lovable-uploads/short_sleeve.png",
    tone: "bg-[#e6e3dd]",
  },
  {
    name: "SWEATS",
    label: "스웻",
    note: "부드럽고 여유로운 형태",
    image: "/lovable-uploads/sweatshirt.png",
    tone: "bg-[#d5d6d8]",
  },
  {
    name: "BOTTOMS",
    label: "하의",
    note: "움직임을 위한 균형",
    image: "/lovable-uploads/long_pants.png",
    tone: "bg-[#cec8c1]",
  },
];

const shopperPromises = [
  {
    number: "01",
    title: "LIMITED PRODUCTION",
    description: "선택받은 수량만 제작해 불필요한 재고를 남기지 않습니다.",
  },
  {
    number: "02",
    title: "MADE IN KOREA",
    description: "원단 선택부터 봉제와 검수까지 국내 생산 기준으로 완성합니다.",
  },
  {
    number: "03",
    title: "TRACK YOUR ORDER",
    description: "선주문 이후 샘플, 생산, 배송까지 진행 과정을 확인할 수 있습니다.",
  },
];

const formatPrice = (price: number | null) =>
  price ? `${price.toLocaleString("ko-KR")}원` : "가격 준비 중";

const Index = () => {
  const [approvedFundings, setApprovedFundings] = useState<Funding[]>([]);

  useEffect(() => {
    let active = true;

    fetchApprovedFundings()
      .then((fundings) => {
        if (active) setApprovedFundings(fundings);
      })
      .catch((error) => {
        console.error("Failed to load homepage collection:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  const collection = useMemo<CollectionItem[]>(() => {
    if (approvedFundings.length) return approvedFundings.slice(0, 4);
    return fallbackCollection;
  }, [approvedFundings]);

  return (
    <div className="min-h-screen bg-[#f1f0ed] text-[#211b1c]">
      <Header />
      <main className="pt-16 sm:pt-[72px]">
        <section className="relative isolate min-h-[680px] overflow-hidden border-b border-black/10 sm:min-h-[760px] lg:min-h-[calc(100vh-72px)]">
          <img
            src={getAppPath("/brand-er-hero-editorial-v2.webp")}
            alt="BRAND-ER 리미티드 컬렉션"
            className="absolute inset-0 h-full w-full object-cover object-[66%_center] sm:object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(27,21,22,0.04)_0%,rgba(27,21,22,0.02)_52%,rgba(27,21,22,0.36)_100%)] sm:bg-[linear-gradient(90deg,rgba(235,229,220,0.96)_0%,rgba(235,229,220,0.82)_31%,rgba(235,229,220,0.10)_59%,rgba(25,19,20,0.06)_100%)]" />

          <div className="relative mx-auto flex min-h-[680px] max-w-[1440px] items-end px-5 pb-11 pt-16 sm:min-h-[760px] sm:items-center sm:px-8 sm:pb-16 lg:min-h-[calc(100vh-72px)] lg:px-12 xl:px-16">
            <div
              className="w-full max-w-[680px] rounded-sm bg-[#f1ece4]/92 p-6 shadow-[0_24px_80px_rgba(44,33,29,0.10)] backdrop-blur-md sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none"
              data-tutorial="home-hero"
            >
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.24em] text-brand sm:text-xs">
                <span className="h-px w-8 bg-brand" />
                BRAND-ER · EARLY FALL 2026
              </div>
              <h1 className="mt-5 font-serif text-[clamp(3.25rem,7.4vw,7.4rem)] font-normal leading-[0.84] tracking-[-0.065em] text-[#251d1e]">
                WEAR THE<br />UNSEEN.
              </h1>
              <p className="mt-6 max-w-md text-base font-medium leading-7 text-stone-700 sm:mt-8 sm:text-lg sm:leading-8">
                아직 세상에 없는 옷을, 가장 먼저.<br />
                새로운 디자이너의 리미티드 컬렉션을 만나보세요.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:items-center">
                <Link
                  to="/fundings"
                  className="inline-flex h-[52px] items-center justify-center bg-brand px-7 text-sm font-bold text-white transition hover:bg-brand-dark sm:h-14"
                >
                  컬렉션 쇼핑하기 <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <a
                  href="#new-drop"
                  className="inline-flex h-[52px] items-center justify-center border border-[#312829]/25 bg-white/25 px-7 text-sm font-semibold text-[#312829] backdrop-blur transition hover:bg-white/55 sm:h-14"
                >
                  NEW DROP 보기
                </a>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500 sm:mt-10">
                <span>Limited order</span>
                <span>Made in Korea</span>
                <span>Small batch only</span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 right-0 hidden border-l border-t border-white/30 bg-[#251d1e]/75 px-7 py-5 text-white backdrop-blur-lg lg:block">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/55">Editorial no. 01</p>
            <p className="mt-1 font-serif text-xl">Form, texture and quiet confidence.</p>
          </div>
        </section>

        <section className="overflow-hidden border-b border-black/10 bg-[#21191a] py-4 text-white">
          <div className="flex min-w-max items-center gap-10 px-5 text-[10px] font-bold uppercase tracking-[0.28em] text-white/70 sm:justify-center sm:gap-16 sm:text-xs">
            <span>BRAND-ER LIMITED COLLECTION</span>
            <span className="h-1 w-1 rounded-full bg-[#c999a4]" />
            <span>NEW DROP EVERY SEASON</span>
            <span className="h-1 w-1 rounded-full bg-[#c999a4]" />
            <span>MADE ONLY WHEN CHOSEN</span>
          </div>
        </section>

        <section
          id="new-drop"
          className="mx-auto max-w-[1440px] scroll-mt-20 px-4 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16"
          data-tutorial="home-collection"
        >
          <div className="flex items-end justify-between gap-6 border-b border-black/10 pb-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand sm:text-xs">New drop</p>
              <h2 className="mt-3 font-serif text-4xl font-normal tracking-[-0.04em] sm:text-6xl">지금, 새로 나온 옷</h2>
            </div>
            <Link to="/fundings" className="hidden items-center text-sm font-semibold text-stone-600 transition hover:text-brand sm:inline-flex">
              전체 컬렉션 <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>

          <div className="mt-9 grid grid-cols-2 gap-x-3 gap-y-11 sm:gap-x-6 lg:grid-cols-4 lg:gap-x-7">
            {collection.map((item, index) => {
              const detailPath = item.id.startsWith("preview-") ? "/fundings" : `/fundings/${item.id}`;
              const remaining = Math.max(0, item.moq - item.current_orders);

              return (
                <Link key={item.id} to={detailPath} className="group block min-w-0">
                  <article>
                    <div className={`relative aspect-[4/5] overflow-hidden ${index % 2 === 0 ? "bg-[#dedbd6]" : "bg-[#e6e3df]"}`}>
                      <img
                        src={item.image_url}
                        alt={item.product_name}
                        className="h-full w-full object-contain p-3 transition duration-700 ease-out group-hover:scale-[1.045] sm:p-6"
                      />
                      <span className="absolute left-3 top-3 bg-[#f4f1eb]/90 px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.15em] text-[#2a2324] backdrop-blur sm:left-4 sm:top-4 sm:text-[10px]">
                        New · 0{index + 1}
                      </span>
                      <span className="absolute bottom-0 left-0 bg-brand px-3 py-2 text-[8px] font-bold uppercase tracking-[0.14em] text-white sm:px-4 sm:text-[10px]">
                        Limited order
                      </span>
                    </div>
                    <div className="pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-brand sm:text-[11px]">
                            BRAND-ER · {item.cloth_type}
                          </p>
                          <h3 className="mt-1.5 truncate text-sm font-semibold text-[#211b1c] sm:text-base">{item.product_name}</h3>
                        </div>
                        <ArrowUpRight className="mt-1 hidden h-4 w-4 shrink-0 text-stone-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand sm:block" />
                      </div>
                      <p className="mt-1 truncate text-[11px] text-stone-500 sm:text-sm">{item.material}</p>
                      <p className="mt-3 text-sm font-bold sm:text-base">{formatPrice(item.price)}</p>
                      <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-3 text-[9px] text-stone-500 sm:text-[11px]">
                        <span>{remaining > 0 ? `제작 확정까지 ${remaining}장` : "제작 확정"}</span>
                        <span>{item.current_orders}/{item.moq} 선주문</span>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>

          <Link to="/fundings" className="mt-10 inline-flex h-12 w-full items-center justify-center border border-[#211b1c] text-sm font-bold transition hover:bg-[#211b1c] hover:text-white sm:hidden">
            전체 컬렉션 보기 <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </section>

        <section id="category" className="border-y border-black/10 bg-[#e9e7e3]">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
            <div className="max-w-2xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand sm:text-xs">Shop by category</p>
              <h2 className="mt-3 font-serif text-4xl font-normal tracking-[-0.04em] sm:text-6xl">무드에 맞는 실루엣</h2>
              <p className="mt-5 text-sm leading-7 text-stone-600 sm:text-base">과장된 로고보다 좋은 소재와 균형 잡힌 형태에 집중한 컬렉션입니다.</p>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
              {categories.map((category, index) => (
                <Link key={category.name} to="/fundings" className="group relative block overflow-hidden">
                  <div className={`relative aspect-[3/4] overflow-hidden ${category.tone}`}>
                    <span className="absolute left-3 top-3 z-10 text-[9px] font-bold uppercase tracking-[0.18em] text-stone-600 sm:left-5 sm:top-5 sm:text-[11px]">0{index + 1}</span>
                    <img
                      src={getAppPath(category.image)}
                      alt={category.label}
                      className="h-full w-full object-contain p-4 transition duration-700 group-hover:scale-105 sm:p-8"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#20191a]/75 to-transparent px-4 pb-4 pt-16 text-white sm:px-6 sm:pb-6">
                      <div className="flex items-end justify-between gap-2">
                        <div>
                          <p className="font-serif text-2xl leading-none sm:text-3xl">{category.name}</p>
                          <p className="mt-2 hidden text-xs text-white/65 sm:block">{category.note}</p>
                        </div>
                        <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-[#f1f0ed]">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-16">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand sm:text-xs">Production portfolio</p>
                <h2 className="mt-3 font-serif text-4xl font-normal tracking-[-0.04em] sm:text-6xl">
                  아이디어에서<br />실제 제품까지
                </h2>
                <p className="mt-5 max-w-md text-sm leading-7 text-stone-600 sm:text-base">
                  브랜더가 제작한 다양한 의류와<br />
                  AI 디자인부터 샘플·본생산까지 이어지는 제작 과정을 확인해보세요.
                </p>
                <Link
                  to="/portfolio"
                  className="mt-7 inline-flex h-12 items-center justify-center bg-brand px-7 text-sm font-bold text-white transition hover:bg-brand-dark sm:h-14"
                >
                  제작 포트폴리오 보기 <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {portfolioProducts
                  .filter((product) =>
                    ["burgundy-leather-jacket", "technical-shell", "studded-hoodie", "work-jacket"].includes(product.id),
                  )
                  .map((product, index) => (
                    <Link
                      key={product.id}
                      to="/portfolio"
                      className={`aspect-[3/4] overflow-hidden bg-[#e9e5dd] transition hover:opacity-90 ${
                        index % 2 === 1 ? "mt-6 sm:mt-10" : ""
                      }`}
                    >
                      <img
                        src={product.image}
                        alt={product.nameKo}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain p-4 sm:p-5"
                      />
                    </Link>
                  ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#711a2a] text-white">
          <div className="mx-auto grid min-h-[650px] max-w-[1440px] lg:grid-cols-[0.82fr_1.18fr]">
            <div className="flex flex-col justify-center px-6 py-16 sm:px-10 lg:px-12 xl:px-16">
              <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#e6b7c2] sm:text-xs">The burgundy edit</p>
              <h2 className="mt-5 font-serif text-[clamp(3.5rem,7vw,7rem)] font-normal leading-[0.86] tracking-[-0.06em]">
                DEEPER<br />THAN RED.
              </h2>
              <p className="mt-7 max-w-md text-sm leading-7 text-white/65 sm:text-base">
                빛에 따라 달라지는 깊은 와인 컬러. 조용하지만 분명하게 남는 이번 시즌의 시그니처입니다.
              </p>
              <Link to="/fundings" className="mt-9 inline-flex w-fit items-center border-b border-white/70 pb-2 text-sm font-bold transition hover:border-white/30 hover:text-white/70">
                BURGUNDY EDIT 보기 <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>

            <div className="relative min-h-[520px] overflow-hidden bg-[#5d1422] lg:min-h-[650px]">
              <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.16)_1px,transparent_1px)] [background-size:64px_64px]" />
              <div className="absolute left-[9%] top-[9%] h-[68%] w-[47%] rotate-[-5deg] bg-[#e8e3dc] shadow-[0_40px_80px_rgba(36,5,12,0.35)]">
                <img src={getAppPath("/lovable-uploads/jacket.png")} alt="버건디 에디트 재킷" className="h-full w-full object-contain p-6 sm:p-10" />
              </div>
              <div className="absolute bottom-[7%] right-[7%] h-[63%] w-[43%] rotate-[5deg] bg-[#c9c6c2] shadow-[0_40px_80px_rgba(36,5,12,0.4)]">
                <img src={getAppPath("/lovable-uploads/long_pants.png")} alt="버건디 에디트 팬츠" className="h-full w-full object-contain p-5 sm:p-9" />
              </div>
              <span className="absolute bottom-5 left-5 text-[9px] font-bold uppercase tracking-[0.22em] text-white/55 sm:bottom-8 sm:left-8 sm:text-[11px]">BRAND-ER COLOR STUDY · 2026</span>
            </div>
          </div>
        </section>

        <section id="story" className="bg-[#f1f0ed]">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
            <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand sm:text-xs">Why brand-er</p>
                <h2 className="mt-4 max-w-lg font-serif text-4xl font-normal leading-[1.02] tracking-[-0.045em] sm:text-6xl">
                  좋은 옷만<br />남기는 방식.
                </h2>
              </div>
              <div className="border-t border-black/15">
                {shopperPromises.map((item) => (
                  <article key={item.number} className="grid gap-4 border-b border-black/15 py-7 sm:grid-cols-[76px_1fr] sm:py-9">
                    <span className="text-[10px] font-bold tracking-[0.18em] text-brand">{item.number}</span>
                    <div>
                      <h3 className="font-serif text-2xl font-normal tracking-[-0.025em] sm:text-3xl">{item.title}</h3>
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">{item.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-black/10 bg-[#21191a] text-white">
          <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_auto] lg:items-end lg:px-12 xl:px-16">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#d7a6b2] sm:text-xs">
                <Sparkles className="h-4 w-4" /> BRAND-ER STUDIO
              </div>
              <div className="mt-5 flex items-end gap-3 sm:gap-4">
                <BrandMascot size={64} className="hidden shrink-0 pb-1 sm:block" />
                <h2 className="max-w-4xl font-serif text-4xl font-normal leading-[1.02] tracking-[-0.045em] sm:text-6xl">
                  찾던 옷이 없다면,<br />당신의 컬렉션을 시작하세요.
                </h2>
              </div>
              <p className="mt-5 max-w-xl text-sm leading-7 text-white/55 sm:text-base">
                아이디어를 디자인으로 만들고, 선택받은 수량만큼 실제 옷으로 완성합니다.
              </p>
            </div>
            <Link
              to="/customize"
              className="inline-flex h-14 items-center justify-center border border-white/35 px-7 text-sm font-bold transition hover:bg-white hover:text-[#21191a]"
              data-tutorial="home-start-cta"
            >
              컬렉션 시작하기 <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
