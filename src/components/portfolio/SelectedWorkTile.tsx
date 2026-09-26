import { PORTFOLIO_CATEGORY_LABEL_KO, type PortfolioProject } from "@/types/portfolio";
import { PORTFOLIO_DEFAULT_SERVICES } from "@/data/portfolioShowcase";
import { RevealImage } from "@/components/portfolio/ScrollReveal";

interface SelectedWorkTileProps {
  project: PortfolioProject;
  index: number;
  /** Grid placement + image ratio, varied per position so the page reads like a lookbook spread. */
  layoutClassName?: string;
  aspectClassName?: string;
  emphasis?: "large" | "medium";
  onSelect: (project: PortfolioProject) => void;
  revealDelayMs?: number;
}

export const SelectedWorkTile = ({
  project,
  index,
  layoutClassName = "",
  aspectClassName = "aspect-[4/5]",
  emphasis = "medium",
  onSelect,
  revealDelayMs = 0,
}: SelectedWorkTileProps) => {
  const services = project.services.length > 0 ? project.services : PORTFOLIO_DEFAULT_SERVICES;
  const orderLabel = String(index).padStart(2, "0");
  const category = PORTFOLIO_CATEGORY_LABEL_KO[project.category] || project.category;

  return (
    <button
      type="button"
      onClick={() => onSelect(project)}
      className={`group relative block w-full min-w-0 text-left ${layoutClassName}`}
      aria-label={`${project.nameKo} 프로젝트 상세보기`}
    >
      <RevealImage delayMs={revealDelayMs} className={`relative bg-[#ebe6df] ${aspectClassName}`}>
        <img
          src={project.images[0]}
          alt={project.nameKo}
          loading="lazy"
          decoding="async"
          className="img-zoom h-full w-full object-contain p-[9%] mix-blend-multiply"
        />
      </RevealImage>

      <div className="mt-5 grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3 sm:mt-6">
        <span className="pt-1 font-display text-[11px] font-semibold tracking-[0.18em] text-brand">{orderLabel}</span>
        <div className="min-w-0">
          <h3
            className={`font-semibold tracking-[-0.03em] text-[#211b1c] ${
              emphasis === "large" ? "text-2xl sm:text-[2rem]" : "text-lg sm:text-xl"
            }`}
          >
            <span className="link-draw">{project.nameKo}</span>
          </h3>
          <p className="mt-1 font-display text-[11px] uppercase tracking-[0.16em] text-stone-500">{project.nameEn}</p>
          <p className="mt-3 text-xs text-stone-500">
            {category}
            {project.country ? ` · ${project.country}` : ""}
            <span className="mx-2 text-stone-300">/</span>
            {services.join(" · ")}
          </p>
        </div>
      </div>
    </button>
  );
};
