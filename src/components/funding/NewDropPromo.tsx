import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Flame } from "lucide-react";

// NEW DROP 01 런칭 이벤트 종료 시각 (KST 10월 10일 자정 직전)
export const NEW_DROP_EVENT_END = new Date("2026-10-10T23:59:59+09:00");

// NEW DROP 01 은 FENRAX 반팔 티셔츠 드롭이다. 가장 최근에 펀딩이 열린(승인된) 상품 하나에만 HOT/불꽃 강조를 붙인다.
export const NEW_DROP_BRAND = "FENRAX";

type NewDropCandidate = {
  id: string;
  status?: string;
  created_at: string;
  reviewed_at?: string | null;
};

const getOpenedAt = (funding: NewDropCandidate) => new Date(funding.reviewed_at ?? funding.created_at).getTime();

export const useNewDropIds = (fundings: NewDropCandidate[]) =>
  useMemo(() => {
    const latest = fundings
      .filter((funding) => !funding.status || funding.status === "approved")
      .reduce<NewDropCandidate | null>(
        (newest, funding) => (!newest || getOpenedAt(funding) > getOpenedAt(newest) ? funding : newest),
        null,
      );
    return new Set(latest ? [latest.id] : []);
  }, [fundings]);

type Countdown = { days: number; hours: number; minutes: number; seconds: number };

const getCountdown = (end: Date): Countdown | null => {
  const diff = end.getTime() - Date.now();
  if (diff <= 0) return null;
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
};

export const useNewDropCountdown = () => {
  const [countdown, setCountdown] = useState(() => getCountdown(NEW_DROP_EVENT_END));

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = getCountdown(NEW_DROP_EVENT_END);
      setCountdown(next);
      if (!next) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return countdown;
};

const pad = (value: number) => value.toString().padStart(2, "0");

const tickerItems = [
  "NEW DROP 01 OPEN",
  `${NEW_DROP_BRAND} 반팔 티셔츠`,
  "10.10 까지 런칭 이벤트",
  "LIMITED ORDER ONLY",
  "선주문 한정 수량",
  "MADE IN KOREA",
];

// 불꽃 그라데이션 (브랜드 버건디 → 레드 → 오렌지)
export const fireGradientClassName =
  "bg-[linear-gradient(90deg,#741b2b,#c81e3a,#f97316,#c81e3a,#741b2b)] bg-[length:200%_100%] animate-fire-shift motion-reduce:animate-none";

export const FlickerFlame = ({ className = "h-4 w-4" }: { className?: string }) => (
  <Flame
    aria-hidden
    className={`${className} shrink-0 origin-bottom animate-flicker fill-amber-300 text-amber-200 drop-shadow-[0_0_6px_rgba(251,146,60,0.9)] motion-reduce:animate-none`}
  />
);

export const NewDropTicker = () => {
  const items = [...tickerItems, ...tickerItems];

  return (
    <div className="overflow-hidden border-y border-black/[0.08] py-2.5 text-brand">
      <div className="flex w-max animate-marquee items-center gap-10 whitespace-nowrap font-display text-[11px] font-semibold uppercase tracking-[0.24em] motion-reduce:animate-none">
        {[...items, ...items].map((item, index) => (
          <span key={index} className="flex items-center gap-10">
            {item}
            <span className="h-1 w-1 rounded-full bg-brand/50" />
          </span>
        ))}
      </div>
    </div>
  );
};

// Countdown set as type (numbers + hairline labels), not as a row of boxes.
const CountdownBlocks = ({ countdown }: { countdown: Countdown }) => (
  <div className="flex items-start gap-4 sm:gap-6">
    {[
      { value: countdown.days, label: "DAYS" },
      { value: countdown.hours, label: "HRS" },
      { value: countdown.minutes, label: "MIN" },
      { value: countdown.seconds, label: "SEC" },
    ].map((unit) => (
      <div key={unit.label} className="min-w-[2.6rem] sm:min-w-[3.4rem]">
        <p className="font-display text-[2rem] font-light leading-none tabular-nums tracking-[-0.04em] text-[#211b1c] sm:text-[2.75rem]">{pad(unit.value)}</p>
        <p className="mt-2 border-t border-black/15 pt-1.5 text-[9px] font-semibold tracking-[0.2em] text-stone-500">{unit.label}</p>
      </div>
    ))}
  </div>
);

type NewDropEventBannerProps = {
  ctaTo?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

export const NewDropEventBanner = ({ ctaTo, ctaHref, ctaLabel = "NEW DROP 01 보러가기" }: NewDropEventBannerProps) => {
  const countdown = useNewDropCountdown();
  if (!countdown) return null;

  const ctaClassName = "cta-primary shrink-0";

  return (
    <section>
      <NewDropTicker />
      <div className="page-shell grid gap-8 py-10 sm:py-14 lg:grid-cols-12 lg:items-end lg:gap-8">
        <div className="lg:col-span-6">
          <p className="eyebrow flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
            </span>
            Launch event
            <span className="text-stone-400">D-{countdown.days === 0 ? "DAY" : countdown.days} · ~10.10 (토)</span>
          </p>
          <h2 className="mt-4 font-display text-[clamp(2.4rem,5vw,4rem)] font-semibold leading-[0.95] tracking-[-0.045em] text-[#211b1c]">NEW DROP 01</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-stone-600 sm:text-base">
            {NEW_DROP_BRAND} 반팔 티셔츠 런칭 기념 · <strong className="font-semibold text-[#211b1c]">10월 10일까지만</strong> 선주문을 받습니다.
          </p>
        </div>
        <div className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between lg:col-span-6 lg:justify-end lg:gap-10">
          <CountdownBlocks countdown={countdown} />
          {ctaTo ? (
            <Link to={ctaTo} className={ctaClassName}>
              {ctaLabel} <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <a href={ctaHref} className={ctaClassName}>
              {ctaLabel} <ArrowRight className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
};
