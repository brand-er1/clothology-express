import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { BrandMascot } from "@/components/BrandMascot";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/components/ui/use-toast";
import { useMascotPageContextValue } from "./MascotContext";
import { useTutorial, markTutorialSeen } from "./TutorialContext";
import { getTutorialKeyForPath, resolveTutorialSteps, type TutorialPosition } from "./tutorials";

// A step that needs a login-gated route (e.g. /customize) can dead-end at /auth instead of
// ever reaching its target — this is how long we wait before treating that as "blocked" rather
// than "still navigating" and bailing out with an explanation instead of hanging silently.
const PAGE_NAV_TIMEOUT_MS = 1800;

const SPOTLIGHT_PADDING = 8;
const CARD_WIDTH = 300;
// Generous stand-in for the card's real height (message + progress dots + buttons) — the box is
// clamped against this instead of measuring after paint, so it never has to jump post-render.
const CARD_HEIGHT_ESTIMATE = 260;
const VIEWPORT_MARGIN = 12;
const GAP = 16;
const FIND_TARGET_RETRY_MS = 120;
const FIND_TARGET_TIMEOUT_MS = 900;

// Tutorials that intentionally span multiple routes or have no fixed route at all (pure
// narration steps). The "close tutorial if the route no longer matches its page" guard only
// makes sense for single-page tutorials — these instead rely on each step's own `page` to
// drive navigation.
const JOURNEY_KEYS = new Set(["brandProcess", "fundingConcept", "productionProcess"]);

type Rect = { top: number; left: number; width: number; height: number };

const rectFromElement = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/** Picks which side of the target the character/bubble should sit on, mirroring the spec's
 * "top button → character below, bottom button → character above" rule, then returns the card's
 * top-left corner directly (no CSS transform math) clamped so it never renders off-screen. */
const computeCardPosition = (
  rect: Rect,
  explicit: TutorialPosition | undefined,
  isMobile: boolean,
) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  let side: "top" | "bottom" | "left" | "right" = "bottom";
  if (explicit && explicit !== "auto" && !isMobile) {
    side = explicit;
  } else if (isMobile) {
    // Mobile: bubbles only ever go above or below, never off to the side (rule 17).
    side = centerY > vh * 0.55 ? "top" : "bottom";
  } else if (rect.top < vh * 0.35) {
    side = "bottom";
  } else if (rect.top + rect.height > vh * 0.65) {
    side = "top";
  } else if (centerX < vw * 0.35) {
    side = "right";
  } else if (centerX > vw * 0.65) {
    side = "left";
  }

  const cardWidth = isMobile ? Math.min(CARD_WIDTH, vw - VIEWPORT_MARGIN * 2) : CARD_WIDTH;
  const cardHeight = Math.min(CARD_HEIGHT_ESTIMATE, vh - VIEWPORT_MARGIN * 2);

  let top: number;
  let left: number;

  if (side === "top") {
    top = rect.top - GAP - cardHeight;
    left = centerX - cardWidth / 2;
  } else if (side === "bottom") {
    top = rect.top + rect.height + GAP;
    left = centerX - cardWidth / 2;
  } else if (side === "left") {
    top = centerY - cardHeight / 2;
    left = rect.left - GAP - cardWidth;
  } else {
    top = centerY - cardHeight / 2;
    left = rect.left + rect.width + GAP;
  }

  return {
    side,
    top: clamp(top, VIEWPORT_MARGIN, vh - VIEWPORT_MARGIN - cardHeight),
    left: clamp(left, VIEWPORT_MARGIN, vw - VIEWPORT_MARGIN - cardWidth),
    cardWidth,
  };
};

