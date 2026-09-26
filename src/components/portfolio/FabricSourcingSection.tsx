import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Reveal, RevealImage } from "@/components/portfolio/ScrollReveal";
import {
  FABRIC_SOURCING_CUSTOM_FLOW_EN,
  FABRIC_SOURCING_CUSTOM_FLOW_KO,
  FABRIC_SOURCING_KIDS_FLOW,
  FABRIC_SOURCING_KIDS_POINTS,
  SPECIAL_MATERIAL_CARDS,
  type SpecialMaterialCard,
} from "@/data/portfolioShowcase";

const FlowBar = ({ steps }: { steps: string[] }) => (
  <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
    {steps.map((step, index) => (
      <div key={step} className="flex items-center gap-2">
        <span className="whitespace-nowrap font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-600">
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
  <p className="mt-8 border-l-2 border-brand pl-5 text-xl font-semibold italic leading-snug tracking-[-0.02em] text-[#211b1c] sm:text-2xl">
    {children}
  </p>
);

/** Image is rendered at its natural aspect ratio (no aspect-box, no object-fit: cover) so the
 * full swatch — including a color-swatch board's edge text — is always visible, uncropped. */
const MaterialCard = ({ material, index }: { material: SpecialMaterialCard; index: number }) => (
  <Reveal delayMs={index * 120} className={`flex flex-col ${index % 2 === 1 ? "lg:mt-24" : ""}`}>
    <img src={material.image} alt={material.imageAlt} loading="lazy" decoding="async" className="w-full" />

    <div className="flex flex-1 flex-col pt-6 sm:pt-8">
      <span className="font-display text-[11px] font-semibold tracking-[0.2em] text-brand">{material.nameEn}</span>
      <h4 className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-[1.8rem]">
        {material.nameKo}
      </h4>
      <p className="mt-3 text-sm leading-7 text-stone-600 sm:text-base sm:leading-8">
        {material.description.map((line, i) => (
          <span key={line}>
            {line}
            {i < material.description.length - 1 && <br />}
          </span>
        ))}
      </p>

      <PointList points={material.features} />

      {material.noteVariant === "highlight" ? (
        <p className="mt-6 w-fit border-l-2 border-brand pl-3 text-xs font-semibold text-brand">
          {material.note}
        </p>
      ) : (
        <p className="mt-6 text-xs leading-6 text-stone-400">{material.note}</p>
      )}

      <Link
        to={`/design-quote?ref=${encodeURIComponent(material.nameKo)}`}
        state={{ fromPortfolio: { productName: material.nameKo } }}
        className="cta-text mt-6 w-fit"
      >
        이 소재로 제작 문의하기 <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  </Reveal>
);

export const FabricSourcingSection = () => {
  return (
    <>
      {/* SPECIAL FABRIC SOURCING — intro */}
      <section id="fabric-sourcing" className="scroll-mt-20">
        <div className="page-shell py-20 sm:py-28 lg:py-32">
          <Reveal>
            <p className="eyebrow">
              Special Fabric Sourcing
            </p>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="display-section mt-6 max-w-3xl">
              특별한 원단까지,
              <br />
              BRAND-ER가 찾아드립니다.
            </h2>
          </Reveal>
          <Reveal delayMs={220}>
            <p className="mt-7 max-w-2xl text-base leading-8 text-stone-600 sm:text-lg">
              일반적인 원단부터 아동복용 안전기준 대응 소재, 비건 한지 레더와 같은 특수 소재까지.{" "}
              <br className="hidden sm:block" />
              제품의 목적과 디자인에 맞는 원단을 찾아 샘플 제작과 본생산까지 연결합니다.
            </p>
          </Reveal>
        </div>
      </section>

      {/* 01. 아동복 안전기준 대응 원단 수급 */}
      <section>
        <div className="page-shell py-20 sm:py-28 lg:py-32">
          <Reveal>
            <span className="display-number block text-[4rem] text-brand sm:text-[5rem]">01</span>
            <h3 className="mt-5 max-w-2xl text-3xl font-semibold leading-[1.12] tracking-[-0.035em] sm:text-[2.6rem]">
              아이들이 입는 옷, 왜 원단부터 중요할까요?
            </h3>
          </Reveal>
          <Reveal delayMs={100} className="mt-6">
            <FlowBar steps={FABRIC_SOURCING_KIDS_FLOW} />
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            {/* Visual first in DOM so mobile shows the swatch board before the long body copy. */}
            <RevealImage className="relative aspect-[4/5] overflow-hidden bg-[#ebe6df] sm:aspect-[6/5]">
              <img
                src={`${import.meta.env.BASE_URL}fabrics/kc-safety-swatch.png`}
                alt="KC 안전기준 대응 아동복 원단 컬러 스와치 보드"
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-[#f6f3ee]/90 px-3 py-2 sm:bottom-6 sm:left-6">
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

      {/* 02. SPECIAL MATERIALS & CERTIFIED FABRICS — 비건 한지 레더 / KC 인증 아동복 원단 */}
      <section id="special-materials" className="bg-[#ece7e0]">
        <div className="page-shell py-20 sm:py-28 lg:py-32">
          <Reveal>
            <p className="eyebrow">
              Special Materials &amp; Certified Fabrics
            </p>
          </Reveal>
          <Reveal delayMs={100}>
            <h3 className="mt-6 max-w-2xl text-3xl font-semibold leading-[1.12] tracking-[-0.035em] sm:text-[2.6rem]">
              일반적인 원단을 넘어,
              <br />
              브랜드의 차별화를 만드는 소재까지.
            </h3>
          </Reveal>
          <Reveal delayMs={180}>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base sm:leading-8">
              BRAND-ER는 비건 한지 레더, KC 인증 아동복 원단과 같은 특수·인증 소재 수급부터 샘플 제작, 본생산까지
              지원합니다.
            </p>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
            {SPECIAL_MATERIAL_CARDS.map((material, index) => (
              <MaterialCard key={material.nameEn} material={material} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* 03. 맞춤 특수 원단 서칭 */}
      <section>
        <div className="page-shell py-20 sm:py-28 lg:py-32">
          <Reveal>
            <span className="display-number block text-[4rem] text-brand sm:text-[5rem]">03</span>
            <h3 className="mt-5 max-w-2xl text-3xl font-semibold leading-[1.12] tracking-[-0.035em] sm:text-[2.6rem]">
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

          <div className="-mx-5 mt-10 flex gap-0 overflow-x-auto overscroll-x-contain px-5 pb-2 lg:mx-0 lg:overflow-visible lg:px-0 lg:flex-row lg:items-stretch">
            {FABRIC_SOURCING_CUSTOM_FLOW_KO.map((step, index) => (
              <div key={step} className="flex shrink-0 items-stretch lg:flex-1">
                <Reveal
                  delayMs={index * 70}
                  className="flex min-w-[8.5rem] flex-1 flex-col gap-2 border-t border-black/15 py-4 lg:min-w-0 lg:px-2"
                >
                  <span className="font-display text-[11px] font-semibold tracking-[0.2em] text-brand">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-lg font-semibold tracking-[-0.02em] sm:text-xl">{step}</span>
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
      <section>
        <div className="page-shell grid gap-8 pb-8 pt-4 lg:grid-cols-12 lg:items-end lg:gap-8">
          <Reveal className="border-t border-black/10 pt-10 lg:col-span-7">
            <h2 className="display-section max-w-2xl">
              찾고 있는 특별한 원단이 있으신가요?
            </h2>
            <p className="mt-6 max-w-lg text-sm leading-7 text-stone-600 sm:text-base">
              사진 한 장이나 레퍼런스만 보내주세요.
              <br />
              BRAND-ER가 원단부터 생산 방법까지 함께 찾아드립니다.
            </p>
          </Reveal>
          <Reveal delayMs={140} className="lg:col-span-4 lg:col-start-9">
            <Link to="/design-quote" className="cta-primary w-full sm:w-auto">
              특수 원단 제작 문의하기 <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
};
