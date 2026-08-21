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
 * front (left half) and back (right half) view side by side; the crop below is that garment's
 * own tight content bounding box, auto-detected from the actual pixels (+4% padding, plus extra
 * clearance on whichever edge faces the other half so a wide sleeve/cuff never bleeds into its
 * neighbor) — not a fixed half-width cell, since the source photos aren't all framed identically.
 */
const PRODUCT_SPRITES: Record<string, ProductSpriteMap> = {
  short_sleeve_tee: {
    블랙: {
      front: { sheet: "/clothing-templates/tshirt-black.png.png", viewBox: "0 111 743 777" },
      back: { sheet: "/clothing-templates/tshirt-black.png.png", viewBox: "792 109 743 780" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/tshirt-gray.png.png", viewBox: "18 104 724 819" },
      back: { sheet: "/clothing-templates/tshirt-gray.png.png", viewBox: "791 104 719 818" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/tshirt-white.png.png", viewBox: "43 130 699 763" },
      back: { sheet: "/clothing-templates/tshirt-white.png.png", viewBox: "791 130 689 764" },
    },
  },
  polo: {
    블랙: {
      front: { sheet: "/clothing-templates/polo-black.png.png", viewBox: "17 73 726 842" },
      back: { sheet: "/clothing-templates/polo-black.png.png", viewBox: "792 72 727 845" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/polp-gray.png.png", viewBox: "9 45 733 811" },
      back: { sheet: "/clothing-templates/polp-gray.png.png", viewBox: "791 45 720 811" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/polo-white.png.png", viewBox: "34 88 708 810" },
      back: { sheet: "/clothing-templates/polo-white.png.png", viewBox: "791 87 697 811" },
    },
  },
  sweatshirt: {
    블랙: {
      front: { sheet: "/clothing-templates/sweatshirt-black.png.png", viewBox: "0 109 743 788" },
      back: { sheet: "/clothing-templates/sweatshirt-black.png.png", viewBox: "792 108 743 794" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/sweatshirt-gray.png.png", viewBox: "43 113 699 757" },
      back: { sheet: "/clothing-templates/sweatshirt-gray.png.png", viewBox: "791 113 689 761" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/sweatshirt-white.png.png", viewBox: "57 109 685 786" },
      back: { sheet: "/clothing-templates/sweatshirt-white.png.png", viewBox: "791 113 693 778" },
    },
  },
  half_pants: {
    블랙: {
      front: { sheet: "/clothing-templates/shorts-black.png.png", viewBox: "0 163 743 651" },
      back: { sheet: "/clothing-templates/shorts-black.png.png", viewBox: "792 159 735 655" },
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
      front: { sheet: "/clothing-templates/hoodie-black.png.png", viewBox: "0 30 743 915" },
      back: { sheet: "/clothing-templates/hoodie-black.png.png", viewBox: "792 38 741 911" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/hoodie-gray.png.png", viewBox: "0 38 743 911" },
      back: { sheet: "/clothing-templates/hoodie-gray.png.png", viewBox: "792 41 743 907" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/hoodie-white.png.png", viewBox: "0 25 742 936" },
      back: { sheet: "/clothing-templates/hoodie-white.png.png", viewBox: "791 48 741 912" },
    },
  },
  hoodie_zipup: {
    블랙: {
      front: { sheet: "/clothing-templates/ziphoodie-black.png.png", viewBox: "0 46 743 867" },
      back: { sheet: "/clothing-templates/ziphoodie-black.png.png", viewBox: "792 104 728 805" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/ziphoodie-gray.png.png", viewBox: "22 79 721 773" },
      back: { sheet: "/clothing-templates/ziphoodie-gray.png.png", viewBox: "792 99 706 749" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/ziphoodie-white.png.png", viewBox: "52 106 691 766" },
      back: { sheet: "/clothing-templates/ziphoodie-white.png.png", viewBox: "792 109 692 762" },
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
          // Never stretch past the crop's own native pixel size — the editor canvas can be much
          // bigger than these thumbnail-era crops, and filling 100% of a large canvas from a
          // ~400px-wide source crop is what reads as blurry/broken. Capping here lets the box
          // still shrink to fit small containers (mobile) via the width/height above, it just
          // can't grow past 1:1 pixel scale.
          maxWidth: `${cropWidth}px`,
          maxHeight: `${cropHeight}px`,
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
