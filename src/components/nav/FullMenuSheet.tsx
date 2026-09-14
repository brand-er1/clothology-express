import { Link, NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import type { AccountType } from "@/utils/accountRouting";
import { getDiscoverItems, getShopItems, type NavLinkItem } from "./navigationData";

const guestMyItems: NavLinkItem[] = [
  { to: "/auth?mode=login", label: "로그인" },
  { to: "/auth?mode=signup", label: "회원가입" },
];

const SheetNavLink = ({ item, onNavigate }: { item: NavLinkItem; onNavigate: () => void }) => (
  <NavLink
    to={item.to}
    onClick={onNavigate}
    className={({ isActive }) =>
      `block rounded-xl px-3 py-2.5 text-[15px] font-semibold transition ${
        isActive ? "bg-brand text-white" : "text-stone-700 hover:bg-stone-100"
      }`
    }
  >
    {item.label}
  </NavLink>
);

/** 모바일: SHOP/COMMUNITY/PORTFOLIO는 바로 이동, MAKE/MY만 아코디언으로 펼쳐진다. */
const AccordionSection = ({
  value,
  title,
  items,
  onNavigate,
}: {
  value: string;
  title: string;
  items: NavLinkItem[];
  onNavigate: () => void;
}) => (
  <AccordionItem value={value} className="border-b-0">
    <AccordionTrigger className="rounded-xl px-3 py-2.5 text-[15px] font-semibold text-stone-700 hover:bg-stone-100 hover:no-underline [&[data-state=open]]:text-brand">
      {title}
    </AccordionTrigger>
    <AccordionContent className="pb-1 pl-3">
      <div className="space-y-0.5 border-l-2 border-stone-100 pl-3">
        {items.map((item) => (
          <SheetNavLink key={`${item.to}-${item.label}`} item={item} onNavigate={onNavigate} />
        ))}
      </div>
    </AccordionContent>
  </AccordionItem>
);

/** 데스크톱: 화면 공간이 넉넉하므로 접지 않고 카테고리 헤더 아래 전체 목록을 바로 펼쳐 보여준다. */
const GroupBlock = ({ title, items, onNavigate }: { title: string; items: NavLinkItem[]; onNavigate: () => void }) => (
  <div>
    <p className="px-3 text-xs font-bold uppercase tracking-[0.2em] text-stone-400">{title}</p>
    <div className="mt-2 space-y-0.5">
      {items.map((item) => (
        <SheetNavLink key={`${item.to}-${item.label}`} item={item} onNavigate={onNavigate} />
      ))}
    </div>
  </div>
);

interface FullMenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAuthenticated: boolean;
  displayName: string;
  nickname: string;
  brandName: string;
  accountType: AccountType | null;
  makeItems: NavLinkItem[];
  myItems: NavLinkItem[];
  onSignOut: () => void;
}

export const FullMenuSheet = ({
  open,
  onOpenChange,
  isAuthenticated,
  displayName,
  nickname,
  brandName,
  accountType,
  makeItems,
  myItems,
  onSignOut,
}: FullMenuSheetProps) => {
  const close = () => onOpenChange(false);
  const shopItems = getShopItems();
  const discoverItems = getDiscoverItems();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-[100dvh] w-[min(92vw,420px)] flex-col overflow-hidden border-l-stone-200 bg-[#f9fafb] p-0"
      >
        <div className="shrink-0 border-b border-stone-200 px-6 pb-4 pt-[max(1.5rem,env(safe-area-inset-top))]">
          <SheetTitle className="sr-only">전체 메뉴</SheetTitle>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">BRAND-ER</p>
          {isAuthenticated ? (
            <>
              <p className="mt-2 text-xl font-bold text-stone-950">{displayName}</p>
              {brandName && <p className="mt-0.5 text-sm text-stone-500">@{nickname}</p>}
            </>
          ) : (
            <p className="mt-2 text-base font-semibold text-stone-800">새로운 패션을 가장 먼저 만나보세요.</p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {/* 모바일: 5개 핵심 카테고리, MAKE/MY만 아코디언 */}
          <div className="md:hidden">
            <div className="space-y-0.5">
              <SheetNavLink item={{ to: "/fundings", label: "SHOP" }} onNavigate={close} />
            </div>
            <Accordion type="single" collapsible className="mt-0.5">
              <AccordionSection value="make" title="MAKE" items={makeItems} onNavigate={close} />
            </Accordion>
            <div className="space-y-0.5">
              <SheetNavLink item={{ to: "/community", label: "COMMUNITY" }} onNavigate={close} />
              <SheetNavLink item={{ to: "/portfolio", label: "PORTFOLIO" }} onNavigate={close} />
            </div>
            {isAuthenticated ? (
              <Accordion type="single" collapsible className="mt-0.5">
                <AccordionSection value="my" title="MY" items={myItems} onNavigate={close} />
              </Accordion>
            ) : (
              <div className="mt-3 space-y-0.5">
                {guestMyItems.map((item) => (
                  <SheetNavLink key={item.to} item={item} onNavigate={close} />
                ))}
              </div>
            )}
          </div>

          {/* 데스크톱: 카테고리별로 그룹화한 전체 사이트맵 */}
          <div className="hidden space-y-7 px-2 md:block">
            <GroupBlock title="SHOP" items={shopItems} onNavigate={close} />
            {makeItems.length > 0 && <GroupBlock title="MAKE" items={makeItems} onNavigate={close} />}
            <GroupBlock title="DISCOVER" items={discoverItems} onNavigate={close} />
            <GroupBlock title="MY" items={isAuthenticated ? myItems : guestMyItems} onNavigate={close} />
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t border-stone-200 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
          {isAuthenticated ? (
            <>
              {accountType === "seller" && (
                <Button asChild className="h-12 w-full rounded-full bg-brand hover:bg-brand-dark">
                  <Link to="/customize" onClick={close}>옷 만들기</Link>
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => { onSignOut(); close(); }}
                className="h-11 w-full rounded-full text-stone-500"
              >
                <LogOut className="mr-2 h-4 w-4" /> 로그아웃
              </Button>
            </>
          ) : (
            <Button asChild className="h-12 w-full rounded-full bg-brand hover:bg-brand-dark">
              <Link to="/customize" onClick={close}>무료로 의류 만들어보기</Link>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
