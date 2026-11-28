import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/portfolio/ScrollReveal";
import { ProductionCtaLink } from "@/components/production/ProductionCtaLink";
import { productionRequestHref, trackProductionCtaClick } from "@/lib/production-request";
import { getAppPath } from "@/utils/appUrl";

const capabilities = [
  { title: "국내 소량 제작 20장부터", body: "첫 컬렉션 · 테스트 판매도 부담 없는 수량으로 시작합니다." },
  { title: "원단 및 부자재 컨택", body: "콘셉트와 예산에 맞는 원단 · 라벨 · 부자재를 직접 찾아 제안합니다." },
  { title: "패턴 및 샘플 제작", body: "패턴 설계부터 실물 샘플까지, 본생산 전에 핏과 봉제를 검수합니다." },
  { title: "국내외 생산 인프라", body: "국내 봉제 라인과 해외 협력 공장을 수량 · 단가에 맞게 연결합니다." },
  { title: "브랜드 의류 및 단체복 제작", body: "브랜드 컬렉션부터 기업 · 학교 · 팀 단체복까지 제작합니다." },
];

/** 메인 — 브랜더의 핵심 서비스(의류 제작 · 생산 대행)를 히어로 바로 아래에서 설명한다. */
export const ProductionServiceSection = () => (
  <section aria-labelledby="production-service-title" className="bg-[#1f191a] text-white">
    <div className="page-shell grid gap-12 py-20 sm:py-28 lg:grid-cols-12 lg:gap-10 lg:py-32">
      <Reveal className="lg:col-span-5">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d9a3ad]">Production service</p>
        <h2 id="production-service-title" className="mt-4 text-[clamp(1.9rem,3.3vw,3rem)] font-semibold leading-[1.1] tracking-[-0.035em]">
          의류 제작의 모든 과정,
          <br />
          브랜더가 함께합니다.
        </h2>
        <p className="mt-6 max-w-md text-[15px] leading-7 text-white/65">
          디자인 파일이 없어도, 제작 경험이 없어도 괜찮습니다. 아이디어 하나로 원단 선정부터 샘플, 소량 · 대량 생산까지 브랜더 제작팀이 직접 진행합니다.
        </p>
        <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-7">
          <ProductionCtaLink source="home_service" className="cta-primary w-full sm:w-auto">
            제작 의뢰하기 <ArrowRight className="h-4 w-4" />
          </ProductionCtaLink>
          <Link to="/portfolio" className="cta-text text-white/80 hover:!text-white">
            <span className="link-draw">제작 포트폴리오</span> <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-12 hidden aspect-[4/3] overflow-hidden bg-[#2a2324] lg:block">
          <img src={getAppPath("/fabrics/cotton-twill.webp")} alt="브랜더가 제안하는 코튼 트윌 원단" loading="lazy" decoding="async" className="h-full w-full object-cover opacity-90" />
        </div>
      </Reveal>

      <ol className="border-t border-white/15 lg:col-span-6 lg:col-start-7">
        {capabilities.map((capability, index) => (
          <li key={capability.title} className="border-b border-white/15">
            <Reveal delayMs={index * 70} className="grid grid-cols-[2.75rem_1fr] gap-2 py-6 sm:grid-cols-[4rem_1fr] sm:py-8">
              <span className="font-display text-[13px] font-semibold text-[#d9a3ad]">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="text-[1.2rem] font-semibold tracking-[-0.02em] sm:text-[1.45rem]">{capability.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">{capability.body}</p>
              </div>
            </Reveal>
          </li>
        ))}
        <li className="pt-6 text-[13px] leading-6 text-white/50">
          상담 · 견적은 무료이며, 접수 후 영업일 기준 1일 이내 제작 매니저가 연락드립니다.
        </li>
      </ol>
    </div>
  </section>
);

const services = [
  { number: "01", title: "의류 제작 의뢰하기", en: "Production", body: "소량 20장부터 대량 생산까지. 원단 · 패턴 · 샘플 · 생산을 한 번에 맡기세요.", to: productionRequestHref("home_services_index"), primary: true },
  { number: "02", title: "AI 이미지 만들기", en: "AI design", body: "문장 한 줄이나 레퍼런스로 의류 디자인을 그리고 바로 제작으로 이어갑니다.", to: "/customize" },
  { number: "03", title: "상세페이지 제작하기", en: "Detail page", body: "완성한 디자인으로 판매용 상세페이지 이미지와 문구를 자동으로 만듭니다.", to: "/customize?next=detail-page" },
  { number: "04", title: "크라우드펀딩", en: "Funding", body: "선주문으로 수요를 먼저 확인하고, 모인 수량만큼 생산합니다.", to: "/fundings" },
];

/** 메인 — 서비스 우선순위(1 제작 의뢰 · 2 AI 이미지 · 3 상세페이지 · 4 크라우드펀딩) 목록 */
export const ServicesIndex = () => (
  <section aria-labelledby="services-index-title" className="page-shell py-20 sm:py-28">
    <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
      <Reveal className="lg:col-span-6">
        <p className="eyebrow">What BRAND-ER does</p>
        <h2 id="services-index-title" className="display-section mt-4">
          디자인에서 생산까지,
          <br />
          하나의 플랫폼에서.
        </h2>
      </Reveal>
      <Reveal delayMs={100} className="lg:col-span-4 lg:col-start-9">
        <p className="text-sm leading-7 text-stone-600 sm:text-[15px]">
          AI 도구는 시작일 뿐입니다. 브랜더의 목표는 고객이 상상한 옷을 실제로 만들어 손에 쥐게 하는 것입니다.
        </p>
      </Reveal>
    </div>
    <ul className="mt-12 grid gap-px overflow-hidden border border-black/10 bg-black/10 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
      {services.map((service) => (
        <li key={service.number} className={service.primary ? "bg-brand text-white" : "bg-[#f6f3ee]"}>
          <Link
            to={service.to}
            onClick={() => { if (service.primary) trackProductionCtaClick("home_services_index"); }}
            className="group flex h-full min-h-[220px] flex-col p-6 sm:min-h-[260px] sm:p-7"
          >
            <div className="flex items-start justify-between">
              <span className={`font-display text-[11px] font-semibold tracking-[0.2em] ${service.primary ? "text-white/70" : "text-brand"}`}>{service.number} · {service.en}</span>
              <ArrowUpRight className={`h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 ${service.primary ? "text-white" : "text-stone-400 group-hover:text-brand"}`} strokeWidth={1.6} />
            </div>
            <h3 className={`mt-auto pt-10 text-[1.35rem] font-semibold tracking-[-0.03em] ${service.primary ? "" : "group-hover:text-brand"}`}>{service.title}</h3>
            <p className={`mt-2 text-[13px] leading-6 ${service.primary ? "text-white/75" : "text-stone-500"}`}>{service.body}</p>
          </Link>
        </li>
      ))}
    </ul>
  </section>
);

/** 메인 하단 — 제작 상담 CTA 밴드 */
export const ProductionConsultBand = () => (
  <section aria-labelledby="consult-band-title" className="bg-brand text-white">
    <div className="page-shell flex flex-col gap-8 py-14 sm:py-16 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">Free consultation</p>
        <h2 id="consult-band-title" className="mt-3 text-[1.7rem] font-semibold leading-tight tracking-[-0.03em] sm:text-[2.1rem]">
          만들고 싶은 옷이 있다면, 제작 상담부터 받아보세요.
        </h2>
        <p className="mt-3 text-[15px] leading-7 text-white/75">전화번호만 남기면 됩니다. 상담 · 견적은 무료예요.</p>
      </div>
      <ProductionCtaLink
        source="home_bottom"
        className="group inline-flex min-h-[56px] w-full shrink-0 items-center justify-center gap-3 rounded-[2px] bg-white px-8 text-[15px] font-semibold text-brand transition-colors hover:bg-[#f6f3ee] sm:w-auto"
      >
        무료 제작 상담 신청 <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      </ProductionCtaLink>
    </div>
  </section>
);
