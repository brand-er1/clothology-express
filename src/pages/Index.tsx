import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import {
  ArrowRight,
  Calculator,
  Check,
  Compass,
  Factory,
  Heart,
  ShieldCheck,
  Sparkles,
  Users,
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

const platformSteps = [
  {
    number: "01",
    title: "마음에 드는 디자인 발견",
    description: "아직 매장에는 없는 새로운 브랜드와 패션 아이디어를 가장 먼저 만나보세요.",
    icon: Compass,
  },
  {
    number: "02",
    title: "프리오더로 함께 결정",
    description: "원하는 컬러와 사이즈를 선택해 참여하면 달성 수량에 실시간으로 반영됩니다.",
    icon: Users,
  },
  {
    number: "03",
    title: "목표 달성 후 제작",
    description: "필요한 수량이 모인 디자인만 브랜더의 생산 네트워크를 통해 실제 제품이 됩니다.",
    icon: Factory,
  },
  {
    number: "04",
    title: "과정을 확인하고 배송",
    description: "원단 컨택부터 샘플과 생산까지 진행 상황을 확인하고 완성된 제품을 받아보세요.",
    icon: ShieldCheck,
  },
];

const faqs = [
  {
    question: "브랜더 펀딩에는 어떻게 참여하나요?",
    answer: "마음에 드는 디자인을 선택한 뒤 컬러, 사이즈와 수량을 정해 참여할 수 있습니다. 로그인하면 참여 내역과 제작 진행 상황을 내 펀딩에서 확인할 수 있습니다.",
  },
  {
    question: "펀딩 목표 수량을 달성하지 못하면 어떻게 되나요?",
    answer: "목표 수량에 도달하지 못한 디자인은 생산하지 않습니다. 참여 및 결제 상태는 내 펀딩에서 확인하고 안내된 정책에 따라 취소할 수 있습니다.",
  },
  {
    question: "목표 달성 후 제품은 언제 받을 수 있나요?",
    answer: "일반적으로 원단 컨택, 패턴·샘플 확인과 본생산을 거쳐 약 2~3주가 소요됩니다. 디자인 난이도와 원단 수급 상황에 따라 일정이 달라질 수 있습니다.",
  },
  {
    question: "의류를 전혀 몰라도 내 디자인을 만들 수 있나요?",
    answer: "가능합니다. 의류 종류, 소재, 색상과 원하는 분위기를 선택하면 AI가 디자인을 시각화합니다. 전문 용어를 몰라도 단계별 안내를 따라 첫 펀딩을 만들 수 있습니다.",
  },
  {
    question: "자동 견적이 최종 제작비와 똑같나요?",
    answer: "자동 견적은 이미지와 선택 사양을 기준으로 계산한 예상 범위입니다. 원단 실물, 패턴 난이도와 후가공 사양을 확정한 뒤 최종 금액이 달라질 수 있습니다.",
  },
  {
    question: "펀딩 없이 바로 제작을 의뢰할 수도 있나요?",
    answer: "가능합니다. 제작할 수량이 이미 정해졌다면 ‘바로 제작 의뢰하기’를 선택하세요. AI 디자인과 자동 견적을 확인하고 의뢰서를 접수하면 담당자가 사양을 검토해 연락드립니다.",
  },
  {
    question: "다른 브랜드 로고를 넣어도 되나요?",
    answer: "유명 국내·해외 브랜드로 확인되는 고위험 로고는 자동 차단됩니다. 식별이 어렵거나 일반적인 이미지는 우선 통과 후 관리자 검토가 진행되며, 사용 권리에 대한 책임은 업로드한 사용자에게 있습니다.",
  },
];

const projectProgress = (project: ShowcaseProject) =>
  Math.min(100, Math.round((project.current_orders / Math.max(project.moq, 1)) * 100));

const heroEditorialImage = getAppPath("/brand-er-hero-editorial-v2.webp");

const Index = () => {
  const [approvedFundings, setApprovedFundings] = useState<Funding[]>([]);

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
    if (approvedFundings.length) return approvedFundings.slice(0, 4);

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

  return (
    <div className="min-h-screen bg-[#f4f0ea] text-[#201b19]">
      <Header />
      <main className="pt-[72px]">
        <section className="relative overflow-hidden border-b border-stone-200 bg-[#f4f0ea]">
          <div className="absolute -right-48 -top-56 h-[42rem] w-[42rem] rounded-full bg-[#d6bcb2]/45 blur-[120px]" />
          <div className="relative mx-auto grid min-h-[760px] max-w-[1440px] items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:px-12 lg:py-20">
            <div className="max-w-2xl">
              <div className="mb-7 inline-flex items-center rounded-full border border-stone-300 bg-white/65 px-4 py-2 text-xs font-bold tracking-[0.08em] text-brand backdrop-blur">
                <Sparkles className="mr-2 h-4 w-4" />
                DISCOVER THE NEXT FASHION
              </div>
              <h1 className="text-[3.15rem] font-semibold leading-[1.02] tracking-[-0.06em] text-stone-950 sm:text-6xl md:text-7xl">
                당신의 취향이
                <br />
                <span className="text-brand">다음 브랜드가 됩니다.</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-stone-600 sm:text-lg">
                아직 세상에 없는 디자인을 가장 먼저 발견하고 참여해보세요. 사람들의 선택이 모이면 브랜더가 실제 제품으로 만듭니다.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-14 rounded-full bg-brand px-8 text-base font-bold hover:bg-brand-light">
                  <Link to="/fundings">
                    지금 펀딩 둘러보기 <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-14 rounded-full border-stone-300 bg-white/50 px-8 text-base hover:bg-white">
                  <Link to="/customize?mode=direct">바로 제작 의뢰하기</Link>
                </Button>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-stone-500">
                {["새로운 브랜드 발견", "목표 달성 후 제작", "진행 과정을 투명하게"].map((text) => (
                  <span key={text} className="flex items-center">
                    <Check className="mr-1.5 h-4 w-4 text-brand" />
                    {text}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-2xl pb-8 pt-4">
              <div className="absolute inset-10 rounded-[3rem] bg-brand/15 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2.25rem] border border-white/80 bg-[#ded3c9] p-3 shadow-[0_35px_90px_rgba(53,37,32,0.18)]">
                <div className="relative aspect-[5/4] overflow-hidden rounded-[1.75rem] bg-[#e7dfd5]">
                  <img
                    src={heroEditorialImage}
                    alt="다양한 패션 아이디어를 전시한 브랜더 에디토리얼"
                    className="h-full w-full object-cover object-[68%_center] transition duration-700 hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#211a19]/45 via-transparent to-transparent" />
                  <div className="absolute left-5 top-5 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-[10px] font-bold tracking-[0.18em] text-stone-800 backdrop-blur-md sm:left-7 sm:top-7">
                    BRAND-ER EDITORIAL
                  </div>
                  <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-5 text-white sm:bottom-8 sm:left-8 sm:right-8">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/70">Discover your taste</p>
                      <p className="mt-2 max-w-sm text-xl font-semibold leading-snug tracking-[-0.025em] sm:text-2xl">
                        한 가지 상품이 아닌,
                        <br />
                        새로운 취향을 발견하는 곳.
                      </p>
                    </div>
                    <span className="hidden h-12 w-12 items-center justify-center rounded-full border border-white/50 bg-white/15 backdrop-blur sm:flex">
                      <Compass className="h-5 w-5" />
                    </span>
                  </div>
                </div>
              </div>
              <div className="absolute -right-2 top-10 flex items-center gap-2 rounded-full bg-[#201819] px-4 py-3 text-xs font-bold text-white shadow-xl sm:-right-5">
                <Heart className="h-4 w-4 fill-[#e2aaa4] text-[#e2aaa4]" /> 취향으로 함께 만드는 패션
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-stone-200 bg-[#fbfaf8]">
          <div className="mx-auto grid max-w-[1440px] grid-cols-2 divide-x divide-stone-200 px-4 py-8 md:grid-cols-4 md:px-8">
            {[
              ["DISCOVER", "새로운 디자인 발견"],
              ["PRE-ORDER", "원하는 제품에 참여"],
              ["TOGETHER", "목표 달성 후 제작"],
              ["TRACK", "생산 과정 확인"],
            ].map(([value, label]) => (
              <div key={label} className="px-3 py-3 text-center">
                <strong className="text-sm font-bold tracking-[0.12em] text-brand sm:text-base">{value}</strong>
                <p className="mt-1.5 text-[11px] text-stone-500 sm:text-xs">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:px-12 lg:py-28">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">Trending now</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] md:text-5xl">지금 주목할 디자인</h2>
            </div>
            <Button asChild variant="ghost" className="w-fit rounded-full font-semibold text-stone-600 hover:bg-white hover:text-brand">
              <Link to="/fundings">전체 펀딩 보기 <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>

          <div className="mt-12 grid gap-7 md:grid-cols-3">
            {projects.slice(0, 3).map((project) => {
              const progress = projectProgress(project);
              return (
                <Link
                  key={project.id}
                  to={hasLiveFundings ? `/fundings/${project.id}` : "/fundings"}
                  className="group"
                >
                  <article>
                    <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-[#e9e1d9] p-7">
                      <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-bold tracking-wide text-stone-700 backdrop-blur">
                        {project.cloth_type}
                      </span>
                      <span
                        aria-hidden="true"
                        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-stone-600 transition hover:text-brand"
                      >
                        <Heart className="h-4 w-4" />
                      </span>
                      <img
                        src={project.image_url}
                        alt={project.product_name}
                        className="h-full w-full object-contain drop-shadow-xl transition duration-500 group-hover:scale-[1.04]"
                      />
                    </div>
                    <div className="px-1 pt-5">
                      <p className="text-xs font-bold text-brand">{progress}% 달성</p>
                      <h3 className="mt-2 truncate text-xl font-bold tracking-tight">{project.product_name}</h3>
                      <div className="mt-3 flex items-end justify-between">
                        <p className="font-bold">{project.price ? `${project.price.toLocaleString("ko-KR")}원` : "가격 준비 중"}</p>
                        <p className="text-xs text-stone-400">{project.current_orders}/{project.moq}명</p>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="bg-[#ded3c9]">
          <div className="mx-auto grid max-w-[1440px] gap-6 px-5 py-24 sm:px-8 lg:grid-cols-2 lg:px-12 lg:py-28">
            <article className="flex min-h-[430px] flex-col justify-between rounded-[2rem] bg-[#fbfaf8] p-8 md:p-10">
              <div>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eee5dd] text-brand"><Heart className="h-5 w-5" /></span>
                <p className="mt-10 text-xs font-bold uppercase tracking-[0.2em] text-brand">For supporters</p>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em]">구경하는 재미,<br />함께 만드는 경험.</h2>
                <p className="mt-5 max-w-md text-sm leading-7 text-stone-500">
                  평범한 쇼핑 대신 새로운 디자이너의 아이디어를 발견하고, 마음에 드는 제품이 탄생하는 과정에 참여하세요.
                </p>
              </div>
              <Button asChild className="mt-10 h-12 w-fit rounded-full bg-brand px-6 hover:bg-brand-dark">
                <Link to="/fundings">새로운 디자인 발견하기 <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </article>

            <article className="flex min-h-[430px] flex-col justify-between rounded-[2rem] bg-[#201819] p-8 text-white md:p-10">
              <div>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-[#e1b2ad]"><Sparkles className="h-5 w-5" /></span>
                <p className="mt-10 text-xs font-bold uppercase tracking-[0.2em] text-[#e1b2ad]">For makers</p>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em]">상황에 맞는 방식으로<br />아이디어를 제품으로.</h2>
                <p className="mt-5 max-w-md text-sm leading-7 text-white/58">
                  수요를 먼저 확인하고 싶다면 펀딩으로, 제작 수량이 이미 정해졌다면 바로 제작으로 시작하세요.
                </p>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <Users className="h-5 w-5 text-[#e1b2ad]" />
                    <p className="mt-4 font-bold">펀딩이 필요한 경우</p>
                    <p className="mt-1 text-xs leading-5 text-white/50">재고 부담 없이 수요를 확인한 뒤 생산</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <Factory className="h-5 w-5 text-[#e1b2ad]" />
                    <p className="mt-4 font-bold">바로 제작할 경우</p>
                    <p className="mt-1 text-xs leading-5 text-white/50">확정 수량으로 제작 의뢰를 바로 접수</p>
                  </div>
                </div>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="outline" className="h-12 rounded-full border-white/20 bg-transparent px-6 text-white hover:bg-white hover:text-stone-950">
                  <Link to="/customize?mode=funding">펀딩으로 시작 <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild className="h-12 rounded-full bg-brand px-6 text-white hover:bg-brand-light">
                  <Link to="/customize?mode=direct">바로 제작 의뢰 <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
            </article>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">How Brand-er works</p>
              <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-[-0.045em] md:text-5xl">
                취향이 모여 제품이 되는
                <br />새로운 패션 방식.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-stone-500">
              고객은 원하는 디자인의 탄생에 참여하고, 메이커는 실제 수요가 확인된 제품만 안전하게 제작합니다.
            </p>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-[2rem] border border-stone-200 bg-stone-200 md:grid-cols-2 xl:grid-cols-4">
            {platformSteps.map(({ icon: Icon, number, title, description }) => (
              <article key={number} className="group bg-[#fbfaf8] p-7 transition hover:bg-white lg:p-8">
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#efe7e1] text-brand transition group-hover:bg-brand group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-bold tracking-[0.18em] text-stone-300">{number}</span>
                </div>
                <h3 className="mt-12 text-xl font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-stone-500">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-stone-200 bg-[#fbfaf8]">
          <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:px-12 lg:py-28">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">Professional system</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em]">재미있게 시작하고,<br />전문적으로 완성합니다.</h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-stone-500">
                쉬운 화면 뒤에는 실제 제작에 필요한 견적 분석과 안전 검수, 생산 운영 시스템이 연결되어 있습니다.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                [Sparkles, "AI 디자인", "아이디어를 앞·뒤 의류 이미지로 빠르게 시각화합니다."],
                [Calculator, "자동 견적", "공임, 원단, 후가공과 개발비를 분리해 예상 비용을 계산합니다."],
                [ShieldCheck, "상표 검수", "유명 브랜드 고위험 로고를 자동으로 감지하고 차단합니다."],
                [Factory, "원스톱 생산", "원단 컨택, 패턴, 샘플, 본생산과 배송을 단계별로 관리합니다."],
              ].map(([Icon, title, text]) => {
                const FeatureIcon = Icon as typeof Sparkles;
                return (
                  <article key={String(title)} className="rounded-2xl border border-stone-200 bg-white p-6">
                    <FeatureIcon className="h-5 w-5 text-brand" />
                    <h3 className="mt-8 text-lg font-bold">{String(title)}</h3>
                    <p className="mt-2 text-sm leading-6 text-stone-500">{String(text)}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1200px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[0.75fr_1.25fr] lg:py-32">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">Q&A</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em]">참여하기 전,<br />많이 묻는 질문</h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-stone-500">
              펀딩 참여부터 직접 디자인을 만드는 방법까지, 궁금한 내용을 먼저 확인해보세요.
            </p>
          </div>
          <Accordion type="single" collapsible className="border-t border-stone-300">
            {faqs.map((faq, index) => (
              <AccordionItem key={faq.question} value={`faq-${index}`} className="border-stone-300">
                <AccordionTrigger className="py-6 text-left text-base font-semibold hover:text-brand hover:no-underline sm:text-lg">
                  <span className="mr-4 text-xs font-bold text-stone-400">{String(index + 1).padStart(2, "0")}</span>
                  <span className="flex-1">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="pb-6 pl-9 pr-8 text-sm leading-7 text-stone-600">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="border-t border-stone-200 bg-[#201819] text-white">
          <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-8 px-5 py-20 sm:px-8 md:flex-row md:items-center lg:px-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#dfb1ac]">Fashion made together</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] md:text-4xl">발견하는 사람도, 만드는 사람도 즐겁게.</h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-14 rounded-full bg-brand px-8 text-base font-bold hover:bg-brand-light">
                <Link to="/fundings">펀딩 둘러보기 <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-14 rounded-full border-white/20 bg-transparent px-8 text-base text-white hover:bg-white hover:text-stone-950">
                <Link to="/customize?mode=direct">바로 제작 의뢰하기</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
