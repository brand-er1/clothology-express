import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ReadyMadeGarmentImage } from "@/components/ready-made/ReadyMadeGarmentImage";
import { READY_MADE_PRODUCT_OPTIONS, type ReadyMadeProductOption } from "@/data/ready-made-pricing-config";
import type { UseReadyMadeGroupWearFormReturn } from "@/hooks/useReadyMadeGroupWearForm";

interface ProductPanelProps {
  form: UseReadyMadeGroupWearFormReturn;
}

const ProductCard = ({
  product,
  isSelected,
  onSelect,
}: {
  product: ReadyMadeProductOption;
  isSelected: boolean;
  onSelect: () => void;
}) => (
  <button type="button" onClick={onSelect} className="text-left">
    <Card
      className={`overflow-hidden rounded-2xl border-2 p-0 transition ${
        isSelected ? "border-brand shadow-md" : "border-stone-200 hover:border-brand/40"
      }`}
    >
      <div className="relative flex aspect-square items-center justify-center bg-stone-50">
        <ReadyMadeGarmentImage
          product={product}
          color="그레이"
          side="front"
          alt={`${product.label} 그레이 앞면`}
          className="h-full w-full p-2"
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

    <div className="mt-4 grid grid-cols-2 gap-2.5">
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
