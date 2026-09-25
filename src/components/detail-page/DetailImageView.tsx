import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import type { DetailImage } from "@/types/detailPage";
import { cn } from "@/lib/utils";
import { WatermarkOverlay } from "@/components/WatermarkOverlay";

type NaturalSize = { width: number; height: number };

// Slightly narrower than half so a sleeve of the other view crossing the midline is not shown.
const CROP_WIDTH = 0.465;

const sizeCache = new Map<string, NaturalSize>();

const useNaturalSize = (url: string, enabled: boolean) => {
  const [size, setSize] = useState<NaturalSize | null>(() => sizeCache.get(url) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled || !url) return;
    const cached = sizeCache.get(url);
    if (cached) {
      setSize(cached);
      return;
    }
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      const next = { width: probe.naturalWidth || 1, height: probe.naturalHeight || 1 };
      sizeCache.set(url, next);
      if (!cancelled) setSize(next);
    };
    probe.onerror = () => {
      if (!cancelled) setFailed(true);
    };
    probe.src = url;
    return () => {
      cancelled = true;
    };
  }, [enabled, url]);

  return { size, failed };
};

type DetailImageViewProps = {
  image: DetailImage;
  className?: string;
  /** "contain" never crops the garment; "cover" fills the frame (lifestyle/uploaded photos). */
  fit?: "contain" | "cover";
  padded?: boolean;
  /** Public funding pages watermark design images, like the rest of the funding page. */
  watermark?: boolean;
};

/**
 * Renders a detail-page image inside a sized frame. Design images are one frame with the
 * front on the left half and the back on the right half; `crop` picks a half via an SVG
 * viewBox, which scales like object-fit without distorting or clipping the garment.
 */
export const DetailImageView = ({ image, className, fit = "contain", padded = true, watermark = false }: DetailImageViewProps) => {
  const needsCrop = image.crop !== "full";
  const { size, failed: probeFailed } = useNaturalSize(image.url, needsCrop);
  const [imgFailed, setImgFailed] = useState(false);
  const failed = probeFailed || imgFailed || !image.url;
  // Design renders sit on a white studio background; multiply lets the template's frame
  // colour show through instead of a white box.
  const blend = image.source === "design" && "mix-blend-multiply";

  return (
    <div className={cn("relative overflow-hidden", className)} role="img" aria-label={image.alt}>
      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs opacity-50">
          <ImageOff className="h-6 w-6" />
          이미지를 불러오지 못했습니다
        </div>
      ) : needsCrop ? (
        size ? (
          <svg
            className={cn("absolute inset-0 h-full w-full", blend, padded && fit === "contain" && "p-[4%]")}
            viewBox={`${image.crop === "right" ? size.width * (1 - CROP_WIDTH) : 0} 0 ${size.width * CROP_WIDTH} ${size.height}`}
            preserveAspectRatio={fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"}
            aria-hidden
          >
            <image href={image.url} width={size.width} height={size.height} />
          </svg>
        ) : (
          <div className="absolute inset-0 animate-pulse bg-black/5" />
        )
      ) : (
        <img
          src={image.url}
          alt={image.alt}
          loading="lazy"
          onError={() => setImgFailed(true)}
          className={cn(
            "absolute inset-0 h-full w-full",
            blend,
            fit === "cover" ? "object-cover" : "object-contain",
            padded && fit === "contain" && "p-[4%]",
          )}
        />
      )}
      {watermark && !failed && <WatermarkOverlay />}
    </div>
  );
};
