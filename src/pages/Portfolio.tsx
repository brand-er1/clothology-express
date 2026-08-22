import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Calculator,
  FileText,
  Factory,
  Layers,
  Lightbulb,
  MessageCircle,
  PackageCheck,
  Ruler,
  Sparkles,
  Truck,
} from "lucide-react";
import { Header } from "@/components/Header";
import { PortfolioProductCard } from "@/components/portfolio/PortfolioProductCard";
import { PortfolioProductDetail } from "@/components/portfolio/PortfolioProductDetail";
import {
  portfolioPdfUrl,
  portfolioProducts,
  type PortfolioCategory,
  type PortfolioProduct,
} from "@/data/portfolioProducts";

const filterOptions: Array<{ value: "ALL" | PortfolioCategory; label: string }> = [
  { value: "ALL", label: "ALL" },
  { value: "TOP", label: "TOP" },
  { value: "BOTTOM", label: "BOTTOM" },
  { value: "OUTER", label: "OUTER" },
  { value: "HOODIE", label: "HOODIE" },
  { value: "TECHNICAL", label: "TECHNICAL" },
];

const aboutCards = [
  {
    number: "01",
    title: "쉽게 디자인",
    description: "전문 디자인 툴 없이 원하는 옷을 이미지로 확인합니다.",
  },
  {
    number: "02",
    title: "먼저 비용 확인",
    description: "패턴·샘플·공임·후가공이 반영된 예상 견적을 확인합니다.",
  },
  {
    number: "03",
    title: "실제 생산까지",
    description: "의류 프로모션 담당자가 원단, 샘플, 본생산과 배송을 연결합니다.",
  },
];

const beforeItems = [
  "참고 이미지만으로 디자인을 설명하기 어렵다",
  "패턴·샘플·원단·후가공 업체를 따로 찾는다",
  "제작 전에 총비용을 알기 어렵다",
  "MOQ와 선생산 때문에 재고가 남을 수 있다",
  "현재 제작 단계와 일정을 관리하기 어렵다",
];

const afterItems = [
  "AI 이미지로 원하는 디자인을 먼저 시각화한다",
  "이미지 기반 자동견적으로 예상 비용을 확인한다",
  "상표 위험과 예상 순이익을 함께 검토한다",
  "자동견적 후 담당자 상담으로 제작 방향을 정한다",
  "샘플부터 배송까지 진행 상태를 한눈에 확인한다",
];

const processSteps = [
  { number: "01", title: "아이디어", description: "키워드·참고 이미지", icon: Lightbulb, to: undefined as string | undefined },
  { number: "02", title: "AI 이미지", description: "앞·뒤 의류 생성", icon: Sparkles, to: "/customize" },
  { number: "03", title: "자동견적", description: "예상 제작비 확인", icon: Calculator, to: "/design-quote" },
  { number: "04", title: "제작 상담", description: "원단·사양·일정 확정", icon: MessageCircle, to: "/design-quote" },
  { number: "05", title: "샘플", description: "패턴·원단·핏 확인", icon: Ruler, to: undefined },
  { number: "06", title: "본생산", description: "수량별 제작·후가공", icon: Factory, to: undefined },
  { number: "07", title: "검수·배송", description: "QC·포장·납품", icon: PackageCheck, to: undefined },
];

const trackingSteps = [
  { number: "01", title: "견적·상담", description: "사양 확정" },
  { number: "02", title: "원단 컨택", description: "원단 확보" },
  { number: "03", title: "샘플 제작", description: "핏·사양 확인" },
  { number: "04", title: "본생산", description: "수량 제작" },
  { number: "05", title: "검수·포장", description: "QC·포장" },
  { number: "06", title: "납품 완료", description: "배송·수령" },
];

const trackingRoles = [
  { title: "고객", description: "생성한 의류 이미지 · 자동견적 결과 · 현재 제작 단계 확인" },
  { title: "프로모션 담당자", description: "원단·샘플·생산 일정과 수정 요청을 통합 관리" },
  { title: "생산 파트너", description: "확정 사양·수량·후가공 기준으로 제작과 검수를 진행" },
];

