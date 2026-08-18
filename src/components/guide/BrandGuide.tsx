import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Calculator, MessageCircleQuestion, Phone, ShoppingBag, Sparkles, X } from "lucide-react";
import { BrandMascot } from "@/components/BrandMascot";
import { supabase } from "@/lib/supabase";
import { getAccountType, type AccountType } from "@/utils/accountRouting";
import { fetchFunding } from "@/services/funding";

type GuideMessage = {
  key: string;
  text: string;
  cta?: { label: string; to: string };
};

const IDLE_DELAY_MS = 4000;
const AUTO_HIDE_MS = 9000;

const staticMessages: Record<string, GuideMessage> = {
  "/": {
    key: "home",
    text: "안녕하세요! 브랜더에서 나만의 옷을 만들어볼까요?",
    cta: { label: "펀딩 둘러보기", to: "/fundings" },
  },
  "/customize": {
    key: "customize",
    text: "어떤 스타일을 만들고 싶으신가요? AI가 멋진 디자인을 도와드릴게요!",
  },
  "/design-quote": {
    key: "design-quote",
    text: "예상 제작비를 확인해보세요! 수량에 따라 할인도 받을 수 있어요.",
  },
  "/fundings": {
    key: "fundings",
    text: "펀딩에 참여하면 제작이 시작돼요! 지금 참여하고 한정판을 만드세요.",
  },
  "/my-fundings": {
    key: "my-fundings",
    text: "내 펀딩 진행상황을 확인해볼까요?",
  },
};

const getFundingDetailId = (pathname: string) => {
  const match = pathname.match(/^\/fundings\/([^/]+)$/);
  return match ? match[1] : null;
};

export const BrandGuide = () => {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [message, setMessage] = useState<GuideMessage | null>(null);
  const [isBubbleOpen, setIsBubbleOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [wave, setWave] = useState(false);
  const [isHopping, setIsHopping] = useState(false);
  const shownKeys = useRef<Set<string>>(new Set());

  // Cycles the placeholder's pose while idle so it reads as "alive" rather than a static
  // icon. Once real character art/frames arrive, swap this for frame cycling instead.
  useEffect(() => {
    const interval = setInterval(() => {
      setWave((w) => !w);
      setIsHopping(true);
      setTimeout(() => setIsHopping(false), 500);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

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

  useEffect(() => {
    setIsMenuOpen(false);
    setIsBubbleOpen(false);

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
                text: "축하합니다! 목표를 달성했어요. 이제 제작을 시작할게요!",
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

  const menuItems = useMemo(() => {
    const canSeeStudio = !isAuthenticated || accountType === "seller";

    return [
      canSeeStudio && { label: "제작 시작하기", icon: Sparkles, to: "/customize" },
      canSeeStudio && { label: "견적 계산하기", icon: Calculator, to: "/design-quote" },
      { label: "펀딩 둘러보기", icon: ShoppingBag, to: "/fundings" },
      isAuthenticated && { label: "내 펀딩 확인하기", icon: MessageCircleQuestion, to: "/my-fundings" },
    ].filter((item): item is { label: string; icon: typeof Sparkles; to: string } => Boolean(item));
  }, [isAuthenticated, accountType]);

  if (location.pathname.startsWith("/admin")) return null;

  const toggleMenu = () => {
    setIsBubbleOpen(false);
    setIsMenuOpen((open) => !open);
  };

  return (
    <div className="fixed bottom-24 right-4 z-[60] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {isMenuOpen && (
        <div className="w-56 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">
          {menuItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 hover:text-brand"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          ))}
          <a
            href="tel:+821059161331"
            className="flex items-center gap-3 border-t border-black/5 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 hover:text-brand"
          >
            <Phone className="h-4 w-4 shrink-0" />
            1:1 상담하기
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

      <button
        type="button"
        onClick={toggleMenu}
        aria-label="브랜더 가이드 열기"
        aria-expanded={isMenuOpen}
        className={`flex h-14 w-14 items-center justify-center rounded-full border border-black/10 bg-[#f1ece4] shadow-xl transition hover:scale-105 hover:shadow-2xl sm:h-16 sm:w-16 ${
          isHopping ? "animate-bounce" : ""
        }`}
      >
        <BrandMascot tone="dark" size={44} wave={wave} className="pointer-events-none" />
      </button>
    </div>
  );
};
