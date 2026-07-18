import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { ArrowRight, Check, Factory, Sparkles, Users } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-[#f7f5f2] text-[#171313]">
      <Header />
      <main className="pt-16">
        <section className="relative overflow-hidden bg-[#211819] text-white">
          <div className="absolute -right-32 -top-32 h-[34rem] w-[34rem] rounded-full bg-brand/35 blur-3xl" />
          <div className="container relative mx-auto grid min-h-[720px] items-center gap-12 px-4 py-20 lg:grid-cols-[1.02fr_0.98fr]">
            <div className="max-w-3xl">
              <div className="mb-6 inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/75 backdrop-blur">
                <Sparkles className="mr-2 h-4 w-4 text-[#d5a6a6]" /> AI 기반 패션 창업 플랫폼
              </div>
              <h1 className="text-5xl font-bold leading-[1.08] tracking-[-0.04em] md:text-7xl">
                디자인부터 펀딩,
                <br />생산까지 한 번에.
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-white/65">
                키워드를 입력하면 AI가 의류 디자인을 만들고, 펀딩으로 수요를 확인한 뒤 브랜더가 실제 생산과 배송까지 책임집니다.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-14 rounded-full bg-brand px-8 text-base hover:bg-brand-light">
                  <Link to="/customize">AI 디자인 시작하기 <ArrowRight className="ml-2 h-5 w-5" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-14 rounded-full border-white/25 bg-transparent px-8 text-base text-white hover:bg-white hover:text-gray-950">
                  <Link to="/fundings">펀딩 둘러보기</Link>
                </Button>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/60">
                {["재고 부담 없이 시작", "MOQ 20장부터", "생산·배송 원스톱"].map((text) => (
                  <span key={text} className="flex items-center"><Check className="mr-1.5 h-4 w-4 text-[#d5a6a6]" />{text}</span>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute inset-8 rounded-[3rem] bg-brand/30 blur-3xl" />
              <div className="relative rotate-2 rounded-[2rem] border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur-xl">
                <div className="overflow-hidden rounded-[1.5rem] bg-[#eee9e3]">
                  <div className="flex items-center justify-between border-b border-black/5 px-5 py-4 text-xs font-medium text-gray-500">
                    <span>BRAND-ER AI STUDIO</span><span>DESIGN 01</span>
                  </div>
                  <div className="aspect-[4/3] p-8 md:p-12">
                    <img src="/lovable-uploads/jacket.png" alt="AI로 생성한 의류 디자인 예시" className="h-full w-full object-contain drop-shadow-2xl" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 p-3 text-center text-xs text-white/75">
                  <div className="rounded-xl bg-white/10 py-3"><span className="block text-white/40">COLOR</span>BURGUNDY</div>
                  <div className="rounded-xl bg-white/10 py-3"><span className="block text-white/40">FIT</span>RELAXED</div>
                  <div className="rounded-xl bg-white/10 py-3"><span className="block text-white/40">MOQ</span>20 PCS</div>
                </div>
              </div>
              <div className="absolute -bottom-8 -left-5 rounded-2xl border border-white/10 bg-[#362829] px-5 py-4 shadow-xl">
                <p className="text-xs text-white/45">펀딩 페이지 자동 생성</p>
                <p className="mt-1 font-semibold text-white">관리자 승인 대기 완료</p>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-brand">HOW IT WORKS</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">아이디어 하나면 충분합니다</h2>
            <p className="mt-5 text-gray-500">복잡했던 의류 창업 과정을 세 단계로 단순하게 만들었습니다.</p>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {[
              [Sparkles, "01", "AI 디자인 생성", "의류 종류, 원단, 색상과 핏을 선택하면 AI가 판매 가능한 디자인 이미지를 만듭니다."],
              [Users, "02", "펀딩으로 수요 검증", "완성된 이미지로 펀딩 페이지가 자동 작성되고 최소 20장의 선주문을 모읍니다."],
              [Factory, "03", "브랜더 생산·배송", "목표 수량을 달성하면 원단 컨택, 패턴, 샘플, 생산과 배송까지 진행합니다."],
            ].map(([Icon, number, title, description]) => {
              const StepIcon = Icon as typeof Sparkles;
              return (
                <div key={String(number)} className="rounded-[2rem] border border-black/5 bg-white p-7 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><StepIcon className="h-6 w-6" /></div>
                    <span className="text-sm font-bold text-gray-300">{String(number)}</span>
                  </div>
                  <h3 className="mt-8 text-xl font-bold">{String(title)}</h3>
                  <p className="mt-3 text-sm leading-6 text-gray-500">{String(description)}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-y border-black/5 bg-white">
          <div className="container mx-auto flex flex-col items-center justify-between gap-8 px-4 py-16 text-center md:flex-row md:text-left">
            <div>
              <h2 className="text-3xl font-bold">당신의 디자인을 실제 제품으로.</h2>
              <p className="mt-3 text-gray-500">재고 없이 시작하고, 팔릴 디자인만 생산하세요.</p>
            </div>
            <Button asChild size="lg" className="h-14 rounded-full bg-brand px-8 hover:bg-brand-dark">
              <Link to="/customize">지금 펀딩 만들기 <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
