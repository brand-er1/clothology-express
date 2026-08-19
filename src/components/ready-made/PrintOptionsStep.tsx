import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  READY_MADE_DTF_BULK_SIZE_OPTIONS,
  READY_MADE_DTG_BULK_SIZE_OPTIONS,
  READY_MADE_GRAPHIC_SIZE_CATEGORIES,
  READY_MADE_PRINT_LOCATION_OPTIONS,
  READY_MADE_PRINT_METHOD_LABELS,
  type ReadyMadeGraphicSizeCategory,
  type ReadyMadePrintLocation,
  type ReadyMadePrintMethod,
} from "@/data/ready-made-pricing-config";
import type { UseReadyMadeGroupWearFormReturn } from "@/hooks/useReadyMadeGroupWearForm";

interface PrintOptionsStepProps {
  form: UseReadyMadeGroupWearFormReturn;
}

const sizeCategoryOrder: ReadyMadeGraphicSizeCategory[] = ["small", "medium", "large"];

export const PrintOptionsStep = ({ form }: PrintOptionsStepProps) => {
  const isBulkTier = form.quantityTier === "bulk";
  const usedLocations = new Set(form.printJobs.map((job) => job.location));
  const availableLocationsToAdd = READY_MADE_PRINT_LOCATION_OPTIONS.filter(
    (option) => option.key === "custom" || !usedLocations.has(option.key),
  );

  return (
    <div>
      <h2 className="text-xl font-black text-stone-950">인쇄 방식·위치·크기를 선택해주세요</h2>
      <p className="mt-1 text-sm leading-6 text-stone-500">
        총 {form.totalQuantity.toLocaleString("ko-KR")}장 기준{" "}
        {isBulkTier ? "50장 이상 대량생산 단가표" : "소량 생산 단가표"}가 적용됩니다.
      </p>

      <div className="mt-5">
        <p className="text-sm font-bold text-stone-700">인쇄 방식</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {(Object.keys(READY_MADE_PRINT_METHOD_LABELS) as ReadyMadePrintMethod[]).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => form.setPrintMethod(method)}
              className={`rounded-2xl border-2 px-4 py-3 text-left text-sm font-bold transition ${
                form.printMethod === method
                  ? "border-brand bg-brand/5 text-brand"
                  : "border-stone-200 bg-white text-stone-600 hover:border-brand/30"
              }`}
            >
              {READY_MADE_PRINT_METHOD_LABELS[method]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-stone-700">인쇄 위치 (여러 곳 선택 가능)</p>
        </div>

        {form.printJobs.map((job) => {
          const locationMeta = READY_MADE_PRINT_LOCATION_OPTIONS.find((option) => option.key === job.location);
          const bulkOptions =
            form.printMethod === "dtf" ? READY_MADE_DTF_BULK_SIZE_OPTIONS : READY_MADE_DTG_BULK_SIZE_OPTIONS;

          return (
            <Card key={job.id} className="rounded-2xl border-stone-200 bg-[#fbfaf8] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Select
                    value={job.location}
                    onValueChange={(value) => form.updatePrintJob(job.id, { location: value as ReadyMadePrintLocation })}
                  >
                    <SelectTrigger className="h-10 w-full bg-white font-bold">
                      <SelectValue>{locationMeta?.label}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {READY_MADE_PRINT_LOCATION_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.key}
                          value={option.key}
                          disabled={option.key !== "custom" && option.key !== job.location && usedLocations.has(option.key)}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {job.location === "custom" && (
                    <Input
                      value={job.customLocationNote || ""}
                      onChange={(event) => form.updatePrintJob(job.id, { customLocationNote: event.target.value })}
                      placeholder="예: 오른쪽 소매 하단"
                      maxLength={40}
                      className="mt-2 h-10 bg-white"
                    />
                  )}
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

              <p className="mt-4 text-xs font-bold text-stone-500">그래픽 크기</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {sizeCategoryOrder.map((category) => {
                  const meta = READY_MADE_GRAPHIC_SIZE_CATEGORIES[category];
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => form.setPrintJobSizeCategory(job.id, category)}
                      className={`rounded-xl border px-2 py-2.5 text-center transition ${
                        job.sizeCategory === category
                          ? "border-brand bg-white text-brand ring-1 ring-brand/30"
                          : "border-stone-200 bg-white text-stone-500 hover:border-brand/30"
                      }`}
                    >
                      <span className="block text-sm font-black">{meta.label}</span>
                      <span className="mt-0.5 block text-[10px] leading-tight text-stone-400">{meta.spec}</span>
                    </button>
                  );
                })}
              </div>

              {isBulkTier && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-stone-500">상세 규격 선택 (50장 이상 대량생산 단가 기준)</p>
                  <Select
                    value={job.bulkSizeKey || ""}
                    onValueChange={(value) => form.updatePrintJob(job.id, { bulkSizeKey: value })}
                  >
                    <SelectTrigger className="mt-2 h-10 w-full bg-white">
                      <SelectValue placeholder="정확한 규격을 선택해주세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {bulkOptions.map((option) => (
                        <SelectItem key={option.key} value={option.key}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {form.printMethod === "dtg" && (
                    <label className="mt-3 flex items-center justify-between rounded-xl bg-white px-3 py-2.5 ring-1 ring-stone-200">
                      <span className="text-xs font-bold text-stone-600">전처리 적용</span>
                      <Switch
                        checked={Boolean(job.pretreatment)}
                        onCheckedChange={(checked) => form.updatePrintJob(job.id, { pretreatment: checked })}
                      />
                    </label>
                  )}
                </div>
              )}
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
