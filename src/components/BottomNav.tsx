import { NavLink, useLocation } from "react-router-dom";
import { Home, Sparkles, Users, WalletCards, CircleUserRound, Factory } from "lucide-react";
import { useEffect, useState } from "react";
import { useBottomNavMetrics } from "@/hooks/useBottomNavMetrics";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/lib/supabase";
import { fetchUnreadCommunityNotificationCount } from "@/services/community";
import { PRODUCTION_REQUEST_PATH, productionRequestHref, trackProductionCtaClick } from "@/lib/production-request";

/**
 * 모바일 전용 하단 내비게이션 — 홈/만들기/[제작 의뢰]/매거진/펀딩/MY.
 * 기존 Header의 상단 메뉴는 그대로 유지하고, 모바일에서 핵심 흐름 이동만 보강한다.
 * '제작 의뢰'는 브랜더의 핵심 서비스라 탭 바 안에 버건디 버튼으로 고정한다 — 별도 플로팅 버튼을 띄우지 않아
 * 본문이나 각 페이지의 하단 고정 CTA(결제 · 다음 단계 버튼)를 가리지 않는다.
 */
const navItems = [
  { to: "/", label: "홈", icon: Home, end: true },
  { to: "/customize", label: "만들기", icon: Sparkles, end: false },
  { to: PRODUCTION_REQUEST_PATH, label: "제작 의뢰", icon: Factory, end: false, primary: true },
  { to: "/community", label: "매거진", icon: Users, end: false },
  { to: "/fundings", label: "펀딩", icon: WalletCards, end: false },
  { to: "/profile", label: "MY", icon: CircleUserRound, end: false },
] as const;

export const BottomNav = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const navRef = useBottomNavMetrics();

  useEffect(() => {
    let active = true;

    const refresh = () => {
      void fetchUnreadCommunityNotificationCount().then((count) => {
        if (active) setUnreadCount(count);
      });
    };

    refresh();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => refresh());
    const interval = window.setInterval(refresh, 60_000);

    return () => {
      active = false;
      subscription.unsubscribe();
      window.clearInterval(interval);
    };
  }, [location.pathname]);

  if (!isMobile) return null;

  return (
    <nav
      ref={navRef}
      className="fixed inset-x-0 bottom-[var(--viewport-bottom-inset,0px)] z-40 flex border-t border-black/10 bg-[#f6f3ee]/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
      aria-label="주요 메뉴"
    >
      {navItems.map(({ to, label, icon: Icon, end, ...rest }) => "primary" in rest ? (
        <NavLink
          key={to}
          to={productionRequestHref("mobile_bar")}
          onClick={() => trackProductionCtaClick("mobile_bar")}
          className="flex min-h-14 flex-[1.15] items-center justify-center px-0.5 py-1.5"
          aria-label="제작 의뢰하기"
        >
          {({ isActive }) => (
            <span className={`flex h-11 w-full max-w-[76px] flex-col items-center justify-center gap-0.5 rounded-[3px] text-[11px] font-semibold leading-4 text-white shadow-[0_4px_14px_rgba(116,27,43,0.28)] ${isActive ? "bg-brand-dark" : "bg-brand"}`}>
              <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
              {label}
            </span>
          )}
        </NavLink>
      ) : (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-semibold leading-4 transition ${
              isActive ? "text-brand" : "text-stone-400"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className="relative">
                <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.4 : 2} />
                {label === "MY" && unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};

/**
 * Bottom padding for the app shell: the measured tab bar height (`--bottom-nav-h`, 0 when no tab bar
 * is rendered, e.g. admin/seller consoles) plus the page's pinned CTA bar (`--mobile-cta-h`), so the
 * last footer links can always be scrolled fully above both fixed bars.
 */
export const BOTTOM_NAV_SPACER_CLASSNAME = "pb-[calc(var(--bottom-nav-h,0px)+var(--mobile-cta-h,0px))] md:pb-0";
