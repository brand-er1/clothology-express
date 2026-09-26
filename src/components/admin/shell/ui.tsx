import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2, Lock, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Tone } from "@/lib/admin/format";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-stone-100 text-stone-600 ring-stone-200",
  wine: "bg-[#741b2b]/10 text-[#741b2b] ring-[#741b2b]/20",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};

export const StatusBadge = ({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) => (
  <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset", TONE_CLASS[tone], className)}>
    {children}
  </span>
);

export const MappedBadge = ({ map, value }: { map: Record<string, { label: string; tone: Tone }>; value: string | null | undefined }) => {
  const entry = value ? map[value] : undefined;
  return <StatusBadge tone={entry?.tone ?? "neutral"}>{entry?.label ?? value ?? "-"}</StatusBadge>;
};

export const PageHeader = ({ title, description, actions, eyebrow }: { title: string; description?: string; actions?: ReactNode; eyebrow?: string }) => (
  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#741b2b]">{eyebrow}</p>}
      <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.03em] text-stone-950 sm:text-[28px]">{title}</h1>
      {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const Panel = ({ title, description, actions, children, className, bodyClassName }: {
  title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string;
}) => (
  <section className={cn("min-w-0 rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)]", className)}>
    {(title || actions) && (
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-stone-100 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          {title && <h2 className="text-sm font-extrabold text-stone-900">{title}</h2>}
          {description && <p className="mt-0.5 text-xs text-stone-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
    )}
    <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
  </section>
);

export const KpiCard = ({ label, value, hint, icon: Icon, emphasis, locked }: {
  label: string; value: ReactNode; hint?: ReactNode; icon?: typeof Inbox; emphasis?: boolean; locked?: boolean;
}) => (
  <div className={cn(
    "flex min-w-0 flex-col rounded-2xl border p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)]",
    emphasis ? "border-[#741b2b] bg-[#741b2b] text-white" : "border-stone-200/80 bg-white",
  )}>
    <div className="flex items-start justify-between gap-2">
      <p className={cn("text-xs font-bold", emphasis ? "text-white/75" : "text-stone-500")}>{label}</p>
      {Icon && <Icon className={cn("h-4 w-4 shrink-0", emphasis ? "text-white/70" : "text-[#741b2b]")} />}
    </div>
    <p title={typeof value === "string" ? value : undefined} className={cn("mt-2 truncate text-xl font-black tracking-[-0.03em] tabular-nums 2xl:text-2xl", emphasis ? "text-white" : "text-stone-950")}>
      {locked ? <span className="inline-flex items-center gap-1 text-base font-bold text-stone-400"><Lock className="h-4 w-4" />권한 없음</span> : value}
    </p>
    {hint && <p className={cn("mt-1 truncate text-[11px]", emphasis ? "text-white/70" : "text-stone-400")}>{hint}</p>}
  </div>
);

export const EmptyState = ({ title = "데이터가 없습니다", description }: { title?: string; description?: string }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
    <span className="rounded-2xl bg-stone-100 p-3"><Inbox className="h-5 w-5 text-stone-400" /></span>
    <p className="text-sm font-bold text-stone-700">{title}</p>
    {description && <p className="max-w-sm text-xs text-stone-500">{description}</p>}
  </div>
);

export const LoadingBlock = ({ label = "불러오는 중..." }: { label?: string }) => (
  <div className="flex items-center justify-center gap-2 py-14 text-sm text-stone-500">
    <Loader2 className="h-4 w-4 animate-spin" />{label}
  </div>
);

export const ErrorBanner = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
    <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{message}</span>
    {onRetry && <Button size="sm" variant="outline" onClick={onRetry}><RefreshCw className="mr-1 h-3.5 w-3.5" />다시 시도</Button>}
  </div>
);

export const Notice = ({ children, tone = "amber" }: { children: ReactNode; tone?: "amber" | "blue" | "stone" }) => (
  <div className={cn("rounded-xl border px-4 py-3 text-xs leading-5", {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-sky-200 bg-sky-50 text-sky-800",
    stone: "border-stone-200 bg-stone-50 text-stone-600",
  }[tone])}>{children}</div>
);

export const Forbidden = ({ permission }: { permission?: string }) => (
  <div className="mx-auto mt-10 max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#741b2b]/10"><Lock className="h-5 w-5 text-[#741b2b]" /></span>
    <h2 className="mt-4 text-lg font-extrabold">접근 권한이 없습니다</h2>
    <p className="mt-2 text-sm text-stone-500">현재 관리자 등급으로는 이 메뉴를 사용할 수 없습니다.{permission ? ` (${permission})` : ""}</p>
  </div>
);

export const SearchInput = ({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    const timer = window.setTimeout(() => { if (draft !== value) onChange(draft); }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, value, onChange]);
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
      <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} className="h-9 rounded-xl pl-9 text-sm" />
    </div>
  );
};

export const FilterChips = <T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[];
}) => (
  <div className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-1">
    {options.map((option) => (
      <button key={option.value} type="button" onClick={() => onChange(option.value)}
        className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition",
          value === option.value ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200")}>
        {option.label}{option.count !== undefined ? ` ${option.count}` : ""}
      </button>
    ))}
  </div>
);

export const Pager = ({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-2 border-t border-stone-100 px-4 py-3 text-xs text-stone-500">
      <span>총 {total.toLocaleString("ko-KR")}건</span>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={page <= 0} onClick={() => onPage(page - 1)} aria-label="이전 페이지"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="tabular-nums">{page + 1} / {pages}</span>
        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)} aria-label="다음 페이지"><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
};

// 반응형 테이블: 데스크톱은 표, 모바일은 가로 스크롤.
export const DataTable = ({ head, children, minWidth = 900 }: { head: ReactNode[]; children: ReactNode; minWidth?: number }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left text-sm" style={{ minWidth }}>
      <thead>
        <tr className="border-b border-stone-100 bg-stone-50/70 text-[11px] font-bold uppercase tracking-wide text-stone-500">
          {head.map((cell, index) => <th key={index} className="whitespace-nowrap px-4 py-2.5">{cell}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-stone-100">{children}</tbody>
    </table>
  </div>
);

export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>
);

export const DefinitionGrid = ({ items }: { items: { label: string; value: ReactNode }[] }) => (
  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
    {items.map((item) => (
      <div key={item.label} className="min-w-0">
        <dt className="text-[11px] font-bold text-stone-400">{item.label}</dt>
        <dd className="mt-0.5 break-words text-sm font-semibold text-stone-800">{item.value ?? "-"}</dd>
      </div>
    ))}
  </dl>
);
