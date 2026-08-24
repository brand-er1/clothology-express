import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Header } from "@/components/Header";
import { SelectedWorkTile } from "@/components/portfolio/SelectedWorkTile";
import { PortfolioProjectDetail } from "@/components/portfolio/PortfolioProjectDetail";
import { Reveal } from "@/components/portfolio/ScrollReveal";
import { HeroCarousel, type HeroSlide } from "@/components/portfolio/HeroCarousel";
import { useParallax } from "@/hooks/useParallax";
import { fetchVisiblePortfolioProjects } from "@/services/portfolioProjects";
import { PORTFOLIO_CATEGORY_LABEL_KO, type PortfolioProject } from "@/types/portfolio";
import {
  PORTFOLIO_CAPABILITIES,
  PORTFOLIO_PROCESS_STEPS,
  PORTFOLIO_STATS,
} from "@/data/portfolioShowcase";

const Portfolio = () => {
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [selectedProject, setSelectedProject] = useState<PortfolioProject | null>(null);
  const heroParallaxRef = useParallax<HTMLDivElement>(24);

  useEffect(() => {
    let cancelled = false;
    fetchVisiblePortfolioProjects().then((data) => {
      if (!cancelled) {
        setProjects(data);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(projects.map((project) => project.category)));
    return ["ALL", ...unique];
  }, [projects]);

  const filteredProjects = useMemo(
    () => (filter === "ALL" ? projects : projects.filter((project) => project.category === filter)),
    [filter, projects],
  );

  // One sample photo per category (not several of the same garment type back to back) so the
  // hero band reads as "a range of what we make" rather than landing on a single odd-one-out
  // item (e.g. one lone pair of shorts) with nothing else to give it context.
  const heroSlides: HeroSlide[] = useMemo(() => {
    const seenCategories = new Set<string>();
    const diverse: PortfolioProject[] = [];
    for (const project of projects) {
      if (seenCategories.has(project.category)) continue;
      seenCategories.add(project.category);
      diverse.push(project);
    }
    for (const project of projects) {
      if (diverse.length >= 6) break;
      if (!diverse.includes(project)) diverse.push(project);
    }
    return diverse.slice(0, 6).map((project) => ({
      id: project.id,
      src: project.images[0],
      alt: project.nameKo,
    }));
  }, [projects]);

  return (
    <div className="min-h-screen bg-[#f4f0ea] text-[#211b1c]">
      <Header />
      <main className="pt-16 sm:pt-[72px]">
        {/* 1. PORTFOLIO HERO */}
        <section className="border-b border-black/10">
          <div className="mx-auto max-w-[1440px] px-5 pb-16 pt-20 sm:px-8 sm:pb-24 sm:pt-28 lg:px-12 lg:pb-32 lg:pt-36 xl:px-16">
            <Reveal>
              <p className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.08em] text-brand sm:text-xs">
                <span className="h-px w-8 bg-brand" />
                우리의 작업
              </p>
            </Reveal>
            <Reveal delayMs={100}>
              <h1 className="mt-6 max-w-4xl font-serif text-[clamp(2.6rem,7vw,6rem)] font-normal leading-[0.98] tracking-[-0.05em]">
                당신의 아이디어가
                <br />
                실제 옷이 되는 과정.
              </h1>
            </Reveal>
            <Reveal delayMs={280}>
              <p className="mt-8 max-w-xl text-base leading-8 text-stone-600 sm:text-lg">
                브랜더는 디자인부터 원단, 패턴, 샘플, 생산까지{" "}
                <br className="hidden sm:block" />
                브랜드가 실제 제품을 완성할 수 있도록 함께합니다.
              </p>
            </Reveal>
          </div>

          {heroSlides.length > 0 && (
            <div ref={heroParallaxRef} className="overflow-hidden bg-[#e9e5dd]">
              <HeroCarousel slides={heroSlides} />
            </div>
          )}
        </section>

        {/* 2. BRAND-ER IN NUMBERS */}
        <section className="border-b border-black/10 bg-[#f1f0ed]">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 xl:px-16">
            <Reveal>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand sm:text-xs">
                브랜더, 숫자로 보다
              </p>
            </Reveal>
            <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 sm:gap-y-14 lg:grid-cols-4">
              {PORTFOLIO_STATS.map((stat, index) => (
                <Reveal key={stat.label} delayMs={index * 80} className="border-t border-black/15 pt-5">
                  <p className="font-serif text-[clamp(1.6rem,3.4vw,2.6rem)] font-normal leading-[1.05] tracking-[-0.03em]">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.02em] text-stone-500 sm:text-[11px]">
                    {stat.label}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 3. SELECTED WORKS */}
        <section id="selected-works" className="scroll-mt-20 border-b border-black/10">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
            <div className="flex flex-wrap items-end justify-between gap-6 border-b border-black/10 pb-8">
              <Reveal>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand sm:text-xs">
                  프로젝트
                </p>
                <h2 className="mt-3 font-serif text-4xl font-normal leading-[1.02] tracking-[-0.04em] sm:text-6xl">
                  대표 프로젝트
                </h2>
                <p className="mt-4 text-sm font-semibold text-stone-400">
                  아이디어에서 생산까지.
                </p>
              </Reveal>
            </div>

            <div className="-mx-5 mt-8 flex gap-5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setFilter(category)}
                  className={`shrink-0 whitespace-nowrap border-b-2 pb-1.5 text-xs font-bold uppercase tracking-[0.04em] transition ${
                    filter === category
                      ? "border-brand text-[#211b1c]"
                      : "border-transparent text-stone-400 hover:text-stone-700"
                  }`}
                >
                  {category === "ALL" ? "전체" : PORTFOLIO_CATEGORY_LABEL_KO[category] || category}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2">
                {[0, 1, 2].map((key) => (
                  <div
                    key={key}
                    className={`animate-pulse bg-[#e9e5dd] ${key === 0 ? "sm:col-span-2 aspect-[16/9]" : "aspect-[4/5]"}`}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 sm:gap-y-16">
                {filteredProjects.map((project, index) => (
                  <SelectedWorkTile
                    key={project.id}
                    project={project}
                    index={index + 1}
                    size={index % 3 === 0 ? "large" : "medium"}
                    onSelect={setSelectedProject}
                    revealDelayMs={(index % 3) * 60}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 6. OUR CAPABILITIES */}
        <section className="border-b border-black/10 bg-[#211b1c] text-white">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
            <Reveal>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#d7a6b2] sm:text-xs">
                우리의 제작 역량
              </p>
              <h2 className="mt-3 font-serif text-4xl font-normal leading-[1.02] tracking-[-0.04em] sm:text-6xl">
                컨셉에서 생산까지.
              </h2>
            </Reveal>

            <div className="mt-14 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {PORTFOLIO_CAPABILITIES.map((capability, index) => (
                <Reveal
                  key={capability.number}
                  delayMs={(index % 3) * 90}
                  className="border-t border-white/15 pt-6"
                >
                  <span className="text-[10px] font-bold tracking-[0.2em] text-white/40">{capability.number}</span>
                  <h3 className="mt-3 font-serif text-2xl font-normal tracking-[-0.02em]">{capability.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/60">{capability.description}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 7. HOW WE MAKE */}
        <section className="border-b border-black/10 bg-[#f1f0ed]">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
            <Reveal>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand sm:text-xs">제작 과정</p>
              <h2 className="mt-3 font-serif text-4xl font-normal leading-[1.02] tracking-[-0.04em] sm:text-6xl">
                이렇게 만듭니다.
              </h2>
            </Reveal>

            <div className="-mx-5 mt-14 flex gap-0 overflow-x-auto px-5 pb-2 sm:mx-0 sm:overflow-visible sm:px-0 lg:flex-row lg:items-stretch">
              {PORTFOLIO_PROCESS_STEPS.map((step, index) => (
                <div key={step.number} className="flex shrink-0 items-stretch lg:flex-1">
                  <Reveal delayMs={index * 70} className="flex min-w-[9.5rem] flex-1 flex-col gap-3 py-2 lg:min-w-0 lg:px-2">
                    <span className="text-[10px] font-bold tracking-[0.2em] text-brand">{step.number}</span>
                    <span className="font-serif text-xl font-normal tracking-[-0.02em] sm:text-2xl">{step.title}</span>
                  </Reveal>
                  {index < PORTFOLIO_PROCESS_STEPS.length - 1 && (
                    <div className="flex w-8 shrink-0 items-center justify-center text-stone-300 lg:w-10">→</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 8. FINAL CTA */}
        <section className="bg-[#711a2a] text-white">
          <div className="mx-auto max-w-[1440px] px-5 py-20 text-center sm:px-8 sm:py-32 lg:px-12 xl:px-16">
            <Reveal>
              <h2 className="mx-auto max-w-3xl font-serif text-[clamp(2.4rem,6vw,5rem)] font-normal leading-[1.02] tracking-[-0.05em]">
                아이디어가 있으신가요?
                <br />
                함께 현실로 만들어요.
              </h2>
            </Reveal>
            <Reveal delayMs={120}>
              <p className="mx-auto mt-7 max-w-xl text-sm leading-7 text-white/70 sm:text-base">
                브랜드 의류부터 단체복까지
                <br />
                브랜더에서 제작을 시작해보세요.
              </p>
            </Reveal>
            <Reveal delayMs={220}>
              <div className="mx-auto mt-10 flex max-w-xl flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  to="/design-quote"
                  className="inline-flex h-12 items-center justify-center bg-white px-7 text-sm font-bold text-[#711a2a] transition hover:bg-white/90 sm:h-14"
                >
                  제작 견적 받아보기 <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  to="/customize"
                  className="inline-flex h-12 items-center justify-center border border-white/50 px-7 text-sm font-bold text-white transition hover:bg-white/10 sm:h-14"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI로 디자인 시작하기 <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <PortfolioProjectDetail project={selectedProject} onOpenChange={(open) => !open && setSelectedProject(null)} />
    </div>
  );
};

export default Portfolio;
