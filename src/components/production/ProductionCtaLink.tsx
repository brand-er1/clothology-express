import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { productionRequestHref, trackProductionCtaClick, type ProductionCtaSource } from "@/lib/production-request";

/**
 * 제작 의뢰 페이지로 가는 모든 링크. 클릭 위치(source)를 전환 이벤트로 남기고 ?from= 으로 넘겨
 * 양식 진입 · 제출까지 같은 CTA 위치로 집계되게 한다.
 */
export const ProductionCtaLink = ({
  source,
  className,
  children,
  onClick,
  ariaLabel,
}: {
  source: ProductionCtaSource;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
}) => (
  <Link
    to={productionRequestHref(source)}
    className={className}
    aria-label={ariaLabel}
    onClick={() => {
      trackProductionCtaClick(source);
      onClick?.();
    }}
  >
    {children}
  </Link>
);
