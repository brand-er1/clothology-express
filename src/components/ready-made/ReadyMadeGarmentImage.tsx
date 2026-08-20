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

/**
 * Render one crop from a sprite sheet with a CSS background instead of an inline SVG <image>.
 * Some production browsers/CDN combinations were failing to paint WEBP files referenced from
 * SVG <image>, which made polo / half-pants / zip-hoodie cards look empty. CSS backgrounds are
 * much more reliable and still let us use the existing combined front/back image sheets.
 */
const DirectSprite = ({ crop, alt, className }: { crop: SpriteCrop; alt: string; className?: string }) => {
  const sourceWidth = crop.sourceWidth ?? W;
  const sourceHeight = crop.sourceHeight ?? H;
  const [x, y, cropWidth, cropHeight] = crop.viewBox.split(/\s+/).map(Number);

  const backgroundSizeX = (sourceWidth / cropWidth) * 100;
  const backgroundSizeY = (sourceHeight / cropHeight) * 100;
  const maxX = sourceWidth - cropWidth;
  const maxY = sourceHeight - cropHeight;
  const backgroundPositionX = maxX > 0 ? (x / maxX) * 100 : 0;
  const backgroundPositionY = maxY > 0 ? (y / maxY) * 100 : 0;

  return (
    <div
      role="img"
      aria-label={alt}
      className={className}
      style={{
        backgroundImage: `url("${getAppPath(crop.sheet)}")`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${backgroundSizeX}% ${backgroundSizeY}%`,
        backgroundPosition: `${backgroundPositionX}% ${backgroundPositionY}%`,
      }}
    />
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

  if (crop) return <DirectSprite crop={crop} alt={alt} className={className} />;

  // Categories that used to be placeholders (polo / half pants / zip hoodie) should never
  // disappear. For an unsupported color such as navy, use their real black garment sprite.
  if (product.hasPlaceholderImage) {
    const blackCrop = PRODUCT_SPRITES[product.key]?.블랙?.[side];
    if (blackCrop) return <DirectSprite crop={blackCrop} alt={alt} className={className} />;
  }

  return <img src={fallbackUrl} alt={alt} className={className} style={{ objectFit: "contain" }} />;
};
