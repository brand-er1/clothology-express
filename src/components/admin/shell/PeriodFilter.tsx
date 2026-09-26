import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { FilterChips } from "./ui";

export type PeriodKey = "today" | "7d" | "30d" | "month" | "custom";
export type Period = { key: PeriodKey; from: string; to: string };

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const toInputDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const resolvePeriod = (key: PeriodKey, customFrom?: string, customTo?: string): Period => {
  const now = new Date();
  const today = startOfToday();
  if (key === "today") return { key, from: today.toISOString(), to: now.toISOString() };
  if (key === "7d") return { key, from: new Date(today.getTime() - 6 * 86400000).toISOString(), to: now.toISOString() };
  if (key === "month") return { key, from: new Date(today.getFullYear(), today.getMonth(), 1).toISOString(), to: now.toISOString() };
  if (key === "custom" && customFrom && customTo) {
    const from = new Date(`${customFrom}T00:00:00`);
    const to = new Date(`${customTo}T00:00:00`);
    to.setDate(to.getDate() + 1);
    return { key, from: from.toISOString(), to: to.toISOString() };
  }
  return { key: "30d", from: new Date(today.getTime() - 29 * 86400000).toISOString(), to: now.toISOString() };
};

export const usePeriod = (initial: PeriodKey = "30d") => {
  const [key, setKey] = useState<PeriodKey>(initial);
  const [customFrom, setCustomFrom] = useState(toInputDate(new Date(Date.now() - 13 * 86400000)));
  const [customTo, setCustomTo] = useState(toInputDate(new Date()));
  const period = useMemo(() => resolvePeriod(key, customFrom, customTo), [key, customFrom, customTo]);
  return { period, key, setKey, customFrom, setCustomFrom, customTo, setCustomTo };
};

export const PeriodFilter = ({ state }: { state: ReturnType<typeof usePeriod> }) => (
  <div className="flex flex-wrap items-center gap-2">
    <FilterChips value={state.key} onChange={(v) => state.setKey(v as PeriodKey)} options={[
      { value: "today", label: "오늘" }, { value: "7d", label: "7일" }, { value: "30d", label: "30일" },
      { value: "month", label: "이번 달" }, { value: "custom", label: "사용자 지정" },
    ]} />
    {state.key === "custom" && (
      <div className="flex items-center gap-1 text-xs">
        <Input type="date" value={state.customFrom} max={state.customTo} onChange={(e) => state.setCustomFrom(e.target.value)} className="h-8 w-[140px] rounded-lg text-xs" aria-label="시작일" />
        <span className="text-stone-400">~</span>
        <Input type="date" value={state.customTo} min={state.customFrom} onChange={(e) => state.setCustomTo(e.target.value)} className="h-8 w-[140px] rounded-lg text-xs" aria-label="종료일" />
      </div>
    )}
  </div>
);
