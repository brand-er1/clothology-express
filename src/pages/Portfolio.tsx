import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/Header";
import { SelectedWorkTile } from "@/components/portfolio/SelectedWorkTile";
import { PortfolioProjectDetail } from "@/components/portfolio/PortfolioProjectDetail";
import { Reveal } from "@/components/portfolio/ScrollReveal";
import { HeroCarousel, type HeroSlide } from "@/components/portfolio/HeroCarousel";
import { FabricSourcingSection } from "@/components/portfolio/FabricSourcingSection";
import { useParallax } from "@/hooks/useParallax";
import { fetchVisiblePortfolioProjects } from "@/services/portfolioProjects";
import { PORTFOLIO_CATEGORY_LABEL_KO, type PortfolioProject } from "@/types/portfolio";
import {
  PORTFOLIO_CAPABILITIES,
  PORTFOLIO_PROCESS_STEPS,
  PORTFOLIO_STATS,
} from "@/data/portfolioShowcase";

// Lookbook rhythm: image sizes, ratios and offsets change from one project to the next so the
// page reads like a printed spread rather than a uniform card grid. Mobile falls back to one column.
const LOOKBOOK_LAYOUT: { layout: string; aspect: string; emphasis: "large" | "medium" }[] = [
  { layout: "sm:col-span-2 lg:col-span-7", aspect: "aspect-[4/5] sm:aspect-[16/11] lg:aspect-[7/8]", emphasis: "large" },
  { layout: "lg:col-span-4 lg:col-start-9 lg:mt-48", aspect: "aspect-[3/4]", emphasis: "medium" },
  { layout: "lg:col-span-5 lg:col-start-2", aspect: "aspect-[4/5]", emphasis: "medium" },
  { layout: "lg:col-span-5 lg:col-start-8 lg:mt-32", aspect: "aspect-square", emphasis: "medium" },
  { layout: "sm:col-span-2 lg:col-span-8 lg:col-start-3", aspect: "aspect-[4/5] sm:aspect-[16/10]", emphasis: "large" },
  { layout: "lg:col-span-4", aspect: "aspect-[3/4]", emphasis: "medium" },
  { layout: "lg:col-span-4 lg:col-start-6 lg:mt-24", aspect: "aspect-[4/5]", emphasis: "medium" },
  { layout: "lg:col-span-3 lg:col-start-10 lg:mt-56", aspect: "aspect-[3/4]", emphasis: "medium" },
];

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
    <div className="min-h-screen bg-[#f6f3ee] text-[#211b1c]">
      <Header />
      <main className="pt-16 sm:pt-[72px]">
        {/* 1. PORTFOLIO HERO */}
        <section>
          <div className="page-shell grid gap-10 pb-14 pt-16 sm:pb-20 sm:pt-24 lg:grid-cols-12 lg:gap-8 lg:pb-24 lg:pt-32">
            <div className="lg:col-span-8">
              <Reveal>
                <p className="eyebrow">Lookbook · 우리의 작업</p>
              </Reveal>
              <Reveal delayMs={100}>
                <h1 className="display-hero mt-6">
                  당신의 아이디어가
                  <br />
                  <span className="lg:pl-[1.2em]">실제 옷이 되는 과정<span className="text-brand">.</span></span>
                </h1>
              </Reveal>
            </div>
            <Reveal delayMs={240} className="lg:col-span-3 lg:col-start-10 lg:self-end">
              <p className="text-base leading-7 text-stone-600">
                브랜더는 디자인부터 원단, 패턴, 샘플, 생산까지 브랜드가 실제 제품을 완성할 수 있도록 함께합니다.
              </p>
              <a href="#selected-works" className="cta-text mt-5">
                <span className="link-draw">프로젝트 보기</span> <ArrowRight className="h-4 w-4" />
              </a>
            </Reveal>
          </div>

          {heroSlides.length > 0 && (
            <div ref={heroParallaxRef} className="overflow-hidden bg-[#ebe6df]">
              <HeroCarousel slides={heroSlides} />
            </div>
          )}
        </section>

        {/* 2. BRAND-ER IN NUMBERS */}
        <section>
          <div className="page-shell py-20 sm:py-28">
            <Reveal>
              <p className="eyebrow">브랜더, 숫자로 보다</p>
            </Reveal>
            <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 sm:gap-y-14 lg:grid-cols-12">
              {PORTFOLIO_STATS.map((stat, index) => (
                <Reveal
                  key={stat.label}
                  delayMs={index * 80}
                  className={`border-t border-black/15 pt-5 ${index % 3 === 0 ? "lg:col-span-5" : "lg:col-span-7"}`}
                >
                  <p className={`font-semibold leading-[1.02] tracking-[-0.04em] ${index === 0 ? "font-display text-[clamp(2.75rem,6vw,5rem)] text-brand" : "text-[clamp(1.6rem,3vw,2.5rem)]"}`}>
                    {stat.value}
                  </p>
                  <p className="mt-3 text-xs text-stone-500">
                    {stat.label}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 3. SELECTED WORKS */}
        <section id="selected-works" className="scroll-mt-20">
          <div className="page-shell pb-24 pt-8 sm:pb-32 lg:pb-40">
            <div className="grid gap-6 border-t border-black/10 pt-10 lg:grid-cols-12 lg:items-end">
              <Reveal className="lg:col-span-6">
                <p className="eyebrow">Selected works</p>
                <h2 className="display-section mt-4">
                  대표 프로젝트
                </h2>
              </Reveal>
              <p className="text-sm text-stone-500 lg:col-span-3 lg:col-start-10 lg:text-right">
                아이디어에서 생산까지.
                <span className="ml-2 font-display font-semibold text-[#211b1c]">{String(filteredProjects.length).padStart(2, "0")}</span>
              </p>
            </div>

            <div className="-mx-5 mt-10 flex gap-7 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setFilter(category)}
                  aria-pressed={filter === category}
                  className={`shrink-0 whitespace-nowrap border-b py-2 text-sm transition-colors duration-300 ${
                    filter === category
                      ? "border-brand font-semibold text-[#211b1c]"
                      : "border-transparent text-stone-500 hover:text-[#211b1c]"
                  }`}
                >
                  {category === "ALL" ? "전체" : PORTFOLIO_CATEGORY_LABEL_KO[category] || category}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-12">
                {LOOKBOOK_LAYOUT.slice(0, 3).map((slot, key) => (
                  <div key={key} className={`animate-pulse bg-[#ebe6df] ${slot.layout} ${slot.aspect}`} />
                ))}
              </div>
            ) : (
              <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 sm:gap-y-20 lg:grid-cols-12 lg:gap-y-28">
                {filteredProjects.map((project, index) => {
                  const slot = LOOKBOOK_LAYOUT[index % LOOKBOOK_LAYOUT.length];
                  return (
                    <SelectedWorkTile
                      key={project.id}
                      project={project}
                      index={index + 1}
                      layoutClassName={slot.layout}
                      aspectClassName={slot.aspect}
                      emphasis={slot.emphasis}
                      onSelect={setSelectedProject}
                      revealDelayMs={(index % 2) * 90}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* 6. OUR CAPABILITIES */}
        <section className="bg-[#ece7e0]">
          <div className="page-shell grid gap-12 py-24 sm:py-32 lg:grid-cols-12 lg:gap-8 lg:py-40">
            <Reveal className="lg:col-span-4">
              <p className="eyebrow">우리의 제작 역량</p>
              <h2 className="display-section mt-4">
                컨셉에서
                <br />
                생산까지.
              </h2>
            </Reveal>

            <ol className="lg:col-span-7 lg:col-start-6">
              {PORTFOLIO_CAPABILITIES.map((capability, index) => (
                <Reveal key={capability.number} delayMs={(index % 3) * 70}>
                  <li className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 border-t border-black/10 py-6 sm:grid-cols-[6rem_10rem_minmax(0,1fr)] sm:gap-x-6 sm:py-7">
                    <span className="display-number text-[2.75rem] text-brand sm:text-[3.25rem]">{capability.number}</span>
                    <h3 className="text-xl font-semibold tracking-[-0.02em]">{capability.title}</h3>
                    <p className="col-start-2 text-sm leading-6 text-stone-600 sm:col-start-3">{capability.description}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        <FabricSourcingSection />

        {/* 7. HOW WE MAKE */}
        <section>
          <div className="page-shell py-24 sm:py-32 lg:py-40">
            <Reveal>
              <p className="eyebrow">제작 과정</p>
              <h2 className="display-section mt-4">
                이렇게 만듭니다.
              </h2>
            </Reveal>

            <ol className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-0">
              {PORTFOLIO_PROCESS_STEPS.map((step, index) => (
                <Reveal key={step.number} delayMs={index * 70}>
                  <li className={`border-t border-black/15 pt-5 lg:pr-6 ${index % 2 === 1 ? "lg:mt-16" : ""}`}>
                    <span className="display-number block text-[3.5rem] text-brand sm:text-[4.5rem]">{step.number}</span>
                    <span className="mt-4 block text-lg font-semibold tracking-[-0.02em] sm:text-xl">{step.title}</span>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* 8. FINAL CTA */}
        <section className="page-shell pb-28 sm:pb-36 lg:pb-44">
          <div className="grid gap-10 border-t border-black/10 pt-12 lg:grid-cols-12 lg:gap-8">
            <Reveal className="lg:col-span-8">
              <h2 className="display-hero">
                아이디어가 있으신가요?
                <br />
                <span className="text-stone-400">함께 현실로 만들어요</span><span className="text-brand">.</span>
              </h2>
            </Reveal>
            <Reveal delayMs={140} className="lg:col-span-3 lg:col-start-10 lg:self-end">
              <p className="text-sm leading-7 text-stone-600 sm:text-base">
                브랜드 의류부터 단체복까지 브랜더에서 제작을 시작해보세요.
              </p>
              <div className="mt-7 flex flex-col items-start gap-2">
                <Link to="/design-quote" className="cta-primary w-full sm:w-auto">
                  제작 견적 받아보기 <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/customize" className="cta-text">
                  <span className="link-draw">AI로 디자인 시작하기</span> <ArrowRight className="h-4 w-4" />
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
