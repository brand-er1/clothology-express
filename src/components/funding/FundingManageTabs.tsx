import { NavLink } from "react-router-dom";
import { ClipboardList, Users } from "lucide-react";
import { cn } from "@/lib/utils";

// 내 펀딩 → 펀딩 관리 하위 메뉴
export const FundingManageTabs = ({ fundingId, className }: { fundingId: string; className?: string }) => {
  const tabs = [
    { to: `/fundings/${fundingId}/manage`, label: "참여자·배송 관리", icon: ClipboardList },
    { to: `/fundings/${fundingId}/buyers`, label: "구매자 관리", icon: Users },
  ];
  return (
    <nav aria-label="펀딩 관리 메뉴" className={cn("-mx-4 overflow-x-auto px-4", className)}>
      <div className="inline-flex min-w-max gap-1 rounded-full border border-stone-200 bg-white p-1">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) => cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition",
              isActive ? "bg-brand text-white" : "text-stone-600 hover:bg-stone-100",
            )}
          >
            <Icon className="h-4 w-4" />{label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
