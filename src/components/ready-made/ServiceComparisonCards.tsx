import { Link } from "react-router-dom";
import { ArrowRight, CircleX, Ruler, Scissors, Timer, Zap } from "lucide-react";

interface ComparisonPoint {
  icon: typeof Zap;
  label: string;
}

const quickPoints: ComparisonPoint[] = [
  { icon: Zap, label: "기성품 + 인쇄" },
  { icon: Timer, label: "약 7일 이내" },
  { icon: Ruler, label: "낮은 제작비 · XS~3XL" },
  { icon: CircleX, label: "원단/핏 변경 불가" },
];

const customPoints: ComparisonPoint[] = [
  { icon: Scissors, label: "원단 선택 · 패턴 제작" },
  { icon: Ruler, label: "샘플 제작 · 핏/사이즈 커스텀" },
  { icon: Zap, label: "브랜드 의류 제작에 적합" },
];

interface ServiceComparisonCardsProps {
  className?: string;
}

// Two services compared side by side as columns on a hairline, not as two boxed cards.
export const ServiceComparisonCards = ({ className = "" }: ServiceComparisonCardsProps) => (
  <div className={`grid gap-8 border-t border-black/10 pt-6 sm:grid-cols-2 sm:gap-10 ${className}`}>
    <div className="flex flex-col justify-between">
      <div>
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">Quick production</p>
        <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-stone-950">빠른 단체복 제작</h3>
        <ul className="mt-4 space-y-2">
          {quickPoints.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2.5 text-sm text-stone-700">
              <Icon className="h-3.5 w-3.5 shrink-0 text-brand" strokeWidth={1.8} />
              {label}
            </li>
          ))}
        </ul>
      </div>
      <Link to="/quick-group-wear" className="cta-primary mt-6 w-full sm:w-fit">
        빠른 단체복 제작 시작하기 <ArrowRight className="h-4 w-4" />
      </Link>
    </div>

    <div className="flex flex-col justify-between border-t border-black/10 pt-8 sm:border-l sm:border-t-0 sm:pl-10 sm:pt-0">
      <div>
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">Custom production</p>
        <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-stone-950">맞춤 의류 제작</h3>
        <ul className="mt-4 space-y-2">
          {customPoints.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2.5 text-sm text-stone-700">
              <Icon className="h-3.5 w-3.5 shrink-0 text-stone-500" strokeWidth={1.8} />
              {label}
            </li>
          ))}
        </ul>
      </div>
      <Link to="/customize" className="cta-text mt-6">
        <span className="link-draw">맞춤 의류 제작 시작하기</span> <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  </div>
);
