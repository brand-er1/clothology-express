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

const DIRECT_GRAY_FRONT_IMAGES: Record<string, string> = {
  polo: "/clothing-templates/direct/polo-gray-front.webp",
  half_pants: "/clothing-templates/direct/shorts-gray-front.webp",
  hoodie_zipup: "/clothing-templates/direct/zip-hoodie-gray-front.webp",
};

const halfBlack = (sheet: string): ProductSpriteMap => ({
  블랙: {
    front: { sheet, viewBox: `0 0 ${W / 2} ${H}` },
    back: { sheet, viewBox: `${W / 2} 0 ${W / 2} ${H}` },
  },
});

const grayWhite2x2 = (sheet: string): ProductSpriteMap => ({
  그레이: {
    front: { sheet, viewBox: `0 0 ${W / 2} ${H / 2}` },
    back: { sheet, viewBox: `${W / 2} 0 ${W / 2} ${H / 2}` },
  },
  화이트: {
    front: { sheet, viewBox: `0 ${H / 2} ${W / 2} ${H / 2}` },
    back: { sheet, viewBox: `${W / 2} ${H / 2} ${W / 2} ${H / 2}` },
  },
});

const PRODUCT_SPRITES: Record<string, ProductSpriteMap> = {
  short_sleeve_tee: {
    ...halfBlack("/clothing-templates/tshirt-black-front-back.webp"),
    그레이: {
      front: { sheet: "/clothing-templates/sweatshirt-gray-white-front-back.webp", viewBox: `0 ${H / 2} ${W / 4} ${H / 2}` },
      back: { sheet: "/clothing-templates/sweatshirt-gray-white-front-back.webp", viewBox: `${W / 4} ${H / 2} ${W / 4} ${H / 2}` },
    },
    화이트: {
      front: { sheet: "/clothing-templates/sweatshirt-gray-white-front-back.webp", viewBox: `${W / 2} ${H / 2} ${W / 4} ${H / 2}` },
      back: { sheet: "/clothing-templates/sweatshirt-gray-white-front-back.webp", viewBox: `${(W * 3) / 4} ${H / 2} ${W / 4} ${H / 2}` },
    },
  },
  polo: {
    ...halfBlack("/clothing-templates/polo-black-front-back.webp"),
    ...grayWhite2x2("/clothing-templates/polo-gray-white-front-back.webp"),
  },
  sweatshirt: {
    ...halfBlack("/clothing-templates/sweatshirt-black-front-back.webp"),
    그레이: {
      front: { sheet: "/clothing-templates/sweatshirt-gray-white-front-back.webp", viewBox: `0 0 ${W / 4} ${H / 2}` },
      back: { sheet: "/clothing-templates/sweatshirt-gray-white-front-back.webp", viewBox: `${W / 4} 0 ${W / 4} ${H / 2}` },
    },
    화이트: {
      front: { sheet: "/clothing-templates/sweatshirt-gray-white-front-back.webp", viewBox: `${W / 2} 0 ${W / 4} ${H / 2}` },
      back: { sheet: "/clothing-templates/sweatshirt-gray-white-front-back.webp", viewBox: `${(W * 3) / 4} 0 ${W / 4} ${H / 2}` },
    },
  },
  half_pants: {
    ...halfBlack("/clothing-templates/shorts-black-front-back.webp"),
    ...grayWhite2x2("/clothing-templates/shorts-gray-white-front-back.webp"),
  },
  hoodie: {
    ...halfBlack("/clothing-templates/hoodie-black-front-back.webp"),
    ...grayWhite2x2("/clothing-templates/hoodie-gray-white-front-back.webp"),
  },
  hoodie_zipup: {
    ...halfBlack("/clothing-templates/zip-hoodie-black-front-back.webp"),
    ...grayWhite2x2("/clothing-templates/zip-hoodie-gray-white-front-back.webp"),
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
    <div role="img" aria-label={alt} className={`relative overflow-hidden ${className ?? ""}`}>
      <img
        src={getAppPath(crop.sheet)}
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
  );
};

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
  const fallbackSource = getAppPath(side === "front" ? product.imageFront : product.imageBack);
  const fallbackUrl = useRecoloredGarmentImage(fallbackSource, color);

  const standaloneGrayFront = color === "그레이" && side === "front" ? DIRECT_GRAY_FRONT_IMAGES[product.key] : undefined;
  if (standaloneGrayFront) {
    return (
      <img
        src={getAppPath(standaloneGrayFront)}
        alt={alt}
        draggable={false}
        className={`object-contain ${className ?? ""}`}
      />
    );
  }

  if (crop) return <DirectSprite crop={crop} alt={alt} className={className} />;

  if (product.hasPlaceholderImage) {
    const blackCrop = PRODUCT_SPRITES[product.key]?.블랙?.[side];
    if (blackCrop) return <DirectSprite crop={blackCrop} alt={alt} className={className} />;
  }

  return <img src={fallbackUrl} alt={alt} className={className} />;
};
