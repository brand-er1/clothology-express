import { Link, NavLink, useNavigate } from "react-router-dom";
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
import { ProductionCtaLink } from "@/components/production/ProductionCtaLink";

type ProfileIdentity = { brandName: string; nickname: string; };

// Plain text navigation: the current page is marked by wine text and a hairline underline,
// not by a filled pill. The one filled element in the header is the "제작 의뢰하기" CTA —
// 브랜더의 핵심 서비스(의류 제작 · 생산 대행)라 어느 페이지에서든 우측 상단에 고정으로 둔다.
const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  `relative whitespace-nowrap py-2 text-[13px] lg:text-[14px] font-medium tracking-[-0.01em] transition-colors duration-300 after:absolute after:inset-x-0 after:-bottom-px after:h-px after:origin-left after:bg-brand after:transition-transform after:duration-300 ${
    isActive ? "text-brand after:scale-x-100" : "text-stone-600 after:scale-x-0 hover:text-[#211b1c] hover:after:scale-x-100"
  }`;

export const Header = () => {
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [identity, setIdentity] = useState<ProfileIdentity>({ brandName: "", nickname: "" });
  const [isFullMenuOpen, setIsFullMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // The header melts into the page at the top and only gains a hairline once content scrolls under it.
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate("/auth"); };

  useEffect(() => {
    let active = true;
    const syncSession = async (session: Session | null) => {
      if (!active) return;
      setIsAuthenticated(Boolean(session));
      setUserId(session?.user.id ?? null);
      setAccountType(session ? getAccountType(session.user) : null);
      if (!session?.user) { setIdentity({ brandName: "", nickname: "" }); return; }
      const metadata = session.user.user_metadata;
      const fallback = {
        brandName: typeof metadata.brand_name === "string" ? metadata.brand_name : "",
        nickname: typeof metadata.username === "string" ? metadata.username : session.user.email?.split("@")[0] || "멤버",
      };
      const { data } = await supabase.from("profiles").select("brand_name, username").eq("id", session.user.id).maybeSingle();
      if (!active) return;
      setIdentity({ brandName: data?.brand_name || fallback.brandName, nickname: data?.username || fallback.nickname });
    };
    supabase.auth.getSession().then(({ data }) => syncSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { void syncSession(session); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const navContext = { isAuthenticated, accountType, isAdmin, userId };
  const makeItems = getMakeItems(navContext, "mega_menu");
  const sheetMakeItems = getMakeItems(navContext, "menu_sheet");
  const myItems = getMyItems({ isAuthenticated, accountType, isAdmin, userId });
  const displayName = identity.brandName || identity.nickname;
  const initial = displayName.trim().slice(0, 1).toUpperCase() || "B";

  return (
    <header className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color] duration-300 ${isScrolled ? "border-black/[0.07] bg-[#f6f3ee]/90 backdrop-blur-md" : "border-transparent bg-[#f6f3ee]/70 backdrop-blur-sm"}`}>
      <div className="page-shell flex h-16 items-center gap-4 sm:h-[72px] lg:gap-12">
        <Link to="/" className="flex shrink-0 items-center" aria-label="BRAND-ER 홈"><img src={getAppPath("/lovable-uploads/40adfb8c-d6e9-4e33-899e-0e9db51c50f1.png")} alt="BRAND-ER" className="h-8 w-auto sm:h-7" /></Link>
        <nav className="hidden items-center gap-4 md:flex lg:gap-7 xl:gap-9" aria-label="주요 메뉴">
          <NavLink to="/fundings" className={navLinkClassName}>펀딩 둘러보기</NavLink>
          <MakeMegaMenu items={makeItems} />
          <NavLink to="/portfolio" className={navLinkClassName}>포트폴리오</NavLink>
          <NavLink to="/community" className={navLinkClassName}>매거진</NavLink>
          <NavLink to="/lab" className={navLinkClassName}>BRAND-ER LAB</NavLink>
        </nav>
        <div className="ml-auto hidden items-center gap-4 md:flex lg:gap-5" data-tutorial="header-account">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {isAuthenticated ? (
                <button className="flex items-center gap-2 py-2 text-[14px] font-medium text-stone-700 transition-colors hover:text-brand"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#211b1c] text-[11px] font-semibold text-white">{initial}</span><span className="max-w-[9rem] truncate">{displayName || "MY"}</span><ChevronDown className="h-3.5 w-3.5 text-stone-400" /></button>
              ) : (
                <button className="flex items-center gap-1 py-2 text-[14px] font-medium text-stone-600 transition-colors hover:text-[#211b1c]">로그인<ChevronDown className="h-3.5 w-3.5 text-stone-400" /></button>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-md border-black/10 bg-[#fbfaf8] p-1.5 shadow-[0_18px_50px_rgba(33,27,28,0.12)]">
              {isAuthenticated ? (
                <>
                  <DropdownMenuLabel className="px-2.5 py-2"><p className="text-sm font-semibold text-stone-950">{displayName}</p>{identity.brandName && <p className="text-xs font-normal text-stone-500">@{identity.nickname}</p>}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {myItems.map((item) => <DropdownMenuItem key={`${item.to}-${item.label}`} asChild className="cursor-pointer rounded-[3px] px-2.5 py-2 text-sm"><Link to={item.to}>{item.label}</Link></DropdownMenuItem>)}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer rounded-[3px] px-2.5 py-2 text-sm text-stone-500"><LogOut className="mr-2 h-4 w-4" /> 로그아웃</DropdownMenuItem>
                </>
              ) : (
                <><DropdownMenuItem asChild className="cursor-pointer rounded-[3px] px-2.5 py-2 text-sm"><Link to="/auth?mode=login">로그인</Link></DropdownMenuItem><DropdownMenuItem asChild className="cursor-pointer rounded-[3px] px-2.5 py-2 text-sm"><Link to="/auth?mode=signup">회원가입</Link></DropdownMenuItem></>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link to="/customize" className="hidden h-10 items-center rounded-[2px] border border-black/15 px-3.5 text-[13px] font-semibold text-stone-700 transition-colors duration-300 hover:border-[#211b1c] hover:text-[#211b1c] xl:inline-flex">AI 이미지 만들기</Link>
          <ProductionCtaLink source="header" className="group inline-flex h-10 shrink-0 items-center gap-2 rounded-[2px] bg-brand px-3.5 text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(116,27,43,0.22)] transition-colors duration-300 hover:bg-brand-dark lg:px-4">
            <span className="lg:hidden">제작 의뢰</span><span className="hidden lg:inline">제작 의뢰하기</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </ProductionCtaLink>
          <button type="button" onClick={() => setIsFullMenuOpen(true)} className="-mr-2 flex h-11 w-11 items-center justify-center text-stone-600 transition-colors hover:text-[#211b1c]" aria-label="전체 메뉴"><Menu className="h-5 w-5" strokeWidth={1.6} /></button>
        </div>
        <div className="ml-auto md:hidden"><button type="button" onClick={() => setIsFullMenuOpen(true)} className="-mr-2 flex h-11 w-11 items-center justify-center text-[#211b1c]" aria-label="메뉴"><Menu className="h-[22px] w-[22px]" strokeWidth={1.6} /></button></div>
      </div>
      <FullMenuSheet open={isFullMenuOpen} onOpenChange={setIsFullMenuOpen} isAuthenticated={isAuthenticated} displayName={displayName} nickname={identity.nickname} brandName={identity.brandName} accountType={accountType} makeItems={sheetMakeItems} myItems={myItems} onSignOut={handleSignOut} />
    </header>
  );
};
