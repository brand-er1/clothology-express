import { getAppPath } from "@/utils/appUrl";
import { useRecoloredGarmentImage } from "@/lib/garment-recolor";
import type { ReadyMadeGarmentSide, ReadyMadeProductOption } from "@/data/ready-made-pricing-config";

interface SpriteCrop {
  sheet: string;
  viewBox: string;
  sourceWidth?: number;
  sourceHeight?: number;
}

type DirectColor = "그레이" | "화이트" | "블랙";
type ProductSpriteMap = Partial<Record<DirectColor, Record<ReadyMadeGarmentSide, SpriteCrop>>>;

const W = 1536;
const H = 1024;

/**
 * Every crop below is the garment's own tight content bounding box (auto-detected from each
 * sheet's actual pixels, +5% padding) — not the raw half/quarter cell it was cut from. The
 * source sheets mix two unrelated compositions (a 2-panel black front/back layout vs. a 2x2
 * gray/white grid) whose empty margins differ a lot, so cropping to the raw cell made the same
 * garment look a different size depending on color. Cropping to content instead keeps every
 * color's silhouette filling a similar share of its frame — no distortion (the box still uses
 * the crop's own real aspect ratio, see `DirectSprite` below), just consistent framing.
 */
const PRODUCT_SPRITES: Record<string, ProductSpriteMap> = {
  short_sleeve_tee: {
    블랙: {
      front: { sheet: "/clothing-templates/tshirt-black-front-back.webp", viewBox: "0 87 768 832" },
      back: { sheet: "/clothing-templates/tshirt-black-front-back.webp", viewBox: "768 85 768 836" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/sweatshirt-gray-white-front-back.webp", viewBox: "0 536 384 435" },
      back: { sheet: "/clothing-templates/sweatshirt-gray-white-front-back.webp", viewBox: "384 536 383 437" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/sweatshirt-gray-white-front-back.webp", viewBox: "768 536 384 435" },
      back: { sheet: "/clothing-templates/sweatshirt-gray-white-front-back.webp", viewBox: "1152 536 383 437" },
    },
  },
  polo: {
    블랙: {
      front: { sheet: "/clothing-templates/polo-black-front-back.webp", viewBox: "8 52 760 883" },
      back: { sheet: "/clothing-templates/polo-black-front-back.webp", viewBox: "768 52 760 886" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/polo-gray-white-front-back.webp", viewBox: "178 0 590 512" },
      back: { sheet: "/clothing-templates/polo-gray-white-front-back.webp", viewBox: "768 0 560 512" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/polo-gray-white-front-back.webp", viewBox: "178 512 590 512" },
      back: { sheet: "/clothing-templates/polo-gray-white-front-back.webp", viewBox: "768 512 560 512" },
    },
  },
  sweatshirt: {
    블랙: {
      front: { sheet: "/clothing-templates/sweatshirt-black-front-back.webp", viewBox: "0 85 768 848" },
      back: { sheet: "/clothing-templates/sweatshirt-black-front-back.webp", viewBox: "768 85 768 858" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/sweatshirt-gray-white-front-back.webp", viewBox: "0 50 384 421" },
      back: { sheet: "/clothing-templates/sweatshirt-gray-white-front-back.webp", viewBox: "384 50 375 423" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/sweatshirt-gray-white-front-back.webp", viewBox: "768 50 384 421" },
      back: { sheet: "/clothing-templates/sweatshirt-gray-white-front-back.webp", viewBox: "1152 50 375 423" },
    },
  },
  half_pants: {
    블랙: {
      front: { sheet: "/clothing-templates/shorts-black-front-back.webp", viewBox: "0 136 768 705" },
      back: { sheet: "/clothing-templates/shorts-black-front-back.webp", viewBox: "768 131 768 711" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/shorts-gray-white-front-back.webp", viewBox: "64 39 612 473" },
      back: { sheet: "/clothing-templates/shorts-gray-white-front-back.webp", viewBox: "811 36 604 476" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/shorts-gray-white-front-back.webp", viewBox: "64 551 612 473" },
      back: { sheet: "/clothing-templates/shorts-gray-white-front-back.webp", viewBox: "811 548 604 476" },
    },
  },
  hoodie: {
    블랙: {
      front: { sheet: "/clothing-templates/hoodie-black-front-back.webp", viewBox: "0 10 768 964" },
      back: { sheet: "/clothing-templates/hoodie-black-front-back.webp", viewBox: "768 19 768 963" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/hoodie-gray-white-front-back.webp", viewBox: "178 10 553 502" },
      back: { sheet: "/clothing-templates/hoodie-gray-white-front-back.webp", viewBox: "768 8 538 504" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/hoodie-gray-white-front-back.webp", viewBox: "178 522 553 502" },
      back: { sheet: "/clothing-templates/hoodie-gray-white-front-back.webp", viewBox: "768 520 538 504" },
    },
  },
  hoodie_zipup: {
    블랙: {
      front: { sheet: "/clothing-templates/zip-hoodie-black-front-back.webp", viewBox: "0 27 768 904" },
      back: { sheet: "/clothing-templates/zip-hoodie-black-front-back.webp", viewBox: "768 81 762 850" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/zip-hoodie-gray-white-front-back.webp", viewBox: "176 10 569 502" },
      back: { sheet: "/clothing-templates/zip-hoodie-gray-white-front-back.webp", viewBox: "768 24 560 488" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/zip-hoodie-gray-white-front-back.webp", viewBox: "176 522 569 502" },
      back: { sheet: "/clothing-templates/zip-hoodie-gray-white-front-back.webp", viewBox: "768 536 560 488" },
    },
  },
};

const DirectSprite = ({ crop, alt, className }: { crop: SpriteCrop; alt: string; className?: string }) => {
  const sourceWidth = crop.sourceWidth ?? W;
  const sourceHeight = crop.sourceHeight ?? H;
  const [x, y, cropWidth, cropHeight] = crop.viewBox.split(/\s+/).map(Number);

  const imageWidthPercent = (sourceWidth / cropWidth) * 100;
  const imageHeightPercent = (sourceHeight / cropHeight) * 100;
  const leftPercent = -(x / cropWidth) * 100;
  const topPercent = -(y / cropHeight) * 100;
  const cropAspectRatio = cropWidth / cropHeight;

  return (
    <div
      role="img"
      aria-label={alt}
      className={`flex items-center justify-center overflow-hidden ${className ?? ""}`}
    >
      <div
        className="relative max-h-full max-w-full overflow-hidden"
        style={{
          aspectRatio: `${cropWidth} / ${cropHeight}`,
          width: cropAspectRatio >= 1 ? "100%" : "auto",
          height: cropAspectRatio < 1 ? "100%" : "auto",
        }}
      >
        <img
          src={crop.sheet.startsWith("data:") ? crop.sheet : getAppPath(crop.sheet)}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none absolute max-w-none select-none"
          style={{
            width: `${imageWidthPercent}%`,
            height: `${imageHeightPercent}%`,
            left: `${leftPercent}%`,
            top: `${topPercent}%`,
          }}
        />
      </div>
    </div>
  );
};

/** Preference order for which real photo to recolor from when the requested color (e.g. 네이비)
 * has no sprite crop of its own. Black first: its strong garment/background contrast gives the
 * cleanest Otsu mask and the shading amplitude here was tuned against dark reference photos, so
 * it best preserves pocket/seam/drawstring structure on another dark target like navy. */
const REFERENCE_COLOR_ORDER: DirectColor[] = ["블랙", "그레이", "화이트"];

export const ReadyMadeGarmentImage = ({
  product,
  color,
  side,
  alt,
  className,
}: {
  product: ReadyMadeProductOption;
  color: string;
  side: ReadyMadeGarmentSide;
  alt: string;
  className?: string;
}) => {
  const directColor = color as DirectColor;
  const crop = PRODUCT_SPRITES[product.key]?.[directColor]?.[side];

  // No real photo/sprite for this exact color (currently: 네이비 on every product) — recolor the
  // best available real photo instead of the generic placeholder.png, so the fallback still shows
  // actual garment structure (seams, pocket, drawstring) rather than a bare hanger icon.
  const referenceCrop =
    REFERENCE_COLOR_ORDER.map((c) => PRODUCT_SPRITES[product.key]?.[c]?.[side]).find(
      (candidate): candidate is SpriteCrop => Boolean(candidate),
    ) ?? null;
  const recoloredSheetUrl = useRecoloredGarmentImage(
    referenceCrop ? getAppPath(referenceCrop.sheet) : "",
    color,
  );

  if (crop) return <DirectSprite crop={crop} alt={alt} className={className} />;

  if (referenceCrop) {
    return (
      <DirectSprite crop={{ ...referenceCrop, sheet: recoloredSheetUrl }} alt={alt} className={className} />
    );
  }

  const fallbackSource = getAppPath(side === "front" ? product.imageFront : product.imageBack);
  return <img src={fallbackSource} alt={alt} className={`${className ?? ""} object-contain`} />;
};