export const TutorialOverlay = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const pageContext = useMascotPageContextValue();
  const { activeKey, stepIndex, pendingKey, start, clearPending, stop, goNext, goPrev } = useTutorial();
  const [rect, setRect] = useState<Rect | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const pageTutorialKey = getTutorialKeyForPath(location.pathname);
  const steps = resolveTutorialSteps(activeKey, pageContext);
  const step = activeKey ? steps[Math.min(stepIndex, Math.max(steps.length - 1, 0))] : null;
  const isLastStep = activeKey ? stepIndex >= steps.length - 1 : false;
  const onStepPage = !step?.page || step.page === location.pathname;

  // Starting a tutorial from the character menu: navigate to whatever route its first step
  // needs (if any), then start once we've actually arrived. Works for a single fixed-page
  // tutorial (e.g. home) exactly the same way it works for a multi-page journey. If that route
  // needs login and bounces to /auth instead, give up with an explanation rather than hang.
  useEffect(() => {
    if (!pendingKey) return;
    const firstStep = resolveTutorialSteps(pendingKey, pageContext)[0];
    const targetPage = firstStep?.page;
    if (targetPage && targetPage !== location.pathname) {
      navigate(targetPage);
      const timer = window.setTimeout(() => {
        if (window.location.pathname !== targetPage) {
          clearPending();
          toast({ title: "로그인 후 이용할 수 있어요", description: "이 도움말은 로그인한 뒤에 볼 수 있어요." });
        }
      }, PAGE_NAV_TIMEOUT_MS);
      return () => window.clearTimeout(timer);
    }
    start(pendingKey);
    clearPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey, location.pathname]);

  // Never leave the overlay dangling on a page whose DOM no longer matches a single-page
  // tutorial. Journeys are exempt — their own steps drive navigation via `page` instead.
  useEffect(() => {
    if (activeKey && !JOURNEY_KEYS.has(activeKey) && pageTutorialKey !== activeKey) stop();
  }, [location.pathname, activeKey, pageTutorialKey, stop]);

  // Mid-tutorial step advance that needs a different route (journeys crossing /customize →
  // /design-quote etc.) — navigate there; the rest of this component waits via `onStepPage`.
  // Same login-wall bailout as above so a mid-tour redirect can't strand the overlay silently.
  useEffect(() => {
    if (!activeKey || !step?.page || step.page === location.pathname) return;
    const targetPage = step.page;
    navigate(targetPage);
    const timer = window.setTimeout(() => {
      if (window.location.pathname !== targetPage) {
        stop();
        toast({ title: "로그인 후 이용할 수 있어요", description: "이 도움말은 로그인한 뒤에 볼 수 있어요." });
      }
    }, PAGE_NAV_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, stepIndex, step?.page]);

  useEffect(() => {
    setDontShowAgain(false);
  }, [activeKey]);

  // Locate + track the current step's real target element: scroll it into view, measure it,
  // and keep measuring on resize/scroll/content changes so the spotlight tracks it live.
  // Conceptual steps (no `target`) and steps still waiting on a page navigation skip this.
  useEffect(() => {
    if (!activeKey || !step || !step.target || !onStepPage) {
      setRect(null);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let rafId: number;

    const measure = () => {
      const el = document.querySelector(step.target as string);
      if (!el) return null;
      return { el, rect: rectFromElement(el) };
    };

    const tryFind = () => {
      if (cancelled) return;
      const found = measure();
      if (found) {
        found.el.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => {
          if (!cancelled) {
            const refreshed = measure();
            setRect(refreshed ? refreshed.rect : found.rect);
          }
        }, 350);
        return;
      }
      attempts += 1;
      if (attempts * FIND_TARGET_RETRY_MS >= FIND_TARGET_TIMEOUT_MS) {
        // Target genuinely isn't on screen (e.g. conditional UI) — skip ahead instead of stalling.
        if (isLastStep) stop();
        else goNext();
        return;
      }
      window.setTimeout(tryFind, FIND_TARGET_RETRY_MS);
    };

    tryFind();

    const onViewportChange = () => {
      const found = measure();
      if (!found) return;
      setRect((current) =>
        current &&
        current.top === found.rect.top &&
        current.left === found.rect.left &&
        current.width === found.rect.width &&
        current.height === found.rect.height
          ? current
          : found.rect,
      );
    };
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    // Layout can keep shifting briefly after the step change (images loading, smooth-scroll in
    // progress), so poll every frame for the first second, then settle to resize/scroll only.
    let framesLeft = 60;
    const raf = () => {
      onViewportChange();
      framesLeft -= 1;
      if (framesLeft > 0) rafId = window.requestAnimationFrame(raf);
    };
    rafId = window.requestAnimationFrame(raf);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
      window.cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, stepIndex, step?.target, onStepPage]);

  if (!activeKey || !step || !onStepPage) return null;
  const isConceptual = !step.target;
  if (!isConceptual && !rect) return null;

  const handleClose = () => {
    stop();
  };

  const handleFinish = () => {
    if (dontShowAgain) markTutorialSeen(activeKey);
    stop();
  };

  const handleCta = (to: string) => {
    stop();
    navigate(to);
  };

  const progressBar = (
    <div className="mt-3 flex items-center gap-1">
      {steps.map((_, index) => (
        <span
          key={index}
          className={`h-1.5 rounded-full transition-all ${
            index === stepIndex ? "w-5 bg-brand" : "w-1.5 bg-stone-200"
          }`}
        />
      ))}
    </div>
  );

  const footer = isLastStep ? (
    <div className="mt-4 space-y-2.5">
      {step.ctas?.length ? (
        <div className="space-y-2">
          {step.ctas.map((cta, index) => (
            <button
              key={cta.to}
              type="button"
              onClick={() => handleCta(cta.to)}
              className={`h-10 w-full rounded-full text-sm font-bold transition ${
                index === 0
                  ? "bg-brand text-white hover:bg-brand-dark"
                  : "border border-stone-200 text-stone-700 hover:bg-stone-50"
              }`}
            >
              {cta.label}
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleFinish}
          className="h-10 w-full rounded-full bg-brand text-sm font-bold text-white transition hover:bg-brand-dark"
        >
          완료 ✓
        </button>
      )}
      <label className="flex items-center gap-2 text-xs font-semibold text-stone-500">
        <input
          type="checkbox"
          checked={dontShowAgain}
          onChange={(event) => setDontShowAgain(event.target.checked)}
          className="h-3.5 w-3.5 rounded border-stone-300 text-brand focus:ring-brand"
        />
        이 도움말 다시 보지 않기
      </label>
      {step.ctas?.length ? (
        <button
          type="button"
          onClick={handleFinish}
          className="w-full text-center text-xs font-bold text-stone-400 hover:text-stone-600"
        >
          닫기
        </button>
      ) : null}
    </div>
  ) : (
    <div className="mt-4 flex items-center justify-between">
      <button
        type="button"
        onClick={handleClose}
        className="text-xs font-bold text-stone-400 hover:text-stone-600"
      >
        건너뛰기
      </button>
      <div className="flex items-center gap-3">
        {stepIndex > 0 && (
          <button
            type="button"
            onClick={goPrev}
            className="text-xs font-bold text-stone-500 hover:text-stone-700"
          >
            ← 이전
          </button>
        )}
        <button
          type="button"
          onClick={goNext}
          className="rounded-full bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-dark"
        >
          다음 →
        </button>
      </div>
    </div>
  );

  const bubble = (widthClass: string) => (
    <div className={`relative ${widthClass} rounded-2xl border border-black/10 bg-white p-4 shadow-2xl`}>
      <button
        type="button"
        onClick={handleClose}
        aria-label="튜토리얼 종료"
        className="absolute right-2 top-2 rounded-full p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <p className="pr-6 text-[13px] font-bold uppercase tracking-[0.08em] text-brand">
        {stepIndex + 1} / {steps.length}
      </p>
      <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-stone-800">{step.message}</p>
      {progressBar}
      {footer}
    </div>
  );

  // Conceptual slide: no real target exists yet for this part of the story, so the character
  // just narrates centered on a uniformly dimmed screen instead of faking a spotlight.
  if (isConceptual) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#141312]/70 p-4" aria-live="polite">
        <button
          type="button"
          onClick={handleClose}
          aria-label="튜토리얼 닫기"
          className="fixed inset-0 z-[71] cursor-default"
        />
        <div className="relative z-[72] flex w-full max-w-sm flex-col items-center gap-3">
          <BrandMascot
            pose={step.character ?? "idle"}
            size={isMobile ? 64 : 88}
            className="animate-mascot-bounce drop-shadow-xl"
          />
          {bubble("w-full")}
        </div>
      </div>
    );
  }

  const spotlightStyle: React.CSSProperties = {
    position: "fixed",
    top: (rect as Rect).top - SPOTLIGHT_PADDING,
    left: (rect as Rect).left - SPOTLIGHT_PADDING,
    width: (rect as Rect).width + SPOTLIGHT_PADDING * 2,
    height: (rect as Rect).height + SPOTLIGHT_PADDING * 2,
    borderRadius: 16,
    boxShadow:
      "0 0 0 9999px rgba(20,15,14,0.55), 0 0 0 3px rgba(113,26,42,0.9), 0 0 28px 6px rgba(113,26,42,0.35)",
    transition: "top 300ms ease, left 300ms ease, width 300ms ease, height 300ms ease",
    pointerEvents: "none",
    zIndex: 70,
  };

  const { side, top, left, cardWidth } = computeCardPosition(rect as Rect, step.position, isMobile);

  return (
    <div className="fixed inset-0 z-[70]" aria-live="polite">
      <div style={spotlightStyle} />
      <button
        type="button"
        onClick={handleClose}
        aria-label="튜토리얼 닫기"
        className="fixed inset-0 z-[71] cursor-default"
      />

      <div
        className="fixed z-[72] flex flex-col items-center gap-2 transition-[top,left] duration-300 ease-out"
        style={{
          top,
          left,
          width: cardWidth,
          flexDirection: side === "top" ? "column-reverse" : "column",
        }}
      >
        <BrandMascot
          pose={step.character ?? "idle"}
          size={isMobile ? 56 : 76}
          className="animate-mascot-bounce drop-shadow-xl"
        />
        {bubble("w-full")}
      </div>
    </div>
  );
};