const fabricGroups = [
  { category: "티셔츠", fabrics: "싱글 저지 · 코튼 · 기능성 원단" },
  { category: "후디·스웨트", fabrics: "쭈리 · 기모 · 고중량 저지" },
  { category: "팬츠·자켓", fabrics: "트윌 · 캔버스 · 데님 · 레더" },
  { category: "니트", fabrics: "게이지와 혼용률에 따른 원사 선택" },
];

const policyCards = [
  { title: "1회 개발비", description: "패턴비 + 샘플비 + 프린팅·자수 판비 + 소재별 샘플 가산" },
  { title: "장당 변동비", description: "생산 공임 + 원단비 + 프린팅·자수·워싱 + 부자재 + 소재 가산" },
  { title: "MOQ", description: "일반 제품 20장부터 · 니트·레더 등 일부 품목은 100장 기준" },
  { title: "수량 할인", description: "100장 -5% · 200장 -7% · 300장 -10% (제품 조건에 따라 달라질 수 있음)" },
  { title: "샘플", description: "제작상 문제 외 수정 시 샘플비 추가 (수정 샘플은 동일 비용이 발생할 수 있음)" },
  { title: "기타", description: "종이패턴 제공 · 배송비 포함 · VAT 별도 · 최종 견적서 기준으로 확정" },
];

const startCards = [
  { number: "01", title: "디자인", description: "참고 이미지, 직접 그린 스케치 또는 원하는 분위기" },
  { number: "02", title: "제품 정보", description: "의류 카테고리, 핏, 컬러, 원단 느낌" },
  { number: "03", title: "후가공", description: "프린팅·자수·패치 위치와 크기" },
  { number: "04", title: "생산 조건", description: "희망 수량, 사이즈 구성, 일정과 예산" },
];

const aiDesignInputs = [
  "의류 카테고리",
  "오버핏·슬림핏 등 실루엣",
  "추천 원단과 컬러",
  "프린팅·자수·패치 위치",
  "참고 이미지 또는 직접 입력한 문장",
];

const smartCheckCards = [
  {
    title: "AI 자동견적",
    description: "의류 종류, 소재, 프린팅·자수, 워싱, 안감, 봉제 난이도를 분석해 단가 DB와 매칭합니다.",
    tags: ["1회 개발비", "장당 변동비", "수량별 할인"],
  },
  {
    title: "상표 위험 분석",
    description: "유명 국내외 브랜드의 로고·문구·형태와 비교해 자동 차단, 관리자 검토, 우선 승인으로 분류합니다.",
    tags: ["로고·문구 추출", "유사도 점수", "위험도 분류"],
  },
  {
    title: "의류 프로모션 상담",
    description: "생성 이미지와 자동견적 결과를 기준으로 담당자가 원단, 샘플, 후가공과 생산 일정을 구체화합니다.",
    tags: ["디자인 시안", "예상 견적", "담당자 제작 상담"],
  },
];

