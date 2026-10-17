import {
  BarChart3, BellRing, Building2, ClipboardList, Contact, CreditCard, Factory, Flag, Images, LayoutDashboard, Megaphone,
  MessageCircleQuestion, Palette, ReceiptText, RotateCcw, ScrollText, Settings, ShieldCheck, Sparkles, Star, Truck, Users,
  WalletCards, Wrench,
} from "lucide-react";
import type { AdminPermission } from "@/lib/admin/permissions";

export type AdminNavItem = {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  // 하나라도 가지고 있으면 메뉴 노출
  anyOf: AdminPermission[];
};

// 메뉴 순서: 1 대시보드 · 2 회원 · 3 제작자 및 브랜드 · 4 펀딩 · 5 고객 문의 · 6 AI 디자인 · 7 주문 및 결제 · 8 리뷰,
// 그 밖의 기존 운영 메뉴는 아래 그룹에 그대로 둔다(중복 메뉴 없음).
export const ADMIN_NAV: { group: string; items: AdminNavItem[] }[] = [
  { group: "대시보드", items: [
    { path: "", label: "대시보드", icon: LayoutDashboard, anyOf: ["dashboard.view"] },
    { path: "analytics", label: "통계", icon: BarChart3, anyOf: ["analytics.view"] },
  ] },
  { group: "회원 관리", items: [
    { path: "members", label: "회원 관리", icon: Users, anyOf: ["members.view"] },
  ] },
  { group: "제작자 및 브랜드 관리", items: [
    { path: "creators", label: "제작자 관리", icon: Palette, anyOf: ["creators.view"] },
    { path: "brands", label: "브랜드 관리", icon: Building2, anyOf: ["brands.view"] },
  ] },
  { group: "펀딩 관리", items: [
    { path: "fundings", label: "펀딩 관리", icon: WalletCards, anyOf: ["fundings.view"] },
  ] },
  { group: "고객 문의 관리", items: [
    { path: "inquiries", label: "고객 문의 관리", icon: MessageCircleQuestion, anyOf: ["cs.view"] },
  ] },
  { group: "AI 디자인 관리", items: [
    { path: "ai-designs", label: "AI 디자인 관리", icon: Images, anyOf: ["members.view"] },
  ] },
  { group: "주문 및 결제 관리", items: [
    { path: "orders", label: "주문 관리", icon: ClipboardList, anyOf: ["orders.view"] },
    { path: "buyers", label: "구매자 관리", icon: Contact, anyOf: ["orders.pii"] },
    { path: "payments", label: "결제 관리", icon: CreditCard, anyOf: ["payments.view"] },
    { path: "refunds", label: "환불 관리", icon: RotateCcw, anyOf: ["refunds.view"] },
    { path: "settlements", label: "정산 관리", icon: ReceiptText, anyOf: ["settlements.view"] },
  ] },
  { group: "리뷰 관리", items: [
    { path: "reviews", label: "리뷰 관리", icon: Star, anyOf: ["content.view"] },
  ] },
  { group: "풀필먼트", items: [
    { path: "production", label: "제작 관리", icon: Factory, anyOf: ["production.view"] },
    { path: "shipping", label: "배송 관리", icon: Truck, anyOf: ["shipping.view"] },
  ] },
  { group: "커뮤니케이션", items: [
    { path: "content", label: "콘텐츠/신고", icon: Flag, anyOf: ["content.view", "reports.manage", "cs.view"] },
    { path: "notifications", label: "공지/알림", icon: Megaphone, anyOf: ["notifications.send"] },
    { path: "notification-logs", label: "알림 발송 내역", icon: BellRing, anyOf: ["notifications.send"] },
  ] },
  { group: "시스템", items: [
    { path: "admins", label: "관리자 관리", icon: ShieldCheck, anyOf: ["admins.manage"] },
    { path: "audit", label: "Audit Log", icon: ScrollText, anyOf: ["audit.view"] },
    { path: "ai-usage", label: "AI 사용량", icon: Sparkles, anyOf: ["ai_usage.view"] },
    { path: "settings", label: "시스템 설정", icon: Settings, anyOf: ["settings.view"] },
    { path: "tools", label: "기타 운영 도구", icon: Wrench, anyOf: ["legacy.tools"] },
  ] },
];
