import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ReadyMadeGarmentImage } from "@/components/ready-made/ReadyMadeGarmentImage";
import { READY_MADE_PRODUCT_OPTIONS, type ReadyMadeProductOption } from "@/data/ready-made-pricing-config";
import type { UseReadyMadeGroupWearFormReturn } from "@/hooks/useReadyMadeGroupWearForm";

interface ProductPanelProps {
  form: UseReadyMadeGroupWearFormReturn;
}

const PRODUCT_THUMBNAIL_COLORS: Record<string, string> = {
  short_sleeve_tee: "화이트",
  polo: "그레이",
  sweatshirt: "그레이",
  half_pants: "그레이",
  hoodie: "그레이",
  hoodie_zipup: "블랙",
};

const ProductCard = ({
  product,
  isSelected,
  onSelect,
}: {
  product: ReadyMadeProductOption;
  isSelected: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={isSelected}
    data-testid={`ready-made-product-option-${product.key}`}
    className="w-full min-w-0 text-left"
  >
    <Card
      className={`w-full min-w-0 overflow-hidden rounded-2xl border-2 p-0 transition ${
        isSelected ? "border-brand shadow-md" : "border-stone-200 hover:border-brand/40"
      }`}
    >
      <div
        data-testid={`ready-made-product-thumbnail-${product.key}`}
        className="relative grid aspect-square w-full min-w-0 grid-cols-2 items-center gap-2 overflow-hidden bg-white p-[12%]"
      >
        <ReadyMadeGarmentImage
          product={product}
          color={PRODUCT_THUMBNAIL_COLORS[product.key] ?? product.defaultColor}
          side="front"
          alt={`${product.label} 앞면 전체`}
          className="h-full w-full min-h-0 min-w-0"
        />
        <ReadyMadeGarmentImage
          product={product}
          color={PRODUCT_THUMBNAIL_COLORS[product.key] ?? product.defaultColor}
          side="back"
          alt={`${product.label} 뒷면 전체`}
          className="h-full w-full min-h-0 min-w-0"
        />
        {isSelected && (
          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
            <Check className="h-3 w-3" />
          </span>
        )}
      </div>
      <div className="p-2">
        <p className="text-xs font-bold text-stone-950">{product.label}</p>
        <p className="mt-0.5 text-[11px] font-black text-brand">
          {product.basePrice.toLocaleString("ko-KR")}원~
        </p>
      </div>
    </Card>
  </button>
);

export const ProductPanel = ({ form }: ProductPanelProps) => (
  <div>
    <h3 className="text-sm font-black text-stone-950">상품</h3>
    <p className="mt-1 text-xs leading-5 text-stone-500">원단과 핏은 기성품 규격을 그대로 사용해요.</p>

    <div className="mt-4 grid min-w-0 grid-cols-2 gap-2.5">
      {READY_MADE_PRODUCT_OPTIONS.map((product) => (
        <ProductCard
          key={product.key}
          product={product}
          isSelected={product.key === form.selectedProductKey}
          onSelect={() => form.setSelectedProductKey(product.key)}
        />
      ))}
    </div>
  </div>
);