const Portfolio = () => {
  const [filter, setFilter] = useState<"ALL" | PortfolioCategory>("ALL");
  const [selectedProduct, setSelectedProduct] = useState<PortfolioProduct | null>(null);

  const filteredProducts = useMemo(
    () => (filter === "ALL" ? portfolioProducts : portfolioProducts.filter((p) => p.category === filter)),
    [filter],
  );

  const heroSampleImages = portfolioProducts
    .filter((p) => ["burgundy-leather-jacket", "technical-shell", "studded-hoodie"].includes(p.id))
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-[#f1f0ed] text-[#211b1c]">
      <Header />
      <main className="pt-16 sm:pt-[72px]">
        {/* 3. Portfolio Hero */}
        <section className="border-b border-black/10 bg-[#f4f0ea]">
          <div className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12 lg:py-24 xl:px-16">
            <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
              <div>
                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.24em] text-brand sm:text-xs">
                  <span className="h-px w-8 bg-brand" />
                  CUSTOMER SERVICE PORTFOLIO · 2026
                </div>
                <h1 className="mt-5 font-serif text-[clamp(2.6rem,6.4vw,5.2rem)] font-normal leading-[0.98] tracking-[-0.05em] text-[#211b1c]">
                  당신의 아이디어를<br />입을 수 있는 제품으로.
                </h1>
                <p className="mt-6 max-w-lg text-base leading-8 text-stone-600 sm:text-lg">
                  디자인이 없어도,<br />
                  공장을 몰라도,<br />
                  브랜더와 함께 시작할 수 있습니다.
                </p>
                <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.22em] text-stone-500">
                  AI DESIGN · AUTO QUOTE · PROMOTION · PRODUCTION
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/customize"
                    className="inline-flex h-[52px] items-center justify-center bg-brand px-7 text-sm font-bold text-white transition hover:bg-brand-dark sm:h-14"
                  >
                    내 옷 만들어보기 <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                  <Link
                    to="/design-quote"
                    className="inline-flex h-[52px] items-center justify-center border border-[#312829]/25 bg-white/50 px-7 text-sm font-semibold text-[#312829] transition hover:bg-white sm:h-14"
                  >
                    제작 상담하기
                  </Link>
                </div>
                <a
                  href={portfolioPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 underline-offset-4 hover:text-brand hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" />
                  브랜더 포트폴리오 PDF 보기
                </a>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {heroSampleImages.map((product, index) => (
                  <div
                    key={product.id}
                    className={`aspect-[3/4] overflow-hidden bg-[#e9e5dd] ${index === 1 ? "mt-6 sm:mt-10" : ""}`}
                  >
                    <img
                      src={product.image}
                      alt={product.nameKo}
                      loading={index === 0 ? "eager" : "lazy"}
                      decoding="async"
                      className="h-full w-full object-contain p-3 sm:p-4"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 4. About Brand-er */}
        <section className="border-b border-black/10 bg-[#f1f0ed]">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 xl:px-16">
            <div className="max-w-2xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand sm:text-xs">About brand-er</p>
              <h2 className="mt-3 font-serif text-3xl font-normal leading-[1.08] tracking-[-0.04em] sm:text-5xl">
                옷을 처음 만드는 사람도<br />실제 제품을 만들 수 있도록
              </h2>
              <p className="mt-5 text-sm leading-7 text-stone-600 sm:text-base">
                브랜더는 AI와 의류 제작 실무를 결합해 이미지 제작·자동견적·샘플·생산을
                한 흐름으로 제공하는 의류 프로모션 서비스입니다.
              </p>
            </div>

            <div className="mt-10 grid gap-px overflow-hidden border border-black/10 bg-black/10 sm:grid-cols-3">
              {aboutCards.map((card) => (
                <div key={card.number} className="bg-[#f1f0ed] p-6 sm:p-8">
                  <span className="text-[10px] font-bold tracking-[0.18em] text-brand">{card.number}</span>
                  <h3 className="mt-3 font-serif text-xl font-normal tracking-[-0.02em] sm:text-2xl">{card.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-stone-600">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Why brand-er before/after */}
        <section className="border-b border-black/10 bg-[#211b1c] text-white">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 xl:px-16">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d7a6b2] sm:text-xs">Why brand-er</p>
            <h2 className="mt-3 font-serif text-3xl font-normal leading-[1.08] tracking-[-0.04em] sm:text-5xl">
              의류 제작의 복잡한 과정을 한곳으로
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
              공장과 업체를 따로 찾고 반복해서 설명하던 과정을 브랜더의 표준 프로세스로 바꿉니다.
            </p>

            <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-16">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/45">Before</p>
                <p className="mt-1 text-lg font-semibold text-white/85">브랜더 사용 전</p>
                <ul className="mt-6 space-y-0 border-t border-white/15">
                  {beforeItems.map((item, index) => (
                    <li key={item} className="flex gap-4 border-b border-white/15 py-4 text-sm leading-6 text-white/65 sm:text-base">
                      <span className="shrink-0 text-white/35">0{index + 1}</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e6b7c2]">After</p>
                <p className="mt-1 text-lg font-semibold text-white">브랜더 사용 후</p>
                <ul className="mt-6 space-y-0 border-t border-white/25">
                  {afterItems.map((item, index) => (
                    <li key={item} className="flex gap-4 border-b border-white/25 py-4 text-sm leading-6 text-white sm:text-base">
                      <span className="shrink-0 text-[#e6b7c2]">0{index + 1}</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 6-8. Production Portfolio + filter + cards */}
        <section id="production-portfolio" className="scroll-mt-20 border-b border-black/10 bg-[#f1f0ed]">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 xl:px-16">
            <div className="flex flex-wrap items-end justify-between gap-6 border-b border-black/10 pb-6">
              <div className="max-w-2xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand sm:text-xs">Production portfolio</p>
                <h2 className="mt-3 font-serif text-3xl font-normal leading-[1.08] tracking-[-0.04em] sm:text-5xl">
                  다양한 의류를 실제 제품으로 구현합니다
                </h2>
                <p className="mt-4 text-sm leading-7 text-stone-600 sm:text-base">
                  기본 톱과 팬츠부터 레더, 워크웨어, 테크니컬 아우터까지 제품별 소재와 봉제 구조에 맞춰 제작합니다.
                </p>
              </div>
            </div>

            <div className="-mx-5 mt-8 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={`shrink-0 whitespace-nowrap border px-4 py-2 text-xs font-bold tracking-[0.08em] transition ${
                    filter === option.value
                      ? "border-brand bg-brand text-white"
                      : "border-black/15 bg-transparent text-stone-600 hover:border-brand/50 hover:text-brand"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-6 lg:grid-cols-4 lg:gap-x-7">
              {filteredProducts.map((product) => (
                <PortfolioProductCard key={product.id} product={product} onSelect={setSelectedProduct} />
              ))}
            </div>
          </div>
        </section>

        {/* 9. Production process */}
        <section className="border-b border-black/10 bg-[#f4f0ea]">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 xl:px-16">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand sm:text-xs">Service process</p>
            <h2 className="mt-3 font-serif text-3xl font-normal leading-[1.08] tracking-[-0.04em] sm:text-5xl">
              이미지에서 실제 제품까지
            </h2>

            <div className="mt-12 flex flex-col gap-0 lg:flex-row lg:items-stretch lg:gap-0">
              {processSteps.map((step, index) => {
                const Icon = step.icon;
                const content = (
                  <div className="flex h-full flex-col gap-3 border border-black/10 bg-[#f1f0ed] p-5 transition hover:border-brand/40 sm:p-6">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-[0.18em] text-brand">{step.number}</span>
                      <Icon className="h-4 w-4 text-brand" />
                    </div>
                    <h3 className="font-serif text-xl font-normal tracking-[-0.02em]">{step.title}</h3>
                    <p className="text-xs leading-5 text-stone-500">{step.description}</p>
                  </div>
                );
                return (
                  <div key={step.number} className="flex flex-1 flex-col lg:flex-row lg:items-stretch">
                    <div className="flex-1">
                      {step.to ? <Link to={step.to} className="block h-full">{content}</Link> : content}
                    </div>
                    {index < processSteps.length - 1 && (
                      <div className="flex h-6 items-center justify-center lg:h-auto lg:w-6">
                        <span className="h-6 w-px bg-black/15 lg:h-px lg:w-6" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 10. AI Design */}
        <section className="border-b border-black/10 bg-[#f1f0ed]">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 xl:px-16">
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand sm:text-xs">AI design</p>
                <h2 className="mt-3 font-serif text-3xl font-normal leading-[1.08] tracking-[-0.04em] sm:text-5xl">
                  말로 설명한 아이디어를<br />의류 이미지로
                </h2>
                <p className="mt-5 text-sm leading-7 text-stone-600 sm:text-base">
                  카테고리·핏·원단·컬러·디테일을 선택하면 제작 상담에 활용할 수 있는 앞·뒤 시안을 생성합니다.
                </p>
                <ul className="mt-7 space-y-3 border-t border-black/10 pt-6 text-sm text-stone-700">
                  {aiDesignInputs.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/customize"
                  className="mt-8 inline-flex h-12 items-center justify-center bg-brand px-7 text-sm font-bold text-white transition hover:bg-brand-dark sm:h-14"
                >
                  AI로 옷 만들어보기 <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {portfolioProducts
                  .filter((p) => ["technical-shell", "burgundy-leather-jacket"].includes(p.id))
                  .map((product, index) => (
                    <div key={product.id} className={`aspect-[3/4] overflow-hidden bg-[#e9e5dd] ${index === 1 ? "mt-8" : ""}`}>
                      <img src={product.image} alt={product.nameKo} loading="lazy" decoding="async" className="h-full w-full object-contain p-5" />
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </section>

        {/* 11. Auto Quote (SMART CHECK) */}
        <section className="border-b border-black/10 bg-[#211b1c] text-white">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 xl:px-16">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d7a6b2] sm:text-xs">Auto quote</p>
            <h2 className="mt-3 font-serif text-3xl font-normal leading-[1.08] tracking-[-0.04em] sm:text-5xl">
              이미지를 만들었다면<br />제작비도 바로 확인하세요
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
              생성한 이미지를 분석해 예상 제작비와 유명 상표 위험을 확인한 뒤 의류 프로모션 담당자에게 전달합니다.
            </p>

            <div className="mt-10 grid gap-px overflow-hidden border border-white/15 bg-white/15 sm:grid-cols-3">
              {smartCheckCards.map((card) => (
                <div key={card.title} className="bg-[#211b1c] p-6 sm:p-7">
                  <h3 className="font-serif text-xl font-normal tracking-[-0.02em]">{card.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/60">{card.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {card.tags.map((tag) => (
                      <span key={tag} className="border border-white/20 px-2.5 py-1 text-[10px] font-semibold text-white/70">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Link
              to="/design-quote"
              className="mt-10 inline-flex h-12 items-center justify-center border border-white/35 px-7 text-sm font-bold text-white transition hover:bg-white hover:text-[#211b1c] sm:h-14"
            >
              자동견적 받아보기 <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* 12. Fabric & Detail support */}
        <section className="border-b border-black/10 bg-[#f1f0ed]">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 xl:px-16">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand sm:text-xs">Fabric &amp; detail support</p>
            <h2 className="mt-3 font-serif text-3xl font-normal leading-[1.08] tracking-[-0.04em] sm:text-5xl">
              제품에 맞는 원단과<br />후가공을 함께 찾습니다
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
              카테고리별로 자주 사용하는 원단을 추천하고 사진 예시와 스와치를 통해 실제 질감과 색상을 확인합니다.
            </p>

            <div className="mt-10 grid gap-px overflow-hidden border border-black/10 bg-black/10 sm:grid-cols-2 lg:grid-cols-4">
              {fabricGroups.map((group) => (
                <div key={group.category} className="bg-[#f1f0ed] p-6">
                  <h3 className="font-semibold text-stone-900">{group.category}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-500">{group.fabrics}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-px overflow-hidden border border-black/10 bg-black/10 sm:grid-cols-2">
              <div className="bg-[#f4f0ea] p-6 sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Swatch service</p>
                <h3 className="mt-2 font-serif text-xl font-normal tracking-[-0.02em] sm:text-2xl">
                  원단 스와치 5개 이상 신청
                </h3>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  원하는 원단 느낌과 색상을 필수로 입력하고 참고 이미지를 함께 전달하면 담당자가 적합한 원단을 선별합니다.
                </p>
                <Link
                  to="/fabric-swatch"
                  className="mt-5 inline-flex items-center text-sm font-bold text-brand hover:underline"
                >
                  원단 스와치 신청하기 <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="bg-[#f4f0ea] p-6 sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Knit special rule</p>
                <h3 className="mt-2 font-serif text-xl font-normal tracking-[-0.02em] sm:text-2xl">
                  니트는 패치 중심으로 구현
                </h3>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  니트 제품은 일반 프린팅보다 로고·이미지 패치를 권장하며, 원사와 편직 구조를 고려해
                  최소 생산 수량을 별도로 안내합니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 13. Quote & production policy */}
        <section className="border-b border-black/10 bg-[#f4f0ea]">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 xl:px-16">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand sm:text-xs">Quote &amp; production policy</p>
            <h2 className="mt-3 font-serif text-3xl font-normal leading-[1.08] tracking-[-0.04em] sm:text-5xl">
              견적은 개발비와 장당 비용을 나눠 확인합니다
            </h2>

            <div className="mt-10 grid gap-px overflow-hidden border border-black/10 bg-black/10 sm:grid-cols-2 lg:grid-cols-3">
              {policyCards.map((card) => (
                <div key={card.title} className="bg-[#f1f0ed] p-6">
                  <h3 className="font-semibold text-stone-900">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-500">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 14. Production tracking */}
        <section className="border-b border-black/10 bg-[#f1f0ed]">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 xl:px-16">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand sm:text-xs">Production tracking</p>
            <h2 className="mt-3 font-serif text-3xl font-normal leading-[1.08] tracking-[-0.04em] sm:text-5xl">
              제작 과정도 한눈에 확인하세요
            </h2>

            <div className="mt-12 lg:flex lg:items-stretch">
              {trackingSteps.map((step, index) => (
                <div key={step.number} className="flex lg:flex-1 lg:flex-col">
                  <div className="flex items-start gap-4 py-5 lg:flex-col lg:items-start lg:gap-0 lg:py-0 lg:pr-6">
                    <div className="flex flex-col items-center lg:w-full lg:flex-row lg:items-center">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand text-xs font-bold text-brand">
                        {step.number}
                      </span>
                      {index < trackingSteps.length - 1 && (
                        <span className="mt-1 h-full w-px flex-1 bg-black/15 lg:ml-2 lg:mt-0 lg:h-px lg:w-full" />
                      )}
                    </div>
                    <div className="pb-6 lg:mt-4 lg:pb-0">
                      <h3 className="font-semibold text-stone-900">{step.title}</h3>
                      <p className="mt-1 text-xs text-stone-500">{step.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-px overflow-hidden border border-black/10 bg-black/10 sm:grid-cols-3">
              {trackingRoles.map((role) => (
                <div key={role.title} className="bg-[#f4f0ea] p-6">
                  <h3 className="font-semibold text-stone-900">{role.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-500">{role.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 15. Start a project */}
        <section className="border-b border-black/10 bg-[#f4f0ea]">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 xl:px-16">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand sm:text-xs">Start a project</p>
            <h2 className="mt-3 font-serif text-3xl font-normal leading-[1.08] tracking-[-0.04em] sm:text-5xl">
              이 정보만 준비하면<br />상담을 시작할 수 있습니다
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
              모든 항목이 완벽하지 않아도 괜찮습니다. 가능한 정보부터 전달하면 브랜더가 필요한 내용을 함께 정리합니다.
            </p>

            <div className="mt-10 grid gap-px overflow-hidden border border-black/10 bg-black/10 sm:grid-cols-2 lg:grid-cols-4">
              {startCards.map((card) => (
                <div key={card.number} className="bg-[#f1f0ed] p-6">
                  <span className="text-[10px] font-bold tracking-[0.18em] text-brand">{card.number}</span>
                  <h3 className="mt-3 font-semibold text-stone-900">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-500">{card.description}</p>
                </div>
              ))}
            </div>

            <Link
              to="/design-quote"
              className="mt-10 inline-flex h-12 w-full items-center justify-center bg-brand text-sm font-bold text-white transition hover:bg-brand-dark sm:h-14 sm:w-auto sm:px-8"
            >
              제작 상담 시작하기 <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* 16-17. Final CTA + PDF link */}
        <section className="bg-[#711a2a] text-white">
          <div className="mx-auto max-w-[1440px] px-5 py-16 text-center sm:px-8 sm:py-24 lg:px-12 xl:px-16">
            <h2 className="mx-auto max-w-3xl font-serif text-[clamp(2.2rem,5.4vw,4.4rem)] font-normal leading-[1.04] tracking-[-0.05em]">
              당신의 아이디어를<br />입을 수 있는 제품으로.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-white/70 sm:text-base">
              디자인이 없어도, 공장을 몰라도,<br />브랜더와 함께 시작할 수 있습니다.
            </p>
            <div className="mx-auto mt-9 flex max-w-xl flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                to="/customize"
                className="inline-flex h-12 items-center justify-center bg-white px-6 text-sm font-bold text-[#711a2a] transition hover:bg-white/90 sm:h-14"
              >
                내 옷 만들기
              </Link>
              <Link
                to="/design-quote"
                className="inline-flex h-12 items-center justify-center border border-white/50 px-6 text-sm font-bold text-white transition hover:bg-white/10 sm:h-14"
              >
                자동견적 받기
              </Link>
              <Link
                to="/design-quote"
                className="inline-flex h-12 items-center justify-center border border-white/50 px-6 text-sm font-bold text-white transition hover:bg-white/10 sm:h-14"
              >
                제작 상담하기
              </Link>
            </div>
            <a
              href={portfolioPdfUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center gap-1.5 text-xs font-semibold text-white/60 underline-offset-4 hover:text-white hover:underline"
            >
              <FileText className="h-3.5 w-3.5" />
              브랜더 포트폴리오 PDF 보기
            </a>
          </div>
        </section>
      </main>

      <PortfolioProductDetail product={selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)} />
    </div>
  );
};

export default Portfolio;
