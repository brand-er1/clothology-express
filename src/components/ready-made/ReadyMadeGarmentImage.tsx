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
 * Real per-category, per-color product photos (uploaded directly to
 * public/clothing-templates/, not AI-regenerated or CSS-recolored). Each file holds one color's
 * front (left) and back (right) view side by side, but not at a clean 50/50 split — the actual
 * gap between the two garments (or, when their sleeves touch, the point where they're closest)
 * was measured per photo from the pixels themselves and used as the front/back boundary, since a
 * fixed half-width boundary was cutting several pixels into a sleeve/cuff on one side (most
 * visibly on hoodie/후드집업, whose sleeves run wide). The crop itself is that garment's own tight
 * content bounding box within its side of that boundary, auto-detected from the actual pixels
 * (+4% padding) — not a fixed cell, since the source photos aren't all framed identically.
 */
const PRODUCT_SPRITES: Record<string, ProductSpriteMap> = {
  short_sleeve_tee: {
    블랙: {
      front: { sheet: "/clothing-templates/tshirt-black.png.png", viewBox: "0 111 766 777" },
      back: { sheet: "/clothing-templates/tshirt-black.png.png", viewBox: "766 109 769 780" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/tshirt-gray.png.png", viewBox: "18 104 747 819" },
      back: { sheet: "/clothing-templates/tshirt-gray.png.png", viewBox: "765 104 745 818" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/tshirt-white.png.png", viewBox: "43 130 732 763" },
      back: { sheet: "/clothing-templates/tshirt-white.png.png", viewBox: "775 130 704 764" },
    },
  },
  polo: {
    블랙: {
      front: { sheet: "/clothing-templates/polo-black.png.png", viewBox: "17 73 752 842" },
      back: { sheet: "/clothing-templates/polo-black.png.png", viewBox: "769 72 750 845" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/polp-gray.png.png", viewBox: "9 45 767 811" },
      back: { sheet: "/clothing-templates/polp-gray.png.png", viewBox: "776 45 735 811" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/polo-white.png.png", viewBox: "34 88 744 810" },
      back: { sheet: "/clothing-templates/polo-white.png.png", viewBox: "778 87 710 811" },
    },
  },
  sweatshirt: {
    블랙: {
      front: { sheet: "/clothing-templates/sweatshirt-black.png.png", viewBox: "0 109 763 788" },
      back: { sheet: "/clothing-templates/sweatshirt-black.png.png", viewBox: "763 108 772 794" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/sweatshirt-gray.png.png", viewBox: "43 113 713 757" },
      back: { sheet: "/clothing-templates/sweatshirt-gray.png.png", viewBox: "756 113 724 761" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/sweatshirt-white.png.png", viewBox: "57 109 713 786" },
      back: { sheet: "/clothing-templates/sweatshirt-white.png.png", viewBox: "770 113 714 778" },
    },
  },
  half_pants: {
    블랙: {
      front: { sheet: "/clothing-templates/shorts-black.png.png", viewBox: "0 163 760 651" },
      back: { sheet: "/clothing-templates/shorts-black.png.png", viewBox: "760 159 767 655" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/shorts-gray.png.png", viewBox: "108 33 583 482" },
      back: { sheet: "/clothing-templates/shorts-gray.png.png", viewBox: "835 33 568 482" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/short-white.png.png", viewBox: "81 34 589 461" },
      back: { sheet: "/clothing-templates/short-white.png.png", viewBox: "850 33 579 462" },
    },
  },
  hoodie: {
    블랙: {
      front: { sheet: "/clothing-templates/hoodie-black.png.png", viewBox: "0 30 748 915" },
      back: { sheet: "/clothing-templates/hoodie-black.png.png", viewBox: "748 38 785 911" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/hoodie-gray.png.png", viewBox: "0 38 769 911" },
      back: { sheet: "/clothing-templates/hoodie-gray.png.png", viewBox: "769 41 766 907" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/hoodie-white.png.png", viewBox: "0 25 763 936" },
      back: { sheet: "/clothing-templates/hoodie-white.png.png", viewBox: "763 48 769 912" },
    },
  },
  hoodie_zipup: {
    블랙: {
      front: { sheet: "/clothing-templates/ziphoodie-black.png.png", viewBox: "1 46 755 867" },
      back: { sheet: "/clothing-templates/ziphoodie-black.png.png", viewBox: "756 104 765 805" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/ziphoodie-gray.png.png", viewBox: "22 79 741 773" },
      back: { sheet: "/clothing-templates/ziphoodie-gray.png.png", viewBox: "763 99 735 749" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/ziphoodie-white.png.png", viewBox: "52 106 716 766" },
      back: { sheet: "/clothing-templates/ziphoodie-white.png.png", viewBox: "768 109 716 762" },
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
        className="relative overflow-hidden"
        style={
          cropAspectRatio >= 1
            ? {
                aspectRatio: `${cropWidth} / ${cropHeight}`,
                // Only one axis is ever a definite size (capped at the crop's own native pixel
                // size so a small source crop never gets stretched past 1:1 on the editor's much
                // bigger canvas, which is what read as blurry/broken); the other is `auto`,
                // purely derived from aspect-ratio. Setting both a percentage size AND a max-*
                // cap on both axes at once (the previous approach) left width and height fighting
                // — one axis would hit its cap while the other stayed at 100%, breaking the box's
                // actual aspect ratio and throwing off the image's percentage-based crop offset,
                // which showed up as a sleeve/cuff getting sliced off.
                width: `min(100%, ${cropWidth}px)`,
                height: "auto",
              }
            : {
                aspectRatio: `${cropWidth} / ${cropHeight}`,
                width: "auto",
                height: `min(100%, ${cropHeight}px)`,
              }
        }
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
