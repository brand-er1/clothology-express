import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { READY_MADE_PRODUCT_OPTIONS } from "@/data/ready-made-pricing-config";
import { getAppPath } from "@/utils/appUrl";
import type { UseReadyMadeGroupWearFormReturn } from "@/hooks/useReadyMadeGroupWearForm";

interface ProductStepProps {
  form: UseReadyMadeGroupWearFormReturn;
}

export const ProductStep = ({ form }: ProductStepProps) => (
  <div>
    <h2 className="text-xl font-black text-stone-950">기성 제품을 선택해주세요</h2>
    <p className="mt-1 text-sm leading-6 text-stone-500">
      선택한 제품 위에 로고·그래픽을 인쇄합니다. 원단과 핏은 기성품 규격을 그대로 사용해요.
    </p>

    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {READY_MADE_PRODUCT_OPTIONS.map((product) => {
        const isSelected = product.key === form.selectedProductKey;
        return (
          <button
            key={product.key}
            type="button"
            onClick={() => form.setSelectedProductKey(product.key)}
            className="text-left"
          >
            <Card
              className={`overflow-hidden rounded-2xl border-2 p-0 transition ${
                isSelected ? "border-brand shadow-md" : "border-stone-200 hover:border-brand/40"
              }`}
            >
              <div className="relative flex aspect-square items-center justify-center bg-stone-50">
                <img
                  src={getAppPath(product.image)}
                  alt={product.label}
                  className="h-full w-full object-contain p-4"
                />
                {isSelected && (
                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-bold text-stone-950">{product.label}</p>
                <p className="mt-0.5 truncate text-xs text-stone-500">{product.description}</p>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  </div>
);
