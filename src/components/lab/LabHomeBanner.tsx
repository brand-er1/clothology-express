import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/portfolio/ScrollReveal";
import { getAppPath } from "@/utils/appUrl";

const LOGO_720 = getAppPath("/lab/brander-lab-logo-720.webp");
const LOGO_1254 = getAppPath("/lab/brander-lab-logo-1254.webp");

/** 메인 페이지 BRAND-ER LAB 진입 배너 — 릴스 촬영 프로젝트 소개(/lab#process)와 참여 신청(/lab/apply). */
export const LabHomeBanner = () => (
  <section aria-labelledby="lab-home-banner-title" className="overflow-hidden border-y border-stone-200 bg-white text-[#211b1c]">
    <div className="page-shell grid items-center gap-6 py-12 sm:py-16 lg:grid-cols-12 lg:gap-10">
      <Reveal className="mx-auto w-full max-w-[460px] lg:col-span-5 lg:max-w-none">
        <Link to="/lab" aria-label="BRAND-ER LAB 바로가기" className="block">
          <img
            src={LOGO_720}
            srcSet={`${LOGO_720} 720w, ${LOGO_1254} 1254w`}
            sizes="(min-width: 1024px) 38vw, 90vw"
            width={1254}
            height={1254}
            alt="BRAND-ER LAB — 버건디 원단 질감에 봉제선이 들어간 로고"
            loading="lazy"
            decoding="async"
            className="h-auto w-full select-none"
            draggable={false}
          />
        </Link>
      </Reveal>
      <Reveal delayMs={120} className="lg:col-span-6 lg:col-start-7">
        <p className="eyebrow text-lab">BRAND-ER LAB · Street Interview × AI Design × Real Production</p>
        <h2 id="lab-home-banner-title" className="mt-4 text-[clamp(1.9rem,4.4vw,3.4rem)] font-extrabold leading-[1.1] tracking-[-0.04em] text-[#1f191a]">
          당신이 상상한 옷,
          <br />
          우리가 만들어드립니다<span className="text-lab">.</span>
        </h2>
        <p className="mt-5 max-w-md text-[15px] leading-7 text-stone-600">
          길거리 인터뷰부터 AI 의류 디자인, 실제 샘플 제작, 완성품 전달까지. 모든 과정을 릴스 영상으로 기록하는 BRAND-ER LAB 프로젝트에 아이디어를 남겨주세요.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/lab/apply"
            className="inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-lab px-8 text-[15px] font-bold text-white transition hover:bg-lab-dark sm:w-auto"
          >
            릴스 촬영 프로젝트 참여하기 <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/lab#process"
            className="inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full border border-lab/30 px-8 text-[15px] font-bold text-lab transition hover:border-lab hover:bg-lab-soft sm:w-auto"
          >
            프로젝트 알아보기
          </Link>
        </div>
        <p className="mt-3 text-[12px] text-stone-500">신청 비용은 없으며, 선정된 참여자에게 의류 샘플을 무료로 제작해드립니다. 촬영 · 게시 동의는 별도 선택입니다.</p>
      </Reveal>
    </div>
  </section>
);
