import { Link, NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, LogOut, Menu } from "lucide-react";
import { getAppPath } from "@/utils/appUrl";
import { getAccountType, type AccountType } from "@/utils/accountRouting";
import type { Session } from "@supabase/supabase-js";
import { MakeMegaMenu } from "@/components/nav/MakeMegaMenu";
import { FullMenuSheet } from "@/components/nav/FullMenuSheet";
import { getMakeItems, getMyItems } from "@/components/nav/navigationData";

type ProfileIdentity = {
  brandName: string;
  nickname: string;
};

const topPillClassName = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-2 text-sm font-semibold transition ${
    isActive ? "bg-stone-950 text-white" : "text-stone-600 hover:bg-stone-100 hover:text-stone-950"
  }`;

export const Header = () => {
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [identity, setIdentity] = useState<ProfileIdentity>({ brandName: "", nickname: "" });
  const [isFullMenuOpen, setIsFullMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  useEffect(() => {
    let active = true;

    const syncSession = async (session: Session | null) => {
      if (!active) return;

      setIsAuthenticated(Boolean(session));
      setUserId(session?.user.id ?? null);
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

  const makeItems = getMakeItems({ isAuthenticated, accountType, isAdmin, userId });
  const myItems = getMyItems({ isAuthenticated, accountType, isAdmin, userId });

  const displayName = identity.brandName || identity.nickname;
  const initial = displayName.trim().slice(0, 1).toUpperCase() || "B";

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-gray-200/80 bg-[#f9fafb]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-4 sm:h-[72px] sm:px-6 lg:gap-8 lg:px-8">
        <Link to="/" className="flex shrink-0 items-center">
          <img
            src={getAppPath("/lovable-uploads/40adfb8c-d6e9-4e33-899e-0e9db51c50f1.png")}
            alt="BRAND-ER"
            className="h-8 w-auto sm:h-7"
          />
        </Link>

        {/* 핵심 탐색 메뉴만 노출하고 제작 세부 기능은 MAKE 안에 묶는다. */}
        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/fundings" className={topPillClassName}>SHOP</NavLink>
          <MakeMegaMenu items={makeItems} />
          <NavLink to="/community" className={topPillClassName}>COMMUNITY</NavLink>
          <NavLink to="/magazine" className={topPillClassName}>MAGAZINE</NavLink>
          <NavLink to="/portfolio" className={topPillClassName}>PORTFOLIO</NavLink>
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex" data-tutorial="header-account">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {isAuthenticated ? (
                <button className="flex items-center gap-2 rounded-full border border-stone-200 bg-white py-1.5 pl-1.5 pr-3 text-sm font-semibold text-stone-800 transition hover:border-brand/30">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                    {initial}
                  </span>
                  MY
                  <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
                </button>
              ) : (
                <button className="flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 hover:text-stone-950">
                  MY
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-2xl p-2">
              {isAuthenticated ? (
                <>
                  <DropdownMenuLabel className="px-2 py-1.5">
                    <p className="text-sm font-bold text-stone-950">{displayName}</p>
                    {identity.brandName && <p className="text-xs font-normal text-stone-500">@{identity.nickname}</p>}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {myItems.map((item) => (
                    <DropdownMenuItem
                      key={`${item.to}-${item.label}`}
                      asChild
                      className="cursor-pointer rounded-xl py-2 text-sm font-semibold"
                    >
                      <Link to={item.to}>{item.label}</Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="cursor-pointer rounded-xl py-2 text-sm font-semibold text-stone-500"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> 로그아웃
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem asChild className="cursor-pointer rounded-xl py-2 text-sm font-semibold">
                    <Link to="/auth?mode=login">로그인</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer rounded-xl py-2 text-sm font-semibold">
                    <Link to="/auth?mode=signup">회원가입</Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button asChild className="h-11 rounded-full bg-brand px-5 hover:bg-brand-dark">
            <Link to="/customize">
              옷 만들기 <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullMenuOpen(true)}
            className="h-11 w-11 rounded-full text-stone-500 hover:text-stone-950"
            aria-label="전체 메뉴"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <div className="ml-auto md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullMenuOpen(true)}
            className="h-11 w-11 rounded-full"
            aria-label="메뉴"
          >
            <Menu className="h-5.5 w-5.5" />
          </Button>
        </div>
      </div>

      <FullMenuSheet
        open={isFullMenuOpen}
        onOpenChange={setIsFullMenuOpen}
        isAuthenticated={isAuthenticated}
        displayName={displayName}
        nickname={identity.nickname}
        brandName={identity.brandName}
        accountType={accountType}
        makeItems={makeItems}
        myItems={myItems}
        onSignOut={handleSignOut}
      />
    </header>
  );
};
