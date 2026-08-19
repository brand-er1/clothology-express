import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { READY_MADE_COLOR_SWATCHES, READY_MADE_SIZE_OPTIONS } from "@/data/ready-made-pricing-config";
import { useRecoloredGarmentImage } from "@/lib/garment-recolor";
import { getAppPath } from "@/utils/appUrl";
import type { UseReadyMadeGroupWearFormReturn } from "@/hooks/useReadyMadeGroupWearForm";

interface SizeQuantityStepProps {
  form: UseReadyMadeGroupWearFormReturn;
}

const GarmentPreview = ({ src, label }: { src: string; label: string }) => (
  <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
    <div className="flex aspect-square items-center justify-center bg-stone-50">
      <img src={src} alt={label} className="h-full w-full object-contain p-3" />
    </div>
    <p className="py-1.5 text-center text-xs font-bold text-stone-500">{label}</p>
  </div>
);

export const SizeQuantityStep = ({ form }: SizeQuantityStepProps) => {
  const frontUrl = useRecoloredGarmentImage(getAppPath(form.selectedProduct.imageFront), form.selectedColor);
  const backUrl = useRecoloredGarmentImage(getAppPath(form.selectedProduct.imageBack), form.selectedColor);

  return (
    <div>
      <h2 className="text-xl font-black text-stone-950">색상 및 사이즈별 수량을 입력해주세요</h2>
      <p className="mt-1 text-sm leading-6 text-stone-500">
        {form.selectedProduct.label} · 색상을 선택하면 아래 이미지가 바로 바뀝니다.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <GarmentPreview src={frontUrl} label="앞면" />
        <GarmentPreview src={backUrl} label="뒷면" />
      </div>
      {form.selectedProduct.hasPlaceholderImage && (
        <p className="mt-2 text-xs font-semibold text-amber-600">
          이 품목은 아직 실제 제품 사진이 준비되지 않아 임시 이미지가 표시됩니다.
        </p>
      )}

      <div className="mt-5">
        <p className="text-sm font-bold text-stone-700">색상</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {form.selectedProduct.colors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => form.setSelectedColor(color)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                form.selectedColor === color
                  ? "border-brand bg-brand text-white"
                  : "border-stone-200 bg-white text-stone-600 hover:border-brand/40"
              }`}
            >
              <span
                className="h-3.5 w-3.5 rounded-full border border-black/10"
                style={{ backgroundColor: READY_MADE_COLOR_SWATCHES[color] }}
              />
              {color}
            </button>
          ))}
        </div>
      </div>

      <Card className="mt-5 rounded-2xl border-stone-200 bg-[#fbfaf8] p-4 sm:p-5">
        <p className="text-sm font-bold text-stone-700">사이즈별 수량</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {READY_MADE_SIZE_OPTIONS.map((size) => (
            <label key={size} className="block">
              <span className="text-xs font-bold text-stone-500">{size}</span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={form.sizeQuantities[size] || ""}
                placeholder="0"
                onChange={(event) => form.setSizeQuantity(size, Number(event.target.value))}
                className="mt-1 h-11 bg-white text-right font-bold"
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-stone-200">
          <span className="text-sm font-bold text-stone-600">총 수량</span>
          <span className="text-lg font-black text-brand">{form.totalQuantity.toLocaleString("ko-KR")}장</span>
        </div>
      </Card>
    </div>
  );
};
