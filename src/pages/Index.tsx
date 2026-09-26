import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Header } from "@/components/Header";
import { fetchApprovedFundings } from "@/services/funding";
import type { Funding } from "@/types/funding";
import { getAppPath } from "@/utils/appUrl";
import { portfolioProducts } from "@/data/portfolioProducts";
import { FreeTeeEventBanner } from "@/components/funding/FreeTeeEvent";
import { FlickerFlame, NewDropEventBanner, fireGradientClassName, NEW_DROP_BRAND, useNewDropCountdown, useNewDropIds } from "@/components/funding/NewDropPromo";
import { FundingProductCard } from "@/components/funding/FundingProductCard";
import { Reveal, RevealImage } from "@/components/portfolio/ScrollReveal";

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
    image_url: getAppPath("/portfolio/burgundy-leather-jacket.webp"),
    cloth_type: "아우터",
    material: "소프트 터치 우븐",
    current_orders: 14,
    moq: 20,
    price: 109000,
  },
  {
    id: "preview-knit",
    product_name: "Quiet Form Sweatshirt",
    image_url: getAppPath("/portfolio/hood-pullover.webp"),
    cloth_type: "스웻셔츠",
    material: "헤비 코튼",
    current_orders: 12,
    moq: 20,
    price: 89000,
  },
  {
    id: "preview-shirt",
    product_name: "Essential Long Sleeve",
    image_url: getAppPath("/portfolio/rolled-hem-long-sleeve.webp"),
    cloth_type: "상의",
    material: "코튼 저지",
    current_orders: 9,
    moq: 20,
    price: 79000,
  },
  {
    id: "preview-pants",
    product_name: "Relaxed Wide Pants",
    image_url: getAppPath("/portfolio/wide-trousers.webp"),
    cloth_type: "하의",
    material: "코튼 블렌드",
    current_orders: 8,
    moq: 20,
    price: 79000,
  },
];

// Category index — typographic rows that deep-link into the matching SHOP filter.
const categories = [
  { name: "OUTER", label: "아우터", note: "구조적인 실루엣", filter: "OUTER", image: "/portfolio/work-jacket.webp" },
  { name: "TOPS", label: "상의", note: "매일 입는 새로운 기본", filter: "TOP", image: "/portfolio/rolled-hem-long-sleeve.webp" },
  { name: "KNIT", label: "니트", note: "부드럽고 여유로운 형태", filter: "KNIT", image: "/portfolio/rib-half-zip.webp" },
  { name: "BOTTOMS", label: "하의", note: "움직임을 위한 균형", filter: "BOTTOM", image: "/portfolio/wide-trousers.webp" },
];

// The making story, told as one continuous sequence instead of four equal cards.
const processSteps = [
  {
    number: "01",
    title: "DESIGN",
    label: "디자인",
    description: "텍스트 한 줄이나 레퍼런스 이미지로 AI 디자인을 만들고 원하는 대로 다듬습니다.",
    image: "/lovable-uploads/ready-made/hoodie_front.png",
    fit: "contain",
    frame: "aspect-[4/5]",
    offset: "lg:mt-0",
  },
  {
    number: "02",
    title: "FABRIC",
    label: "원단",
    description: "제품 콘셉트와 예산에 맞는 원단을 제안하고 스와치로 직접 확인합니다.",
    image: "/fabrics/cotton-twill.webp",
    fit: "cover",
    frame: "aspect-square",
    offset: "lg:mt-28",
  },
  {
    number: "03",
    title: "SAMPLE",
    label: "샘플",
    description: "본생산 전에 실제 샘플로 핏과 봉제 완성도를 먼저 검수합니다.",
    image: "/portfolio/work-jacket.webp",
    fit: "contain",
    frame: "aspect-[3/4]",
    offset: "lg:mt-10",
  },
  {
    number: "04",
    title: "PRODUCTION",
    label: "생산 · 펀딩",
    description: "펀딩으로 모인 수량만큼 생산하고, 샘플부터 배송까지 진행 상황을 공유합니다.",
    image: "/portfolio/technical-shell.webp",
    fit: "contain",
    frame: "aspect-[4/5]",
    offset: "lg:mt-40",
  },
] as const;

