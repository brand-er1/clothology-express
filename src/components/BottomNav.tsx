import { NavLink, useLocation } from "react-router-dom";
import { Home, Sparkles, Users, WalletCards, CircleUserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/lib/supabase";
import { fetchUnreadCommunityNotificationCount } from "@/services/community";

/**
 * 모바일 전용 5탭 하단 내비게이션 — 홈/만들기/매거진/펀딩/MY.
 * 기존 Header의 상단 메뉴는 그대로 유지하고, 모바일에서 핵심 흐름 이동만 보강한다.
 */
const navItems = [
  { to: "/", label: "홈", icon: Home, end: true },
  { to: "/customize", label: "만들기", icon: Sparkles, end: false },
  { to: "/community", label: "매거진", icon: Users, end: false },
  { to: "/fundings", label: "펀딩", icon: WalletCards, end: false },
  { to: "/profile", label: "MY", icon: CircleUserRound, end: false },
] as const;

export const BottomNav = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

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
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-stone-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
      aria-label="주요 메뉴"
    >
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-semibold leading-4 transition ${
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

export const BOTTOM_NAV_SPACER_CLASSNAME = "pb-[calc(56px+env(safe-area-inset-bottom)+var(--mobile-cta-h,0px))] md:pb-0";
