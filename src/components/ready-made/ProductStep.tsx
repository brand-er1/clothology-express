import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { READY_MADE_PRODUCT_OPTIONS, type ReadyMadeProductOption } from "@/data/ready-made-pricing-config";
import { useRecoloredGarmentImage } from "@/lib/garment-recolor";
import { getAppPath } from "@/utils/appUrl";
import type { UseReadyMadeGroupWearFormReturn } from "@/hooks/useReadyMadeGroupWearForm";

interface ProductStepProps {
  form: UseReadyMadeGroupWearFormReturn;
}

/** Every category's catalog thumbnail is shown in the same "그레이" so the product grid reads as
 * one unified design system, regardless of which color the customer ends up picking. Extracted
 * into its own component (rather than called inline in the `.map` below) because the recolor is
 * a hook — one call per card, not one call shared across the whole list. */
const ProductCard = ({
  product,
  isSelected,
  onSelect,
}: {
  product: ReadyMadeProductOption;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const thumbnailUrl = useRecoloredGarmentImage(getAppPath(product.imageFront), "그레이");

  return (
    <button type="button" onClick={onSelect} className="text-left">
      <Card
        className={`overflow-hidden rounded-2xl border-2 p-0 transition ${
          isSelected ? "border-brand shadow-md" : "border-stone-200 hover:border-brand/40"
        }`}
      >
        <div className="relative flex aspect-square items-center justify-center bg-stone-50">
          <img src={thumbnailUrl} alt={product.label} className="h-full w-full object-contain p-4" />
          {isSelected && (
            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white">
              <Check className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        <div className="p-3">
          <p className="text-sm font-bold text-stone-950">{product.label}</p>
          <p className="mt-0.5 truncate text-xs text-stone-500">{product.description}</p>
          <p className="mt-1 text-xs font-black text-brand">
            기본 {product.basePrice.toLocaleString("ko-KR")}원~
          </p>
        </div>
      </Card>
    </button>
  );
};

export const ProductStep = ({ form }: ProductStepProps) => (
  <div>
    <h2 className="text-xl font-black text-stone-950">기성 제품을 선택해주세요</h2>
    <p className="mt-1 text-sm leading-6 text-stone-500">
      선택한 제품 위에 로고·그래픽을 인쇄합니다. 원단과 핏은 기성품 규격을 그대로 사용해요.
    </p>

    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
