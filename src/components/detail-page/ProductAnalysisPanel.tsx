import { AlertCircle, Check } from "lucide-react";
import { ALL_DETAIL_PARTS, DETAIL_PARTS } from "@/lib/detail-page/analysis";
import { cn } from "@/lib/utils";
import type { DetailPart, DetailProductAnalysis } from "@/types/detailPage";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-b border-stone-200 py-2.5 text-sm">
    <dt className="text-xs font-semibold text-stone-500">{label}</dt>
    <dd className="min-w-0 text-wrap-anywhere text-stone-900">{children}</dd>
  </div>
);

const Swatch = ({ hex }: { hex?: string }) =>
  hex ? <span className="mr-1.5 inline-block h-3.5 w-3.5 translate-y-0.5 border border-black/15" style={{ backgroundColor: hex }} /> : null;

const join = (values: string[]) => values.filter(Boolean).join(", ");

/**
 * AI 상품 분석 결과. The creator confirms it: detected parts can be switched off (only parts that
 * really exist are photographed and described), and the "확인 필요" list says what the image can't
 * prove and must be typed in instead.
 */
export const ProductAnalysisPanel = ({
  analysis,
  onChange,
  onEditInfo,
}: {
  analysis: DetailProductAnalysis;
  onChange: (next: DetailProductAnalysis) => void;
  onEditInfo?: () => void;
}) => {
  const toggle = (part: DetailPart) => {
    const parts = analysis.parts.includes(part) ? analysis.parts.filter((entry) => entry !== part) : [...analysis.parts, part];
    onChange({ ...analysis, parts, hasPrint: parts.includes("print"), hasEmbroidery: parts.includes("embroidery") });
  };
  const decorations = [analysis.hasPrint && "프린팅", analysis.hasEmbroidery && "자수"].filter(Boolean) as string[];
  return (
    <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:gap-10">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
          {analysis.provider === "ai" ? "AI 이미지 분석" : "입력 정보 기반 분석"}
        </p>
        <dl className="mt-3 border-t border-stone-200">
          <Row label="카테고리">{analysis.category || "—"}</Row>
          <Row label="메인 컬러"><Swatch hex={analysis.mainColor.hex} />{analysis.mainColor.name || "—"}</Row>
          {analysis.subColors.length > 0 && (
            <Row label="서브 컬러">
              {analysis.subColors.map((color) => (
                <span key={color.name} className="mr-3 inline-block"><Swatch hex={color.hex} />{color.name}</span>
              ))}
            </Row>
          )}
          {analysis.materialGuess && (
            <Row label="예상 소재">
              {analysis.materialGuess} <span className="text-xs text-amber-700">· 추정 (페이지에 표시하지 않음)</span>
            </Row>
          )}
          {(analysis.silhouette || analysis.fit) && <Row label="실루엣 · 핏">{join([analysis.silhouette, analysis.fit])}</Row>}
          {analysis.designFeatures.length > 0 && <Row label="디자인 특징">{join(analysis.designFeatures)}</Row>}
          <Row label="프린팅 · 자수">{decorations.length ? decorations.join(" · ") : "없음"}</Row>
          {analysis.target && <Row label="예상 타깃">{analysis.target}</Row>}
          {analysis.mood.length > 0 && <Row label="제품 분위기">{join(analysis.mood)}</Row>}
          {analysis.brandMoods.length > 0 && <Row label="브랜드 무드">{join(analysis.brandMoods)}</Row>}
          {analysis.emphasis.length > 0 && <Row label="강조할 특징">{join(analysis.emphasis)}</Row>}
        </dl>
      </div>

      <div className="space-y-6">
        <div>
          <p className="text-sm font-bold">주요 디테일</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">
            켜진 디테일만 클로즈업 촬영하고 설명합니다. 실제 제품에 없는 항목은 꺼주세요.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ALL_DETAIL_PARTS.map((part) => {
              const active = analysis.parts.includes(part);
              return (
                <button
                  key={part}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(part)}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1 border px-2.5 text-xs font-semibold transition",
                    active ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 text-stone-500 hover:border-stone-500",
                  )}
                >
                  {active && <Check className="h-3 w-3" />}
                  {DETAIL_PARTS[part].label}
                </button>
              );
            })}
          </div>
        </div>

        {analysis.unknowns.length > 0 && (
          <div className="border-l-2 border-amber-500 bg-amber-50/60 px-4 py-3">
            <p className="flex items-center gap-1.5 text-sm font-bold text-amber-900">
              <AlertCircle className="h-4 w-4" /> 이미지로 확인할 수 없는 정보
            </p>
            <p className="mt-1 text-xs leading-5 text-amber-900/80">
              {analysis.unknowns.join(" · ")} — AI가 추측해서 쓰지 않아요. 입력하면 원단·핏·사이즈 섹션에 표시됩니다.
            </p>
            {onEditInfo && (
              <button type="button" onClick={onEditInfo} className="mt-2 min-h-9 text-xs font-bold text-amber-900 underline underline-offset-2">
                정보 입력하러 가기
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
