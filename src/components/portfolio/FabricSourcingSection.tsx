import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Reveal, RevealImage } from "@/components/portfolio/ScrollReveal";
import {
  FABRIC_SOURCING_CUSTOM_FLOW_EN,
  FABRIC_SOURCING_CUSTOM_FLOW_KO,
  FABRIC_SOURCING_HANJI_POINTS,
  FABRIC_SOURCING_KIDS_FLOW,
  FABRIC_SOURCING_KIDS_POINTS,
} from "@/data/portfolioShowcase";

/** Soft pastel swatch tones standing in for a rack of children's-wear-safe fabric samples —
 * no stock photography of these specific materials exists in the repo, so the "premium
 * showcase" look is built from color/texture rather than a fabricated product photo. */
const KIDS_SWATCH_TONES = [
  "#f4d9d9",
  "#dbe8ec",
  "#f6e8bd",
  "#dcead9",
  "#e7ddf0",
  "#f0e2d0",
];

const FlowBar = ({ steps }: { steps: string[] }) => (
  <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
    {steps.map((step, index) => (
      <div key={step} className="flex items-center gap-2">
        <span className="whitespace-nowrap border border-black/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-stone-600">
          {step}
        </span>
        {index < steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-stone-300" />}
      </div>
    ))}
  </div>
);

const PointList = ({ points }: { points: string[] }) => (
  <ul className="mt-7 space-y-3">
    {points.map((point) => (
      <li key={point} className="flex gap-3 text-sm leading-6 text-stone-600 sm:text-[15px]">
        <span className="mt-2.5 h-1 w-1 shrink-0 bg-brand" />
        {point}
      </li>
    ))}
  </ul>
);

const PullQuote = ({ children }: { children: string }) => (
  <p className="mt-8 border-l-2 border-brand pl-5 font-serif text-xl italic leading-snug tracking-[-0.02em] text-[#211b1c] sm:text-2xl">
    {children}
  </p>
);

export const FabricSourcingSection = () => {
  return (
    <>
      {/* SPECIAL FABRIC SOURCING — intro */}
      <section id="fabric-sourcing" className="scroll-mt-20 border-b border-black/10">
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
          <Reveal>
            <p className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.08em] text-brand sm:text-xs">
              <span className="h-px w-8 bg-brand" />
              Special Fabric Sourcing
            </p>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-6 max-w-3xl font-serif text-[clamp(2.2rem,5.5vw,4.5rem)] font-normal leading-[1.05] tracking-[-0.04em]">
              특별한 원단까지,
              <br />
              BRAND-ER가 찾아드립니다.
            </h2>
          </Reveal>
          <Reveal delayMs={220}>
            <p className="mt-7 max-w-2xl text-base leading-8 text-stone-600 sm:text-lg">
              일반적인 원단부터 아동복용 안전기준 대응 소재, 한지 레더와 같은 특수 소재까지.{" "}
              <br className="hidden sm:block" />
              제품의 목적과 디자인에 맞는 원단을 찾아 샘플 제작과 본생산까지 연결합니다.
            </p>
          </Reveal>
        </div>
      </section>

      {/* 01. 아동복 안전기준 대응 원단 수급 */}
      <section className="border-b border-black/10 bg-white">
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
          <Reveal>
            <span className="text-[10px] font-bold tracking-[0.2em] text-brand">01</span>
            <h3 className="mt-3 max-w-2xl font-serif text-3xl font-normal leading-[1.1] tracking-[-0.03em] sm:text-[2.6rem]">
              아이들이 입는 옷, 왜 원단부터 중요할까요?
            </h3>
          </Reveal>
          <Reveal delayMs={100} className="mt-6">
            <FlowBar steps={FABRIC_SOURCING_KIDS_FLOW} />
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            {/* Visual first in DOM so mobile shows the swatch board before the long body copy. */}
            <RevealImage className="relative aspect-[4/5] bg-[#f6f4ef] sm:aspect-[6/5]">
              <div className="grid h-full grid-cols-3 gap-3 p-6 sm:p-8">
                {KIDS_SWATCH_TONES.map((tone, index) => (
                  <div
                    key={tone}
                    className="rounded-sm border border-dashed border-black/15"
                    style={{
                      backgroundColor: tone,
                      opacity: 0.5 + (index % 3) * 0.12,
                    }}
                  />
                ))}
              </div>
              <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-white/90 px-3 py-2 shadow-sm sm:bottom-6 sm:left-6">
                <ShieldCheck className="h-4 w-4 text-brand" />
                <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-[#211b1c] sm:text-xs">
                  KC 안전기준 대응 원단 서칭
                </span>
              </div>
            </RevealImage>

            <Reveal delayMs={80}>
              <p className="text-sm leading-7 text-stone-600 sm:text-base sm:leading-8">
                아동복은 성인 의류와 달리 어린이가 직접 피부에 착용하고 장시간 사용하는 제품입니다.
                제품의 연령과 종류에 따라 「어린이제품 안전 특별법」 및 관련 안전기준의 적용을 받을 수 있으며,
                유해물질 등 안전기준을 확인해야 하는 경우가 있습니다.
              </p>
              <p className="mt-5 text-sm leading-7 text-stone-600 sm:text-base sm:leading-8">
                따라서 단순히 디자인과 가격만 보고 원단을 선택하는 것이 아니라 제품 용도와 대상 연령을 고려한
                소재 선정과 안전기준 대응이 중요합니다. BRAND-ER는 아동복 제작 시 필요한 조건을 확인하여 KC 관련
                안전기준 및 시험·인증 요건에 대응할 수 있는 아동복용 원단 수급을 지원합니다.
              </p>

              <PointList points={FABRIC_SOURCING_KIDS_POINTS} />
              <PullQuote>“아이들이 입는 옷인 만큼, 원단 선택부터 달라야 합니다.”</PullQuote>

              <p className="mt-6 text-xs leading-6 text-stone-400">
                ※ KC 적용 대상 및 필요한 시험·인증 절차는 제품의 종류, 사용 연령 및 사양 등에 따라 달라질 수
                있습니다.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 02. 한지 레더 */}
      <section className="border-b border-black/10 bg-[#efe7db]">
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
          <Reveal>
            <span className="text-[10px] font-bold tracking-[0.2em] text-brand">02</span>
            <h3 className="mt-3 max-w-2xl font-serif text-3xl font-normal leading-[1.1] tracking-[-0.03em] sm:text-[2.6rem]">
              앞면은 레더, 뒷면은 한지.
            </h3>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            {/* Visual first in DOM (mobile-first), pushed to the right column on desktop for an
                alternating rhythm against the section above. */}
            <RevealImage className="relative aspect-[4/5] overflow-hidden bg-[#dcd0bb] lg:order-2">
              <img
                src="/fabrics/faux-leather.webp"
                alt="한지 레더 앞면 — 레더 소재 표면"
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
              <span className="absolute left-4 top-4 bg-black/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white sm:left-6 sm:top-6">
                Front · Leather
              </span>

              {/* Folded corner reveals the hanji (mulberry-paper) back so the front/back
                  construction reads at a glance, instead of a single flat leather photo. */}
              <div
                className="absolute bottom-0 right-0 h-[52%] w-[52%]"
                style={{
                  clipPath: "polygon(100% 0%, 100% 100%, 0% 100%)",
                  background:
                    "repeating-linear-gradient(100deg, #efe6d2 0px, #efe6d2 2px, #e6d9bd 3px, #efe6d2 5px), radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.5), transparent 60%)",
                  boxShadow: "-10px -10px 24px -14px rgba(0,0,0,0.45)",
                }}
              />
              <span className="absolute bottom-3 right-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[#4a3c22] sm:bottom-5 sm:right-5">
                Back · Hanji
              </span>
            </RevealImage>

            <Reveal delayMs={80} className="lg:order-1">
              <p className="text-sm leading-7 text-stone-600 sm:text-base sm:leading-8">
                일반적인 레더 소재와 차별화된 특수 소재인 한지 레더 수급이 가능합니다. 앞면에서는 레더 특유의
                질감을 표현하면서 뒷면에는 한지 소재의 특성이 적용된 소재로, 일반적인 원단에서 만들기 어려운
                독특한 제품과 브랜드 스토리를 구현할 수 있습니다.
              </p>

              <PointList points={FABRIC_SOURCING_HANJI_POINTS} />
              <PullQuote>“평범한 원단이 아닌, 브랜드의 이야기가 되는 소재.”</PullQuote>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 03. 맞춤 특수 원단 서칭 */}
      <section className="border-b border-black/10 bg-[#f1f0ed]">
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
          <Reveal>
            <span className="text-[10px] font-bold tracking-[0.2em] text-brand">03</span>
            <h3 className="mt-3 max-w-2xl font-serif text-3xl font-normal leading-[1.1] tracking-[-0.03em] sm:text-[2.6rem]">
              원하는 원단이 없다면, BRAND-ER가 찾아드립니다.
            </h3>
          </Reveal>
          <Reveal delayMs={100}>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base sm:leading-8">
              고객이 원하는 원단이 일반 원단시장에서 쉽게 발견되지 않더라도 제품 사진, 디자인 또는 레퍼런스를
              기반으로 적합한 소재를 서칭하고 제안합니다. 한국·중국·일본의 생산 및 소재 공급망을 활용하여 제품에
              적합한 원단을 찾고 실제 생산까지 연결합니다.
            </p>
          </Reveal>

          <Reveal delayMs={180} className="mt-8">
            <FlowBar steps={FABRIC_SOURCING_CUSTOM_FLOW_EN} />
          </Reveal>

          <div className="-mx-5 mt-10 flex gap-0 overflow-x-auto px-5 pb-2 sm:mx-0 sm:overflow-visible sm:px-0 lg:flex-row lg:items-stretch">
            {FABRIC_SOURCING_CUSTOM_FLOW_KO.map((step, index) => (
              <div key={step} className="flex shrink-0 items-stretch lg:flex-1">
                <Reveal
                  delayMs={index * 70}
                  className="flex min-w-[8.5rem] flex-1 flex-col gap-2 border-t border-black/15 py-4 lg:min-w-0 lg:px-2"
                >
                  <span className="text-[10px] font-bold tracking-[0.2em] text-brand">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="font-serif text-lg font-normal tracking-[-0.02em] sm:text-xl">{step}</span>
                </Reveal>
                {index < FABRIC_SOURCING_CUSTOM_FLOW_KO.length - 1 && (
                  <div className="flex w-6 shrink-0 items-center justify-center text-stone-300 lg:w-8">→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fabric sourcing CTA */}
      <section className="border-b border-black/10 bg-[#211b1c] text-white">
        <div className="mx-auto max-w-[1440px] px-5 py-16 text-center sm:px-8 sm:py-24 lg:px-12 xl:px-16">
          <Reveal>
            <h2 className="mx-auto max-w-2xl font-serif text-[clamp(1.9rem,4.4vw,3.2rem)] font-normal leading-[1.1] tracking-[-0.04em]">
              찾고 있는 특별한 원단이 있으신가요?
            </h2>
          </Reveal>
          <Reveal delayMs={120}>
            <p className="mx-auto mt-6 max-w-lg text-sm leading-7 text-white/70 sm:text-base">
              사진 한 장이나 레퍼런스만 보내주세요.
              <br />
              BRAND-ER가 원단부터 생산 방법까지 함께 찾아드립니다.
            </p>
          </Reveal>
          <Reveal delayMs={220}>
            <Link
              to="/design-quote"
              className="mt-9 inline-flex h-12 items-center justify-center bg-white px-7 text-sm font-bold text-[#211b1c] transition hover:bg-white/90 sm:h-14"
            >
              특수 원단 제작 문의하기 <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
};
