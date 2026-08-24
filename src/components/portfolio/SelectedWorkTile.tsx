import { PORTFOLIO_CATEGORY_LABEL_KO, type PortfolioProject } from "@/types/portfolio";
import { PORTFOLIO_DEFAULT_SERVICES } from "@/data/portfolioShowcase";
import { RevealImage } from "@/components/portfolio/ScrollReveal";

interface SelectedWorkTileProps {
  project: PortfolioProject;
  index: number;
  size: "large" | "medium";
  onSelect: (project: PortfolioProject) => void;
  revealDelayMs?: number;
}

export const SelectedWorkTile = ({ project, index, size, onSelect, revealDelayMs = 0 }: SelectedWorkTileProps) => {
  const services = project.services.length > 0 ? project.services : PORTFOLIO_DEFAULT_SERVICES;
  const orderLabel = String(index).padStart(2, "0");

  return (
    <button
      type="button"
      onClick={() => onSelect(project)}
      className={`group relative block w-full min-w-0 overflow-hidden text-left ${
        size === "large" ? "sm:col-span-2" : ""
      }`}
      aria-label={`${project.nameKo} 프로젝트 상세보기`}
    >
      <RevealImage
        delayMs={revealDelayMs}
        className={`relative bg-[#efece6] ${size === "large" ? "aspect-[4/5] sm:aspect-[16/9]" : "aspect-[4/5]"}`}
      >
        <img
          src={project.images[0]}
          alt={project.nameKo}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain p-6 transition duration-700 ease-out group-hover:scale-[1.03] sm:p-10"
        />

        {/* Desktop hover overlay — project name / category / services / country only. */}
        <div className="pointer-events-none absolute inset-0 hidden items-end bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 sm:flex">
          <div className="w-full p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
              {PORTFOLIO_CATEGORY_LABEL_KO[project.category] || project.category}
              {project.country ? ` · ${project.country}` : ""}
            </p>
            <p className="mt-1.5 font-serif text-xl font-normal tracking-[-0.02em] text-white">{project.nameEn}</p>
            <p className="mt-1.5 text-xs font-semibold text-white/75">{services.join(" / ")}</p>
          </div>
        </div>
      </RevealImage>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand">
            {orderLabel} · {PORTFOLIO_CATEGORY_LABEL_KO[project.category] || project.category}
          </p>
          <h3 className={`mt-1.5 truncate font-serif font-normal tracking-[-0.02em] text-[#211b1c] ${
            size === "large" ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl"
          }`}>
            {project.nameEn}
          </h3>
          <p className="mt-1 truncate text-xs text-stone-500 sm:text-sm">{project.nameKo}</p>
        </div>
      </div>
    </button>
  );
};