const shopperPromises = [
  {
    number: "01",
    title: "Limited production",
    description: "선택받은 수량만 제작해 불필요한 재고를 남기지 않습니다.",
  },
  {
    number: "02",
    title: "Made in Korea",
    description: "원단 선택부터 봉제와 검수까지 국내 생산 기준으로 완성합니다.",
  },
  {
    number: "03",
    title: "Track your order",
    description: "선주문 이후 샘플, 생산, 배송까지 진행 과정을 확인할 수 있습니다.",
  },
];

// Staggered editorial placement for the four collection pieces on desktop.
const collectionLayout = [
  "col-span-2 lg:col-span-5 lg:row-span-2",
  "lg:col-span-3 lg:col-start-7 lg:mt-20",
  "lg:col-span-3 lg:col-start-10 lg:row-start-1 lg:mt-52",
  "lg:col-span-3 lg:col-start-7 lg:mt-16",
];

const lookbookIds = ["burgundy-leather-jacket", "studded-hoodie", "technical-shell"];

const Index = () => {
  const [approvedFundings, setApprovedFundings] = useState<Funding[]>([]);
  const newDropCountdown = useNewDropCountdown();
  const isNewDropLive = newDropCountdown !== null;
  const newDropIds = useNewDropIds(approvedFundings);

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
    if (!approvedFundings.length) return fallbackCollection;
    if (!isNewDropLive) return approvedFundings.slice(0, 4);
    // 이벤트 기간에는 NEW DROP 01 상품을 맨 앞에 노출
    const dropItems = approvedFundings.filter((funding) => newDropIds.has(funding.id));
    const others = approvedFundings.filter((funding) => !newDropIds.has(funding.id));
    return [...dropItems, ...others].slice(0, 4);
  }, [approvedFundings, isNewDropLive, newDropIds]);

  const lookbook = useMemo(
    () => lookbookIds.map((id) => portfolioProducts.find((product) => product.id === id)).filter((product) => product !== undefined),
    [],
  );

  return (
    <div className="min-h-screen bg-[#f6f3ee] text-[#211b1c]">
      <Header />
      <main className="pt-16 sm:pt-[72px]">
        {/* HERO — one editorial canvas: message on paper, the garments bleeding off the right edge. */}
        <section className="relative" data-tutorial="home-hero">
          <div className="lg:grid lg:min-h-[calc(100svh-72px)] lg:grid-cols-12">
            <div className="relative order-2 aspect-[4/5] overflow-hidden bg-[#e8e2da] sm:aspect-[16/11] lg:order-none lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:aspect-auto">
              <img
                src={getAppPath("/brand-er-hero-editorial-v2.webp")}
                alt="BRAND-ER 스튜디오에서 제작한 의류"
                className="h-full w-full object-cover object-[72%_center] animate-in fade-in-0 duration-700"
              />
              <p className="absolute bottom-4 right-4 font-display text-[10px] font-medium uppercase tracking-[0.24em] text-white/80 sm:bottom-6 sm:right-6">
                Studio archive — Fall 2026
              </p>
            </div>

            <div className="page-shell relative z-10 flex flex-col justify-end pb-12 pt-10 sm:pb-16 lg:col-span-7 lg:col-start-1 lg:row-start-1 lg:max-w-none lg:pb-24 lg:pl-[clamp(1.25rem,4.4vw,4.5rem)] lg:pr-0 lg:pt-24">
              {newDropCountdown && (
                <a href="#new-drop" className="eyebrow mb-8 inline-flex w-fit items-center gap-2 transition-colors hover:text-brand-dark">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
                  </span>
                  New drop 01 open · D-{newDropCountdown.days === 0 ? "DAY" : newDropCountdown.days}
                </a>
              )}
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.3em] text-stone-500 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
                Make your idea wearable
              </p>
              <h1 className="display-hero mt-5 max-w-[11ch] text-[#1f191a] animate-in fade-in-0 slide-in-from-bottom-3 duration-700 lg:max-w-none lg:[text-shadow:0_0_32px_rgba(246,243,238,0.9)]">
                아이디어가
                <br />
                옷이 되는
                <br />
                가장 쉬운 방법<span className="text-brand">.</span>
              </h1>
              <div className="mt-8 grid gap-8 sm:mt-10 lg:ml-[12%] lg:max-w-md">
                <p className="text-base leading-7 text-stone-600 animate-in fade-in-0 duration-700 [animation-delay:150ms] [animation-fill-mode:both] sm:text-lg sm:leading-8">
                  디자인부터 원단, 샘플, 생산까지.
                  <br />
                  <span className="font-display font-semibold tracking-[0.02em] text-[#211b1c]">BRAND-ER</span>
                </p>
                <div className="flex flex-col items-start gap-3 animate-in fade-in-0 duration-700 [animation-delay:300ms] [animation-fill-mode:both] sm:flex-row sm:items-center sm:gap-8">
                  <Link to="/customize" className="cta-primary w-full sm:w-auto">
                    디자인 시작하기 <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to="/fundings" className="cta-text">
                    <span className="link-draw">펀딩 둘러보기</span> <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <FreeTeeEventBanner fundings={approvedFundings} />
        <NewDropEventBanner ctaHref="#new-drop" ctaLabel="지금 선주문하기" />

        {/* NOW FUNDING — commerce grid set with an editorial stagger. */}
        <section
          id="new-drop"
          className="page-shell scroll-mt-20 pb-24 pt-20 sm:pb-32 sm:pt-28 lg:pb-40 lg:pt-36"
          data-tutorial="home-collection"
        >
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <Reveal className="lg:col-span-6">
              <p className="eyebrow">{newDropCountdown ? "New drop 01 · Launch event ~10.10" : "Now funding"}</p>
              <h2 className="display-section mt-4">
                지금, 새로 나온 옷
              </h2>
            </Reveal>
            <Reveal delayMs={120} className="lg:col-span-3 lg:col-start-7">
              <p className="text-sm leading-7 text-stone-600 sm:text-[15px]">
                선택받은 수량만큼만 제작합니다. 목표 수량이 모이면 샘플 검수를 거쳐 생산이 시작됩니다.
              </p>
            </Reveal>
            <Link to="/fundings" className="cta-text hidden justify-self-end lg:col-span-2 lg:col-start-11 lg:inline-flex">
              <span className="link-draw">전체 컬렉션</span> <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-12 sm:mt-16 sm:gap-x-6 lg:grid-cols-12 lg:gap-x-8 lg:gap-y-0">
            {collection.map((item, index) => {
              const detailPath = item.id.startsWith("preview-") ? "/fundings" : `/fundings/${item.id}`;
              const isDropItem = newDropIds.has(item.id);
              const isLead = index === 0;

              return (
                <Reveal key={item.id} delayMs={index * 90} className={`min-w-0 ${collectionLayout[index] ?? "lg:col-span-3"}`}>
                  <FundingProductCard
                    item={item}
                    to={detailPath}
                    brandName={`${isDropItem ? NEW_DROP_BRAND : "BRAND-ER"}`}
                    imageAspect={isLead ? "aspect-[4/5] lg:aspect-[5/6]" : "aspect-[4/5]"}
                    titleSize={isLead ? "lg" : "md"}
                    badge={
                      isNewDropLive && isDropItem ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-white sm:text-[10px] ${fireGradientClassName}`}>
                          <FlickerFlame className="h-3 w-3" />
                          Hot · Drop 01
                        </span>
                      ) : (
                        <span className="font-display text-[10px] font-semibold tracking-[0.2em] text-stone-500">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      )
                    }
                  />
                </Reveal>
              );
            })}
          </div>

          <Link to="/fundings" className="cta-text mt-12 lg:hidden">
            <span className="link-draw">전체 컬렉션 보기</span> <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        {/* PROCESS — one story read left to right (stacked on mobile). Numbers carry the rhythm. */}
        <section className="pb-24 sm:pb-32 lg:pb-44">
          <div className="page-shell">
            <div className="grid gap-6 border-t border-black/10 pt-10 lg:grid-cols-12 lg:pt-14">
              <Reveal className="lg:col-span-5">
                <p className="eyebrow">How it is made</p>
                <h2 className="display-section mt-4">
                  그리는 순간부터
                  <br />
                  입는 순간까지.
                </h2>
              </Reveal>
              <Reveal delayMs={120} className="lg:col-span-4 lg:col-start-8 lg:self-end">
                <p className="text-sm leading-7 text-stone-600 sm:text-[15px]">
                  브랜더는 디자인 도구에서 끝나지 않습니다. 원단, 샘플, 생산과 펀딩까지 하나의 흐름으로 이어집니다.
                </p>
              </Reveal>
            </div>

            <ol className="mt-16 grid gap-16 sm:mt-20 sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-4 lg:gap-x-10 lg:gap-y-0">
              {processSteps.map((step, index) => (
                <li key={step.number} className={`min-w-0 ${step.offset}`}>
                  <Reveal delayMs={index * 110}>
                    <div className="flex items-end gap-4">
                      <span className="display-number text-[5.5rem] text-brand sm:text-[6.5rem] lg:text-[7.5rem]">{step.number}</span>
                      <span className="mb-2 h-px flex-1 bg-black/15" aria-hidden />
                    </div>
                    <p className="mt-6 font-display text-sm font-semibold tracking-[0.2em] text-[#211b1c]">{step.title}</p>
                    <p className="mt-1 text-sm text-stone-500">{step.label}</p>
                  </Reveal>
                  <RevealImage delayMs={index * 110 + 120} className={`mt-6 bg-[#ebe7e1] ${step.frame}`}>
                    <img
                      src={getAppPath(step.image)}
                      alt={`${step.label} 단계`}
                      loading="lazy"
                      decoding="async"
                      className={`h-full w-full ${step.fit === "cover" ? "object-cover" : "object-contain p-[8%] mix-blend-multiply"}`}
                    />
                  </RevealImage>
                  <p className="mt-5 max-w-[26ch] text-sm leading-6 text-stone-600">{step.description}</p>
                </li>
              ))}
            </ol>

            <div className="mt-16 flex flex-col gap-3 sm:mt-24 sm:flex-row sm:items-center sm:gap-8 lg:ml-[calc(50%+1.25rem)]">
              <Link to="/customize" className="cta-primary">
                디자인 시작하기 <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/design-quote" className="cta-text">
                <span className="link-draw">제작 견적 받아보기</span> <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* PORTFOLIO — lookbook spread with deliberately unequal image sizes. */}
        <section className="bg-[#ece7e0] py-24 sm:py-32 lg:py-40">
          <div className="page-shell">
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
              {lookbook[0] && (
                <Link to="/portfolio" className="group block lg:col-span-7">
                  <RevealImage className="aspect-[4/5] bg-[#e2dcd3] lg:aspect-[6/7]">
                    <img src={lookbook[0].image} alt={lookbook[0].nameKo} loading="lazy" decoding="async" className="img-zoom h-full w-full object-contain p-[9%]" />
                  </RevealImage>
                </Link>
              )}

              <div className="flex flex-col lg:col-span-4 lg:col-start-9">
                <Reveal>
                  <p className="eyebrow">Production portfolio</p>
                  <h2 className="display-section mt-4">
                    아이디어에서
                    <br />
                    실제 제품까지.
                  </h2>
                  <p className="mt-6 text-sm leading-7 text-stone-600 sm:text-[15px]">
                    브랜더가 제작한 의류를 둘러보세요. AI 디자인에서 샘플, 본생산까지 실제로 완성된 옷들입니다.
                  </p>
                </Reveal>

                {lookbook[0] && (
                  <Reveal delayMs={120} className="mt-10 border-t border-black/10 pt-5 lg:mt-14">
                    <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-brand">Project 01</p>
                    <p className="mt-2 text-xl font-semibold tracking-[-0.02em]">{lookbook[0].nameKo}</p>
                    <p className="mt-1 font-display text-xs uppercase tracking-[0.14em] text-stone-500">{lookbook[0].nameEn}</p>
                  </Reveal>
                )}

                {lookbook[1] && (
                  <Link to="/portfolio" className="group mt-10 block w-2/3 self-end lg:mt-auto lg:w-4/5">
                    <RevealImage delayMs={160} className="aspect-[3/4] bg-[#e2dcd3]">
                      <img src={lookbook[1].image} alt={lookbook[1].nameKo} loading="lazy" decoding="async" className="img-zoom h-full w-full object-contain p-[10%]" />
                    </RevealImage>
                    <p className="mt-3 flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{lookbook[1].nameKo}</span>
                      <span className="font-display text-[11px] tracking-[0.18em] text-stone-500">02</span>
                    </p>
                  </Link>
                )}
              </div>
            </div>

            {lookbook[2] && (
              <div className="mt-16 grid gap-8 sm:mt-24 lg:grid-cols-12 lg:items-end lg:gap-8">
                <Reveal className="order-2 lg:order-none lg:col-span-3">
                  <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-brand">Project 03</p>
                  <p className="mt-2 text-xl font-semibold tracking-[-0.02em]">{lookbook[2].nameKo}</p>
                  <p className="mt-1 font-display text-xs uppercase tracking-[0.14em] text-stone-500">{lookbook[2].nameEn}</p>
                  <Link to="/portfolio" className="cta-text mt-6">
                    <span className="link-draw">포트폴리오 전체 보기</span> <ArrowRight className="h-4 w-4" />
                  </Link>
                </Reveal>
                <Link to="/portfolio" className="group block lg:col-span-8 lg:col-start-5">
                  <RevealImage className="aspect-[4/3] bg-[#e2dcd3] lg:aspect-[16/9]">
                    <img src={lookbook[2].image} alt={lookbook[2].nameKo} loading="lazy" decoding="async" className="img-zoom h-full w-full object-contain p-[7%]" />
                  </RevealImage>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* CATEGORY INDEX — words as navigation. */}
        <section id="category" className="page-shell py-24 sm:py-32">
          <div className="grid gap-10 lg:grid-cols-12">
            <Reveal className="lg:col-span-3">
              <p className="eyebrow">Shop by category</p>
              <p className="mt-4 max-w-[22ch] text-sm leading-7 text-stone-600">
                과장된 로고보다 좋은 소재와 균형 잡힌 형태에 집중한 컬렉션입니다.
              </p>
            </Reveal>
            <ul className="border-t border-black/10 lg:col-span-9">
              {categories.map((category, index) => (
                <li key={category.name} className="border-b border-black/10">
                  <Link
                    to={`/fundings?category=${category.filter}`}
                    className="group relative flex items-center gap-5 py-6 sm:gap-8 sm:py-8"
                  >
                    <span className="w-6 font-display text-[11px] font-medium text-stone-400">0{index + 1}</span>
                    <span className="font-display text-[clamp(2.25rem,6vw,5rem)] font-semibold leading-none tracking-[-0.05em] text-[#211b1c] transition-[color,transform] duration-500 group-hover:translate-x-2 group-hover:text-brand">
                      {category.name}
                    </span>
                    <span className="ml-auto hidden text-right text-sm text-stone-500 sm:block">
                      {category.label}
                      <span className="block text-xs text-stone-400">{category.note}</span>
                    </span>
                    <span className="pointer-events-none absolute right-[22%] top-1/2 hidden h-36 w-28 -translate-y-1/2 overflow-hidden bg-[#ebe7e1] opacity-0 transition-opacity duration-500 group-hover:opacity-100 lg:block">
                      <img src={getAppPath(category.image)} alt="" loading="lazy" className="h-full w-full object-contain p-2" />
                    </span>
                    <ArrowUpRight className="ml-auto h-5 w-5 shrink-0 text-stone-400 transition-colors group-hover:text-brand sm:ml-0" strokeWidth={1.5} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* STATEMENT + CLOSING CTA — type as the design element. */}
        <section className="page-shell pb-28 pt-8 sm:pb-36 lg:pb-44">
          <div className="grid gap-16 lg:grid-cols-12 lg:gap-8">
            <Reveal className="lg:col-span-7">
              <p className="whitespace-nowrap font-display text-[clamp(3rem,8.4vw,7.25rem)] font-semibold uppercase leading-[0.86] tracking-[-0.055em] text-[#211b1c]">
                Make
                <br />
                <span className="pl-[0.9em]">your</span>
                <br />
                idea
                <br />
                <span className="pl-[0.45em]">wearable<span className="text-brand">.</span></span>
              </p>
            </Reveal>

            <div className="flex flex-col justify-end lg:col-span-4 lg:col-start-9">
              <ol className="space-y-8">
                {shopperPromises.map((item, index) => (
                  <Reveal key={item.number} delayMs={index * 90}>
                    <li className="grid grid-cols-[2.5rem_1fr] gap-2">
                      <span className="font-display text-xs font-semibold text-brand">{item.number}</span>
                      <div>
                        <h3 className="font-display text-base font-semibold tracking-[-0.01em]">{item.title}</h3>
                        <p className="mt-1.5 text-sm leading-6 text-stone-600">{item.description}</p>
                      </div>
                    </li>
                  </Reveal>
                ))}
              </ol>

              <Reveal delayMs={300} className="mt-14 border-t border-black/10 pt-8">
                <h2 className="text-2xl font-semibold leading-snug tracking-[-0.03em] sm:text-[1.75rem]">
                  찾던 옷이 없다면,
                  <br />
                  당신의 컬렉션을 시작하세요.
                </h2>
                <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-8">
                  <Link to="/customize" className="cta-primary w-full sm:w-auto" data-tutorial="home-start-cta">
                    디자인 시작하기 <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to="/fundings" className="cta-text">
                    <span className="link-draw">펀딩 둘러보기</span> <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
