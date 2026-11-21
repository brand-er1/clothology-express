import { Link } from "react-router-dom";
import { ArrowRight, FlaskConical } from "lucide-react";
import { num } from "@/lib/admin/format";
import { useLabSummary } from "./useLabSummary";

/** 대시보드 상단: BRAND-ER LAB 새 무료 제작 신청 건수. lab.view 권한이 없으면 보이지 않는다. */
export const LabSummaryCard = () => {
  const summary = useLabSummary();
  if (!summary) return null;
  const hasNew = summary.new_count > 0;
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[#741b2b]/25 bg-white p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <Link to="/admin/lab-applications?status=received" className="group flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#741b2b]/10"><FlaskConical className="h-5 w-5 text-[#741b2b]" /></span>
        <span className="min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#741b2b]">BRAND-ER LAB</span>
          <span className="block text-base font-extrabold tracking-[-0.02em] text-stone-900 sm:text-lg">
            새 무료 제작 신청 <span className={hasNew ? "text-[#741b2b]" : "text-stone-400"}>{num(summary.new_count)}건</span>
          </span>
          <span className="block text-xs text-stone-500">{hasNew ? "아직 검토하지 않은 '신청 접수' 상태의 신청입니다." : "검토를 기다리는 신청이 없습니다."}</span>
        </span>
      </Link>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-stone-500">
        <span>오늘 접수 <b className="tabular-nums text-stone-800">{num(summary.today_count)}</b></span>
        <span>전체 <b className="tabular-nums text-stone-800">{num(summary.total_count)}</b></span>
        {summary.expired_count > 0 && (
          <Link to="/admin/lab-applications?retention=expired" className="font-bold text-rose-700 underline-offset-2 hover:underline">
            보유 기한 만료 {num(summary.expired_count)}
          </Link>
        )}
        <Link to="/admin/lab-applications?status=received"
          className="inline-flex items-center gap-1 rounded-xl bg-[#741b2b] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#551220]">
          신청 확인하기 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
};
