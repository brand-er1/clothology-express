import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/portfolio/ScrollReveal";

/** 메인 페이지 BRAND-ER LAB 무료 의류 제작 신청 배너. */
export const LabHomeBanner = () => (
  <section aria-labelledby="lab-home-banner-title" className="bg-[#1d1718] text-[#f3eee8]">
    <div className="page-shell grid gap-8 py-14 sm:py-20 lg:grid-cols-12 lg:items-end lg:gap-8">
      <Reveal className="lg:col-span-7">
        <p className="eyebrow text-[#c999a4]">BRAND-ER LAB · Free sample project</p>
        <h2 id="lab-home-banner-title" className="mt-4 text-[clamp(1.9rem,4.4vw,3.4rem)] font-semibold leading-[1.1] tracking-[-0.04em]">
          상상하던 옷,
          <br />
          브랜더가 만들어드립니다<span className="text-[#c999a4]">.</span>
        </h2>
      </Reveal>
      <Reveal delayMs={120} className="lg:col-span-4 lg:col-start-9">
        <p className="text-[15px] leading-7 text-stone-300">
          평소 만들고 싶었던 옷이 있으신가요? 원하는 디자인을 알려주세요. 선정된 분께 브랜더가 무료로 의류 샘플을 제작해드립니다.
        </p>
        <Link to="/lab" className="cta-primary mt-7 w-full sm:w-auto">
          무료 제작 신청하기 <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-3 text-[12px] text-stone-500">선정된 참여자에게만 제공되며, 신청 비용은 없습니다.</p>
      </Reveal>
    </div>
  </section>
);
