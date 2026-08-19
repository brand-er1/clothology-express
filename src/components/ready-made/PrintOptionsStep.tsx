import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogoPlacementCanvas } from "@/components/ready-made/LogoPlacementCanvas";
import {
  READY_MADE_PRINT_LOCATION_OPTIONS,
  READY_MADE_PRINT_LOCATION_PRICE,
  type ReadyMadePrintLocation,
} from "@/data/ready-made-pricing-config";
import type { UseReadyMadeGroupWearFormReturn } from "@/hooks/useReadyMadeGroupWearForm";

interface PrintOptionsStepProps {
  form: UseReadyMadeGroupWearFormReturn;
}

export const PrintOptionsStep = ({ form }: PrintOptionsStepProps) => {
  const usedLocations = new Set(form.printJobs.map((job) => job.location));
  const availableLocationsToAdd = READY_MADE_PRINT_LOCATION_OPTIONS.filter(
    (option) => !usedLocations.has(option.key),
  );

  return (
    <div>
      <h2 className="text-xl font-black text-stone-950">인쇄 위치를 선택해주세요</h2>
      <p className="mt-1 text-sm leading-6 text-stone-500">
        위치 1곳당 장당 +{READY_MADE_PRINT_LOCATION_PRICE.toLocaleString("ko-KR")}원이 더해집니다. 앞면과 뒷면을
        각각 따로 디자인할 수 있어요.
      </p>

      <div className="mt-6">
        <p className="text-sm font-bold text-stone-700">디자인 배치 미리보기</p>
        <Card className="mt-2 rounded-2xl border-stone-200 bg-white p-4">
          <LogoPlacementCanvas
            product={form.selectedProduct}
            color={form.selectedColor}
            designPreviewUrl={form.designPreviewUrl}
            printJobs={form.printJobs}
            onPlacementChange={form.setPrintJobPlacement}
          />
        </Card>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-stone-700">인쇄 위치 (여러 곳 선택 가능)</p>
        </div>

        {form.printJobs.map((job) => {
          const locationMeta = READY_MADE_PRINT_LOCATION_OPTIONS.find((option) => option.key === job.location);

          return (
            <Card key={job.id} className="rounded-2xl border-stone-200 bg-[#fbfaf8] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Select
                    value={job.location}
                    onValueChange={(value) => form.setPrintJobLocation(job.id, value as ReadyMadePrintLocation)}
                  >
                    <SelectTrigger className="h-10 w-full bg-white font-bold">
                      <SelectValue>{locationMeta?.label}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {READY_MADE_PRINT_LOCATION_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.key}
                          value={option.key}
                          disabled={option.key !== job.location && usedLocations.has(option.key)}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-2 text-xs font-semibold text-stone-400">
                    +{READY_MADE_PRINT_LOCATION_PRICE.toLocaleString("ko-KR")}원 / 장
                  </p>
                </div>

                {form.printJobs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => form.removePrintJob(job.id)}
                    className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-400 transition hover:bg-white hover:text-red-500"
                    aria-label="인쇄 위치 삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </Card>
          );
        })}

        {availableLocationsToAdd.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {availableLocationsToAdd.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => form.addPrintJob(option.key)}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-stone-300 bg-white px-3.5 py-2 text-xs font-bold text-stone-500 transition hover:border-brand/50 hover:text-brand"
              >
                <Plus className="h-3.5 w-3.5" />
                {option.label} 추가
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
