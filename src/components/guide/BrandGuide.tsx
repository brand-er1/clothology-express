import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { BrandMascot } from "@/components/BrandMascot";
import { supabase } from "@/lib/supabase";
import { getAccountType, type AccountType } from "@/utils/accountRouting";
import { fetchFunding } from "@/services/funding";
import { useIsMobile } from "@/hooks/use-mobile";
import { getFundingDetailId, idleTips, staticMessages, type GuideMessage } from "./mascotConfig";
import { useMascotRoam } from "./useMascotRoam";

const IDLE_DELAY_MS = 4000;
const AUTO_HIDE_MS = 9000;
const IDLE_TIP_MIN_MS = 26000;
const IDLE_TIP_MAX_MS = 42000;

export const BrandGuide = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [message, setMessage] = useState<GuideMessage | null>(null);
  const [isBubbleOpen, setIsBubbleOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const shownKeys = useRef<Set<string>>(new Set());
  const lastActivityAt = useRef(Date.now());

  const roam = useMascotRoam({ enabled: !isMobile, paused: isBubbleOpen || isMenuOpen });
  const docked = isMobile || roam.safeZoneActive;

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setIsAuthenticated(Boolean(data.session));
      setAccountType(data.session ? getAccountType(data.session.user) : null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setIsAuthenticated(Boolean(session));
      setAccountType(session ? getAccountType(session.user) : null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Page-contextual message: static per route, or a live remaining-slot count on a funding detail page.
  useEffect(() => {
    setIsMenuOpen(false);
    setIsBubbleOpen(false);
    lastActivityAt.current = Date.now();

    const fundingId = getFundingDetailId(location.pathname);
    let cancelled = false;
    let showTimer: ReturnType<typeof setTimeout> | undefined;

    const resolveMessage = async (): Promise<GuideMessage | null> => {
      if (fundingId) {
        try {
          const funding = await fetchFunding(fundingId);
          const remaining = Math.max(0, funding.moq - funding.current_orders);
          return remaining > 0
            ? {
                key: `funding-${fundingId}`,
                text: `목표 달성까지 ${remaining}명 남았어요! 함께 참여해주시면 더 빨리 제작돼요.`,
              }
            : {
                key: `funding-${fundingId}-done`,
                text: "축하합니다! 🎉 목표를 달성했어요. 이제 제작을 시작할게요!",
              };
        } catch {
          return null;
        }
      }

      return staticMessages[location.pathname] ?? null;
    };

    resolveMessage().then((resolved) => {
      if (cancelled) return;
      setMessage(resolved);

      if (resolved && !shownKeys.current.has(resolved.key)) {
        shownKeys.current.add(resolved.key);
        showTimer = setTimeout(() => setIsBubbleOpen(true), IDLE_DELAY_MS);
      }
    });

    return () => {
      cancelled = true;
      if (showTimer) clearTimeout(showTimer);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!isBubbleOpen) return;
    const hideTimer = setTimeout(() => setIsBubbleOpen(false), AUTO_HIDE_MS);
    return () => clearTimeout(hideTimer);
  }, [isBubbleOpen]);

  // Random idle nudges (rule 7): if the visitor hasn't interacted with the guide in a while
  // and nothing else is showing, offer a soft check-in instead of staying silent forever.
  useEffect(() => {
    let cancelled = false;

    const scheduleTip = () => {
      const delay = IDLE_TIP_MIN_MS + Math.random() * (IDLE_TIP_MAX_MS - IDLE_TIP_MIN_MS);
      const timer = setTimeout(() => {
        if (cancelled) return;
        if (!isBubbleOpen && !isMenuOpen && Date.now() - lastActivityAt.current > IDLE_TIP_MIN_MS) {
          const tip = idleTips[Math.floor(Math.random() * idleTips.length)];
          setMessage({ key: `idle-${Date.now()}`, text: tip });
          setIsBubbleOpen(true);
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
    registerActivity();
    setIsBubbleOpen(false);
    setIsMenuOpen((open) => !open);
  };

  const characterButton = (
    <button
      type="button"
      onClick={toggleMenu}
      aria-label="브랜더 가이드 열기"
      aria-expanded={isMenuOpen}
      className="block rounded-full transition hover:scale-105"
    >
      <BrandMascot
        pose={docked ? "idle" : roam.pose}
        flip={!docked && roam.flip}
        size={docked ? (isMobile ? 56 : 64) : 88}
        className={!docked && roam.isMoving ? "animate-mascot-bounce drop-shadow-xl" : "drop-shadow-xl"}
      />
    </button>
  );

  const panel = (
    <div className="pointer-events-auto flex flex-col items-end gap-3">
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
            href="tel:+821059161331"
            className="flex items-center border-t border-black/5 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 hover:text-brand"
          >
            💬 1:1 도움받기
          </a>
        </div>
      )}

      {isBubbleOpen && message && !isMenuOpen && (
        <div className="relative w-64 rounded-2xl border border-black/10 bg-white p-4 pr-8 text-sm leading-6 text-stone-700 shadow-2xl">
          <button
            type="button"
            onClick={() => setIsBubbleOpen(false)}
            aria-label="말풍선 닫기"
            className="absolute right-2 top-2 rounded-full p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <p>{message.text}</p>
          {message.cta && (
            <Link
              to={message.cta.to}
              onClick={() => setIsBubbleOpen(false)}
              className="mt-3 inline-flex items-center text-xs font-bold uppercase tracking-[0.08em] text-brand hover:text-brand-dark"
            >
              {message.cta.label} →
            </Link>
          )}
          <span className="absolute -bottom-1.5 right-8 h-3 w-3 rotate-45 border-b border-r border-black/10 bg-white" />
        </div>
      )}

      {characterButton}
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
          transition: "left 1.7s cubic-bezier(0.45, 0.05, 0.35, 1), bottom 1.7s ease-in-out",
        }}
      >
        {panel}
      </div>
    </div>
  );
};
