import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Flame } from "lucide-react";

// NEW DROP 01 런칭 이벤트 종료 시각 (KST 10월 10일 자정 직전)
export const NEW_DROP_EVENT_END = new Date("2026-10-10T23:59:59+09:00");

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
  "HOT LAUNCH EVENT",
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
    <div className={`overflow-hidden py-3 text-white ${fireGradientClassName}`}>
      <div className="flex w-max animate-marquee items-center gap-10 whitespace-nowrap text-[11px] font-extrabold uppercase tracking-[0.24em] motion-reduce:animate-none sm:text-xs">
        {[...items, ...items].map((item, index) => (
          <span key={index} className="flex items-center gap-10">
            {item}
            <span aria-hidden>🔥</span>
          </span>
        ))}
      </div>
    </div>
  );
};

const CountdownBlocks = ({ countdown }: { countdown: Countdown }) => (
  <div className="flex items-center gap-1.5 sm:gap-2">
    {[
      { value: countdown.days, label: "DAYS" },
      { value: countdown.hours, label: "HRS" },
      { value: countdown.minutes, label: "MIN" },
      { value: countdown.seconds, label: "SEC" },
    ].map((unit) => (
      <div key={unit.label} className="min-w-[54px] bg-white/10 px-2 py-2 text-center ring-1 ring-orange-400/30 shadow-[0_0_18px_rgba(249,115,22,0.18)] sm:min-w-[68px] sm:py-3">
        <p className="font-mono text-2xl font-extrabold tabular-nums sm:text-3xl">{pad(unit.value)}</p>
        <p className="mt-0.5 text-[8px] font-bold tracking-[0.2em] text-white/55 sm:text-[9px]">{unit.label}</p>
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

  const ctaClassName =
    `inline-flex h-12 shrink-0 items-center justify-center px-6 text-sm font-extrabold text-white shadow-[0_0_24px_rgba(249,115,22,0.45)] transition hover:brightness-110 ${fireGradientClassName}`;

  return (
    <section className="border-b border-black/10">
      <NewDropTicker />
      <div className="relative overflow-hidden bg-[#1f1718] text-white">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-full bg-[radial-gradient(ellipse_60%_90%_at_18%_120%,rgba(249,115,22,0.38),rgba(200,30,58,0.22)_45%,transparent_75%)]" />
        <div className="pointer-events-none absolute -right-10 top-1/2 hidden -translate-y-1/2 select-none font-logo text-[13rem] leading-none text-white/[0.04] lg:block">
          DROP 01
        </div>
        <div className="relative mx-auto flex max-w-[1440px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10 lg:flex-row lg:items-center lg:justify-between lg:px-12 xl:px-16">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] ${fireGradientClassName}`}>
                <FlickerFlame className="h-3.5 w-3.5" />
                Hot launch event
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300">
                D-{countdown.days === 0 ? "DAY" : countdown.days} · ~10.10 (토)
              </span>
            </div>
            <h2 className="mt-3 flex items-center gap-3 font-logo text-[clamp(2.2rem,5vw,3.8rem)] leading-[0.95]">
              <FlickerFlame className="h-[0.9em] w-[0.9em]" />
              <span className="bg-[linear-gradient(90deg,#fff,#fed7aa_55%,#fb923c)] bg-clip-text text-transparent">NEW DROP 01</span>
            </h2>
            <p className="mt-2 text-sm text-white/70 sm:text-base">
              BRAND-ER 첫 번째 드롭 런칭 기념 · <strong className="text-white">10월 10일까지만</strong> 선주문을 받습니다.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <CountdownBlocks countdown={countdown} />
            {ctaTo ? (
              <Link to={ctaTo} className={ctaClassName}>
                <FlickerFlame className="mr-2 h-4 w-4" />
                {ctaLabel} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            ) : (
              <a href={ctaHref} className={ctaClassName}>
                <FlickerFlame className="mr-2 h-4 w-4" />
                {ctaLabel} <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
