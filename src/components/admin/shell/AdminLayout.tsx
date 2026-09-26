import { useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowUpRight, LogOut, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/admin/permissions";
import { useAdminContext } from "./AdminContext";
import { ADMIN_NAV } from "./navigation";

const SidebarNav = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { can } = useAdminContext();
  return (
    <nav className="grid gap-5" aria-label="관리자 메뉴">
      {ADMIN_NAV.map((group) => {
        const items = group.items.filter((item) => item.anyOf.some((permission) => can(permission)));
        if (!items.length) return null;
        return (
          <div key={group.group}>
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">{group.group}</p>
            <div className="grid gap-0.5">
              {items.map(({ path, label, icon: Icon }) => (
                <NavLink key={path} to={path ? `/admin/${path}` : "/admin"} end={!path} onClick={onNavigate}
                  className={({ isActive }) => cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition",
                    isActive ? "bg-[#741b2b] text-white shadow-sm" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
                  )}>
                  <Icon className="h-4 w-4 shrink-0" />{label}
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
};

const Brand = () => (
  <Link to="/admin" className="flex items-center gap-2 px-3">
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#741b2b] text-sm font-black text-white">B</span>
    <span className="leading-tight">
      <span className="block text-sm font-black tracking-[-0.02em] text-stone-950">BRAND-ER</span>
      <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Admin Console</span>
    </span>
  </Link>
);

export const AdminLayout = ({ children }: { children: ReactNode }) => {
  const { context } = useAdminContext();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.assign(`${import.meta.env.BASE_URL}auth`);
  };

  return (
    <div className="min-h-screen bg-[#f6f3ef] text-stone-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-stone-200/80 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-stone-100"><Brand /></div>
        <div className="flex-1 overflow-y-auto px-3 py-4"><SidebarNav /></div>
        <div className="border-t border-stone-100 p-3 text-xs text-stone-500">
          <Link to="/" className="flex items-center gap-1 rounded-lg px-2 py-1.5 font-semibold hover:bg-stone-100">서비스 화면으로 <ArrowUpRight className="h-3.5 w-3.5" /></Link>
        </div>
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 overflow-y-auto p-0">
          <SheetTitle className="sr-only">관리자 메뉴</SheetTitle>
          <div className="flex h-16 items-center border-b border-stone-100"><Brand /></div>
          <div className="px-3 py-4"><SidebarNav onNavigate={() => setOpen(false)} /></div>
        </SheetContent>
      </Sheet>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-stone-200/80 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" className="rounded-lg p-2 hover:bg-stone-100 lg:hidden" onClick={() => setOpen(true)} aria-label="메뉴 열기"><Menu className="h-5 w-5" /></button>
            <span className="truncate text-xs font-semibold text-stone-400">{location.pathname.replace(/^\/admin\/?/, "admin / ") || "admin"}</span>
          </div>
          <div className="flex items-center gap-2">
            {context?.role && (
              <span className="hidden rounded-full bg-[#741b2b]/10 px-2.5 py-1 text-[11px] font-bold text-[#741b2b] sm:inline">{ROLE_LABEL[context.role]}</span>
            )}
            <span className="max-w-[140px] truncate text-sm font-bold">{context?.display_name}</span>
            <button type="button" onClick={signOut} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="로그아웃" title="로그아웃"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
};
