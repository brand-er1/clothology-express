import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  READY_MADE_PRINT_LOCATION_OPTIONS,
  READY_MADE_PRINT_LOCATION_PRICE,
  READY_MADE_PRINT_METHOD_OPTIONS,
  type ReadyMadePrintLocation,
} from "@/data/ready-made-pricing-config";
import type { UseReadyMadeGroupWearFormReturn } from "@/hooks/useReadyMadeGroupWearForm";

interface PrintPanelProps {
  form: UseReadyMadeGroupWearFormReturn;
}

export const PrintPanel = ({ form }: PrintPanelProps) => {
  const usedLocations = new Set(form.printJobs.map((job) => job.location));
  const availableLocationsToAdd = READY_MADE_PRINT_LOCATION_OPTIONS.filter(
    (option) => !usedLocations.has(option.key),
  );

  return (
    <div>
      <h3 className="text-sm font-black text-stone-950">인쇄</h3>
      <p className="mt-1 text-xs leading-5 text-stone-500">
        위치 1곳당 장당 +{READY_MADE_PRINT_LOCATION_PRICE.toLocaleString("ko-KR")}원. 캔버스에서 직접 옮기거나
        크기를 바꿔도 돼요.
      </p>

      <div className="mt-4">
        <p className="text-xs font-bold text-stone-700">인쇄 방식</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {READY_MADE_PRINT_METHOD_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => form.setPrintMethod(option.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                form.printMethod === option.key
                  ? "bg-brand text-white"
                  : "bg-stone-100 text-stone-500 hover:bg-stone-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        <p className="text-xs font-bold text-stone-700">인쇄 위치 (여러 곳 선택 가능)</p>

        {form.printJobs.map((job) => {
          const locationMeta = READY_MADE_PRINT_LOCATION_OPTIONS.find((option) => option.key === job.location);
          return (
            <Card key={job.id} className="rounded-xl border-stone-200 bg-[#fbfaf8] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Select
                    value={job.location}
                    onValueChange={(value) => form.setPrintJobLocation(job.id, value as ReadyMadePrintLocation)}
                  >
                    <SelectTrigger className="h-9 w-full bg-white text-xs font-bold">
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
                </div>
                {form.printJobs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => form.removePrintJob(job.id)}
                    className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400 transition hover:bg-white hover:text-red-500"
                    aria-label="인쇄 위치 삭제"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </Card>
          );
        })}

        {availableLocationsToAdd.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {availableLocationsToAdd.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => form.addPrintJob(option.key)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-stone-300 bg-white px-3 py-1.5 text-[11px] font-bold text-stone-500 transition hover:border-brand/50 hover:text-brand"
              >
                <Plus className="h-3 w-3" />
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
