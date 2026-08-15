import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import {
  ArrowRight,
  Calculator,
  Check,
  ChevronRight,
  Factory,
  FileCheck2,
  Heart,
  Layers3,
  Palette,
  Ruler,
  Sparkles,
  Truck,
  Upload,
  WandSparkles,
} from "lucide-react";
import { getAppPath } from "@/utils/appUrl";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { fetchApprovedFundings } from "@/services/funding";
import type { Funding } from "@/types/funding";

type ShowcaseProject = Pick<
  Funding,
  "id" | "product_name" | "image_url" | "cloth_type" | "current_orders" | "moq" | "price"
>;

const productionSteps = [
  { number: "01", label: "DESIGN", title: "AI 디자인", description: "아이디어를 앞·뒤 의류 이미지로 시각화", icon: Sparkles },
  { number: "02", label: "ESTIMATE", title: "자동 견적", description: "원단·공임·후가공과 개발비 분석", icon: Calculator },
  { number: "03", label: "SAMPLE", title: "샘플 제작", description: "패턴과 실물 샘플 확인", icon: FileCheck2 },
  { number: "04", label: "PRODUCTION", title: "본생산", description: "생산 일정과 품질을 단계별 관리", icon: Factory },
  { number: "05", label: "DELIVERY", title: "검수·납품", description: "QC, 포장과 배송까지 한 번에", icon: Truck },
];

const garmentCategories = [
  { label: "반팔 티셔츠", image: "/lovable-uploads/short_sleeve.png", moq: "20장부터", fabric: "코튼 저지" },
  { label: "긴팔 티셔츠", image: "/lovable-uploads/long_sleeve.png", moq: "20장부터", fabric: "코튼 저지" },
  { label: "스웻셔츠", image: "/lovable-uploads/sweatshirt.png", moq: "20장부터", fabric: "쭈리·기모" },
  { label: "후드티", image: "/lovable-uploads/hoodie.png", moq: "20장부터", fabric: "쭈리·기모" },
  { label: "팬츠", image: "/lovable-uploads/long_pants.png", moq: "20장부터", fabric: "우븐·쭈리" },
  { label: "자켓", image: "/lovable-uploads/jacket.png", moq: "20장부터", fabric: "우븐·레더" },
];

const faqs = [
  {
    question: "의류를 전혀 몰라도 디자인을 만들 수 있나요?",
    answer: "가능합니다. 의류 종류, 소재, 색상과 원하는 분위기를 선택하면 AI가 디자인을 시각화합니다. 전문 용어를 몰라도 단계별 안내를 따라 제작 의뢰까지 진행할 수 있습니다.",
  },
  {
    question: "최소 제작 수량은 몇 장인가요?",
    answer: "일반 의류는 20장부터 제작할 수 있습니다. 니트와 일부 특수 품목은 원사·공정 특성상 최소 수량이 달라질 수 있으며, 품목 선택 단계에서 별도로 안내합니다.",
  },
  {
    question: "자동 견적이 최종 제작비와 똑같나요?",
    answer: "자동 견적은 이미지와 선택 사양을 기준으로 계산한 예상 범위입니다. 원단 실물, 패턴 난이도와 후가공 사양을 확정한 뒤 최종 금액이 달라질 수 있습니다.",
  },
  {
    question: "샘플부터 완제품까지 얼마나 걸리나요?",
    answer: "사양 확정 후 일반적으로 원단 컨택, 패턴·샘플 확인과 본생산을 거쳐 약 2~3주가 소요됩니다. 디자인 난이도와 원단 수급 상황에 따라 일정은 달라질 수 있습니다.",
  },
  {
    question: "펀딩 없이 바로 제작을 의뢰할 수도 있나요?",
    answer: "가능합니다. AI 디자인을 완성한 뒤 마지막 단계에서 ‘제작 의뢰하기’를 선택하세요. 수요 검증이 필요하면 ‘펀딩 만들기’를 선택할 수도 있습니다.",
  },
  {
    question: "다른 브랜드 로고를 넣어도 되나요?",
    answer: "유명 국내·해외 브랜드로 확인되는 고위험 로고는 자동 차단됩니다. 식별이 어렵거나 일반적인 이미지는 관리자 검토가 진행되며, 사용 권리에 대한 책임은 업로드한 사용자에게 있습니다.",
  },
];

