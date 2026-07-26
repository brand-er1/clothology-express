import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import {
  ArrowRight,
  Calculator,
  Check,
  Factory,
  ScanSearch,
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

const processSteps = [
  {
    number: "01",
    title: "AI 디자인",
    description: "의류 종류와 원단, 핏을 고르면 아이디어가 앞·뒤 디자인 이미지로 완성됩니다.",
    icon: Sparkles,
  },
  {
    number: "02",
    title: "자동 견적",
    description: "생산 공임, 원단과 후가공을 분석해 예상 제작비를 바로 확인합니다.",
    icon: Calculator,
  },
  {
    number: "03",
    title: "프리오더",
    description: "완성된 이미지로 펀딩 페이지를 열고 실제 고객 수요를 먼저 검증합니다.",
    icon: Users,
  },
  {
    number: "04",
    title: "생산·배송",
    description: "목표 수량을 달성하면 브랜더가 원단 컨택부터 생산과 배송까지 진행합니다.",
    icon: Factory,
  },
];

const faqs = [
  {
    question: "의류를 전혀 몰라도 디자인을 만들 수 있나요?",
    answer: "가능합니다. 의류 종류, 소재, 색상과 원하는 분위기를 선택하면 AI가 디자인을 시각화합니다. 전문 용어를 몰라도 단계별 선택과 설명을 따라 진행할 수 있습니다.",
  },
  {
    question: "최소 몇 장부터 제작할 수 있나요?",
    answer: "브랜더의 기본 펀딩 목표는 20장부터 시작합니다. 다만 디자인, 원단, 컬러 수와 공장 조건에 따라 실제 최소 생산수량은 최종 상담에서 조정될 수 있습니다.",
  },
  {
    question: "자동 견적이 최종 제작비와 똑같나요?",
    answer: "자동 견적은 이미지와 선택 사양을 기준으로 계산한 예상 범위입니다. 원단 실물, 패턴 난이도와 후가공 사양을 확정한 뒤 최종 금액이 달라질 수 있습니다.",
  },
  {
    question: "다른 브랜드 로고를 넣어도 되나요?",
    answer: "유명 국내·해외 브랜드로 확인되는 고위험 로고는 자동 차단됩니다. 식별이 어렵거나 일반적인 이미지는 우선 통과 후 관리자 검토가 진행되며, 사용 권리에 대한 책임은 업로드한 사용자에게 있습니다.",
  },
  {
    question: "펀딩 목표 수량을 달성하지 못하면 어떻게 되나요?",
    answer: "목표 수량에 도달하지 못한 디자인은 생산을 진행하지 않습니다. 참여 및 결제 상태는 내 펀딩에서 확인하고 안내된 정책에 따라 취소할 수 있습니다.",
  },
  {
    question: "목표 달성 후 제품은 얼마나 걸리나요?",
    answer: "일반적으로 원단 컨택, 패턴·샘플 확인과 본생산을 거쳐 약 2~3주가 소요됩니다. 디자인 난이도와 원단 수급 상황에 따라 일정이 달라질 수 있습니다.",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-[#f4f0ea] text-[#201b19]">
      <Header />
      <main className="pt-[72px]">
        <section className="relative overflow-hidden bg-[#201819] text-white">
          <div className="absolute -right-40 -top-48 h-[38rem] w-[38rem] rounded-full bg-brand/45 blur-[110px]" />
          <div className="absolute -bottom-52 left-1/3 h-96 w-96 rounded-full bg-[#6d5050]/30 blur-[120px]" />
          <div className="relative mx-auto grid min-h-[760px] max-w-[1440px] items-center gap-16 px-5 py-20 sm:px-8 lg:grid-cols-[1.03fr_0.97fr] lg:px-12">
            <div className="max-w-3xl">
              <div className="mb-7 inline-flex items-center rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-semibold tracking-wide text-white/75 backdrop-blur">
                <Sparkles className="mr-2 h-4 w-4 text-[#e4b5b0]" />
                AI FASHION LAUNCH PLATFORM
              </div>
              <h1 className="text-[3.15rem] font-semibold leading-[1.02] tracking-[-0.055em] sm:text-6xl md:text-7xl">
                디자인을 만들고,
                <br />
                <span className="text-[#dab1ad]">자동 견적까지.</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-white/62 sm:text-lg">
                아이디어만 입력하세요. 브랜더가 디자인 시각화, 제작비 분석, 펀딩과 실제 생산을 하나의 흐름으로 연결합니다.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-14 rounded-full bg-brand px-8 text-base font-bold hover:bg-brand-light">
                  <Link to="/customize">
                    첫 디자인 만들기 <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-14 rounded-full border-white/20 bg-white/[0.04] px-8 text-base text-white hover:bg-white hover:text-stone-950">
                  <Link to="/fundings">브랜드 발견하기</Link>
                </Button>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/55">
                {["재고 부담 없이", "MOQ 20장부터", "생산·배송 원스톱"].map((text) => (
                  <span key={text} className="flex items-center">
                    <Check className="mr-1.5 h-4 w-4 text-[#e4b5b0]" />
                    {text}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute inset-8 rounded-[3rem] bg-brand/35 blur-3xl" />
              <div className="relative rounded-[2rem] border border-white/12 bg-white/[0.08] p-3 shadow-[0_35px_100px_rgba(0,0,0,0.38)] backdrop-blur-xl">
                <div className="overflow-hidden rounded-[1.5rem] bg-[#eee9e2]">
                  <div className="flex items-center justify-between border-b border-black/5 px-5 py-4 text-[10px] font-bold tracking-[0.16em] text-stone-500">
                    <span>BRAND-ER AI STUDIO</span>
                    <span>COLLECTION 01</span>
                  </div>
                  <div className="aspect-[4/3] p-8 md:p-12">
                    <img
                      src={getAppPath("/lovable-uploads/jacket.png")}
                      alt="AI로 생성한 의류 디자인 예시"
                      className="h-full w-full object-contain drop-shadow-2xl"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 p-3 text-center text-[11px] text-white/75">
                  <div className="rounded-xl bg-white/[0.07] py-3"><span className="block text-white/35">COLOR</span>BURGUNDY</div>
                  <div className="rounded-xl bg-white/[0.07] py-3"><span className="block text-white/35">FIT</span>RELAXED</div>
                  <div className="rounded-xl bg-white/[0.07] py-3"><span className="block text-white/35">MOQ</span>20 PCS</div>
                </div>
              </div>
              <div className="absolute -bottom-7 -left-3 rounded-2xl border border-white/10 bg-[#38292a]/95 px-5 py-4 shadow-2xl backdrop-blur sm:-left-8">
                <p className="text-[10px] font-bold tracking-[0.12em] text-white/40">ESTIMATED COST</p>
                <p className="mt-1 text-lg font-bold text-white">자동 견적 분석 완료</p>
              </div>
              <div className="absolute -right-2 top-12 rounded-2xl border border-white/10 bg-white/90 px-4 py-3 text-stone-900 shadow-xl sm:-right-8">
                <p className="flex items-center text-xs font-semibold"><ScanSearch className="mr-1.5 h-4 w-4 text-emerald-700" /> 상표 자동 검수</p>
                <p className="mt-1 text-[11px] text-stone-500">위험 후보 없음</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-stone-200 bg-[#fbfaf8]">
          <div className="mx-auto grid max-w-[1440px] grid-cols-2 divide-x divide-stone-200 px-4 py-8 md:grid-cols-4 md:px-8">
            {[
              ["20장", "기본 펀딩 MOQ"],
              ["AI", "디자인·견적 분석"],
              ["0개", "목표 미달 재고"],
              ["ONE STOP", "생산부터 배송"],
            ].map(([value, label]) => (
              <div key={label} className="px-3 py-3 text-center">
                <strong className="text-xl font-semibold tracking-tight sm:text-2xl">{value}</strong>
                <p className="mt-1 text-[11px] text-stone-500 sm:text-xs">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">From idea to product</p>
              <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-[-0.045em] md:text-5xl">
                복잡했던 의류 제작을
                <br />하나의 흐름으로.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-stone-500">
              제작 지식이 없어도 필요한 선택만 하면 다음 단계와 예상 비용을 브랜더가 안내합니다.
            </p>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-[2rem] border border-stone-200 bg-stone-200 md:grid-cols-2 xl:grid-cols-4">
            {processSteps.map(({ icon: Icon, number, title, description }) => (
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

        <section className="bg-[#ded3c9]">
          <div className="mx-auto grid max-w-[1440px] gap-6 px-5 py-24 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:px-12 lg:py-28">
            <div className="flex flex-col justify-between rounded-[2rem] bg-[#201819] p-8 text-white md:p-10">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#dcb4af]">Why Brand-er</p>
                <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.04em]">
                  예쁜 이미지에서
                  <br />끝나지 않습니다.
                </h2>
                <p className="mt-5 max-w-md text-sm leading-7 text-white/58">
                  실제로 만들 수 있는 디자인인지, 얼마가 필요한지, 고객이 원하는지까지 한 번에 확인합니다.
                </p>
              </div>
              <Button asChild variant="outline" className="mt-12 h-12 w-fit rounded-full border-white/20 bg-transparent px-6 text-white hover:bg-white hover:text-stone-950">
                <Link to="/customize">스튜디오 살펴보기 <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {[
                ["01", "제작 가능한 디자인", "원단과 핏, 디테일을 함께 설정해 생산에 필요한 정보를 남깁니다."],
                ["02", "투명한 예상 비용", "장당 변동비와 패턴·샘플 개발비를 나눠 예상 견적을 제공합니다."],
                ["03", "안전한 상표 검수", "유명 브랜드 고위험 로고를 차단하고 검토 근거를 함께 보여줍니다."],
                ["04", "브랜드 수요 검증", "재고를 만들기 전에 펀딩으로 실제 구매 의사를 확인합니다."],
              ].map(([number, title, text]) => (
                <article key={number} className="min-h-56 rounded-[2rem] bg-[#fbfaf8] p-7">
                  <p className="text-xs font-bold tracking-[0.16em] text-brand">{number}</p>
                  <h3 className="mt-10 text-xl font-bold tracking-tight">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-stone-500">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1200px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[0.75fr_1.25fr] lg:py-32">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">Q&A</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em]">시작하기 전,<br />많이 묻는 질문</h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-stone-500">
              제작 경험이 없어도 괜찮습니다. 궁금한 부분을 먼저 확인하고 가볍게 디자인부터 시작해보세요.
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

        <section className="border-t border-stone-200 bg-[#fbfaf8]">
          <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-8 px-5 py-20 sm:px-8 md:flex-row md:items-center lg:px-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Your first collection</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] md:text-4xl">당신의 이름으로 첫 제품을 시작하세요.</h2>
            </div>
            <Button asChild size="lg" className="h-14 rounded-full bg-brand px-8 text-base font-bold hover:bg-brand-dark">
              <Link to="/auth">브랜드 프로필 만들기 <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
