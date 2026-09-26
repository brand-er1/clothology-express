import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { WatermarkOverlay } from "@/components/WatermarkOverlay";
import type { Funding } from "@/types/funding";

export type FundingProductItem = Pick<
  Funding,
  "id" | "product_name" | "image_url" | "cloth_type" | "current_orders" | "moq" | "price"
>;

/** Actual funding rate (may exceed 100%) — the number shoppers read first. */
export const getFundingRate = (current: number, target: number) =>
  target > 0 ? Math.round((current / target) * 100) : 0;

export const formatWon = (price: number | null | undefined) =>
  price ? `${price.toLocaleString("ko-KR")}원` : "가격 준비 중";

/**
 * Thin progress line with the rate set as a display number above it. The number is the design
 * element; the line only confirms it. Overfunded items keep a full line and show e.g. 250%.
 */
export const ProgressLine = ({
  current,
  target,
  size = "md",
  caption,
  className = "",
}: {
  current: number;
  target: number;
  size?: "sm" | "md" | "lg";
  caption?: ReactNode;
  className?: string;
}) => {
  const rate = getFundingRate(current, target);
  const width = Math.min(100, Math.max(0, rate));
  const numberClass =
    size === "lg" ? "text-[clamp(2.75rem,5vw,4rem)]" : size === "md" ? "text-xl sm:text-[1.375rem]" : "text-base sm:text-lg";

  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-3">
        <span className={`font-display font-semibold leading-none tracking-[-0.04em] text-brand ${numberClass}`}>
          {rate}
          <span className={size === "lg" ? "ml-0.5 text-[0.5em]" : "text-[0.7em]"}>%</span>
        </span>
        <span className="font-display text-[11px] font-medium tabular-nums text-stone-500 sm:text-xs">
          {current} / {target}
        </span>
      </div>
      <div className={`relative mt-2 w-full overflow-hidden bg-black/[0.09] ${size === "lg" ? "h-[3px]" : "h-[2px]"}`}>
        <div
          className="absolute inset-y-0 left-0 bg-brand transition-[width] duration-700 ease-out"
          style={{ width: `${width}%` }}
        />
      </div>
      {caption && <p className="mt-2 text-[11px] text-stone-500 sm:text-xs">{caption}</p>}
    </div>
  );
};

/**
 * Commerce product tile: large image, then only the information a shopper needs. No surrounding
 * border/background — the image is the container. Hover zooms the image and underlines the name.
 */
export const FundingProductCard = ({
  item,
  to,
  brandName,
  badge,
  statusLabel,
  imageAspect = "aspect-[4/5]",
  watermark = false,
  titleSize = "md",
  tutorialId,
}: {
  item: FundingProductItem;
  to: string;
  brandName: string;
  badge?: ReactNode;
  statusLabel?: string;
  imageAspect?: string;
  watermark?: boolean;
  titleSize?: "md" | "lg";
  tutorialId?: string;
}) => {
  const remaining = Math.max(0, item.moq - item.current_orders);

  return (
    <Link to={to} className="group block min-w-0" data-tutorial={tutorialId}>
      <article>
        <div className={`relative overflow-hidden bg-[#ebe7e1] ${imageAspect}`}>
          <img
            src={item.image_url}
            alt={item.product_name}
            loading="lazy"
            decoding="async"
            className="img-zoom h-full w-full object-contain p-[6%] mix-blend-multiply"
          />
          {watermark && <WatermarkOverlay />}
          {(badge || statusLabel) && (
            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-4">
              <span>{badge}</span>
              {statusLabel && (
                <span className="bg-[#211b1c] px-2 py-1 text-[10px] font-semibold tracking-[0.04em] text-white">
                  {statusLabel}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="pt-4 sm:pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500 sm:text-[11px]">
              {brandName}
            </p>
            <p className="shrink-0 text-[10px] text-stone-400 sm:text-[11px]">{item.cloth_type}</p>
          </div>
          <h3
            className={`mt-1.5 line-clamp-2 font-normal leading-snug tracking-[-0.02em] text-[#211b1c] ${
              titleSize === "lg" ? "text-base sm:text-xl" : "text-sm sm:text-[15px]"
            }`}
          >
            <span className="link-draw">{item.product_name}</span>
          </h3>
          <p className="mt-1.5 text-sm font-semibold tracking-[-0.01em] text-[#211b1c] sm:text-[15px]">
            {formatWon(item.price)}
          </p>
          <ProgressLine
            current={item.current_orders}
            target={item.moq}
            size="sm"
            className="mt-4"
            caption={remaining > 0 ? `제작 확정까지 ${remaining}장` : "제작 확정"}
          />
        </div>
      </article>
    </Link>
  );
};
