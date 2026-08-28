import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { isBottomLikeSlot, isTopLikeSlot } from "@/lib/closet-character-config";
import type {
  ClosetSlot,
  FabricDrape,
  FabricStretch,
  FabricThickness,
  FitType,
  GarmentFitInfo,
  GarmentMeasurements,
} from "@/types/closet";

const fitTypeOptions: { value: FitType; label: string }[] = [
  { value: "oversize", label: "오버핏" },
  { value: "semi_oversize", label: "세미오버핏" },
  { value: "regular", label: "레귤러핏" },
  { value: "slim", label: "슬림핏" },
];

const stretchOptions: { value: FabricStretch; label: string }[] = [
  { value: "none", label: "신축성 없음" },
  { value: "low", label: "약간 신축" },
  { value: "medium", label: "보통 신축" },
  { value: "high", label: "높은 신축" },
];

const thicknessOptions: { value: FabricThickness; label: string }[] = [
  { value: "thin", label: "얇음" },
  { value: "medium", label: "보통" },
  { value: "thick", label: "두꺼움" },
];

const drapeOptions: { value: FabricDrape; label: string }[] = [
  { value: "stiff", label: "빳빳함" },
  { value: "medium", label: "보통" },
  { value: "fluid", label: "부드럽게 흐름" },
];

const topMeasurementFields: { key: keyof GarmentMeasurements; label: string }[] = [
  { key: "totalLength", label: "총장" },
  { key: "shoulderWidth", label: "어깨너비" },
  { key: "chestWidth", label: "가슴단면" },
  { key: "waistWidth", label: "허리단면" },
  { key: "hemWidth", label: "밑단단면" },
  { key: "sleeveLength", label: "소매길이" },
];

const bottomMeasurementFields: { key: keyof GarmentMeasurements; label: string }[] = [
  { key: "bottomWaist", label: "허리" },
  { key: "bottomHip", label: "힙" },
  { key: "bottomRise", label: "밑위" },
  { key: "bottomThigh", label: "허벅지" },
  { key: "bottomHem", label: "밑단" },
  { key: "bottomLength", label: "총장" },
];

interface PillGroupProps<T extends string> {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
}

const PillGroup = <T extends string>({ options, value, onChange }: PillGroupProps<T>) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        aria-pressed={value === option.value}
        className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
          value === option.value ? "bg-brand text-white" : "bg-[#f4f0ea] text-stone-600 hover:bg-brand/10"
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

interface GarmentFitInfoFormProps {
  slot: ClosetSlot;
  fitInfo: GarmentFitInfo;
  onChange: (fitInfo: GarmentFitInfo) => void;
}

const hasAnyMeasurement = (measurements: GarmentMeasurements) =>
  Object.values(measurements).some((value) => typeof value === "number" && Number.isFinite(value));

/** Per-garment sizing/fit input: base size, fit type, optional real measurements, fabric info. */
export const GarmentFitInfoForm = ({ slot, fitInfo, onChange }: GarmentFitInfoFormProps) => {
  const [measurementsOpen, setMeasurementsOpen] = useState(hasAnyMeasurement(fitInfo.measurements || {}));
  const fields = [
    ...(isTopLikeSlot(slot) ? topMeasurementFields : []),
    ...(isBottomLikeSlot(slot) ? bottomMeasurementFields : []),
  ];

  const updateMeasurement = (key: keyof GarmentMeasurements, raw: string) => {
    const next: GarmentMeasurements = { ...fitInfo.measurements };
    if (raw.trim() === "") {
      delete next[key];
    } else {
      const num = Number(raw);
      if (Number.isFinite(num)) next[key] = num;
    }
    onChange({ ...fitInfo, measurements: next, hasMeasurements: hasAnyMeasurement(next) });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-stone-200 bg-[#faf8f5] p-3">
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold text-stone-500">의류 기준 사이즈</p>
        <Input
          value={fitInfo.baseSize || ""}
          onChange={(event) => onChange({ ...fitInfo, baseSize: event.target.value.slice(0, 40) })}
          placeholder="예: M, 95, FREE"
          className="h-9 rounded-full border-stone-200 bg-white text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-bold text-stone-500">핏 유형</p>
        <PillGroup options={fitTypeOptions} value={fitInfo.fitType} onChange={(value) => onChange({ ...fitInfo, fitType: value })} />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setMeasurementsOpen((open) => !open)}
          className="flex w-full items-center justify-between text-[11px] font-bold text-stone-500"
        >
          실측값 입력 (선택 — 입력 시 최우선 반영)
          <ChevronDown className={`h-3.5 w-3.5 transition ${measurementsOpen ? "rotate-180" : ""}`} />
        </button>
        {measurementsOpen && (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {fields.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1 block text-[10px] font-bold text-stone-500">{field.label} (cm)</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={fitInfo.measurements?.[field.key] ?? ""}
                  onChange={(event) => updateMeasurement(field.key, event.target.value)}
                  className="h-8 rounded-lg border-stone-200 bg-white text-xs"
                />
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-bold text-stone-500">원단 신축성</p>
        <PillGroup
          options={stretchOptions}
          value={fitInfo.fabric?.stretch}
          onChange={(value) => onChange({ ...fitInfo, fabric: { ...fitInfo.fabric, stretch: value } })}
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold text-stone-500">원단 두께</p>
        <PillGroup
          options={thicknessOptions}
          value={fitInfo.fabric?.thickness}
          onChange={(value) => onChange({ ...fitInfo, fabric: { ...fitInfo.fabric, thickness: value } })}
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold text-stone-500">원단 드레이프</p>
        <PillGroup
          options={drapeOptions}
          value={fitInfo.fabric?.drape}
          onChange={(value) => onChange({ ...fitInfo, fabric: { ...fitInfo.fabric, drape: value } })}
        />
      </div>

      {!fitInfo.hasMeasurements && (
        <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[10px] leading-4 text-amber-700">
          실측값을 입력하지 않으면 선택한 기준 사이즈와 핏 정보를 바탕으로 AI가 시각적으로 추정해 생성합니다.
        </p>
      )}
    </div>
  );
};
