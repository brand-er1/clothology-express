import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { READY_MADE_SIZE_OPTIONS } from "@/data/ready-made-pricing-config";
import type { UseReadyMadeGroupWearFormReturn } from "@/hooks/useReadyMadeGroupWearForm";

interface SizeQuantityStepProps {
  form: UseReadyMadeGroupWearFormReturn;
}

export const SizeQuantityStep = ({ form }: SizeQuantityStepProps) => (
  <div>
    <h2 className="text-xl font-black text-stone-950">색상 및 사이즈별 수량을 입력해주세요</h2>
    <p className="mt-1 text-sm leading-6 text-stone-500">
      {form.selectedProduct.label} · 색상/재고에 따라 선택 가능한 옵션이 달라질 수 있습니다.
    </p>

    <div className="mt-5">
      <p className="text-sm font-bold text-stone-700">색상</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {form.selectedProduct.colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => form.setSelectedColor(color)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              form.selectedColor === color
                ? "border-brand bg-brand text-white"
                : "border-stone-200 bg-white text-stone-600 hover:border-brand/40"
            }`}
          >
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
