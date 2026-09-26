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
      `block py-2 text-[15px] font-medium transition-colors duration-300 ${
        isActive ? "text-brand" : "text-stone-700 hover:text-brand"
      }`
    }
  >
    {item.label}
  </NavLink>
);

const BigNavLink = ({ to, label, onNavigate }: { to: string; label: string; onNavigate: () => void }) => (
  <NavLink
    to={to}
    onClick={onNavigate}
    className={({ isActive }) =>
      `block py-3 text-[22px] font-semibold tracking-[-0.03em] transition-colors duration-300 ${isActive ? "text-brand" : "text-[#211b1c] hover:text-brand"}`
    }
  >
    {label}
  </NavLink>
);

/** 모바일: 펀딩/포트폴리오/매거진은 바로 이동, 제작하기/MY만 아코디언으로 펼쳐진다. */
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
    <AccordionTrigger className="py-3 text-[22px] font-semibold tracking-[-0.03em] text-[#211b1c] hover:no-underline [&[data-state=open]]:text-brand">
      {title}
    </AccordionTrigger>
    <AccordionContent className="pb-2">
      <div className="space-y-0.5 border-l border-brand/30 pl-4">
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
    <p className="eyebrow text-stone-400">{title}</p>
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
        className="flex h-[100dvh] w-[min(92vw,420px)] flex-col overflow-hidden border-l-black/10 bg-[#f6f3ee] p-0"
      >
        <div className="shrink-0 px-7 pb-5 pt-[max(1.75rem,env(safe-area-inset-top))]">
          <SheetTitle className="sr-only">전체 메뉴</SheetTitle>
          <p className="eyebrow">BRAND-ER</p>
          {isAuthenticated ? (
            <>
              <p className="mt-2 text-xl font-semibold text-stone-950">{displayName}</p>
              {brandName && <p className="mt-0.5 text-sm text-stone-500">@{nickname}</p>}
            </>
          ) : (
            <p className="mt-2 text-base text-stone-600">아이디어가 옷이 되는 가장 쉬운 방법.</p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-2">
          {/* 모바일: 5개 핵심 카테고리, MAKE/MY만 아코디언 */}
          <div className="divide-y divide-black/[0.07] md:hidden">
            <BigNavLink to="/fundings" label="펀딩 둘러보기" onNavigate={close} />
            <Accordion type="single" collapsible>
              <AccordionSection value="make" title="제작하기" items={makeItems} onNavigate={close} />
            </Accordion>
            <BigNavLink to="/portfolio" label="포트폴리오" onNavigate={close} />
            <BigNavLink to="/community" label="매거진" onNavigate={close} />
            {isAuthenticated ? (
              <Accordion type="single" collapsible>
                <AccordionSection value="my" title="MY" items={myItems} onNavigate={close} />
              </Accordion>
            ) : (
              <div className="flex gap-6 pt-5">
                {guestMyItems.map((item) => (
                  <SheetNavLink key={item.to} item={item} onNavigate={close} />
                ))}
              </div>
            )}
          </div>

          {/* 데스크톱: 카테고리별로 그룹화한 전체 사이트맵 */}
          <div className="hidden space-y-8 pt-2 md:block">
            <GroupBlock title="SHOP" items={shopItems} onNavigate={close} />
            {makeItems.length > 0 && <GroupBlock title="MAKE" items={makeItems} onNavigate={close} />}
            <GroupBlock title="DISCOVER" items={discoverItems} onNavigate={close} />
            <GroupBlock title="MY" items={isAuthenticated ? myItems : guestMyItems} onNavigate={close} />
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t border-black/[0.07] px-7 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
          {isAuthenticated ? (
            <>
              {accountType === "seller" && (
                <Button asChild className="h-12 w-full rounded-[2px] bg-brand hover:bg-brand-dark">
                  <Link to="/customize" onClick={close}>디자인 시작하기</Link>
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => { onSignOut(); close(); }}
                className="h-11 w-full text-stone-500"
              >
                <LogOut className="mr-2 h-4 w-4" /> 로그아웃
              </Button>
            </>
          ) : (
            <Button asChild className="h-12 w-full rounded-[2px] bg-brand hover:bg-brand-dark">
              <Link to="/customize" onClick={close}>디자인 시작하기</Link>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
