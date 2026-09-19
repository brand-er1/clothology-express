import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Check, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { WatermarkOverlay } from "@/components/WatermarkOverlay";
import { fetchApprovedFundings } from "@/services/funding";
import type { Funding } from "@/types/funding";
import { getAppPath } from "@/utils/appUrl";
import { portfolioProducts } from "@/data/portfolioProducts";

const formatPrice = (price: number | null) =>
  price ? `${price.toLocaleString("ko-KR")}원` : "가격 준비 중";

const getProgressPercent = (funding: Funding) =>
  funding.moq > 0 ? Math.round((funding.current_orders / funding.moq) * 100) : 0;

const getRemainingLabel = (funding: Funding) => {
  const createdAt = new Date(funding.created_at).getTime();
  if (Number.isNaN(createdAt)) return "진행 중";
  const deadline = createdAt + funding.funding_days * 24 * 60 * 60 * 1000;
  const daysLeft = Math.ceil((deadline - Date.now()) / (24 * 60 * 60 * 1000));
  if (daysLeft <= 0) return "마감 임박";
  return `D-${daysLeft}`;
};

/* 02. BRAND-ER 제작 과정 — 8단계. 화면 캡처가 아니라 원단/제품 사진과, 아직 실제 화면이
   없는 단계(아이디어·목표 수량 달성)는 라인 스케치·데이터 그래픽으로 대체해 실제와
   가상을 섞지 않는다. */
type ProcessVisual =
  | { kind: "sketch" }
  | { kind: "screen"; image: string }
  | { kind: "swatch"; image: string }
  | { kind: "card"; image: string }
  | { kind: "ring" }
  | { kind: "sample"; image: string; swatch: string }
  | { kind: "texture"; image: string }
  | { kind: "package"; image: string };

const processSteps: { no: string; title: string; desc: string; visual: ProcessVisual }[] = [
  {
    no: "01",
    title: "아이디어",
    desc: "만들고 싶은 옷을 생각합니다.",
    visual: { kind: "sketch" },
  },
  {
    no: "02",
    title: "AI 디자인",
    desc: "아이디어를 이미지로 구체화합니다.",
    visual: { kind: "screen", image: getAppPath("/portfolio/camo-henley.webp") },
  },
  {
    no: "03",
    title: "견적",
    desc: "원단과 제작 사양을 선택하고 예상 제작비를 확인합니다.",
    visual: { kind: "swatch", image: getAppPath("/fabrics/cotton-twill.webp") },
  },
  {
    no: "04",
    title: "펀딩",
    desc: "완성될 제품을 등록하고 고객의 선주문을 받습니다.",
    visual: { kind: "card", image: getAppPath("/portfolio/studded-hoodie.webp") },
  },
  {
    no: "05",
    title: "목표 수량 달성",
    desc: "필요한 생산 수량이 확보되면 실제 제작을 시작합니다.",
    visual: { kind: "ring" },
  },
  {
    no: "06",
    title: "샘플 제작",
    desc: "패턴과 샘플을 제작하고 실제 제품을 확인합니다.",
    visual: {
      kind: "sample",
      image: getAppPath("/portfolio/rib-half-zip.webp"),
      swatch: getAppPath("/fabrics/denim.webp"),
    },
  },
  {
    no: "07",
    title: "본생산",
    desc: "확정된 디자인과 수량으로 실제 옷을 생산합니다.",
    visual: { kind: "texture", image: getAppPath("/fabrics/cotton-jersey-heavy.webp") },
  },
  {
    no: "08",
    title: "검수 · 배송",
    desc: "제품 검수 후 펀딩 참여자에게 배송합니다.",
    visual: { kind: "package", image: getAppPath("/portfolio/work-jacket.webp") },
  },
];

