import {
  BarChart3, BellRing, Building2, ClipboardList, CreditCard, Factory, Flag, LayoutDashboard, Megaphone, Palette,
  ReceiptText, RotateCcw, ScrollText, Settings, ShieldCheck, Sparkles, Truck, Users, WalletCards, Wrench,
} from "lucide-react";
import type { AdminPermission } from "@/lib/admin/permissions";

export type AdminNavItem = {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  // 하나라도 가지고 있으면 메뉴 노출
  anyOf: AdminPermission[];
};

export const ADMIN_NAV: { group: string; items: AdminNavItem[] }[] = [
  { group: "운영 개요", items: [
    { path: "", label: "Dashboard", icon: LayoutDashboard, anyOf: ["dashboard.view"] },
    { path: "analytics", label: "통계", icon: BarChart3, anyOf: ["analytics.view"] },
  ] },
  { group: "회원 · 파트너", items: [
    { path: "members", label: "회원 관리", icon: Users, anyOf: ["members.view"] },
    { path: "creators", label: "제작자 관리", icon: Palette, anyOf: ["creators.view"] },
    { path: "brands", label: "브랜드 관리", icon: Building2, anyOf: ["brands.view"] },
  ] },
  { group: "커머스", items: [
    { path: "fundings", label: "펀딩 관리", icon: WalletCards, anyOf: ["fundings.view"] },
    { path: "orders", label: "주문 관리", icon: ClipboardList, anyOf: ["orders.view"] },
    { path: "payments", label: "결제 관리", icon: CreditCard, anyOf: ["payments.view"] },
    { path: "refunds", label: "환불 관리", icon: RotateCcw, anyOf: ["refunds.view"] },
    { path: "settlements", label: "정산 관리", icon: ReceiptText, anyOf: ["settlements.view"] },
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
