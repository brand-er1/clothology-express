import { createContext, useContext } from "react";
import { Building2, ClipboardList, LayoutDashboard, MessageCircleQuestion, Package, ReceiptText, Star, WalletCards } from "lucide-react";
import type { BrandWithCreator } from "@/types/brand";

// 판매자 메뉴: 대시보드 / 상품 관리 / 펀딩 관리 / 주문 관리 / 리뷰 관리 / 고객 문의 / 정산 관리 / 브랜드 설정
export const SELLER_NAV = [
  { path: "", label: "대시보드", icon: LayoutDashboard },
  { path: "products", label: "상품 관리", icon: Package },
  { path: "fundings", label: "펀딩 관리", icon: WalletCards },
  { path: "orders", label: "주문 관리", icon: ClipboardList },
  { path: "reviews", label: "리뷰 관리", icon: Star },
  { path: "inquiries", label: "고객 문의", icon: MessageCircleQuestion },
  { path: "settlements", label: "정산 관리", icon: ReceiptText },
  { path: "brand", label: "브랜드 설정", icon: Building2 },
] as const;

type SellerContextValue = { brand: BrandWithCreator | null; reloadBrand: () => Promise<void> };
export const SellerContext = createContext<SellerContextValue>({ brand: null, reloadBrand: async () => {} });
export const useSellerContext = () => useContext(SellerContext);