const ProcessVisualTile = ({ visual }: { visual: ProcessVisual }) => {
  switch (visual.kind) {
    case "sketch":
      return (
        <div className="flex h-full w-full items-center justify-center bg-[#f1ede5]">
          <svg viewBox="0 0 120 120" className="h-16 w-16 text-[#3a2c2e]/70" fill="none">
            <path
              d="M45 22 L50 14 L70 14 L75 22 L92 30 L84 46 L76 42 L76 100 L44 100 L44 42 L36 46 L28 30 Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M50 14 Q60 26 70 14" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 3" />
          </svg>
        </div>
      );
    case "screen":
      return (
        <div className="flex h-full w-full flex-col bg-[#1c1516]">
          <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
          </div>
          <div className="relative flex-1 bg-[#e9e5dd] p-3">
            <img src={visual.image} alt="" className="h-full w-full object-contain" />
          </div>
        </div>
      );
    case "swatch":
      return (
        <div className="relative h-full w-full">
          <img src={visual.image} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#2a1116]/35" />
          <div className="absolute bottom-2 left-2 h-9 w-12 border border-white/70 bg-[#f1ede5]/90 p-1">
            <div className="h-0.5 w-full bg-[#3a2c2e]/40" />
            <div className="mt-1 h-0.5 w-3/4 bg-[#3a2c2e]/40" />
            <div className="mt-1 h-0.5 w-1/2 bg-brand/60" />
          </div>
        </div>
      );
    case "card":
      return (
        <div className="flex h-full w-full flex-col bg-[#e9e5dd]">
          <div className="relative flex-1">
            <img src={visual.image} alt="" className="h-full w-full object-contain p-2" />
          </div>
          <div className="border-t border-black/10 bg-white/70 px-2 py-1.5">
            <div className="h-1 w-full bg-black/10">
              <div className="h-full w-2/3 bg-brand" />
            </div>
          </div>
        </div>
      );
    case "ring":
      return (
        <div className="flex h-full w-full items-center justify-center bg-[#f1ede5]">
          <div
            className="relative flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: "conic-gradient(#741b2b 360deg, #ded7cc 0deg)" }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f1ede5]">
              <Check className="h-5 w-5 text-brand" strokeWidth={2.5} />
            </div>
          </div>
        </div>
      );
    case "sample":
      return (
        <div className="relative h-full w-full bg-[#e9e5dd]">
          <img src={visual.image} alt="" className="h-full w-full object-contain p-3" />
          <div className="absolute bottom-2 right-2 h-9 w-9 overflow-hidden border border-white/80 shadow-sm">
            <img src={visual.swatch} alt="" className="h-full w-full object-cover" />
          </div>
        </div>
      );
    case "texture":
      return (
        <div className="relative h-full w-full">
          <img src={visual.image} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#3d0d17] mix-blend-multiply" />
          <div className="absolute inset-0 bg-black/10" />
          <svg className="absolute inset-x-3 bottom-3 h-4 w-[calc(100%-1.5rem)] text-white/70" viewBox="0 0 100 10">
            <line x1="0" y1="5" x2="100" y2="5" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 2" />
          </svg>
        </div>
      );
    case "package":
      return (
        <div className="relative flex h-full w-full items-center justify-center bg-[#ddd3c3]">
          <img src={visual.image} alt="" className="h-full w-full object-contain p-3" />
          <span className="absolute left-2 top-2 bg-[#211b1c] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-white">
            QC Passed
          </span>
        </div>
      );
    default:
      return null;
  }
};

/* 03. 어떤 방식으로 시작하시나요 — 패션 매거진 이미지 그리드 */
const startPaths = [
  {
    title: "직접 디자인해서 제작",
    desc: "AI를 활용해 아이디어를 디자인하고 실제 옷으로 제작합니다.",
    cta: "디자인 시작하기",
    href: "/customize",
    image: getAppPath("/portfolio/studded-hoodie.webp"),
    span: "lg:col-span-2 lg:row-span-2",
    aspect: "aspect-[4/5] lg:aspect-auto",
  },
  {
    title: "이미 디자인이 있어요",
    desc: "보유한 디자인을 업로드하고 제작 견적을 확인합니다.",
    cta: "견적 확인하기",
    href: "/design-quote",
    image: getAppPath("/portfolio/work-jacket.webp"),
    span: "",
    aspect: "aspect-[4/5]",
  },
  {
    title: "단체복 제작",
    desc: "팀, 동아리, 기업, 행사에 필요한 단체복을 빠르게 제작합니다.",
    cta: "단체복 제작하기",
    href: "/quick-group-wear",
    image: getAppPath("/portfolio/hood-pullover.webp"),
    span: "",
    aspect: "aspect-[4/5]",
  },
  {
    title: "펀딩 참여",
    desc: "다른 창작자의 디자인을 먼저 주문하고 실제 제품 제작에 참여합니다.",
    cta: "펀딩 둘러보기",
    href: "/fundings",
    image: getAppPath("/portfolio/technical-shell.webp"),
    span: "lg:col-span-2",
    aspect: "aspect-[16/9] lg:aspect-auto",
  },
];

/* 05. 펀딩이 끝나면 어떻게 되나요 — 큰 이미지 4단계 */
const afterFundingSteps = [
  {
    step: "STEP 01",
    title: "원단 · 부자재 준비",
    desc: "선택된 원단과 부자재를 확정하고 생산을 준비합니다.",
    image: getAppPath("/fabrics/french-terry.webp"),
  },
  {
    step: "STEP 02",
    title: "패턴 · 샘플 제작",
    desc: "패턴을 뜨고 실제 샘플을 제작해 핏과 디테일을 확인합니다.",
    image: getAppPath("/portfolio/rolled-hem-long-sleeve.webp"),
  },
  {
    step: "STEP 03",
    title: "본생산",
    desc: "확정된 샘플을 기준으로 주문 수량만큼 실제 생산에 들어갑니다.",
    image: getAppPath("/fabrics/wool-blend-knit.webp"),
  },
  {
    step: "STEP 04",
    title: "검수 · 포장 · 배송",
    desc: "완성된 제품을 검수하고 포장해 참여자에게 배송합니다.",
    image: getAppPath("/portfolio/hidden-shirt.webp"),
  },
];

/* 07. BRAND-ER 핵심 기능 */
const coreFeatures = [
  {
    title: "AI 의류 디자인",
    desc: "아이디어를 빠르게 시각화",
    href: "/customize",
    image: getAppPath("/portfolio/camo-henley.webp"),
  },
  {
    title: "AI 가상피팅",
    desc: "제작 전 완성된 스타일 확인",
    href: "/closet",
    image: getAppPath("/portfolio/rolled-hem-long-sleeve.webp"),
  },
  {
    title: "자동 견적",
    desc: "복잡한 제작 비용을 간단하게 확인",
    href: "/design-quote",
    image: getAppPath("/fabrics/cotton-twill.webp"),
  },
  {
    title: "원단 탐색",
    desc: "다양한 원단과 소재 확인",
    href: "/fabric-swatch",
    images: [
      getAppPath("/fabrics/denim.webp"),
      getAppPath("/fabrics/wool-blend-knit.webp"),
      getAppPath("/fabrics/faux-leather.webp"),
      getAppPath("/fabrics/cotton-pique.webp"),
    ],
  },
  {
    title: "소량 생산",
    desc: "대량 재고 없이 필요한 만큼 생산",
    href: "/portfolio",
    image: getAppPath("/portfolio/balloon-cargo-shorts.webp"),
  },
  {
    title: "펀딩",
    desc: "수요를 먼저 확인하고 생산",
    href: "/fundings",
    image: getAppPath("/portfolio/wide-trousers.webp"),
  },
];

const portfolioHighlights = portfolioProducts.filter((product) =>
  [
    "burgundy-leather-jacket",
    "technical-shell",
    "studded-hoodie",
    "work-jacket",
    "hood-pullover",
    "rib-half-zip",
  ].includes(product.id),
);

const Index = () => {
  const [approvedFundings, setApprovedFundings] = useState<Funding[] | null>(null);

  useEffect(() => {
    let active = true;

    fetchApprovedFundings()
      .then((fundings) => {
        if (active) setApprovedFundings(fundings);
      })
      .catch((error) => {
        console.error("Failed to load homepage fundings:", error);
        if (active) setApprovedFundings([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const liveFundings = useMemo(() => approvedFundings?.slice(0, 4) ?? [], [approvedFundings]);

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#211b1c]">
      <Header />
      <main className="pt-16 sm:pt-[72px]">
        {/* 01. HERO */}
        <section
          className="relative isolate min-h-[680px] overflow-hidden border-b border-black/10 sm:min-h-[760px] lg:min-h-[calc(100vh-72px)]"
          data-tutorial="home-hero"
        >
          <img
            src={getAppPath("/brand-er-hero-editorial-v2.webp")}
            alt="BRAND-ER 작업실에서 완성되어가는 의류"
            className="absolute inset-0 h-full w-full object-cover object-[66%_center] sm:object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(27,21,22,0.04)_0%,rgba(27,21,22,0.02)_52%,rgba(27,21,22,0.4)_100%)] sm:bg-[linear-gradient(90deg,rgba(244,241,234,0.96)_0%,rgba(244,241,234,0.84)_33%,rgba(244,241,234,0.12)_60%,rgba(25,19,20,0.06)_100%)]" />

          <div className="relative mx-auto flex min-h-[680px] max-w-[1440px] items-end px-5 pb-11 pt-16 sm:min-h-[760px] sm:items-center sm:px-8 sm:pb-16 lg:min-h-[calc(100vh-72px)] lg:px-12 xl:px-16">
            <div className="w-full max-w-[640px] rounded-sm bg-[#f4f1ea]/92 p-6 shadow-[0_24px_80px_rgba(44,33,29,0.10)] backdrop-blur-md sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.24em] text-brand sm:text-xs">
                <span className="h-px w-8 bg-brand" />
                BRAND-ER · CLOTHING STUDIO
              </div>
              <h1 className="mt-5 text-[clamp(2.75rem,6.4vw,5.6rem)] font-extrabold leading-[1.06] tracking-[-0.03em] text-[#211b1c]">
                아이디어가<br />옷이 되는<br />가장 쉬운 방법.
              </h1>
              <p className="mt-6 max-w-md text-base font-medium leading-7 text-stone-700 sm:mt-8 sm:text-lg sm:leading-8">
                디자인부터 원단, 샘플, 펀딩, 생산까지.<br />
                BRAND-ER가 의류 제작의 전 과정을 연결합니다.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:items-center">
                <Link
                  to="/customize"
                  className="inline-flex h-[52px] items-center justify-center bg-brand px-7 text-sm font-bold text-white transition hover:bg-brand-dark sm:h-14"
                >
                  내 옷 제작하기 <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  to="/fundings"
                  className="inline-flex h-[52px] items-center justify-center border border-[#312829]/25 bg-white/25 px-7 text-sm font-semibold text-[#312829] backdrop-blur transition hover:bg-white/55 sm:h-14"
                >
                  펀딩 둘러보기
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 02. BRAND-ER 제작 과정 */}
        <section className="border-b border-black/10 bg-[#f4f1ea] py-16 sm:py-24">
          <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand sm:text-xs">
              How brand-er works
            </p>
            <h2 className="mt-3 max-w-2xl text-4xl font-extrabold tracking-[-0.03em] sm:text-6xl">
              아이디어 하나면 충분합니다.
            </h2>
          </div>

          <div className="mt-10 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mt-14">
            <div className="flex w-max gap-5 px-5 sm:gap-6 sm:px-8 lg:px-12 xl:px-16">
              {processSteps.map((step, index) => (
                <div key={step.no} className="flex shrink-0 items-center gap-5 sm:gap-6">
                  <article className="w-[220px] sm:w-[240px]">
                    <div className="relative aspect-square overflow-hidden bg-[#e9e5dd]">
                      <ProcessVisualTile visual={step.visual} />
                      <span className="absolute left-2.5 top-2.5 bg-[#211b1c]/85 px-2 py-1 text-[10px] font-bold text-white">
                        {step.no}
                      </span>
                    </div>
                    <h3 className="mt-4 text-lg font-bold tracking-[-0.02em]">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-stone-600">{step.desc}</p>
                  </article>
                  {index < processSteps.length - 1 && (
                    <span className="hidden text-2xl text-stone-300 sm:block" aria-hidden="true">
                      →
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 03. 어떤 방식으로 시작하시나요 */}
        <section className="border-b border-black/10 bg-[#ece8e0]">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand sm:text-xs">
              Where do you start
            </p>
            <h2 className="mt-3 max-w-2xl text-4xl font-extrabold tracking-[-0.03em] sm:text-6xl">
              어떤 방식으로 시작하시나요?
            </h2>

            <div className="mt-10 grid grid-cols-1 gap-3 sm:mt-14 lg:grid-cols-4 lg:grid-rows-2 lg:gap-4">
              {startPaths.map((path) => (
                <Link
                  key={path.title}
                  to={path.href}
                  className={`group relative block overflow-hidden ${path.span} ${path.aspect}`}
                >
                  <img
                    src={path.image}
                    alt={path.title}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1c1516]/85 via-[#1c1516]/15 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
                    <h3 className="text-xl font-bold tracking-[-0.02em] sm:text-2xl">{path.title}</h3>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-white/75">{path.desc}</p>
                    <span className="mt-4 inline-flex items-center text-sm font-bold text-white">
                      {path.cta} <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 04. 현재 진행 중인 펀딩 */}
        <section
          className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16"
          data-tutorial="home-collection"
        >
          <div className="flex items-end justify-between gap-6 border-b border-black/10 pb-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand sm:text-xs">
                Live funding
              </p>
              <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] sm:text-6xl">
                아이디어가 지금,<br className="sm:hidden" /> 실제 옷이 되고 있습니다.
              </h2>
              <p className="mt-3 text-sm text-stone-500 sm:text-base">BRAND-ER에서 진행 중인 디자인을 만나보세요.</p>
            </div>
            <Link
              to="/fundings"
              className="hidden shrink-0 items-center text-sm font-semibold text-stone-600 transition hover:text-brand sm:inline-flex"
            >
              전체 펀딩 보기 <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>

          {approvedFundings === null ? (
            <div className="flex h-64 items-center justify-center text-sm text-stone-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-brand" /> 펀딩을 불러오고 있습니다
            </div>
          ) : liveFundings.length === 0 ? (
            <div className="border-y border-black/10 py-24 text-center">
              <h3 className="text-2xl font-bold text-[#211b1c]">새로운 펀딩을 준비하고 있습니다.</h3>
              <p className="mt-3 text-sm text-stone-500">곧 공개될 BRAND-ER의 다음 아이디어를 기다려주세요.</p>
              <Link
                to="/customize"
                className="mt-7 inline-flex h-12 items-center justify-center border border-stone-400 px-6 text-sm font-bold transition hover:bg-[#211b1c] hover:text-white"
              >
                내 디자인 펀딩 열기
              </Link>
            </div>
          ) : (
            <div className="mt-9 grid grid-cols-2 gap-x-3 gap-y-11 sm:gap-x-6 lg:grid-cols-4 lg:gap-x-7">
              {liveFundings.map((funding, index) => {
                const percent = getProgressPercent(funding);
                const barWidth = Math.min(100, percent);

                return (
                  <Link key={funding.id} to={`/fundings/${funding.id}`} className="group block min-w-0">
                    <article>
                      <div className="relative aspect-[4/5] overflow-hidden bg-[#e9e5dd]">
                        <img
                          src={funding.image_url}
                          alt={funding.product_name}
                          className="h-full w-full object-contain p-3 transition duration-700 ease-out group-hover:scale-[1.045] sm:p-5"
                        />
                        <WatermarkOverlay />
                        <span className="absolute left-3 top-3 bg-[#f4f1ea]/90 px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.15em] text-[#2a2324] backdrop-blur sm:left-4 sm:top-4 sm:text-[10px]">
                          {getRemainingLabel(funding)}
                        </span>
                        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/10">
                          <div className="h-full bg-brand transition-all" style={{ width: `${barWidth}%` }} />
                        </div>
                      </div>
                      <div className="pt-4">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-brand sm:text-[11px]">
                          BRAND-ER · {funding.cloth_type}
                        </p>
                        <h3 className="mt-1.5 truncate text-sm font-semibold text-[#211b1c] sm:text-base">
                          {funding.product_name}
                        </h3>
                        <p className="mt-3 text-sm font-bold sm:text-base">{formatPrice(funding.price)}</p>
                        <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-3 text-[9px] text-stone-500 sm:text-[11px]">
                          <span>
                            {funding.current_orders}/{funding.moq}장 참여
                          </span>
                          <span className="font-bold text-brand">{percent}% 달성</span>
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          )}

          <Link
            to="/fundings"
            className="mt-10 inline-flex h-12 w-full items-center justify-center border border-[#211b1c] text-sm font-bold transition hover:bg-[#211b1c] hover:text-white sm:hidden"
          >
            전체 펀딩 보기 <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </section>

        {/* 05. 펀딩이 끝나면 어떻게 되나요 */}
        <section className="border-y border-black/10 bg-[#211819] text-white">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
            <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#d7a6b2] sm:text-xs">
              After the funding
            </p>
            <h2 className="mt-3 max-w-2xl text-4xl font-extrabold tracking-[-0.03em] sm:text-6xl">
              펀딩 성공이 끝이 아닙니다.<br />그때부터 진짜 옷이 만들어집니다.
            </h2>

            <div className="mt-10 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mt-14">
              <div className="flex w-max gap-4 sm:grid sm:w-auto sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
                {afterFundingSteps.map((step) => (
                  <article key={step.step} className="w-[260px] shrink-0 sm:w-auto">
                    <div className="relative aspect-[3/4] overflow-hidden bg-[#332a2c]">
                      <img src={step.image} alt={step.title} className="h-full w-full object-cover opacity-90" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#150f10]/80 via-transparent to-transparent" />
                      <span className="absolute left-3 top-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#e6b7c2]">
                        {step.step}
                      </span>
                    </div>
                    <h3 className="mt-4 text-lg font-bold tracking-[-0.02em]">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-white/60">{step.desc}</p>
                  </article>
                ))}
              </div>
            </div>

            <p className="mt-12 max-w-2xl text-base leading-8 text-white/70 sm:mt-16 sm:text-lg">
              고객은 아이디어에 먼저 참여하고,<br />
              BRAND-ER는 선택받은 아이디어를 실제 제품으로 만듭니다.
            </p>
          </div>
        </section>

        {/* 06. 실제 제작 사례 */}
        <section className="border-b border-black/10 bg-[#f4f1ea]">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand sm:text-xs">
                  Production portfolio
                </p>
                <h2 className="mt-3 max-w-xl text-4xl font-extrabold tracking-[-0.03em] sm:text-6xl">
                  화면 속 디자인이<br />실제 옷이 되었습니다.
                </h2>
              </div>
              <Link
                to="/portfolio"
                className="inline-flex h-12 w-fit items-center justify-center bg-brand px-7 text-sm font-bold text-white transition hover:bg-brand-dark"
              >
                전체 제작 사례 보기 <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-8 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3">
              {portfolioHighlights.map((product) => (
                <Link key={product.id} to="/portfolio" className="group block">
                  <div className="relative aspect-[4/5] overflow-hidden bg-[#e9e5dd]">
                    <img
                      src={product.image}
                      alt={product.nameKo}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain p-6 transition duration-700 group-hover:scale-[1.04]"
                    />
                    <div className="absolute bottom-3 right-3 h-14 w-14 overflow-hidden border-2 border-[#f4f1ea] shadow-[0_6px_18px_rgba(0,0,0,0.18)]">
                      <img
                        src={product.image}
                        alt=""
                        aria-hidden="true"
                        className="h-full w-full object-contain p-1 grayscale contrast-125"
                        style={{ filter: "grayscale(1) contrast(1.3) sepia(0.25)" }}
                      />
                    </div>
                    <span className="absolute left-3 top-3 bg-[#f4f1ea]/90 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#2a2324] backdrop-blur">
                      Design → Product
                    </span>
                  </div>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-brand">
                    {product.index} · {portfolioProducts.find((p) => p.id === product.id)?.category}
                  </p>
                  <h3 className="mt-1 text-lg font-bold tracking-[-0.02em]">{product.nameKo}</h3>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 07. BRAND-ER 핵심 기능 */}
        <section className="border-b border-black/10 bg-[#ece8e0]">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand sm:text-xs">Core features</p>
            <h2 className="mt-3 max-w-2xl text-4xl font-extrabold tracking-[-0.03em] sm:text-6xl">
              옷을 만드는 복잡한 과정을 하나로.
            </h2>

            <div className="mt-10 grid grid-cols-1 gap-5 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3">
              {coreFeatures.map((feature) => (
                <Link key={feature.title} to={feature.href} className="group block bg-[#f4f1ea]">
                  <div className="relative aspect-[16/10] overflow-hidden bg-[#e9e5dd]">
                    {feature.images ? (
                      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-black/10">
                        {feature.images.map((img, i) => (
                          <img key={i} src={img} alt="" className="h-full w-full object-cover" />
                        ))}
                      </div>
                    ) : (
                      <img
                        src={feature.image}
                        alt={feature.title}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]"
                      />
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-3 p-5">
                    <div>
                      <h3 className="text-lg font-bold tracking-[-0.02em]">{feature.title}</h3>
                      <p className="mt-1.5 text-sm leading-6 text-stone-600">{feature.desc}</p>
                    </div>
                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-stone-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 08. 마지막 CTA */}
        <section className="relative isolate overflow-hidden bg-[#150f10]">
          <img
            src={getAppPath("/brand-er-hero-editorial-v2.webp")}
            alt="BRAND-ER 의류 제작 스튜디오"
            className="absolute inset-0 h-full w-full object-cover opacity-45"
            style={{ filter: "grayscale(0.3) contrast(1.1)" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#150f10]/70 via-[#2a0f16]/75 to-[#150f10]/92" />
          <div className="relative mx-auto flex min-h-[520px] max-w-[1200px] flex-col items-center justify-center px-6 py-24 text-center text-white sm:min-h-[600px]">
            <h2 className="max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-6xl">
              당신의 머릿속에만 있던 옷,<br />이제 실제로 만들어보세요.
            </h2>
            <p className="mt-6 max-w-md text-base leading-7 text-white/70 sm:text-lg">
              디자인 경험이 없어도 시작할 수 있습니다.
            </p>
            <Link
              to="/customize"
              className="mt-9 inline-flex h-14 items-center justify-center bg-brand px-9 text-base font-bold text-white transition hover:bg-brand-dark"
              data-tutorial="home-start-cta"
            >
              내 옷 제작하기 <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
