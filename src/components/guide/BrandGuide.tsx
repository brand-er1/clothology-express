import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { BrandMascot } from "@/components/BrandMascot";
import { supabase } from "@/lib/supabase";
import { getAccountType, type AccountType } from "@/utils/accountRouting";
import { fetchFunding } from "@/services/funding";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  customizeDetailNudge,
  customizeStepTips,
  firstVisitIntro,
  fundingConceptIntro,
  fundingDetailHelp,
  fundingEditorIntro,
  fundingManagerIntro,
  getFundingDetailId,
  getFundingProgressMessage,
  getKakaoPayResultMessage,
  getLoginWelcomeMessage,
  getMyFundingsMessage,
  hasGreetedThisSession,
  hasSeenFirstVisitIntro,
  idleTips,
  markFirstVisitIntroSeen,
  markGreetedThisSession,
  quoteObjectionNudge,
  returningVisitorGreeting,
  staticMessages,
  type GuideMessage,
} from "./mascotConfig";
import { useMascotPageContextValue } from "./MascotContext";
import { useMascotRoam } from "./useMascotRoam";

const DRAG_THRESHOLD_PX = 6;
const IDLE_DELAY_MS = 4000;
const AUTO_HIDE_MS = 9000;
const IDLE_TIP_MIN_MS = 26000;
const IDLE_TIP_MAX_MS = 42000;
const CONTEXT_NUDGE_DELAY_MS = 4000;
const CUSTOMIZE_DESIGN_STEP = 3;
const CUSTOMIZE_SHORT_DETAIL_LENGTH = 12;

/** Picks the highest-priority eligible candidate (lower number = more important); ties keep array order. */
const pickCandidate = (candidates: (GuideMessage | null)[], shownKeys: Set<string>): GuideMessage | null => {
  const eligible = candidates.filter(
    (candidate): candidate is GuideMessage => Boolean(candidate) && !shownKeys.has(candidate.key)
  );
  if (!eligible.length) return null;
  return [...eligible].sort((a, b) => a.priority - b.priority)[0];
};

