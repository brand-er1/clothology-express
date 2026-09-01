import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, Eye, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";

type PeriodMonths = 1 | 3 | 6;

type DailyVisit = {
  date: string;
  sessions: number;
  unique_visitors: number;
  page_views: number;
};

type VisitAnalytics = {
  months: number;
  start_date: string;
  end_date: string;
  total_sessions: number;
  unique_visitors: number;
  page_views: number;
  daily: DailyVisit[];
};

const periodOptions: { value: PeriodMonths; label: string }[] = [
  { value: 1, label: "1개월" },
  { value: 3, label: "3개월" },
  { value: 6, label: "6개월" },
];

const formatDate = (value: string) => {
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
};

export const VisitorAnalyticsDashboard = () => {
  const [period, setPeriod] = useState<PeriodMonths>(1);
  const [analytics, setAnalytics] = useState<VisitAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      const { data, error } = await (supabase as any).rpc("get_admin_visit_analytics", {
        p_months: period,
      });

      if (!active) return;

      if (error) {
        console.error("Error loading visit analytics:", error);
        setErrorMessage("방문자 통계를 불러오지 못했습니다.");
        setAnalytics(null);
      } else {
        setAnalytics(data as VisitAnalytics);
      }

      setIsLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [period]);

  const chartData = useMemo(() => {
    if (!analytics?.daily?.length) return [];
    const maxPoints = period === 1 ? 31 : period === 3 ? 30 : 36;
    const bucketSize = Math.max(1, Math.ceil(analytics.daily.length / maxPoints));
    const buckets: { label: string; sessions: number }[] = [];

    for (let index = 0; index < analytics.daily.length; index += bucketSize) {
      const slice = analytics.daily.slice(index, index + bucketSize);
      buckets.push({
        label: slice[0]?.date.slice(5).replace("-", "/") || "",
        sessions: slice.reduce((sum, item) => sum + Number(item.sessions || 0), 0),
      });
    }

    return buckets;
  }, [analytics, period]);

  const maxSessions = Math.max(1, ...chartData.map((item) => item.sessions));

  return (
    <div className="mb-5 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-brand/10 p-2 text-brand"><BarChart3 className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-black text-stone-950">웹사이트 방문자 통계</p>
              <p className="mt-0.5 text-xs text-stone-500">실제 사이트 방문 기록 기준</p>
            </div>
          </div>

          {analytics && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-stone-100 px-3 py-2 text-sm font-bold text-stone-700">
              <CalendarDays className="h-4 w-4 text-brand" />
              {formatDate(analytics.start_date)} ~ {formatDate(analytics.end_date)}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-stone-100 p-1.5">
          {periodOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              className={`rounded-xl px-4 py-2 text-sm font-black transition ${period === option.value ? "bg-stone-950 text-white shadow-sm" : "text-stone-500 hover:text-stone-950"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="mt-6 h-52 animate-pulse rounded-2xl bg-stone-100" />
      ) : errorMessage ? (
        <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-5 text-sm font-bold text-red-700">{errorMessage}</div>
      ) : analytics ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center justify-between"><p className="text-xs font-bold text-stone-500">방문 횟수</p><BarChart3 className="h-4 w-4 text-brand" /></div>
              <p className="mt-2 text-2xl font-black text-stone-950">{Number(analytics.total_sessions || 0).toLocaleString()}</p>
              <p className="mt-1 text-xs text-stone-400">선택 기간 내 세션 수</p>
            </div>
            <div className="rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center justify-between"><p className="text-xs font-bold text-stone-500">순방문자</p><Users className="h-4 w-4 text-brand" /></div>
              <p className="mt-2 text-2xl font-black text-stone-950">{Number(analytics.unique_visitors || 0).toLocaleString()}</p>
              <p className="mt-1 text-xs text-stone-400">중복 방문 제외</p>
            </div>
            <div className="rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center justify-between"><p className="text-xs font-bold text-stone-500">페이지 조회</p><Eye className="h-4 w-4 text-brand" /></div>
              <p className="mt-2 text-2xl font-black text-stone-950">{Number(analytics.page_views || 0).toLocaleString()}</p>
              <p className="mt-1 text-xs text-stone-400">전체 페이지뷰</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-stone-200 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-stone-950">기간별 방문 추이</p>
                <p className="mt-1 text-xs text-stone-400">{period === 1 ? "일별" : "가독성을 위해 날짜 구간별"} 방문 횟수</p>
              </div>
              <p className="text-xs font-bold text-stone-400">{formatDate(analytics.start_date)} ~ {formatDate(analytics.end_date)}</p>
            </div>

            <div className="flex h-40 items-end gap-1 overflow-hidden">
              {chartData.map((item, index) => (
                <div key={`${item.label}-${index}`} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${item.label} · ${item.sessions.toLocaleString()}회`}>
                  <span className="hidden text-[10px] font-bold text-stone-500 group-hover:block">{item.sessions}</span>
                  <div className="w-full rounded-t-md bg-brand/80 transition group-hover:bg-brand" style={{ height: `${Math.max(4, (item.sessions / maxSessions) * 110)}px` }} />
                  {(index === 0 || index === chartData.length - 1 || index % Math.ceil(chartData.length / 6) === 0) && (
                    <span className="whitespace-nowrap text-[9px] font-bold text-stone-400">{item.label}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
