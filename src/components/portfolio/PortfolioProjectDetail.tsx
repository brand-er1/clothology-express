import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { PORTFOLIO_CATEGORY_LABEL_KO, type PortfolioProject } from "@/types/portfolio";
import { PORTFOLIO_DEFAULT_SERVICES, PORTFOLIO_PROCESS_STEPS } from "@/data/portfolioShowcase";

interface PortfolioProjectDetailProps {
  project: PortfolioProject | null;
  onOpenChange: (open: boolean) => void;
}

const DetailBody = ({ project }: { project: PortfolioProject }) => {
  const navigate = useNavigate();
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => setActiveImage(0), [project.id]);

  const goToQuote = () => {
    navigate(`/design-quote?ref=${encodeURIComponent(project.nameKo)}`, {
      state: { fromPortfolio: { productName: project.nameKo } },
    });
  };

  const services = project.services.length > 0 ? project.services : PORTFOLIO_DEFAULT_SERVICES;

  const specs: Array<[string, string]> = [
    ["카테고리", PORTFOLIO_CATEGORY_LABEL_KO[project.category] || project.category],
    ["제작 국가", project.country || "제작 사양 상담 후 확정"],
    ["제작 수량", project.quantity || "제작 사양 상담 후 확정"],
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex aspect-[4/5] items-center justify-center bg-[#efece6] sm:aspect-[16/10]">
          <img
            src={project.images[activeImage]}
            alt={project.nameKo}
            className="h-full w-full object-contain p-6 sm:p-10"
          />
        </div>

        {project.images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-5 py-3 sm:px-8">
            {project.images.map((image, index) => (
              <button
                key={image}
                type="button"
                onClick={() => setActiveImage(index)}
                className={`h-16 w-16 shrink-0 overflow-hidden bg-[#efece6] transition ${
                  activeImage === index ? "ring-2 ring-brand" : "opacity-60 hover:opacity-100"
                }`}
                aria-label={`이미지 ${index + 1} 보기`}
              >
                <img src={image} alt="" className="h-full w-full object-contain p-1.5" />
              </button>
            ))}
          </div>
        )}

        <div className="px-5 py-6 sm:px-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand">프로젝트</p>
          <h2 className="mt-2 font-serif text-3xl font-normal tracking-[-0.03em] text-[#211b1c] sm:text-4xl">
            {project.nameKo}
          </h2>
          <p className="mt-1 text-sm text-stone-500">{project.nameEn}</p>

          {project.description && (
            <p className="mt-4 text-sm leading-6 text-stone-600">{project.description}</p>
          )}

          <dl className="mt-6 divide-y divide-black/10 border-y border-black/10 text-sm">
            {specs.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[110px_1fr] gap-3 py-3">
                <dt className="font-semibold text-stone-500">{label}</dt>
                <dd className="font-semibold text-stone-800">{value}</dd>
              </div>
            ))}
            <div className="grid grid-cols-[110px_1fr] gap-3 py-3">
              <dt className="font-semibold text-stone-500">제작 서비스</dt>
              <dd className="flex flex-wrap gap-1.5">
                {services.map((service) => (
                  <span key={service} className="border border-black/15 px-2 py-0.5 text-xs font-semibold text-stone-700">
                    {service}
                  </span>
                ))}
              </dd>
            </div>
          </dl>

          <div className="mt-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand">제작 과정</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs font-semibold text-stone-500">
              {PORTFOLIO_PROCESS_STEPS.map((step, index) => (
                <span key={step.number} className="flex items-center gap-2">
                  <span>{step.title}</span>
                  {index < PORTFOLIO_PROCESS_STEPS.length - 1 && <span className="text-stone-300">→</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div
        className="shrink-0 border-t border-black/10 bg-white px-5 py-4 sm:px-8"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={goToQuote}
          className="flex h-12 w-full items-center justify-center gap-2 bg-brand text-sm font-bold text-white transition hover:bg-brand-dark"
        >
          이 제품과 비슷하게 제작하기 <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export const PortfolioProjectDetail = ({ project, onOpenChange }: PortfolioProjectDetailProps) => {
  const isMobile = useIsMobile();
  const open = Boolean(project);
  // Keep showing the last selected project while the sheet/dialog is closing so the exit
  // animation doesn't flash empty content.
  const [displayProject, setDisplayProject] = useState<PortfolioProject | null>(project);
  useEffect(() => {
    if (project) setDisplayProject(project);
  }, [project]);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="z-[80] flex h-[94dvh] max-h-[94dvh] flex-col">
          <DrawerTitle className="sr-only">{displayProject?.nameKo || "프로젝트 상세"}</DrawerTitle>
          <div className="flex shrink-0 items-center justify-end px-4 pt-1">
            <DrawerClose asChild>
              <button type="button" aria-label="닫기" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-400">
                <X className="h-5 w-5" />
              </button>
            </DrawerClose>
          </div>
          {displayProject && <DetailBody project={displayProject} />}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[80] h-[88vh] w-[95vw] max-w-3xl overflow-hidden rounded-none p-0 [&>button]:z-10 [&>button]:rounded-full [&>button]:bg-white/90 [&>button]:p-1.5 [&>button]:opacity-100">
        <DialogTitle className="sr-only">{displayProject?.nameKo || "프로젝트 상세"}</DialogTitle>
        {displayProject && <DetailBody project={displayProject} />}
      </DialogContent>
    </Dialog>
  );
};
