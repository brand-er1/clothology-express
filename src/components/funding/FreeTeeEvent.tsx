import { Link } from "react-router-dom";
import { ArrowRight, Gift } from "lucide-react";
import type { Funding } from "@/types/funding";
import {
  FlickerFlame,
  NEW_DROP_BRAND,
  fireGradientClassName,
  useNewDropCountdown,
  useNewDropIds,
} from "@/components/funding/NewDropPromo";

// 무료 증정 이벤트: 최근 드랍된 반팔(NEW DROP 01) 펀딩에 모의결제로 참여하면 실제 결제 없이 옷을 무료로 받는다.
// 이벤트 기간은 NEW DROP 01 런칭 이벤트(~10.10)와 같다.
export const FREE_TEE_EVENT_PERIOD_LABEL = "~10.10 (토)";

const FREE_TEE_STEPS = ["사이즈 선택", "배송지 입력", "모의결제 0원"];

/** 승인된 펀딩 중 가장 최근에 열린 드랍 상품 (NEW DROP 01 판별 규칙과 동일). */
export const useLatestDropFunding = (fundings: Funding[]) => {
  const dropIds = useNewDropIds(fundings);
  return fundings.find((funding) => dropIds.has(funding.id)) ?? null;
};

/** 홈·SHOP 상단 이벤트 배너. 이벤트 기간이 끝났거나 드랍 상품이 없으면 렌더링하지 않는다. */
export const FreeTeeEventBanner = ({ fundings }: { fundings: Funding[] }) => {
  const countdown = useNewDropCountdown();
  const drop = useLatestDropFunding(fundings);
  if (!countdown || !drop) return null;

  return (
    <section aria-label="반팔 티셔츠 무료 증정 이벤트" className="bg-[#efe6df]">
      <div className="page-shell grid grid-cols-[minmax(0,1fr)] items-center gap-5 py-6 sm:py-8 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-10">
        <Link
          to={`/fundings/${drop.id}`}
          className="relative hidden aspect-[4/5] w-24 shrink-0 overflow-hidden bg-[#f6f3ee] md:block lg:w-28"
          aria-hidden
          tabIndex={-1}
        >
          <img src={drop.image_url} alt="" className="h-full w-full object-contain p-2" />
        </Link>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white ${fireGradientClassName}`}>
              <FlickerFlame className="h-3.5 w-3.5" />
              Free event
            </span>
            <span className="text-[11px] font-semibold tracking-[0.08em] text-brand">
              {FREE_TEE_EVENT_PERIOD_LABEL} · D-{countdown.days === 0 ? "DAY" : countdown.days}
            </span>
          </div>

          <div className="mt-3 flex items-start gap-3">
            <Link
              to={`/fundings/${drop.id}`}
              className="aspect-[4/5] w-16 shrink-0 overflow-hidden bg-[#f6f3ee] md:hidden"
              aria-hidden
              tabIndex={-1}
            >
              <img src={drop.image_url} alt="" className="h-full w-full object-contain p-1" />
            </Link>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold leading-snug tracking-[-0.03em] text-[#211b1c] sm:text-2xl lg:text-3xl">
                모의결제만 해도 <span className="text-brand">반팔 티셔츠 무료</span>
              </h2>
              <p className="text-wrap-anywhere mt-1.5 line-clamp-3 text-sm leading-6 text-stone-600 sm:line-clamp-none">
                {NEW_DROP_BRAND} 신규 드랍 <strong className="font-semibold text-[#211b1c]">{drop.product_name}</strong> 펀딩에
                모의결제로 참여하면, 실제 결제 없이 옷을 무료로 보내드려요.
              </p>
            </div>
          </div>

          <ol className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-medium text-stone-600" aria-label="참여 방법">
            {FREE_TEE_STEPS.map((step, index) => (
              <li key={step} className="flex items-center gap-2">
                {index > 0 && <ArrowRight className="h-3 w-3 text-stone-300" aria-hidden />}
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-display font-semibold text-brand">{String(index + 1).padStart(2, "0")}</span>
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <Link
          to={`/fundings/${drop.id}`}
          className="cta-primary w-full md:w-auto"
        >
          <Gift className="h-4 w-4" /> 무료로 받기 <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
};

/** 드랍 상품 상세·결제 화면에 붙는 짧은 이벤트 안내. */
export const FreeTeeEventNotice = ({ className = "" }: { className?: string }) => {
  const countdown = useNewDropCountdown();
  if (!countdown) return null;

  return (
    <div className={`flex items-start gap-3 border-l-2 border-brand bg-brand/[0.04] px-4 py-3 ${className}`}>
      <Gift className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0 text-sm leading-6">
        <p className="font-semibold text-brand">무료 증정 이벤트 대상 상품 · {FREE_TEE_EVENT_PERIOD_LABEL}</p>
        <p className="text-stone-600">모의결제로 펀딩에 참여하면 실제 결제 없이 이 반팔 티셔츠를 무료로 보내드려요.</p>
      </div>
    </div>
  );
};
