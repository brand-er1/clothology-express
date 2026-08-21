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
type ProductDirectImageMap = Partial<
  Record<DirectColor, Partial<Record<ReadyMadeGarmentSide, string>>>
>;

const W = 1536;
const H = 1024;

/**
 * Real per-category, per-color product photos (uploaded directly to
 * public/clothing-templates/, not AI-regenerated or CSS-recolored). Each file holds one color's
 * front (left) and back (right) view side by side, but not at a clean 50/50 split, and in several
 * of them (폴로 그레이/화이트 especially) the two sleeves visibly cross close to the middle. Each
 * crop's boundary on the side facing the other garment is set from that garment's OWN unambiguous
 * content only — rows where the two sides visibly touch or cross don't count, so the boundary
 * can't land mid-crossing and slice a cuff. Where the two garments never get close (the normal
 * case), this lands on the natural gap between them, same as before. The crop itself is that
 * garment's own tight content bounding box within its side of that boundary, auto-detected from
 * the actual pixels (+4% padding) — not a fixed cell, since the source photos aren't all framed
 * identically.
 */
const PRODUCT_SPRITES: Record<string, ProductSpriteMap> = {
  short_sleeve_tee: {
    블랙: {
      front: { sheet: "/clothing-templates/tshirt-black.png.png", viewBox: "0 111 744 777" },
      back: { sheet: "/clothing-templates/tshirt-black.png.png", viewBox: "789 107 746 783" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/tshirt-gray.png.png", viewBox: "19 103 726 820" },
      back: { sheet: "/clothing-templates/tshirt-gray.png.png", viewBox: "785 104 724 818" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/tshirt-white.png.png", viewBox: "43 130 709 763" },
      back: { sheet: "/clothing-templates/tshirt-white.png.png", viewBox: "792 130 687 764" },
    },
  },
  polo: {
    블랙: {
      front: { sheet: "/clothing-templates/polo-black.png.png", viewBox: "17 73 730 842" },
      back: { sheet: "/clothing-templates/polo-black.png.png", viewBox: "791 72 728 845" },
    },
    그레이: {
      front: {
        sheet: "/clothing-templates/polp-gray.png.png",
        viewBox: "0 0 512 683",
        sourceWidth: 1024,
        sourceHeight: 683,
      },
      back: {
        sheet: "/clothing-templates/polp-gray.png.png",
        viewBox: "512 0 512 683",
        sourceWidth: 1024,
        sourceHeight: 683,
      },
    },
    화이트: {
      front: { sheet: "/clothing-templates/polo-white.png.png", viewBox: "34 88 729 810" },
      back: { sheet: "/clothing-templates/polo-white.png.png", viewBox: "799 87 688 811" },
    },
  },
  sweatshirt: {
    블랙: {
      front: { sheet: "/clothing-templates/sweatshirt-black.png.png", viewBox: "0 109 743 788" },
      back: { sheet: "/clothing-templates/sweatshirt-black.png.png", viewBox: "784 108 751 794" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/sweatshirt-gray.png.png", viewBox: "44 112 693 758" },
      back: { sheet: "/clothing-templates/sweatshirt-gray.png.png", viewBox: "777 113 703 761" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/sweatshirt-white.png.png", viewBox: "58 109 699 786" },
      back: { sheet: "/clothing-templates/sweatshirt-white.png.png", viewBox: "791 113 692 778" },
    },
  },
  half_pants: {
    블랙: {
      front: { sheet: "/clothing-templates/shorts-black.png.png", viewBox: "0 163 738 651" },
      back: { sheet: "/clothing-templates/shorts-black.png.png", viewBox: "783 159 744 655" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/shorts-gray.png.png", viewBox: "108 33 560 482" },
      back: { sheet: "/clothing-templates/shorts-gray.png.png", viewBox: "858 33 544 482" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/short-white.png.png", viewBox: "81 33 567 462" },
      back: { sheet: "/clothing-templates/short-white.png.png", viewBox: "873 33 556 462" },
    },
  },
  hoodie: {
    블랙: {
      front: { sheet: "/clothing-templates/hoodie-black.png.png", viewBox: "0 30 726 915" },
      back: { sheet: "/clothing-templates/hoodie-black.png.png", viewBox: "771 38 762 911" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/hoodie-gray.png.png", viewBox: "0 38 748 911" },
      back: { sheet: "/clothing-templates/hoodie-gray.png.png", viewBox: "791 41 744 907" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/hoodie-white.png.png", viewBox: "0 25 742 936" },
      back: { sheet: "/clothing-templates/hoodie-white.png.png", viewBox: "787 48 744 912" },
    },
  },
  hoodie_zipup: {
    블랙: {
      front: { sheet: "/clothing-templates/ziphoodie-black.png.png", viewBox: "1 46 735 867" },
      back: { sheet: "/clothing-templates/ziphoodie-black.png.png", viewBox: "779 104 741 805" },
    },
    그레이: {
      front: { sheet: "/clothing-templates/ziphoodie-gray.png.png", viewBox: "23 79 721 773" },
      back: { sheet: "/clothing-templates/ziphoodie-gray.png.png", viewBox: "788 99 709 749" },
    },
    화이트: {
      front: { sheet: "/clothing-templates/ziphoodie-white.png.png", viewBox: "53 106 690 766" },
      back: { sheet: "/clothing-templates/ziphoodie-white.png.png", viewBox: "787 109 696 763" },
    },
  },
};

/**
 * Standalone front/back photos supplied as individual files. These are preferred over the old
 * side-by-side sprite sheets because the browser can render the complete source with
 * `object-fit: contain`; no crop coordinates or overflow clipping are involved.
 */
const PRODUCT_DIRECT_IMAGES: Record<string, ProductDirectImageMap> = {
  short_sleeve_tee: {
    블랙: {
      front: "/clothing-templates/separate/tshirt-black-front.png",
      back: "/clothing-templates/separate/tshirt-black-back.png",
    },
    그레이: {
      front: "/clothing-templates/separate/tshirt-gray-front.webp",
      back: "/clothing-templates/separate/tshirt-gray-back.webp",
    },
    화이트: {
      front: "/clothing-templates/separate/tshirt-white-front.webp",
      back: "/clothing-templates/separate/tshirt-white-back.webp",
    },
  },
  polo: {
    블랙: {
      front: "/clothing-templates/separate/polo-black-front.webp",
      back: "/clothing-templates/separate/polo-black-back.webp",
    },
    그레이: {
      front: "/clothing-templates/separate/polo-gray-v2-front.webp",
      back: "/clothing-templates/separate/polo-gray-v2-back.webp",
    },
  },
  sweatshirt: {
    블랙: {
      front: "/clothing-templates/separate/sweatshirt-black-front.webp",
      back: "/clothing-templates/separate/sweatshirt-black-back.webp",
    },
    그레이: {
      front: "/clothing-templates/separate/sweatshirt-gray-front.webp",
      back: "/clothing-templates/separate/sweatshirt-gray-back.webp",
    },
    화이트: {
      front: "/clothing-templates/separate/sweatshirt-white-front.webp",
      back: "/clothing-templates/separate/sweatshirt-white-back.webp",
    },
  },
  half_pants: {
    블랙: {
      front: "/clothing-templates/separate/shorts-black-front.webp",
      back: "/clothing-templates/separate/shorts-black-back.webp",
    },
    그레이: {
      front: "/clothing-templates/separate/shorts-gray-front.webp",
      back: "/clothing-templates/separate/shorts-gray-back.webp",
    },
    화이트: {
      front: "/clothing-templates/separate/shorts-white-front.webp",
      back: "/clothing-templates/separate/shorts-white-back.webp",
    },
  },
  hoodie: {
    블랙: {
      front: "/clothing-templates/separate/hoodie-black-front.webp",
      back: "/clothing-templates/separate/hoodie-black-back.webp",
    },
    그레이: {
      front: "/clothing-templates/separate/hoodie-gray-front.webp",
      back: "/clothing-templates/separate/hoodie-gray-back.webp",
    },
    화이트: {
      front: "/clothing-templates/separate/hoodie-white-front.webp",
      back: "/clothing-templates/separate/hoodie-white-back.webp",
    },
  },
  hoodie_zipup: {
    블랙: {
      front: "/clothing-templates/separate/ziphoodie-black-front.webp",
      back: "/clothing-templates/separate/ziphoodie-black-back.webp",
    },
    그레이: {
      front: "/clothing-templates/separate/ziphoodie-gray-front.webp",
      back: "/clothing-templates/separate/ziphoodie-gray-back.webp",
    },
    화이트: {
      front: "/clothing-templates/separate/ziphoodie-white-front.webp",
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

  return (
    <div
      role="img"
      aria-label={alt}
      className={`flex items-center justify-center overflow-hidden ${className ?? ""}`}
    >
      <div
        className="relative overflow-hidden"
        style={{
          aspectRatio: `${cropWidth} / ${cropHeight}`,
          // Width is the one definite axis (capped at the crop's own native pixel size so a
          // small source crop never gets stretched past 1:1 on the editor's much bigger canvas,
          // which is what read as blurry/broken); height is `auto`, purely derived from
          // aspect-ratio. Deliberately never height-percentage: percentage width against a flex
          // parent's content box is close to universally reliable, but percentage height only
          // resolves if every ancestor up the chain has its own definite height, and threading
          // that through this component's flex/aspect-ratio wrappers wasn't reliable in every
          // browser — a wide-aspect crop (width-based) rendered fine while a tall-aspect crop
          // (which used to be height-based here) still got sliced on some pages/browsers. The
          // outer overflow-hidden below is the fallback for the rare container that's shorter
          // than this width implies.
          width: `min(100%, ${cropWidth}px)`,
          height: "auto",
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

const DirectImage = ({ source, alt, className }: { source: string; alt: string; className?: string }) => (
  <img
    src={source.startsWith("data:") ? source : getAppPath(source)}
    alt={alt}
    draggable={false}
    loading="eager"
    decoding="async"
    className={`block h-full w-full min-h-0 min-w-0 max-h-full max-w-full object-contain object-center ${
      className ?? ""
    }`}
  />
);

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
  const directImage = PRODUCT_DIRECT_IMAGES[product.key]?.[directColor]?.[side];
  const crop = PRODUCT_SPRITES[product.key]?.[directColor]?.[side];

  const directReferenceImage = REFERENCE_COLOR_ORDER.map(
    (candidateColor) => PRODUCT_DIRECT_IMAGES[product.key]?.[candidateColor]?.[side],
  ).find((candidate): candidate is string => Boolean(candidate));

  // No real photo/sprite for this exact color (currently: 네이비 on every product) — recolor the
  // best available real photo instead of the generic placeholder.png, so the fallback still shows
  // actual garment structure (seams, pocket, drawstring) rather than a bare hanger icon.
  const referenceCrop =
    REFERENCE_COLOR_ORDER.map((c) => PRODUCT_SPRITES[product.key]?.[c]?.[side]).find(
      (candidate): candidate is SpriteCrop => Boolean(candidate),
    ) ?? null;
  const recolorSource = directReferenceImage ?? referenceCrop?.sheet ?? "";
  const shouldRecolor = !directImage && Boolean(directReferenceImage || (!crop && referenceCrop));
  const recoloredSheetUrl = useRecoloredGarmentImage(getAppPath(recolorSource), color, shouldRecolor);

  if (directImage) {
    return <DirectImage source={directImage} alt={alt} className={className} />;
  }

  if (directReferenceImage) {
    return <DirectImage source={recoloredSheetUrl} alt={alt} className={className} />;
  }

  if (crop) return <DirectSprite crop={crop} alt={alt} className={className} />;

  if (referenceCrop) {
    return (
      <DirectSprite crop={{ ...referenceCrop, sheet: recoloredSheetUrl }} alt={alt} className={className} />
    );
  }

  const fallbackSource = getAppPath(side === "front" ? product.imageFront : product.imageBack);
  return <img src={fallbackSource} alt={alt} className={`${className ?? ""} object-contain`} />;
};
