import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { EditorialRenderer } from "@/components/detail-page/editorial/EditorialRenderer";
import { buildDirection, getConcept, planImages, seedKeyFor } from "@/lib/detail-page/artDirection";
import { composeEditorialDocument } from "@/lib/detail-page/editorialCompose";
import { buildFallbackCopy } from "@/lib/detail-page/fallbackCopy";
import { cn } from "@/lib/utils";
import type {
  DetailConceptRecommendation,
  DetailFundingStats,
  DetailPageSource,
  DetailPageTemplateId,
  DetailProductAnalysis,
} from "@/types/detailPage";

const PREVIEW_WIDTH = 390;

const useWidth = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
};

/** The real renderer at phone width, scaled into the card: what you pick is what you get. */
const ConceptPreview = ({
  conceptId,
  source,
  analysis,
  productName,
  stats,
}: {
  conceptId: DetailPageTemplateId;
  source: DetailPageSource;
  analysis: DetailProductAnalysis;
  productName: string;
  stats: DetailFundingStats;
}) => {
  const [ref, width] = useWidth();
  const document = useMemo(() => {
    const copy = buildFallbackCopy(source);
    const named = { ...copy, productName: productName || copy.productName, keyMessage: copy.mainCopy };
    const direction = buildDirection(conceptId, analysis, seedKeyFor(source));
    const composed = composeEditorialDocument({ source, copy: named, direction, analysis, plan: planImages(direction, analysis, source) });
    // Hero + the next two sections are enough to read the concept.
    return { ...composed, direction, sections: composed.sections.slice(0, 3) };
  }, [conceptId, source, analysis, productName]);
  const scale = width ? width / PREVIEW_WIDTH : 0;
  return (
    <div ref={ref} className="relative aspect-[5/8] w-full overflow-hidden" aria-hidden>
      {scale > 0 && (
        <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: PREVIEW_WIDTH, transform: `scale(${scale})` }}>
          <EditorialRenderer document={document} source={source} stats={stats} />
        </div>
      )}
    </div>
  );
};

export const ConceptPicker = ({
  concepts,
  value,
  onChange,
  source,
  analysis,
  productName,
  stats,
}: {
  concepts: DetailConceptRecommendation[];
  value: DetailPageTemplateId | null;
  onChange: (id: DetailPageTemplateId) => void;
  source: DetailPageSource;
  analysis: DetailProductAnalysis;
  productName: string;
  stats: DetailFundingStats;
}) => (
  <div className="grid gap-4 sm:grid-cols-3" role="radiogroup" aria-label="상세페이지 콘셉트">
    {concepts.map((concept, index) => {
      const meta = getConcept(concept.id);
      const selected = value === concept.id;
      return (
        <button
          key={concept.id}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(concept.id)}
          className={cn(
            "group relative min-w-0 border bg-white text-left transition",
            selected ? "border-brand ring-2 ring-brand" : "border-stone-300 hover:border-stone-500",
          )}
        >
          <ConceptPreview conceptId={concept.id} source={source} analysis={analysis} productName={productName} stats={stats} />
          <div className="border-t border-stone-200 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className={cn("text-[13px] font-bold tracking-[0.12em]", selected && "text-brand")}>{meta.name}</p>
              {index === 0 && <span className="shrink-0 bg-stone-900 px-1.5 py-0.5 text-[10px] font-bold text-white">AI 추천</span>}
            </div>
            <p className="mt-1.5 text-xs leading-5 text-stone-600">{meta.tagline}</p>
            <p className="mt-2 text-[11px] leading-4 text-stone-500">{concept.reason}</p>
          </div>
          {selected && (
            <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center bg-brand text-white">
              <Check className="h-4 w-4" />
            </span>
          )}
        </button>
      );
    })}
  </div>
);

/** Compact concept switcher for the editor (all concepts, no previews). */
export const ConceptSwitcher = ({ value, onChange }: { value: DetailPageTemplateId; onChange: (id: DetailPageTemplateId) => void }) => {
  const ids: DetailPageTemplateId[] = ["minimal", "street", "editorial", "luxury", "vintage", "sports", "outdoor", "casual", "y2k", "emotional", "lookbook"];
  return (
    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="콘셉트 변경">
      {ids.map((id) => {
        const meta = getConcept(id);
        const selected = id === value;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            className={cn("flex h-11 items-center gap-2 border px-2 text-left", selected ? "border-brand text-brand" : "border-stone-300 text-stone-700 hover:border-stone-500")}
          >
            <span className="h-4 w-4 shrink-0 border border-black/10" style={{ background: `linear-gradient(135deg, ${meta.palette.bg} 50%, ${meta.palette.ink} 50%)` }} />
            <span className="truncate text-[11px] font-bold tracking-[0.06em]">{meta.name}</span>
          </button>
        );
      })}
    </div>
  );
};
