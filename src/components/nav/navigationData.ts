import type { LucideIcon } from "lucide-react";
import { Calculator, Factory, FileImage, FlaskConical, Shirt, Sparkles, Users2, WalletCards } from "lucide-react";
import type { AccountType } from "@/utils/accountRouting";
import { productionRequestHref, type ProductionCtaSource } from "@/lib/production-request";

export interface NavLinkItem {
  to: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  /** 제작 의뢰 링크: 클릭 시 전환 이벤트를 남긴다. */
  ctaSource?: ProductionCtaSource;
  /** 메뉴 안에서 강조 표시(브랜더 핵심 서비스) */
  highlight?: boolean;
}

export interface NavContext {
  isAuthenticated: boolean;
  accountType: AccountType | null;
  isAdmin: boolean;
  userId: string | null;
}

/** BRAND-ER STUDIO 등 제작 도구는 판매자(브랜드) 계정 전용 워크플로우다 — 기존 Header가 쓰던
 * "!isAuthenticated || seller" / "authenticated && seller" 가시성 규칙을 그대로 유지한다. */
const canUseSellerTools = ({ isAuthenticated, accountType }: NavContext) =>
  !isAuthenticated || accountType === "seller";
const isSignedInSeller = ({ isAuthenticated, accountType }: NavContext) =>
  isAuthenticated && accountType === "seller";

/**
 * 제작하기 메뉴 노출 순서 — 브랜더의 핵심 서비스 순:
 * 1 의류 제작 의뢰하기 · 2 AI 이미지 만들기 · 3 상세페이지 제작하기 · 4 크라우드펀딩, 그 밖의 제작 도구는 뒤에 그대로 둔다.
 */
export const getMakeItems = (ctx: NavContext, ctaSource: ProductionCtaSource = "mega_menu"): NavLinkItem[] => {
  const items: (NavLinkItem & { visible: boolean })[] = [
    {
      to: productionRequestHref(ctaSource),
      label: "의류 제작 의뢰하기",
      description: "20장 소량 제작부터 원단 · 샘플 · 대량 생산까지 맡겨주세요.",
      icon: Factory,
      ctaSource,
      highlight: true,
      visible: true,
    },
    {
      to: "/customize",
      label: "AI 이미지 만들기",
      description: "BRAND-ER STUDIO에서 AI로 나만의 옷을 디자인해보세요.",
      icon: Sparkles,
      visible: canUseSellerTools(ctx),
    },
    {
      to: "/customize?next=detail-page",
      label: "상세페이지 제작하기",
      description: "AI 디자인으로 펀딩용 상세페이지를 자동으로 완성합니다.",
      icon: FileImage,
      visible: canUseSellerTools(ctx),
    },
    {
      to: "/fundings",
      label: "크라우드펀딩",
      description: "선주문으로 수요를 먼저 확인하고 생산하세요.",
      icon: WalletCards,
      visible: true,
    },
    {
      to: "/closet",
      label: "AI 가상 피팅",
      description: "디자인한 옷을 마네킹에 입혀보세요.",
      icon: Shirt,
      visible: canUseSellerTools(ctx),
    },
    {
      to: "/design-quote",
      label: "디자인 견적",
      description: "디자인을 기반으로 예상 제작비를 확인하세요.",
      icon: Calculator,
      visible: canUseSellerTools(ctx),
    },
    {
      to: "/quick-group-wear",
      label: "빠른 단체복 제작",
      description: "여러 벌을 한 번에 빠르게 제작하세요.",
      icon: Users2,
      visible: canUseSellerTools(ctx),
    },
    {
      to: "/fabric-swatch",
      label: "원단 스와치",
      description: "다양한 원단 샘플을 살펴보세요.",
      icon: FlaskConical,
      visible: isSignedInSeller(ctx),
    },
  ];
  return items.filter((item) => item.visible);
};

export const getShopItems = (): NavLinkItem[] => [
  { to: "/fundings", label: "펀딩 둘러보기" },
  { to: "/fundings", label: "인기 펀딩" },
  { to: "/fundings", label: "신규 펀딩" },
];

export const getDiscoverItems = (): NavLinkItem[] => [
  { to: "/lab", label: "BRAND-ER LAB" },
  { to: "/community", label: "매거진" },
  { to: "/portfolio", label: "제작 포트폴리오" },
];

export const getMyItems = (ctx: NavContext): NavLinkItem[] => {
  if (!ctx.isAuthenticated) return [];
  const items: (NavLinkItem & { visible: boolean })[] = [
    { to: "/community/notifications", label: "알림", visible: true },
    { to: "/seller", label: "판매자 센터", visible: isSignedInSeller(ctx) },
    { to: "/my-fundings", label: "내 펀딩", visible: true },
    { to: "/orders", label: "제작 관리", visible: isSignedInSeller(ctx) },
    { to: ctx.userId ? `/community/profile/${ctx.userId}` : "/community", label: "내 디자인", visible: true },
    { to: "/my-fundings?tab=joined", label: "참여한 펀딩", visible: true },
    { to: "/profile", label: "프로필", visible: true },
    { to: "/admin", label: "관리자", visible: ctx.isAdmin },
  ];
  return items.filter((item) => item.visible);
};
