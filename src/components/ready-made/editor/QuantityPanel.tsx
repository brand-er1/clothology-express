import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { READY_MADE_SIZE_OPTIONS } from "@/data/ready-made-pricing-config";
import type { UseReadyMadeGroupWearFormReturn } from "@/hooks/useReadyMadeGroupWearForm";

interface QuantityPanelProps {
  form: UseReadyMadeGroupWearFormReturn;
}

export const QuantityPanel = ({ form }: QuantityPanelProps) => (
  <div>
    <h3 className="text-sm font-black text-stone-950">사이즈 / 수량</h3>
    <p className="mt-1 text-xs leading-5 text-stone-500">사이즈별 제작 수량을 입력해주세요.</p>

    <Card className="mt-4 rounded-xl border-stone-200 bg-[#fbfaf8] p-3.5">
      <div className="grid grid-cols-2 gap-2.5">
        {READY_MADE_SIZE_OPTIONS.map((size) => (
          <label key={size} className="block">
            <span className="text-[11px] font-bold text-stone-500">{size}</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={form.sizeQuantities[size] || ""}
              placeholder="0"
              onChange={(event) => form.setSizeQuantity(size, Number(event.target.value))}
              className="mt-1 h-10 bg-white text-right text-sm font-bold"
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg bg-white px-3.5 py-2.5 ring-1 ring-stone-200">
        <span className="text-xs font-bold text-stone-600">총 수량</span>
        <span className="text-base font-black text-brand">{form.totalQuantity.toLocaleString("ko-KR")}장</span>
      </div>
    </Card>
  </div>
);
