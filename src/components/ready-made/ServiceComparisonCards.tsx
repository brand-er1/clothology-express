import { Link } from "react-router-dom";
import { ArrowRight, CircleX, Ruler, Scissors, Timer, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";

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

export const ServiceComparisonCards = ({ className = "" }: ServiceComparisonCardsProps) => (
  <div className={`grid gap-4 sm:grid-cols-2 ${className}`}>
    <Card className="flex flex-col justify-between rounded-[1.75rem] border-brand/25 bg-brand/[0.04] p-6 shadow-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Quick production</p>
        <h3 className="mt-2 text-xl font-black text-stone-950">빠른 단체복 제작</h3>
        <ul className="mt-4 space-y-2.5">
          {quickPoints.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2.5 text-sm font-semibold text-stone-700">
              <Icon className="h-4 w-4 shrink-0 text-brand" />
              {label}
            </li>
          ))}
        </ul>
      </div>
      <Link
        to="/quick-group-wear"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-brand px-5 text-sm font-bold text-white transition hover:bg-brand-dark"
      >
        빠른 단체복 제작 시작하기 <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </Card>

    <Card className="flex flex-col justify-between rounded-[1.75rem] border-stone-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Custom production</p>
        <h3 className="mt-2 text-xl font-black text-stone-950">맞춤 의류 제작</h3>
        <ul className="mt-4 space-y-2.5">
          {customPoints.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2.5 text-sm font-semibold text-stone-700">
              <Icon className="h-4 w-4 shrink-0 text-stone-500" />
              {label}
            </li>
          ))}
        </ul>
      </div>
      <Link
        to="/customize"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-full border border-stone-300 bg-white px-5 text-sm font-bold text-stone-800 transition hover:bg-stone-100"
      >
        맞춤 의류 제작 시작하기 <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </Card>
  </div>
);
