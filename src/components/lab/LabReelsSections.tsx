import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Instagram, Play } from "lucide-react";
import { getAppPath } from "@/utils/appUrl";
import { LAB_INSTAGRAM_URL, LAB_REELS_NOTICES, LAB_REELS_STEPS, type LabReelsMedia, type LabReelsStep } from "./labContent";

/**
 * BRAND-ER LAB(브랜더랩) 진행 과정 · 촬영 안내 섹션.
 *  - LabReelsProcessSection : 진행 과정 4단계 카드(이미지 · 짧은 영상 미리보기 영역 포함)
 *  - LabReelsFilmingSection : 릴스 촬영 안내(촬영 · 게시 범위, 동의 안내)
 * 문구 · 미리보기 파일은 labContent.ts 에서 바꾼다.
 */

const prefersReducedMotion = () =>
  typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

const ReelsMedia = ({ media }: { media: LabReelsMedia }) => {
  const [reduced, setReduced] = useState(true);
  useEffect(() => setReduced(prefersReducedMotion()), []);

  if (media.type === "image") {
    return <img src={getAppPath(media.src)} alt={media.alt} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />;
  }
  return (
    <video
      key={reduced ? "still" : "motion"}
      src={getAppPath(media.src)}
      poster={media.poster ? getAppPath(media.poster) : undefined}
      aria-label={media.alt}
      muted
      playsInline
      loop
      autoPlay={!reduced}
      controls={reduced}
      preload="metadata"
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
};

/** 이미지 · 영상이 아직 없을 때 보이는 교체용 자리. labContent.ts 의 media 를 채우면 사라진다. */
const ReelsPlaceholder = ({ step, index }: { step: LabReelsStep; index: number }) => {
  const Icon = step.icon;
  return (
    <div className="absolute inset-0 flex flex-col justify-between bg-[#efeceb] p-4" data-lab-placeholder={step.key}>
      <span aria-hidden className="pointer-events-none absolute inset-[7px] rounded-[12px] border-[1.5px] border-dashed border-lab/25" />
      <span className="relative font-display text-[44px] font-extrabold leading-none tracking-[-0.04em] text-lab/15">{String(index + 1).padStart(2, "0")}</span>
      <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-lab text-white"><Icon className="h-6 w-6" strokeWidth={1.7} /></span>
      <span className="relative inline-flex items-center gap-1.5 self-start rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-stone-500">
        <Play className="h-3 w-3" />릴스 미리보기 준비 중
      </span>
    </div>
  );
};

/** SECTION B — 프로젝트 진행 과정 (데스크톱 4열, 태블릿 2열, 모바일 1열) */
export const LabReelsProcessSection = () => (
  <section id="process" aria-labelledby="lab-process-title" className="scroll-mt-20 bg-[#f4f2f1] py-16 sm:py-24">
    <div className="page-shell">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <p className="eyebrow text-lab">02 · Project Process</p>
          <h2 id="lab-process-title" className="mt-4 text-[clamp(1.8rem,4vw,3rem)] font-extrabold leading-[1.12] tracking-[-0.045em] text-[#1f191a]">
            인터뷰에서 완성품까지,<br />4단계로 만들어집니다<span className="text-lab">.</span>
          </h2>
        </div>
        <p className="text-[15px] leading-7 text-stone-600 lg:col-span-4 lg:col-start-9">
          길거리에서 만난 한 사람의 아이디어가 AI 디자인과 실제 제작 공정을 거쳐 옷이 되기까지, 모든 과정을 기록합니다.
        </p>
      </div>

      <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {LAB_REELS_STEPS.map((step, index) => (
          <li key={step.key} className="flex flex-col overflow-hidden rounded-[18px] bg-white" data-testid="lab-process-card">
            <div className="relative aspect-[4/5] w-full overflow-hidden">
              {step.media ? <ReelsMedia media={step.media} /> : <ReelsPlaceholder step={step} index={index} />}
            </div>
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <p className="font-display text-[11px] font-bold tracking-[0.2em] text-lab">STEP {String(index + 1).padStart(2, "0")} · {step.label}</p>
              <h3 className="mt-2 text-[19px] font-bold tracking-[-0.03em] text-[#211b1c]">{step.title}</h3>
              <p className="mt-2 break-keep text-[14px] leading-6 text-stone-600">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

/** SECTION C — 릴스 촬영 안내 */
export const LabReelsFilmingSection = ({ onApply }: { onApply: (event: { preventDefault: () => void }) => void }) => (
  <section id="reels" aria-labelledby="lab-reels-title" className="scroll-mt-20 bg-[#1d1718] py-16 text-[#f3eee8] sm:py-24">
    <div className="page-shell grid gap-10 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-6">
        <p className="eyebrow text-[#c999a4]">03 · Reels Content</p>
        <h2 id="lab-reels-title" className="mt-4 text-[clamp(1.8rem,4vw,3rem)] font-extrabold leading-[1.15] tracking-[-0.045em]">
          브랜더랩의 모든 과정은<br />영상으로 기록됩니다.
        </h2>
        <p className="mt-6 max-w-xl break-keep text-[15.5px] leading-8 text-stone-300">
          브랜더랩은 의류 제작 과정뿐 아니라 참여자의 인터뷰와 완성품 전달 순간까지 촬영합니다. 촬영된 콘텐츠는 BRAND-ER LAB 공식 SNS 채널에 게시될 수 있으며, 참여 전 촬영 및 게시 범위를 안내하고 동의를 받습니다.
        </p>
        <blockquote className="mt-8 break-keep border-l-2 border-[#c999a4] pl-5 text-[clamp(1.1rem,2vw,1.35rem)] font-bold leading-[1.6] tracking-[-0.02em] text-white">
          단순한 의류 제작이 아닌,<br className="sm:hidden" /> 당신의 아이디어가 현실이 되는 과정을 기록합니다.
        </blockquote>
      </div>

      <div className="lg:col-span-5 lg:col-start-8">
        <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <p className="text-[13px] font-bold tracking-[0.08em] text-[#c999a4]">촬영 안내 사항</p>
          <ul className="mt-4 space-y-3">
            {LAB_REELS_NOTICES.map((notice) => (
              <li key={notice} className="flex gap-3 text-[15px] leading-6 text-stone-100">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lab"><Check className="h-3 w-3 text-white" strokeWidth={3} /></span>
                {notice}
              </li>
            ))}
          </ul>
          <p className="mt-6 border-t border-white/10 pt-5 text-[13px] leading-6 text-stone-400">
            촬영 · SNS 게시 동의는 신청서에서 <b className="font-semibold text-stone-200">별도 선택</b> 항목입니다. 동의하지 않아도 신청할 수 있고, 촬영 없이 제작만 원하시면 신청서에서 선택해주세요.
            일반 의류 제작 문의는 <Link to="/design-quote" className="font-semibold text-white underline underline-offset-4">제작 견적</Link>에서 촬영과 관계없이 받습니다.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a href="#apply" onClick={onApply}
              className="group inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-white px-6 text-[15px] font-bold text-lab transition hover:bg-lab-soft">
              브랜더랩 참여하기 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            {LAB_INSTAGRAM_URL ? (
              <a href={LAB_INSTAGRAM_URL} target="_blank" rel="noreferrer noopener"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-white/25 px-6 text-[14px] font-semibold text-white transition hover:border-white">
                <Instagram className="h-4 w-4" />릴스 보러가기
              </a>
            ) : (
              <span className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-dashed border-white/20 px-6 text-[13px] font-medium text-stone-400">
                <Instagram className="h-4 w-4" />공식 계정 준비 중
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  </section>
);
