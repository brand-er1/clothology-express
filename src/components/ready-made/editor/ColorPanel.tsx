import { Check } from "lucide-react";
import { READY_MADE_COLOR_SWATCHES } from "@/data/ready-made-pricing-config";
import type { UseReadyMadeGroupWearFormReturn } from "@/hooks/useReadyMadeGroupWearForm";

interface ColorPanelProps {
  form: UseReadyMadeGroupWearFormReturn;
}

export const ColorPanel = ({ form }: ColorPanelProps) => (
  <div>
    <h3 className="text-sm font-black text-stone-950">색상</h3>
    <p className="mt-1 text-xs leading-5 text-stone-500">
      {form.selectedProduct.label} · 선택하면 캔버스가 바로 바뀝니다.
    </p>

    <div className="mt-4 flex flex-wrap gap-3">
      {form.selectedProduct.colors.map((color) => {
        const isSelected = form.selectedColor === color;
        const swatchHex = READY_MADE_COLOR_SWATCHES[color];
        const isLight = color === "화이트";
        return (
          <button
            key={color}
            type="button"
            onClick={() => form.setSelectedColor(color)}
            className="flex flex-col items-center gap-1.5"
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-full ring-2 transition ${
                isSelected ? "ring-brand" : "ring-transparent hover:ring-stone-200"
              }`}
              style={{ boxShadow: isLight ? "inset 0 0 0 1px rgba(0,0,0,0.12)" : undefined }}
            >
              <span
                className="h-9 w-9 rounded-full border border-black/10"
                style={{ backgroundColor: swatchHex }}
              >
                {isSelected && (
                  <span className="flex h-full w-full items-center justify-center">
                    <Check className={`h-4 w-4 ${isLight ? "text-stone-800" : "text-white"}`} />
                  </span>
                )}
              </span>
            </span>
            <span className="text-[11px] font-bold text-stone-600">{color}</span>
          </button>
        );
      })}
    </div>
  </div>
);
