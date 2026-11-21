import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/portfolio/ScrollReveal";

/** 메인 페이지 BRAND-ER LAB 진입 배너 (무료 샘플 제작 신청). */
export const LabHomeBanner = () => (
  <section aria-labelledby="lab-home-banner-title" className="bg-[#1d1718] text-[#f3eee8]">
    <div className="page-shell grid gap-8 py-14 sm:py-20 lg:grid-cols-12 lg:items-end lg:gap-8">
      <Reveal className="lg:col-span-7">
        <p className="eyebrow text-[#c999a4]">BRAND-ER LAB · Fashion Lab Project</p>
        <h2 id="lab-home-banner-title" className="mt-4 text-[clamp(1.9rem,4.4vw,3.4rem)] font-semibold leading-[1.1] tracking-[-0.04em]">
          당신의 상상이
          <br />
          옷이 되는 실험실<span className="text-[#c999a4]">.</span>
        </h2>
      </Reveal>
      <Reveal delayMs={120} className="lg:col-span-4 lg:col-start-9">
        <p className="text-[15px] leading-7 text-stone-300">
          옷에 관한 모든 궁금증부터, 당신이 상상한 옷을 실제로 만드는 순간까지. 선정된 신청자의 아이디어를 BRAND-ER LAB이 무료 샘플로 제작합니다.
        </p>
        <Link to="/lab" className="cta-primary mt-7 w-full sm:w-auto">
          BRAND-ER LAB 바로가기 <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-3 text-[12px] text-stone-500">선정된 참여자에게만 제공되며, 신청 비용은 없습니다.</p>
      </Reveal>
    </div>
  </section>
);
