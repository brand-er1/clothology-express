import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/portfolio/ScrollReveal";
import { getAppPath } from "@/utils/appUrl";

const LOGO_720 = getAppPath("/lab/brander-lab-logo-720.webp");
const LOGO_1254 = getAppPath("/lab/brander-lab-logo-1254.webp");

/** 메인 페이지 BRAND-ER LAB 진입 배너 (무료 샘플 제작 신청). */
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
        <p className="eyebrow text-lab">BRAND-ER LAB · Fashion Lab Project</p>
        <h2 id="lab-home-banner-title" className="mt-4 text-[clamp(1.9rem,4.4vw,3.4rem)] font-extrabold leading-[1.1] tracking-[-0.04em] text-[#1f191a]">
          당신의 상상이
          <br />
          옷이 되는 실험실<span className="text-lab">.</span>
        </h2>
        <p className="mt-5 max-w-md text-[15px] leading-7 text-stone-600">
          옷에 관한 모든 궁금증부터, 당신이 상상한 옷을 실제로 만드는 순간까지. 선정된 신청자의 아이디어를 BRAND-ER LAB이 무료 샘플로 제작합니다.
        </p>
        <Link
          to="/lab"
          className="mt-7 inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-lab px-8 text-[15px] font-bold text-white transition hover:bg-lab-dark sm:w-auto"
        >
          BRAND-ER LAB 바로가기 <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-3 text-[12px] text-stone-500">선정된 참여자에게만 제공되며, 신청 비용은 없습니다.</p>
      </Reveal>
    </div>
  </section>
);