const projectProgress = (project: ShowcaseProject) =>
  Math.min(100, Math.round((project.current_orders / Math.max(project.moq, 1)) * 100));

const Index = () => {
  const [approvedFundings, setApprovedFundings] = useState<Funding[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [selectedQuantity, setSelectedQuantity] = useState(20);

  useEffect(() => {
    let active = true;

    fetchApprovedFundings()
      .then((fundings) => {
        if (active) setApprovedFundings(fundings);
      })
      .catch((error) => {
        console.error("Failed to load homepage fundings:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  const projects = useMemo<ShowcaseProject[]>(() => {
    if (approvedFundings.length) return approvedFundings.slice(0, 3);

    return [
      {
        id: "preview-jacket",
        product_name: "Burgundy Crop Jacket",
        image_url: getAppPath("/lovable-uploads/jacket.png"),
        cloth_type: "재킷",
        current_orders: 14,
        moq: 20,
        price: 109000,
      },
      {
        id: "preview-hoodie",
        product_name: "Daily Graphic Hoodie",
        image_url: getAppPath("/lovable-uploads/hoodie.png"),
        cloth_type: "후드티",
        current_orders: 11,
        moq: 20,
        price: 89000,
      },
      {
        id: "preview-pants",
        product_name: "Relaxed Wide Pants",
        image_url: getAppPath("/lovable-uploads/long_pants.png"),
        cloth_type: "팬츠",
        current_orders: 8,
        moq: 20,
        price: 79000,
      },
    ];
  }, [approvedFundings]);

  const hasLiveFundings = approvedFundings.length > 0;
  const category = garmentCategories[selectedCategory];

  return (
    <div className="min-h-screen bg-[#f5f1eb] text-[#1d1917]">
      <Header />
      <main className="pt-16 sm:pt-[72px]">
        <section className="relative overflow-hidden border-b border-stone-200/80 bg-[#f7f4ef]">
          <div className="absolute -left-56 top-28 h-[34rem] w-[34rem] rounded-full bg-white blur-[110px]" />
          <div className="absolute -right-36 -top-44 h-[38rem] w-[38rem] rounded-full bg-[#b8857d]/20 blur-[120px]" />
          <div className="relative mx-auto grid min-h-[740px] max-w-[1440px] items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:px-12">
            <div className="max-w-[650px]">
              <div className="inline-flex items-center rounded-full border border-brand/15 bg-white/70 px-3.5 py-2 text-[10px] font-bold tracking-[0.14em] text-brand shadow-sm backdrop-blur sm:text-xs">
                <WandSparkles className="mr-2 h-4 w-4" />
                AI FASHION PRODUCTION PLATFORM
              </div>
              <h1 className="mt-6 text-[2.55rem] font-semibold leading-[1.06] tracking-[-0.06em] text-stone-950 sm:text-6xl lg:text-[4.55rem] lg:leading-[0.99]">
                AI로 디자인하고,
                <br />견적 받고,
                <br /><span className="text-brand">20장부터 생산까지.</span>
              </h1>
              <p className="mt-7 max-w-xl text-[15px] leading-7 text-stone-600 sm:text-lg sm:leading-8">
                아이디어만 입력하면 앞·뒤 디자인을 만들고 예상 견적을 확인합니다. 원단 컨택, 패턴, 샘플과 본생산은 브랜더가 이어서 관리합니다.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row">
                <Button asChild size="lg" className="h-14 rounded-full bg-brand px-8 text-base font-bold shadow-[0_14px_35px_rgba(113,16,17,0.22)] hover:bg-brand-light">
                  <Link to="/customize">
                    <Sparkles className="mr-2 h-5 w-5" /> AI로 디자인하기
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-14 rounded-full border-stone-300 bg-white/65 px-8 text-base font-bold hover:bg-white">
                  <Link to="/design-quote">제작 의뢰하기 <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
              <div className="mt-9 grid max-w-xl grid-cols-3 gap-2 sm:gap-3">
                {[["MOQ", "20장부터"], ["PROCESS", "원스톱 생산"], ["DELIVERY", "샘플 후 2–3주"]].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-stone-200/90 bg-white/55 px-3 py-3.5 backdrop-blur sm:px-4">
                    <p className="text-[9px] font-bold tracking-[0.12em] text-brand sm:text-[10px]">{label}</p>
                    <p className="mt-1 text-[12px] font-bold text-stone-800 sm:text-sm">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[690px] py-4">
              <div className="absolute inset-8 rounded-[3rem] bg-brand/15 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-stone-800/80 bg-[#171313] p-3 shadow-[0_35px_100px_rgba(43,28,25,0.25)] sm:rounded-[2.5rem] sm:p-5">
                <div className="flex items-center justify-between px-2 pb-4 pt-1 text-white sm:px-3">
                  <div>
                    <p className="text-[9px] font-bold tracking-[0.18em] text-[#d9aaa4] sm:text-[10px]">BRAND-ER AI STUDIO</p>
                    <p className="mt-1 text-xs font-semibold text-white/80 sm:text-sm">Design workspace</p>
                  </div>
                  <div className="flex gap-1.5"><span className="h-2 w-2 rounded-full bg-[#d5a7a0]" /><span className="h-2 w-2 rounded-full bg-white/20" /><span className="h-2 w-2 rounded-full bg-white/20" /></div>
                </div>
                <div className="grid overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#221d1c] sm:grid-cols-[0.82fr_1.18fr]">
                  <div className="order-2 border-t border-white/10 p-5 text-white sm:order-1 sm:border-r sm:border-t-0 sm:p-6">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-[10px] font-bold tracking-[0.14em] text-[#d9aaa4]">DESIGN BRIEF</p>
                      <p className="mt-3 text-sm leading-6 text-white/75">240g 코튼 오버핏 반팔. 차콜 컬러, 앞가슴 미니 로고와 등판 타이포 그래픽.</p>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {[[Ruler, "FIT", "오버핏"], [Layers3, "FABRIC", "240g 코튼"], [Palette, "COLOR", "차콜"], [Sparkles, "PRINT", "실크스크린"]].map(([Icon, label, value]) => {
                        const StudioIcon = Icon as typeof Ruler;
                        return (
                          <div key={String(label)} className="rounded-xl border border-white/10 bg-black/10 p-3">
                            <StudioIcon className="h-3.5 w-3.5 text-[#d9aaa4]" />
                            <p className="mt-2 text-[8px] font-bold tracking-[0.12em] text-white/35">{String(label)}</p>
                            <p className="mt-0.5 text-[11px] font-semibold text-white/80">{String(value)}</p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-brand px-4 py-3 text-xs font-bold">
                      디자인 생성 <Sparkles className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="order-1 relative flex min-h-[350px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_42%,#f2e9e1_0%,#d8c6ba_55%,#bda59a_100%)] p-8 sm:order-2 sm:min-h-[520px]">
                    <div className="absolute left-4 top-4 rounded-full border border-white/60 bg-white/65 px-3 py-1.5 text-[9px] font-bold tracking-[0.15em] text-stone-700 backdrop-blur">FRONT · AI GENERATED</div>
                    <div className="absolute right-4 top-4 rounded-full bg-[#201819] px-3 py-1.5 text-[9px] font-bold text-white">01 / 02</div>
                    <div className="absolute h-64 w-64 rounded-full border border-white/35 sm:h-80 sm:w-80" />
                    <img src={getAppPath("/lovable-uploads/short_sleeve.png")} alt="AI로 생성된 반팔 티셔츠 디자인 미리보기" className="relative z-10 h-[275px] w-full object-contain drop-shadow-[0_28px_25px_rgba(38,24,21,0.28)] sm:h-[390px]" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-2xl border border-white/55 bg-white/60 px-4 py-3 backdrop-blur-lg">
                      <div><p className="text-[9px] font-bold tracking-[0.12em] text-brand">READY TO ESTIMATE</p><p className="mt-0.5 text-xs font-bold text-stone-800">사양 분석 완료</p></div>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white"><ArrowRight className="h-4 w-4" /></span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -right-2 bottom-1 rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-xl backdrop-blur sm:-right-5 sm:bottom-8">
                <p className="text-[9px] font-bold tracking-[0.12em] text-brand">MINIMUM ORDER</p>
                <p className="mt-1 text-sm font-bold">20 PCS START</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-stone-200 bg-[#fbfaf8]">
          <div className="mx-auto grid max-w-[1440px] gap-px bg-stone-200 sm:grid-cols-2 xl:grid-cols-5">
            {productionSteps.map(({ icon: Icon, number, label, title, description }) => (
              <article key={number} className="group bg-[#fbfaf8] px-5 py-7 transition hover:bg-white sm:px-7">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-[0.16em] text-brand">{number} · {label}</span>
                  <Icon className="h-4 w-4 text-stone-300 transition group-hover:text-brand" />
                </div>
                <h2 className="mt-8 text-lg font-bold">{title}</h2>
                <p className="mt-2 text-xs leading-5 text-stone-500">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">Choose your product</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">무엇을 만들고 싶으세요?</h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-stone-500">제품을 선택하면 핏과 추천 원단, 후가공을 해당 카테고리에 맞춰 안내합니다.</p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {garmentCategories.map((item, index) => (
              <button
                type="button"
                key={item.label}
                onClick={() => setSelectedCategory(index)}
                className={`group rounded-[1.5rem] border p-3 text-left transition duration-300 ${selectedCategory === index ? "border-brand bg-white shadow-[0_16px_40px_rgba(71,43,37,0.10)]" : "border-stone-200 bg-white/55 hover:border-brand/35 hover:bg-white"}`}
              >
                <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[1.1rem] bg-[#ebe4dc] p-3">
                  <img src={getAppPath(item.image)} alt={item.label} className="h-full w-full object-contain drop-shadow-lg transition duration-300 group-hover:scale-105" />
                </div>
                <div className="px-1 pb-1 pt-4">
                  <p className="text-sm font-bold sm:text-[15px]">{item.label}</p>
                  <p className="mt-1 text-[11px] text-stone-500">{item.moq}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-[#1d1817] text-white">
          <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#daa9a3]">AI Design Studio</p>
                <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">챗봇이 아닌,<br />의류 제작 워크스페이스.</h2>
              </div>
              <p className="max-w-md text-sm leading-7 text-white/50">핏, 원단, 컬러와 프린팅 위치까지 선택하고 FRONT / BACK 디자인을 크게 확인하세요.</p>
            </div>
            <div className="mt-12 grid overflow-hidden rounded-[2rem] border border-white/10 bg-[#171312] lg:grid-cols-[0.92fr_1.08fr]">
              <div className="border-b border-white/10 p-6 sm:p-9 lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between">
                  <div><p className="text-[10px] font-bold tracking-[0.16em] text-[#daa9a3]">01 · DESIGN BRIEF</p><h3 className="mt-3 text-2xl font-bold">만들고 싶은 옷을 설명하세요.</h3></div>
                  <WandSparkles className="hidden h-7 w-7 text-[#daa9a3] sm:block" />
                </div>
                <div className="mt-7 min-h-36 rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm leading-7 text-white/65">
                  {category.label}, 여유로운 오버핏. {category.fabric} 원단에 딥 버건디 컬러. 앞가슴에는 작은 로고, 등판에는 크게 타이포 그래픽.
                  <span className="ml-1 inline-block h-4 w-[1px] animate-pulse bg-[#daa9a3] align-middle" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                  {[["제품", category.label], ["핏", "오버핏"], ["원단", category.fabric], ["후가공", "실크스크린"]].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-white/10 px-3 py-3">
                      <p className="text-[9px] font-bold tracking-[0.12em] text-white/30">{label}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-white/80">{value}</p>
                    </div>
                  ))}
                </div>
                <Button asChild className="mt-5 h-13 w-full rounded-full bg-brand font-bold hover:bg-brand-light">
                  <Link to="/customize">내 디자인 생성하기 <Sparkles className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
              <div className="relative flex min-h-[430px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_42%,#eee3da_0%,#cfbab0_52%,#9f8178_100%)] p-8 sm:min-h-[580px]">
                <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:42px_42px]" />
                <div className="absolute left-5 top-5 rounded-full bg-white/75 px-4 py-2 text-[10px] font-bold tracking-[0.14em] text-stone-700 backdrop-blur">FRONT VIEW</div>
                <div className="absolute right-5 top-5 flex items-center gap-2 rounded-full bg-[#201819] px-4 py-2 text-[10px] font-bold"><span className="h-1.5 w-1.5 rounded-full bg-[#e2aba4]" /> AI GENERATED</div>
                <img src={getAppPath(category.image)} alt={`${category.label} AI 디자인 미리보기`} className="relative z-10 h-[330px] w-full object-contain drop-shadow-[0_35px_30px_rgba(45,26,22,0.3)] transition duration-500 sm:h-[455px]" />
                <div className="absolute bottom-5 left-5 right-5 flex flex-col gap-3 rounded-2xl border border-white/50 bg-white/65 p-4 text-stone-800 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-[9px] font-bold tracking-[0.14em] text-brand">NEXT STEP</p><p className="mt-1 text-sm font-bold">이 디자인으로 자동 견적 받기</p></div>
                  <Button asChild size="sm" className="rounded-full bg-[#201819] px-5 hover:bg-brand"><Link to="/design-quote">견적 확인 <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-stone-200 bg-[#fbfaf8]">
          <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.86fr_1.14fr] lg:px-12 lg:py-28">
            <div className="self-center">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">Smart estimate</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">쇼핑 가격이 아닌,<br />제작 견적답게.</h2>
              <p className="mt-6 max-w-lg text-sm leading-7 text-stone-500 sm:text-base">장당 단가 하나만 보여주지 않습니다. 1회 개발비와 장당 생산비를 나누고, 어떤 사양이 견적에 반영됐는지 함께 보여줍니다.</p>
              <div className="mt-7 flex flex-wrap gap-2">
                {[20, 30, 50, 100, 200].map((quantity) => (
                  <button type="button" key={quantity} onClick={() => setSelectedQuantity(quantity)} className={`rounded-full border px-4 py-2 text-xs font-bold transition ${selectedQuantity === quantity ? "border-stone-950 bg-stone-950 text-white" : "border-stone-300 bg-white text-stone-500 hover:border-brand hover:text-brand"}`}>{quantity}장</button>
                ))}
              </div>
            </div>
            <div className="rounded-[2rem] border border-stone-200 bg-white p-4 shadow-[0_24px_70px_rgba(68,45,39,0.08)] sm:p-7">
              <div className="rounded-[1.5rem] bg-[#201819] p-6 text-white sm:p-8">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-6">
                  <div><p className="text-[10px] font-bold tracking-[0.16em] text-[#dda9a4]">ESTIMATE PREVIEW</p><h3 className="mt-2 text-xl font-bold">{selectedQuantity}장 기준 예상 견적</h3></div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-white/55">VAT 별도</span>
                </div>
                <div className="py-2">
                  {[["1회 개발비", "패턴 · 샘플", "사양 확정 후 계산"], ["장당 생산비", "원단 · 공임 · 후가공", "수량별 자동 계산"], ["수량 할인", "100장부터 적용", selectedQuantity >= 200 ? "7% 예상" : selectedQuantity >= 100 ? "5% 예상" : "해당 없음"]].map(([title, detail, value]) => (
                    <div key={title} className="flex items-center justify-between gap-4 border-b border-white/10 py-5 last:border-0">
                      <div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-[11px] text-white/35">{detail}</p></div>
                      <p className="text-right text-xs font-semibold text-white/70">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-2 rounded-2xl border border-[#dba7a1]/20 bg-[#dba7a1]/[0.08] p-5">
                  <div className="flex items-center justify-between gap-4"><div><p className="text-[9px] font-bold tracking-[0.14em] text-[#dda9a4]">TOTAL ESTIMATE</p><p className="mt-2 text-lg font-bold">디자인 분석 후 바로 확인</p></div><Calculator className="h-6 w-6 text-[#dda9a4]" /></div>
                  <p className="mt-3 text-[11px] leading-5 text-white/40">실제 원단과 제작 사양 확정 시 최종 금액이 달라질 수 있습니다.</p>
                </div>
                <Button asChild className="mt-5 h-13 w-full rounded-full bg-brand font-bold hover:bg-brand-light"><Link to="/design-quote">내 디자인 견적받기 <Upload className="ml-2 h-4 w-4" /></Link></Button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">Live funding</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">지금 주목할 디자인</h2></div>
            <Button asChild variant="ghost" className="w-fit rounded-full font-semibold text-stone-600 hover:bg-white hover:text-brand"><Link to="/fundings">전체 펀딩 보기 <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
          <div className="mt-10 grid gap-7 md:grid-cols-3">
            {projects.map((project) => {
              const progress = projectProgress(project);
              return (
                <Link key={project.id} to={hasLiveFundings ? `/fundings/${project.id}` : "/fundings"} className="group">
                  <article>
                    <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] border border-stone-200 bg-[#e9e1d9] p-7">
                      <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-bold tracking-wide text-stone-700 backdrop-blur">{project.cloth_type}</span>
                      <span aria-hidden="true" className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-stone-600 transition group-hover:text-brand"><Heart className="h-4 w-4" /></span>
                      <img src={project.image_url} alt={project.product_name} className="h-full w-full object-contain drop-shadow-xl transition duration-500 group-hover:scale-[1.04]" />
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/70"><div className="h-full bg-brand" style={{ width: `${progress}%` }} /></div>
                    </div>
                    <div className="px-1 pt-5"><div className="flex items-center justify-between"><p className="text-xs font-bold text-brand">{progress}% 달성</p><p className="text-xs text-stone-400">{project.current_orders}/{project.moq}명</p></div><h3 className="mt-2 truncate text-xl font-bold tracking-tight">{project.product_name}</h3><p className="mt-3 font-bold">{project.price ? `${project.price.toLocaleString("ko-KR")}원` : "가격 준비 중"}</p></div>
                  </article>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="border-y border-stone-200 bg-[#ded3c9]">
          <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
            <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">From idea to delivery</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">화면 속 디자인이<br />실제 제품이 되는 과정.</h2>
                <p className="mt-6 max-w-md text-sm leading-7 text-stone-600">디자인만 만들어 끝나는 서비스가 아닙니다. 샘플 확인과 생산 진행률까지 한 계정에서 이어집니다.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <article className="overflow-hidden rounded-[1.75rem] bg-[#201819] p-5 text-white">
                  <p className="text-[10px] font-bold tracking-[0.14em] text-[#dda9a4]">01 · AI DESIGN</p>
                  <div className="mt-5 flex aspect-square items-center justify-center rounded-2xl bg-[radial-gradient(circle,#efe4dc_0%,#b79b90_100%)] p-4"><img src={getAppPath("/lovable-uploads/short_sleeve.png")} alt="AI 의류 디자인" className="h-full w-full object-contain drop-shadow-xl" /></div>
                  <p className="mt-5 text-lg font-bold">앞·뒤 디자인 생성</p><p className="mt-2 text-xs leading-5 text-white/45">원하는 사양을 시각적으로 확인</p>
                </article>
                <article className="rounded-[1.75rem] bg-[#fbfaf8] p-5">
                  <p className="text-[10px] font-bold tracking-[0.14em] text-brand">02 · SAMPLE CHECK</p>
                  <div className="mt-5 space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
                    {["패턴 제작 완료", "원단 컨택 완료", "샘플 검수 대기"].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-xl bg-[#f5f1eb] px-3 py-3"><span className={`flex h-6 w-6 items-center justify-center rounded-full ${index < 2 ? "bg-brand text-white" : "bg-stone-200 text-stone-400"}`}>{index < 2 ? <Check className="h-3.5 w-3.5" /> : index + 1}</span><span className="text-xs font-semibold">{item}</span></div>)}
                  </div>
                  <p className="mt-5 text-lg font-bold">샘플 확인</p><p className="mt-2 text-xs leading-5 text-stone-500">핏·원단·후가공을 생산 전 검수</p>
                </article>
                <article className="rounded-[1.75rem] bg-brand p-5 text-white">
                  <p className="text-[10px] font-bold tracking-[0.14em] text-white/55">03 · PRODUCTION</p>
                  <div className="mt-5 rounded-2xl bg-black/15 p-5">
                    <div className="flex items-center justify-between"><p className="text-xs font-bold">본생산 진행률</p><p className="text-xl font-bold">72%</p></div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/20"><div className="h-full w-[72%] rounded-full bg-white" /></div>
                    <div className="mt-6 space-y-4">{[["재단", true], ["봉제", true], ["검수·포장", false]].map(([item, done]) => <div key={String(item)} className="flex items-center justify-between text-xs"><span className="text-white/70">{String(item)}</span><span className={`h-2 w-2 rounded-full ${done ? "bg-white" : "bg-white/25"}`} /></div>)}</div>
                  </div>
                  <p className="mt-5 text-lg font-bold">생산 과정 확인</p><p className="mt-2 text-xs leading-5 text-white/55">재단부터 납품까지 투명하게 관리</p>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1200px] gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.72fr_1.28fr] lg:py-28">
          <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">Q&A</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">제작 전에<br className="hidden sm:block" /> 많이 묻는 질문</h2><p className="mt-5 max-w-sm text-sm leading-7 text-stone-500">AI 디자인, 자동 견적과 소량 생산에 대해 먼저 확인해보세요.</p></div>
          <Accordion type="single" collapsible className="border-t border-stone-300">
            {faqs.map((faq, index) => (
              <AccordionItem key={faq.question} value={`faq-${index}`} className="border-stone-300">
                <AccordionTrigger className="py-6 text-left text-base font-semibold hover:text-brand hover:no-underline sm:text-lg"><span className="mr-4 text-xs font-bold text-stone-400">{String(index + 1).padStart(2, "0")}</span><span className="flex-1">{faq.question}</span></AccordionTrigger>
                <AccordionContent className="pb-6 pl-9 pr-8 text-sm leading-7 text-stone-600">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="border-t border-stone-200 bg-[#201819] text-white">
          <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-20 sm:px-8 md:grid-cols-[1fr_auto] md:items-end lg:px-12 lg:py-24">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#dfb1ac]">Start your collection</p><h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">20장부터,<br />당신의 브랜드를 생산하세요.</h2><p className="mt-5 text-sm leading-7 text-white/45">AI 디자인부터 샘플, 본생산과 납품까지 BRAND-ER에서 한 번에.</p></div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
              <Button asChild size="lg" className="h-14 rounded-full bg-brand px-8 text-base font-bold hover:bg-brand-light"><Link to="/customize">AI로 디자인하기 <Sparkles className="ml-2 h-5 w-5" /></Link></Button>
              <Button asChild size="lg" variant="outline" className="h-14 rounded-full border-white/20 bg-transparent px-8 text-base text-white hover:bg-white hover:text-stone-950"><Link to="/design-quote">제작 의뢰하기 <ChevronRight className="ml-2 h-5 w-5" /></Link></Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
