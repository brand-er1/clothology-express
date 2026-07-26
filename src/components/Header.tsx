import { Link, NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { ArrowRight, LogOut, Menu, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { getAppPath } from "@/utils/appUrl";
import { getAccountType, type AccountType } from "@/utils/accountRouting";
import type { Session } from "@supabase/supabase-js";

type ProfileIdentity = {
  brandName: string;
  nickname: string;
};

export const Header = () => {
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [identity, setIdentity] = useState<ProfileIdentity>({ brandName: "", nickname: "" });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  useEffect(() => {
    let active = true;

    const syncSession = async (session: Session | null) => {
      if (!active) return;

      setIsAuthenticated(Boolean(session));
      setAccountType(session ? getAccountType(session.user) : null);

      if (!session?.user) {
        setIdentity({ brandName: "", nickname: "" });
        return;
      }

      const metadata = session.user.user_metadata;
      const fallback = {
        brandName: typeof metadata.brand_name === "string" ? metadata.brand_name : "",
        nickname: typeof metadata.username === "string"
          ? metadata.username
          : session.user.email?.split("@")[0] || "멤버",
      };

      const { data } = await supabase
        .from("profiles")
        .select("brand_name, username")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!active) return;
      setIdentity({
        brandName: data?.brand_name || fallback.brandName,
        nickname: data?.username || fallback.nickname,
      });
    };

    supabase.auth.getSession().then(({ data }) => syncSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const navItems = [
    { to: "/fundings", label: "펀딩 둘러보기", visible: true },
    { to: "/customize", label: "AI 디자인", visible: !isAuthenticated || accountType === "seller" },
    { to: "/orders", label: "제작 관리", visible: isAuthenticated && accountType === "seller" },
    { to: "/my-fundings", label: "내 펀딩", visible: isAuthenticated },
    { to: "/admin", label: "관리자", visible: isAdmin },
  ].filter((item) => item.visible);

  const displayName = identity.brandName || identity.nickname;
  const initial = displayName.trim().slice(0, 1).toUpperCase() || "B";

  const mobileMenu = (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full md:hidden" aria-label="메뉴">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[310px] border-l-stone-200 bg-[#fbfaf8] px-5">
        <div className="border-b border-stone-200 pb-6 pt-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">BRAND-ER</p>
          {isAuthenticated ? (
            <>
              <p className="mt-3 text-xl font-bold text-stone-950">{displayName}</p>
              {identity.brandName && <p className="mt-1 text-sm text-stone-500">@{identity.nickname}</p>}
            </>
          ) : (
            <p className="mt-3 text-lg font-semibold">아이디어를 제품으로 만들어보세요.</p>
          )}
        </div>
        <nav className="flex flex-col gap-1 py-6">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  isActive ? "bg-brand text-white" : "text-stone-700 hover:bg-stone-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-2 border-t border-stone-200 pt-5">
          {isAuthenticated ? (
            <>
              <Button asChild variant="outline" className="h-11 w-full rounded-full border-stone-300">
                <Link to="/profile">프로필 관리</Link>
              </Button>
              <Button variant="ghost" onClick={handleSignOut} className="h-11 w-full rounded-full text-stone-500">
                <LogOut className="mr-2 h-4 w-4" /> 로그아웃
              </Button>
            </>
          ) : (
            <Button asChild className="h-12 w-full rounded-full bg-brand hover:bg-brand-dark">
              <Link to="/auth">로그인 · 회원가입</Link>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-stone-200/80 bg-[#fbfaf8]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-8 px-4 sm:px-6 lg:px-8">
        <Link to={accountType === "buyer" ? "/fundings" : "/"} className="flex shrink-0 items-center">
          <img
            src={getAppPath("/lovable-uploads/40adfb8c-d6e9-4e33-899e-0e9db51c50f1.png")}
            alt="BRAND-ER"
            className="h-7 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive ? "bg-stone-950 text-white" : "text-stone-600 hover:bg-stone-100 hover:text-stone-950"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {isAuthenticated ? (
            <>
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-full border border-stone-200 bg-white py-1.5 pl-1.5 pr-3 transition hover:border-brand/30"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{initial}</span>
                <span className="max-w-32 truncate text-sm font-semibold text-stone-800">{displayName}</span>
              </Link>
              <Button variant="ghost" size="icon" onClick={handleSignOut} className="rounded-full text-stone-400 hover:text-brand" aria-label="로그아웃">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" className="rounded-full text-stone-600">
                <Link to="/auth">로그인</Link>
              </Button>
              <Button asChild className="h-11 rounded-full bg-brand px-5 hover:bg-brand-dark">
                <Link to="/auth">
                  <Sparkles className="mr-2 h-4 w-4" /> 브랜드 시작하기 <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
        </div>

        <div className="ml-auto md:hidden">{mobileMenu}</div>
      </div>
    </header>
  );
};
