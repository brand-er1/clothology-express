import { useEffect, useState } from "react";
import { getAppPath } from "@/utils/appUrl";

export type MascotPose =
  | "idle"
  | "run-1"
  | "run-2"
  | "run-3"
  | "run-4"
  | "run-5"
  // Tutorial-only poses: images may not exist yet (see poseSrc below), in which case the
  // component's onError fallback swaps back to idle.png automatically.
  | "point-left"
  | "point-right"
  | "point-up"
  | "point-down"
  | "thinking"
  | "happy"
  | "warning"
  | "clothes"
  | "calculator"
  | "funding"
  | "production"
  | "delivery";

type BrandMascotProps = {
  className?: string;
  size?: number;
  pose?: MascotPose;
  /** Mirrors the character horizontally, e.g. when running left instead of right. */
  flip?: boolean;
};

const poseSrc: Record<MascotPose, string> = {
  idle: getAppPath("/mascot/idle.png"),
  "run-1": getAppPath("/mascot/run-1.png"),
  "run-2": getAppPath("/mascot/run-2.png"),
  "run-3": getAppPath("/mascot/run-3.png"),
  "run-4": getAppPath("/mascot/run-4.png"),
  "run-5": getAppPath("/mascot/run-5.png"),
  "point-left": getAppPath("/mascot/point-left.png"),
  "point-right": getAppPath("/mascot/point-right.png"),
  "point-up": getAppPath("/mascot/point-up.png"),
  "point-down": getAppPath("/mascot/point-down.png"),
  thinking: getAppPath("/mascot/thinking.png"),
  happy: getAppPath("/mascot/happy.png"),
  warning: getAppPath("/mascot/warning.png"),
  clothes: getAppPath("/mascot/clothes.png"),
  calculator: getAppPath("/mascot/calculator.png"),
  funding: getAppPath("/mascot/funding.png"),
  production: getAppPath("/mascot/production.png"),
  delivery: getAppPath("/mascot/delivery.png"),
};

/**
 * BRAND-ER's official mascot artwork (transparent PNGs), swapped by pose. New tutorial poses
 * (point-left, happy, calculator, ...) gracefully fall back to idle.png until that pose's image
 * is actually added under /public/mascot — drop the PNG/WebP in and it's picked up automatically.
 */
export const BrandMascot = ({ className, size = 96, pose = "idle", flip = false }: BrandMascotProps) => {
  const [src, setSrc] = useState(poseSrc[pose]);

  useEffect(() => {
    setSrc(poseSrc[pose]);
  }, [pose]);

  return (
    <img
      src={src}
      alt="BRAND-ER 마스코트"
      width={size}
      style={{ height: "auto", transform: flip ? "scaleX(-1)" : undefined }}
      className={className}
      draggable={false}
      onError={() => {
        if (src !== poseSrc.idle) setSrc(poseSrc.idle);
      }}
    />
  );
};