export const BrandGuide = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const pageContext = useMascotPageContextValue();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [message, setMessage] = useState<GuideMessage | null>(null);
  const [isBubbleOpen, setIsBubbleOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const shownKeys = useRef<Set<string>>(new Set());
  const lastActivityAt = useRef(Date.now());
  // rule 27: visitors who keep dismissing without engaging get nudged less; engaged visitors get more.
  const missCount = useRef(0);
  const engagementCount = useRef(0);
  const hasEngagedWithBubble = useRef(false);
  const dragState = useRef<{ pointerId: number; startX: number; startY: number; dragging: boolean } | null>(null);
  const justDraggedRef = useRef(false);

  const roam = useMascotRoam({ enabled: true, paused: isBubbleOpen || isMenuOpen || isDragging, compact: isMobile });
  const docked = roam.safeZoneActive;

  useEffect(() => {
    let active = true;
    let loginWelcomeTimer: ReturnType<typeof setTimeout> | undefined;

    // Same brand name → username → email-prefix fallback the header uses, so the mascot never
    // greets someone by a name their account doesn't actually have.
    const resolveDisplayName = async (userId: string, metadata: Record<string, unknown>, email?: string) => {
      const fallback =
        (typeof metadata.brand_name === "string" && metadata.brand_name) ||
        (typeof metadata.username === "string" && metadata.username) ||
        email?.split("@")[0] ||
        "회원";

      const { data } = await supabase
        .from("profiles")
        .select("brand_name, username")
        .eq("id", userId)
        .maybeSingle();

      return data?.brand_name || data?.username || fallback;
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setIsAuthenticated(Boolean(data.session));
      setAccountType(data.session ? getAccountType(data.session.user) : null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setIsAuthenticated(Boolean(session));
      setAccountType(session ? getAccountType(session.user) : null);

      // Greets by name only at the actual moment of signing in — not on a page load that just
      // restores an already-open session (that's INITIAL_SESSION, left to the normal greeting).
      if (event === "SIGNED_IN" && session?.user) {
        resolveDisplayName(session.user.id, session.user.user_metadata, session.user.email).then((name) => {
          if (!active) return;
          // Delayed past the post-login redirect's own route-change effect (which resets the
          // bubble on every pathname change), so this greeting is the one that actually lands.
          loginWelcomeTimer = setTimeout(() => {
            if (!active) return;
            markGreetedThisSession();
            showMessage(getLoginWelcomeMessage(name));
          }, 1500);
        });
      }
    });

    return () => {
      active = false;
      if (loginWelcomeTimer) clearTimeout(loginWelcomeTimer);
      subscription.unsubscribe();
    };
  }, []);

  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const showMessage = (candidate: GuideMessage) => {
    hasEngagedWithBubble.current = false;
    shownKeys.current.add(candidate.key);
    setMessage(candidate);
    setIsDetailOpen(false);
    setIsBubbleOpen(true);
  };

  const closeBubble = () => {
    if (hasEngagedWithBubble.current) {
      engagementCount.current += 1;
    } else {
      missCount.current += 1;
    }
    setIsBubbleOpen(false);
  };

  // Resolves the best message for the current route: first-visit intro (or, for a visitor who
  // already saw it on an earlier visit, a light "welcome back") takes priority everywhere until
  // seen, then funding concept/progress (real data only), then the route's static tip. Only one
  // bubble is ever shown at a time (rule 25).
  useEffect(() => {
    setIsMenuOpen(false);
    setIsBubbleOpen(false);
    lastActivityAt.current = Date.now();

    const fundingId = getFundingDetailId(location.pathname);
    const isFundingArea = location.pathname === "/fundings" || Boolean(fundingId);
    let cancelled = false;
    let showTimer: ReturnType<typeof setTimeout> | undefined;

    const resolveCandidates = async (): Promise<(GuideMessage | null)[]> => {
      const intro = !hasSeenFirstVisitIntro()
        ? firstVisitIntro
        : !hasGreetedThisSession()
          ? returningVisitorGreeting
          : null;

      if (fundingId) {
        try {
          const funding = await fetchFunding(fundingId);
          const progress = getFundingProgressMessage(fundingId, funding.current_orders, funding.moq);
          return [intro, isFundingArea ? fundingConceptIntro : null, progress];
        } catch {
          return [intro];
        }
      }

      if (location.pathname.endsWith("/edit") && location.pathname.startsWith("/fundings/")) {
        return [intro, fundingEditorIntro];
      }
      if (location.pathname.endsWith("/manage") && location.pathname.startsWith("/fundings/")) {
        return [intro, fundingManagerIntro];
      }

      return [intro, isFundingArea ? fundingConceptIntro : null, staticMessages[location.pathname] ?? null];
    };

    resolveCandidates().then((candidates) => {
      if (cancelled) return;
      const resolved = pickCandidate(candidates, shownKeys.current);
      if (!resolved) return;

      showTimer = setTimeout(() => {
        if (resolved.key === firstVisitIntro.key) markFirstVisitIntroSeen();
        if (resolved.key === returningVisitorGreeting.key) markGreetedThisSession();
        showMessage(resolved);
      }, IDLE_DELAY_MS);
    });

    return () => {
      cancelled = true;
      if (showTimer) clearTimeout(showTimer);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!isBubbleOpen) return;
    const hideTimer = setTimeout(closeBubble, AUTO_HIDE_MS);
    return () => clearTimeout(hideTimer);
  }, [isBubbleOpen]);

  // Customize wizard, step-driven nudges: a short-description nudge on the AI prompt step
  // (rule 4/5, pointing at the example/trend cards already built into that step rather than
  // duplicating them here) and a MOQ/sample tip on the material and size steps (rule 3/15/16).
  // Debounced by pageContext changing on every keystroke, so it settles ~4s after input stops.
  useEffect(() => {
    if (location.pathname !== "/customize") return;
    if (isBubbleOpen || isMenuOpen) return;

    const step = typeof pageContext.step === "number" ? pageContext.step : null;
    const detailLength = typeof pageContext.detailLength === "number" ? pageContext.detailLength : 0;

    let candidate: GuideMessage | null = null;
    if (step === CUSTOMIZE_DESIGN_STEP && detailLength < CUSTOMIZE_SHORT_DETAIL_LENGTH) {
      candidate = customizeDetailNudge;
    } else if (step !== null && customizeStepTips[step]) {
      candidate = customizeStepTips[step];
    }

    if (!candidate || shownKeys.current.has(candidate.key)) return;

    const timer = setTimeout(() => showMessage(candidate as GuideMessage), CONTEXT_NUDGE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [location.pathname, pageContext.step, pageContext.detailLength, isBubbleOpen, isMenuOpen]);

  // Quote page: once a real estimate exists and the visitor still hasn't acted a while after
  // the pricing-structure tip, offer to help adjust the request instead of just going quiet (rule 8).
  useEffect(() => {
    if (location.pathname !== "/design-quote") return;
    if (isBubbleOpen || isMenuOpen) return;
    if (!pageContext.hasEstimate) return;
    if (!shownKeys.current.has(staticMessages["/design-quote"]?.key ?? "")) return;
    if (shownKeys.current.has(quoteObjectionNudge.key)) return;

    const timer = setTimeout(() => showMessage(quoteObjectionNudge), IDLE_TIP_MIN_MS / 2);
    return () => clearTimeout(timer);
  }, [location.pathname, pageContext.hasEstimate, isBubbleOpen, isMenuOpen]);

  // My-fundings: a real, per-user priority message (needs revision > payment pending > goal
  // reached > generic) instead of a single static line, built only from counts the page itself
  // fetched (rule 18/24).
  useEffect(() => {
    if (location.pathname !== "/my-fundings") return;
    if (isBubbleOpen || isMenuOpen) return;

    const summary = pageContext.myFundingsSummary as
      | { plannedCount: number; needsRevisionCount: number }
      | undefined;
    if (!summary) return;

    const candidate = getMyFundingsMessage(summary);
    if (shownKeys.current.has(candidate.key)) return;

    const timer = setTimeout(() => showMessage(candidate), CONTEXT_NUDGE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [location.pathname, pageContext.myFundingsSummary, isBubbleOpen, isMenuOpen]);

  // KakaoPay result: mirrors the page's own already-accurate state/message in the mascot's
  // voice instead of a second, possibly-inconsistent claim (rule 20).
  useEffect(() => {
    if (!location.pathname.startsWith("/payments/kakaopay")) return;
    if (isBubbleOpen || isMenuOpen) return;

    const resultState = typeof pageContext.resultState === "string" ? pageContext.resultState : "";
    const resultMessage = typeof pageContext.resultMessage === "string" ? pageContext.resultMessage : "";
    const candidate = getKakaoPayResultMessage(resultState, resultMessage);
    if (!candidate || shownKeys.current.has(candidate.key)) return;

    const timer = setTimeout(() => showMessage(candidate), 800);
    return () => clearTimeout(timer);
  }, [location.pathname, pageContext.resultState, pageContext.resultMessage, isBubbleOpen, isMenuOpen]);

  // Idle nudges (rule 7/19): if the visitor hasn't interacted with the guide in a while and
  // nothing else is showing, offer a soft check-in — on a funding detail page this is the more
  // useful "questions about this design?" prompt once, otherwise a random light tip. Frequency
  // adapts to how the visitor has treated the guide so far (rule 27).
  useEffect(() => {
    let cancelled = false;

    const scheduleTip = () => {
      const adapt = missCount.current >= 3 ? 1.6 : engagementCount.current >= 2 ? 0.7 : 1;
      const delay = (IDLE_TIP_MIN_MS + Math.random() * (IDLE_TIP_MAX_MS - IDLE_TIP_MIN_MS)) * adapt;
      const timer = setTimeout(() => {
        if (cancelled) return;
        if (!isBubbleOpen && !isMenuOpen && Date.now() - lastActivityAt.current > IDLE_TIP_MIN_MS * adapt) {
          const isFundingDetail = Boolean(getFundingDetailId(location.pathname));
          if (isFundingDetail && !shownKeys.current.has(fundingDetailHelp.key)) {
            showMessage(fundingDetailHelp);
          } else {
            const tip = idleTips[Math.floor(Math.random() * idleTips.length)];
            showMessage({ key: `idle-${Date.now()}`, priority: 5, text: tip });
          }
        }
        scheduleTip();
      }, delay);
      return timer;
    };

    const timer = scheduleTip();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const menuItems = useMemo(() => {
    const canSeeStudio = !isAuthenticated || accountType === "seller";

    return [
      canSeeStudio && { label: "👕 옷 제작 시작 (AI 디자인)", to: "/customize" },
      canSeeStudio && { label: "🧮 제작 견적 확인", to: "/design-quote" },
      { label: "🚀 펀딩 둘러보기", to: "/fundings" },
      isAuthenticated && { label: "📦 내 펀딩 현황", to: "/my-fundings" },
    ].filter((item): item is { label: string; to: string } => Boolean(item));
  }, [isAuthenticated, accountType]);

  if (location.pathname.startsWith("/admin")) return null;

  const registerActivity = () => {
    lastActivityAt.current = Date.now();
  };

  const toggleMenu = () => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    registerActivity();
    hasEngagedWithBubble.current = true;
    setIsBubbleOpen(false);
    setIsMenuOpen((open) => !open);
  };

  // Lets a visitor pick up the character and drop it anywhere on screen; it keeps roaming
  // from that new spot afterwards instead of snapping back. Disabled while docked (fixed
  // safe-zone corner) since that position isn't percent-based.
  const handleCharacterPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (docked) return;
    dragState.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, dragging: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCharacterPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragState.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;

    if (!state.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      state.dragging = true;
      setIsDragging(true);
      setIsBubbleOpen(false);
      setIsMenuOpen(false);
    }

    if (state.dragging) {
      event.preventDefault();
      registerActivity();
      const xPercent = (event.clientX / window.innerWidth) * 100;
      const bottomPercent = ((window.innerHeight - event.clientY) / window.innerHeight) * 100;
      roam.setManualPosition(xPercent, bottomPercent);
    }
  };

  const handleCharacterPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragState.current;
    if (!state || state.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragState.current = null;
    if (state.dragging) justDraggedRef.current = true;
    setIsDragging(false);
  };

  const handleEngage = () => {
    hasEngagedWithBubble.current = true;
    engagementCount.current += 1;
    setIsBubbleOpen(false);
  };

  const handleChoiceClick = (choice: NonNullable<GuideMessage["choices"]>[number]) => {
    hasEngagedWithBubble.current = true;
    engagementCount.current += 1;
    if (choice.next) {
      showMessage(choice.next);
      return;
    }
    setIsBubbleOpen(false);
  };

  const characterButton = (
    <button
      type="button"
      onClick={toggleMenu}
      onPointerDown={handleCharacterPointerDown}
      onPointerMove={handleCharacterPointerMove}
      onPointerUp={handleCharacterPointerUp}
      onPointerCancel={handleCharacterPointerUp}
      aria-label="브랜더 가이드 열기 (끌어서 위치를 옮길 수 있어요)"
      aria-expanded={isMenuOpen}
      className={`block rounded-full transition hover:scale-105 ${docked ? "" : "touch-none cursor-grab active:cursor-grabbing"}`}
    >
      <BrandMascot
        pose={docked ? "idle" : roam.pose}
        flip={!docked && roam.flip}
        size={docked ? (isMobile ? 56 : 64) : isMobile ? 68 : 88}
        className={!docked && roam.isMoving ? "animate-mascot-bounce drop-shadow-xl" : "drop-shadow-xl"}
      />
    </button>
  );

  // A character dragged into the upper half of the screen would otherwise push the menu/bubble
  // (which normally opens upward, above the character) off the top of the viewport — flip it to
  // open downward instead. Docked mode always sits low in a fixed corner, so it never needs this.
  const flipPanelBelow = !docked && roam.bottomPercent > 55;
  // Same idea horizontally: near the left edge, right-aligning the popup to the character would
  // push it off the left of the screen, so left-align it instead.
  const flipPanelLeft = !docked && roam.xPercent < 25;

  const popupContent = (
    <>
      {isMenuOpen && (
        <div className="w-60 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">
          {menuItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center px-4 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 hover:text-brand"
            >
              {item.label}
            </Link>
          ))}
          <a
            href="https://open.kakao.com/o/sxDGCT4h"
            target="_blank"
            rel="noreferrer"
            className="flex items-center border-t border-black/5 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 hover:text-brand"
          >
            💬 1:1 도움받기
          </a>
        </div>
      )}

      {isBubbleOpen && message && !isMenuOpen && (
        <div className="relative w-72 rounded-2xl border border-black/10 bg-white p-4 pr-8 text-sm leading-6 text-stone-700 shadow-2xl">
          <button
            type="button"
            onClick={closeBubble}
            aria-label="말풍선 닫기"
            className="absolute right-2 top-2 rounded-full p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <p className="whitespace-pre-line">{message.text}</p>
          {isDetailOpen && message.detail && (
            <p className="mt-2 whitespace-pre-line border-t border-black/5 pt-2 text-[13px] leading-6 text-stone-500">
              {message.detail}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold uppercase tracking-[0.08em]">
            {message.detail && !isDetailOpen && (
              <button
                type="button"
                onClick={() => {
                  hasEngagedWithBubble.current = true;
                  setIsDetailOpen(true);
                }}
                className="text-stone-500 hover:text-stone-700"
              >
                자세히 설명
              </button>
            )}
            {message.cta && (
              <Link to={message.cta.to} onClick={handleEngage} className="text-brand hover:text-brand-dark">
                {message.cta.label} →
              </Link>
            )}
            {(message.detail || message.cta) && (
              <button type="button" onClick={closeBubble} className="text-stone-400 hover:text-stone-600">
                닫기
              </button>
            )}
          </div>
          {message.choices && (
            <div className="mt-3 flex flex-col gap-1.5">
              {message.choices.map((choice) =>
                choice.to ? (
                  <Link
                    key={choice.label}
                    to={choice.to}
                    onClick={() => handleChoiceClick(choice)}
                    className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 transition hover:border-brand/40 hover:bg-brand/5 hover:text-brand"
                  >
                    {choice.label}
                  </Link>
                ) : (
                  <button
                    key={choice.label}
                    type="button"
                    onClick={() => handleChoiceClick(choice)}
                    className="rounded-lg border border-stone-200 px-3 py-2 text-left text-xs font-semibold text-stone-500 transition hover:border-stone-300 hover:bg-stone-50"
                  >
                    {choice.label}
                  </button>
                )
              )}
            </div>
          )}
          <span
            className={`absolute h-3 w-3 rotate-45 bg-white ${flipPanelLeft ? "left-8" : "right-8"} ${
              flipPanelBelow ? "-top-1.5 border-l border-t border-black/10" : "-bottom-1.5 border-b border-r border-black/10"
            }`}
          />
        </div>
      )}
    </>
  );

  // The popup is absolutely positioned off a wrapper sized to just the character, so the
  // character's own anchor point never shifts when a menu/bubble opens, closes, or flips side.
  const panel = (
    <div className="pointer-events-auto relative inline-block">
      {characterButton}
      <div
        className={`absolute flex flex-col gap-3 ${flipPanelBelow ? "top-full mt-3" : "bottom-full mb-3"} ${
          flipPanelLeft ? "left-0 items-start" : "right-0 items-end"
        }`}
      >
        {popupContent}
      </div>
    </div>
  );

  if (docked) {
    return (
      <div className="pointer-events-none fixed bottom-24 right-4 z-[60] sm:bottom-6 sm:right-6">
        {panel}
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] h-0">
      <div
        className="pointer-events-none absolute flex flex-col items-end gap-3"
        style={{
          left: `${roam.xPercent}%`,
          bottom: `${roam.bottomPercent}vh`,
          transform: "translateX(-50%)",
          transition: isDragging ? "none" : "left 1.7s cubic-bezier(0.45, 0.05, 0.35, 1), bottom 1.7s ease-in-out",
        }}
      >
        {panel}
      </div>
    </div>
  );
};
