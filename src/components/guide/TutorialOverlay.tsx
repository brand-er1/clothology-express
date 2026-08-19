import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { BrandMascot } from "@/components/BrandMascot";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/components/ui/use-toast";
import { useMascotPageContextValue } from "./MascotContext";
import { useTutorial, markTutorialSeen } from "./TutorialContext";
import { getTutorialKeyForPath, resolveTutorialSteps, type TutorialPosition } from "./tutorials";

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
  // When a step's page requires login and the visitor lands on /auth instead of the target, we
  // don't want to silently end a whole multi-page journey — once they actually log in, the
  // existing `returnTo` redirect (AuthGuard sets it, useAuthForm's resolvePostAuthDestination
  // honors it) brings them straight back to the page this step needed, and `onStepPage` below
  // picks that up on its own re-render, no extra wiring needed. This ref just remembers which
  // page we're waiting for, so a visitor who instead wanders off to some unrelated page without
  // logging in is treated as having abandoned the tour rather than left stuck in limbo forever.
  const awaitingLoginForPage = useRef<string | null>(null);
  // Mobile bottom-sheet offset: normally just a safe-area margin, but when the on-screen
  // keyboard opens (e.g. explaining a prompt/quantity input), visualViewport shrinks — track it
  // so the sheet lifts above the keyboard instead of being covered by it.
  const [sheetBottom, setSheetBottom] = useState(16);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setSheetBottom(covered + 16);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  const pageTutorialKey = getTutorialKeyForPath(location.pathname);
  const steps = resolveTutorialSteps(activeKey, pageContext);
  const step = activeKey ? steps[Math.min(stepIndex, Math.max(steps.length - 1, 0))] : null;
  const isLastStep = activeKey ? stepIndex >= steps.length - 1 : false;
  const onStepPage = step?.pagePattern
    ? step.pagePattern.test(location.pathname)
    : !step?.page || step.page === location.pathname;

  // Starting a tutorial from the character menu: navigate to whatever route its first step
  // needs (if any), then start once we've actually arrived. Works for a single fixed-page
  // tutorial (e.g. home) exactly the same way it works for a multi-page journey.
  useEffect(() => {
    if (!pendingKey) return;
    const firstStep = resolveTutorialSteps(pendingKey, pageContext)[0];
    const targetPage = firstStep?.page;
    if (targetPage && targetPage !== location.pathname) {
      navigate(targetPage);
      return;
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
  useEffect(() => {
    if (!activeKey || !step?.page || step.page === location.pathname) return;
    navigate(step.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, stepIndex, step?.page]);

  // A step's page can need login (AuthGuard bounces an anonymous visitor to /auth) or the right
  // account type (AuthGuard bounces a wrong-type visitor to /fundings instead) — this reacts the
  // instant `location.pathname` actually becomes one of those, not on a fixed timer, so it can
  // never race a slow-to-resolve session check the way a "wait N ms then check" guess could.
  //
  // /auth is a wait, not a dead end: the app already redirects back to the originally-requested
  // page after login via AuthGuard's `returnTo` param (honored in useAuthForm's
  // resolvePostAuthDestination), so once that happens `onStepPage` above picks it up on its own
  // re-render — nothing else to wire up. pendingKey/activeKey stay untouched while parked here.
  // /fundings (wrong account type) can't be waited out the same way, so that one still ends the
  // tour, just with an accurate message instead of a "log in" one that would be flat wrong for
  // someone who already is logged in.
  useEffect(() => {
    const requiredPage = activeKey
      ? step?.page
      : pendingKey
        ? resolveTutorialSteps(pendingKey, pageContext)[0]?.page
        : null;
    if (!requiredPage || requiredPage === location.pathname) return;

    if (location.pathname === "/auth") {
      if (awaitingLoginForPage.current === requiredPage) return;
      awaitingLoginForPage.current = requiredPage;
      toast({
        title: "로그인이 필요해요",
        description: "로그인하면 이어서 자동으로 보여드릴게요.",
      });
      return;
    }

    if (location.pathname === "/fundings") {
      awaitingLoginForPage.current = null;
      if (pendingKey) clearPending();
      if (activeKey) stop();
      toast({
        title: "판매자 계정으로 로그인해주세요",
        description: "이 도움말은 판매자 계정으로 로그인한 뒤에 볼 수 있어요.",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, activeKey, pendingKey, step?.page]);

  // A visitor who was parked waiting on /auth but wanders off to some unrelated page instead of
  // logging in has abandoned the tour — don't leave it silently stuck (and the roaming mascot
  // hidden, see BrandGuide's `if (tutorial.activeKey) return null`) forever.
  useEffect(() => {
    const awaitedPage = awaitingLoginForPage.current;
    if (!awaitedPage || location.pathname === "/auth") return;
    awaitingLoginForPage.current = null;
    if (location.pathname !== awaitedPage) {
      stop();
      clearPending();
    }
  }, [location.pathname, stop, clearPending]);

  // A `pagePattern` step (e.g. "whichever funding you clicked into") has no fixed destination
  // to navigate to — it only ever becomes reachable via a preceding `clickThrough` step's real
  // click. If that never landed (e.g. nothing to click — an empty list), don't strand the tour
  // showing nothing forever; skip past it the same way an unfound target skips ahead.
  useEffect(() => {
    if (!activeKey || !step?.pagePattern || onStepPage) return;
    const timer = window.setTimeout(() => {
      if (isLastStep) stop();
      else goNext();
    }, FIND_TARGET_TIMEOUT_MS + 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, stepIndex, step?.pagePattern, onStepPage]);

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
    window.addEventListener("orientationchange", onViewportChange);
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
      window.removeEventListener("orientationchange", onViewportChange);
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

  // "예시 펀딩 하나를 클릭" — real-click the spotlighted element so its own real navigation
  // fires (e.g. into that funding's actual detail page), instead of faking the transition.
  const handleNext = () => {
    if (step.clickThrough && step.target) {
      (document.querySelector(step.target) as HTMLElement | null)?.click();
    }
    goNext();
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
              className={`h-11 w-full rounded-full text-sm font-bold transition sm:h-10 ${
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
          className="h-11 w-full rounded-full bg-brand text-sm font-bold text-white transition hover:bg-brand-dark sm:h-10"
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
    // PC: 이전 | 건너뛰기 | 다음 in one row. Mobile: 이전/다음 get their own full-width row
    // (always tappable, never squeezed), 건너뛰기 drops to a second row below.
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
      <div className="flex items-center gap-2 sm:hidden">
        {stepIndex > 0 && (
          <button
            type="button"
            onClick={goPrev}
            className="h-11 flex-1 rounded-full border border-stone-200 text-sm font-bold text-stone-600"
          >
            ← 이전
          </button>
        )}
        <button
          type="button"
          onClick={handleNext}
          className="h-11 flex-1 rounded-full bg-brand text-sm font-bold text-white transition hover:bg-brand-dark"
        >
          다음 →
        </button>
      </div>
      <button
        type="button"
        onClick={handleClose}
        className="text-xs font-bold text-stone-400 hover:text-stone-600 sm:order-first"
      >
        건너뛰기
      </button>
      <div className="hidden items-center gap-3 sm:flex">
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
          onClick={handleNext}
          className="rounded-full bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-dark"
        >
          다음 →
        </button>
      </div>
    </div>
  );

  const cardInner = (
    <>
      <button
        type="button"
        onClick={handleClose}
        aria-label="튜토리얼 종료"
        className="absolute right-3 top-3 rounded-full p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 sm:right-2 sm:top-2"
      >
        <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
      </button>

      <p className="pr-6 text-[13px] font-bold uppercase tracking-[0.08em] text-brand">
        {stepIndex + 1} / {steps.length}
      </p>
      <p className="mt-1.5 whitespace-pre-line break-words text-sm leading-6 text-stone-800">{step.message}</p>
      {progressBar}
      {footer}
    </>
  );

  // Mobile: readability of the card beats keeping it glued to the character (spec priority:
  // text visible > buttons tappable > target visible > character position). A fixed bottom
  // sheet — clamped to the viewport width with real margins, capped height with its own
  // scroll, and nudged above the on-screen keyboard via visualViewport — can never clip,
  // over­lap the character, or push its buttons off-screen the way a target-relative bubble
  // could on a narrow screen. The character just sits small, just above the sheet.
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[70]" aria-live="polite">
        {!isConceptual && rect && (
          <div
            style={{
              position: "fixed",
              top: (rect as Rect).top - SPOTLIGHT_PADDING,
              left: (rect as Rect).left - SPOTLIGHT_PADDING,
              width: (rect as Rect).width + SPOTLIGHT_PADDING * 2,
              height: (rect as Rect).height + SPOTLIGHT_PADDING * 2,
              borderRadius: 16,
              boxShadow:
                "0 0 0 9999px rgba(20,15,14,0.6), 0 0 0 3px rgba(113,26,42,0.9), 0 0 24px 6px rgba(113,26,42,0.35)",
              transition: "top 300ms ease, left 300ms ease, width 300ms ease, height 300ms ease",
              pointerEvents: "none",
              zIndex: 70,
            }}
          />
        )}
        {isConceptual && <div className="fixed inset-0 z-[70] bg-[#141312]/65" />}
        <button
          type="button"
          onClick={handleClose}
          aria-label="튜토리얼 닫기"
          className="fixed inset-0 z-[71] cursor-default"
        />
        {/* Character and sheet stack in one bottom-anchored flex column, so the character is
            always fully above the sheet no matter how tall the sheet's content makes it —
            never the two independently-anchored elements overlapping. */}
        <div
          className="fixed inset-x-4 z-[72] flex flex-col items-center gap-2"
          style={{ bottom: sheetBottom, maxWidth: "calc(100vw - 32px)" }}
        >
          <BrandMascot
            pose={step.character ?? "idle"}
            size={56}
            className="animate-mascot-bounce drop-shadow-xl"
          />
          <div className="flex max-h-[50vh] w-full flex-col overflow-y-auto rounded-2xl border border-black/10 bg-white p-4 shadow-2xl">
            {cardInner}
          </div>
        </div>
      </div>
    );
  }

  // Conceptual slide (desktop): no real target exists yet for this part of the story, so the
  // character just narrates centered on a uniformly dimmed screen instead of faking a spotlight.
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
            size={88}
            className="animate-mascot-bounce drop-shadow-xl"
          />
          <div className="relative w-full rounded-2xl border border-black/10 bg-white p-4 shadow-2xl">{cardInner}</div>
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
          size={76}
          className="animate-mascot-bounce drop-shadow-xl"
        />
        <div className="relative w-full rounded-2xl border border-black/10 bg-white p-4 shadow-2xl">{cardInner}</div>
      </div>
    </div>
  );
};
