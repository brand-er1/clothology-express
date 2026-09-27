import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type {
  DetailArtDirection,
  DetailFundingStats,
  DetailImageJobStatus,
  DetailImageType,
  DetailPageDocument,
  DetailPageSource,
  DetailSection,
} from "@/types/detailPage";
import type { FundingColor } from "@/lib/funding-colors";
import { EdHero, renderEditorialSection } from "./sections";
import { BODY_STACK, EdCtx, INNER, SECTION_PAD, ensureEditorialFonts, surfaceStyle } from "./tokens";

export type EditorialRendererProps = {
  document: DetailPageDocument & { direction: DetailArtDirection };
  source: DetailPageSource;
  stats: DetailFundingStats;
  watermark?: boolean;
  imageStatus?: Partial<Record<DetailImageType, DetailImageJobStatus>>;
  colors?: FundingColor[];
  selectedSectionId?: string | null;
  onSelectSection?: (sectionId: string) => void;
  /** Editor only: per-section toolbar shown on hover / when selected. */
  renderToolbar?: (section: DetailSection, index: number) => ReactNode;
  className?: string;
};

/**
 * Editorial detail page: palette, typography, rhythm and each section's layout variant come from
 * the page's art direction, so pages differ by product and concept instead of sharing one
 * template. Container queries (`dp-*`) make the same page lay out correctly in the editor's
 * phone / tablet / desktop previews and on the real funding page.
 */
export const EditorialRenderer = ({
  document,
  source,
  stats,
  watermark = false,
  imageStatus,
  colors,
  selectedSectionId,
  onSelectSection,
  renderToolbar,
  className,
}: EditorialRendererProps) => {
  const direction = document.direction;
  useEffect(ensureEditorialFonts, []);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const visible = document.sections.filter((section) => section.visible);
  let contentIndex = -1;

  return (
    <EdCtx.Provider value={{ direction, document, source, stats, watermark, editing: Boolean(onSelectSection), imageStatus, colors }}>
      <article
        className={cn("[container-name:detail-page] [container-type:inline-size] w-full overflow-hidden antialiased", className)}
        style={{ ...surfaceStyle(direction, "default"), fontFamily: BODY_STACK }}
        data-template={document.template}
        data-engine="editorial"
      >
        {visible.map((section, visibleIndex) => {
          const isHero = section.type === "hero";
          if (!isHero) contentIndex += 1;
          const surface = surfaceStyle(direction, section.layout?.background);
          // Consecutive sections on the same surface are divided by a hairline, not a box.
          const previous = visible[visibleIndex - 1];
          const sameSurface = previous && previous.type !== "hero" && (previous.layout?.background ?? "default") === (section.layout?.background ?? "default");
          const body = isHero ? (
            <div style={surface}>
              <EdHero section={section} />
            </div>
          ) : (
            <section style={surface} className={SECTION_PAD[direction.spacing]} data-section-type={section.type}>
              <div className={INNER}>
                {renderEditorialSection(section, contentIndex)}
              </div>
            </section>
          );
          const divided = sameSurface ? <div style={surface}><div className={INNER}><hr className="border-0 border-t border-[color:var(--ed-rule)]" /></div></div> : null;

          if (!onSelectSection) {
            return (
              <div key={section.id}>
                {divided}
                {body}
              </div>
            );
          }
          const selected = selectedSectionId === section.id;
          return (
            <div key={section.id}>
              {divided}
              <div
                role="button"
                tabIndex={0}
                aria-label={`${section.eyebrow || section.type} 섹션 선택`}
                onClick={() => onSelectSection(section.id)}
                onMouseEnter={() => setHoveredId(section.id)}
                onMouseLeave={() => setHoveredId((current) => (current === section.id ? null : current))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && event.target === event.currentTarget) onSelectSection(section.id);
                }}
                className="group/section relative cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-[#741b2b]"
              >
                {body}
                {/* Selection frame drawn above the section's own background. */}
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-0 z-10 border-[#741b2b]",
                    selected ? "border-2" : "border-0 group-hover/section:border group-hover/section:border-[#741b2b]/60",
                  )}
                />
                {renderToolbar && (selected || hoveredId === section.id) && (
                  <div
                    className="absolute right-2 top-2 z-20"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    {renderToolbar(section, visibleIndex)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </article>
    </EdCtx.Provider>
  );
};
