import { useState } from "react";
import { ArrowUpRight, Instagram, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getAppPath } from "@/utils/appUrl";
import { LAB_KNOWLEDGE, type LabKnowledgeItem } from "./labContent";

/** SECTION 05 — FASHION KNOWLEDGE. 카드를 누르면 상세 내용(관련 릴스 · 가이드 링크 포함)이 열린다. */
export const LabKnowledgeSection = () => {
  const [open, setOpen] = useState<LabKnowledgeItem | null>(null);

  return (
    <section id="knowledge" aria-labelledby="lab-knowledge-title" className="scroll-mt-20 bg-white py-16 sm:py-24">
      <div className="page-shell">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="eyebrow text-lab">05 · Learn</p>
            <h2 id="lab-knowledge-title" className="mt-4 font-display text-[clamp(2rem,4.4vw,3.6rem)] font-extrabold leading-none tracking-[-0.04em] text-lab">FASHION KNOWLEDGE</h2>
          </div>
          <p className="text-[15px] leading-7 text-stone-600 lg:col-span-4 lg:col-start-9">옷에 관한 모든 궁금증, 브랜더 LAB이 알려드립니다.</p>
        </div>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {LAB_KNOWLEDGE.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setOpen(item)}
                className="lab-stitch-card group relative flex h-full w-full flex-col rounded-[18px] bg-[#f4f2f1] p-6 text-left transition duration-300 hover:-translate-y-0.5 hover:bg-lab hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lab focus-visible:ring-offset-2"
                aria-haspopup="dialog"
              >
                <span className="flex items-center justify-between">
                  <span className="font-display text-[11px] font-bold tracking-[0.2em] text-lab group-hover:text-white/80">{String(index + 1).padStart(2, "0")} · {item.tag}</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-lab/30 text-lab transition group-hover:rotate-90 group-hover:border-white/50 group-hover:text-white"><Plus className="h-4 w-4" /></span>
                </span>
                <span className="mt-8 text-[20px] font-bold leading-snug tracking-[-0.03em]">{item.title}</span>
                <span className="mt-2 text-[14px] leading-6 text-stone-600 group-hover:text-white/80">{item.summary}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[12.5px] text-stone-400">카드를 누르면 자세한 설명을 볼 수 있습니다. 관련 릴스는 공개되는 대로 이곳에 연결됩니다.</p>
      </div>

      <Dialog open={Boolean(open)} onOpenChange={(next) => { if (!next) setOpen(null); }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto rounded-[18px] border-0 p-0 sm:max-w-xl [&>button:last-child]:bg-white/15 [&>button:last-child]:text-white">
          {open && (
            <>
              <DialogHeader className="space-y-0 bg-lab px-6 pb-6 pt-7 text-left text-white">
                <p className="font-display text-[11px] font-bold tracking-[0.2em] text-white/70">BRAND-ER LAB · {open.tag}</p>
                <DialogTitle className="mt-2 text-[24px] font-bold tracking-[-0.03em]">{open.title}</DialogTitle>
                <DialogDescription className="mt-1.5 text-[14px] text-white/80">{open.summary}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 px-6 py-6 text-[15px] leading-7 text-stone-700">
                {open.body.map((paragraph) => <p key={paragraph.slice(0, 24)}>{paragraph}</p>)}
                <dl className="divide-y divide-black/[0.07] rounded-xl border border-black/[0.08] text-[14px]">
                  {open.points.map((point) => (
                    <div key={point.term} className="grid gap-0.5 px-4 py-3 sm:grid-cols-[9.5rem_1fr] sm:gap-3">
                      <dt className="font-semibold text-lab">{point.term}</dt>
                      <dd className="text-stone-600">{point.text}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap">
                  {open.reelUrl ? (
                    <a href={open.reelUrl} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-lab px-5 text-[14px] font-semibold text-white hover:bg-lab-dark">
                      <Instagram className="h-4 w-4" />릴스로 보기
                    </a>
                  ) : (
                    <span className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-dashed border-stone-300 px-5 text-[13px] font-medium text-stone-400">
                      <Instagram className="h-4 w-4" />관련 릴스 준비 중
                    </span>
                  )}
                  {open.links?.map((link) => (
                    <a key={link.href} href={link.external ? link.href : getAppPath(link.href)} {...(link.external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                      className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-black/15 px-5 text-[14px] font-semibold text-[#211b1c] hover:border-lab hover:text-lab">
                      {link.label}<ArrowUpRight className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};
