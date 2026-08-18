import { getAppPath } from "@/utils/appUrl";

export type MascotPose = "idle" | "run-1" | "run-2" | "run-3" | "run-4" | "run-5";

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
};

/** BRAND-ER's official mascot artwork (transparent PNGs), swapped by pose. */
export const BrandMascot = ({ className, size = 96, pose = "idle", flip = false }: BrandMascotProps) => (
  <img
    src={poseSrc[pose]}
    alt="BRAND-ER 마스코트"
    width={size}
    style={{ height: "auto", transform: flip ? "scaleX(-1)" : undefined }}
    className={className}
    draggable={false}
  />
);
