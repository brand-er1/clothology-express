import { useEffect, useMemo, useState } from "react";
import { Check, Info, PackageCheck, Ruler, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getProductionSizeGuide,
  normalizeProductionGender,
  type ProductionGender,
  type ProductionSizeColumn,
  type ProductionSizeSelection,
} from "@/lib/production-size-guide";

interface SizeStepProps {
  selectedType: string;
  gender?: string;
  productionSizeSelection: ProductionSizeSelection | null;
  onProductionSizeChange: (selection: ProductionSizeSelection) => void;
  directQuantity?: number;
  onDirectQuantityChange?: (quantity: number) => void;
}

const toNumericValue = (value: string) =>
  value.replace(/[^0-9.]/g, "");

const withUnit = (value: string) => {
  const numericValue = toNumericValue(value);
  return numericValue ? `${numericValue}cm` : "";
};

export const SizeStep = ({
  selectedType,
  gender,
  productionSizeSelection,
  onProductionSizeChange,
  directQuantity = 20,
  onDirectQuantityChange,
}: SizeStepProps) => {
  const [selectedGender, setSelectedGender] = useState<ProductionGender>(
    normalizeProductionGender(gender),
  );
  const [sizes, setSizes] = useState<ProductionSizeColumn[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);

  useEffect(() => {
    setSelectedGender(normalizeProductionGender(gender));
  }, [gender]);

  useEffect(() => {
    const guide = getProductionSizeGuide(selectedGender, selectedType);
    const nextSelectedSizes = guide.sizes.map((size) => size.label);

    setSizes(guide.sizes);
    setSelectedSizes(nextSelectedSizes);
    onProductionSizeChange({
      gender: selectedGender,
      category: guide.category,
      selectedSizes: nextSelectedSizes,
      sizes: guide.sizes,
    });
  }, [onProductionSizeChange, selectedGender, selectedType]);

  const category =
    productionSizeSelection?.category ||
    getProductionSizeGuide(selectedGender, selectedType).category;

  const measurementKeys = useMemo(
    () =>
      Array.from(
        new Set(
          sizes.flatMap((size) => Object.keys(size.measurements)),
        ),
      ),
    [sizes],
  );

  const emitChange = (
    nextSizes: ProductionSizeColumn[],
    nextSelectedSizes: string[],
  ) => {
    setSizes(nextSizes);
    setSelectedSizes(nextSelectedSizes);
    onProductionSizeChange({
      gender: selectedGender,
      category,
      selectedSizes: nextSelectedSizes,
      sizes: nextSizes,
    });
  };

  const toggleSize = (label: string) => {
    const isSelected = selectedSizes.includes(label);
    if (isSelected && selectedSizes.length === 1) return;

    const nextSelectedSizes = isSelected
      ? selectedSizes.filter((size) => size !== label)
      : sizes
          .filter(
            (size) =>
              selectedSizes.includes(size.label) || size.label === label,
          )
          .map((size) => size.label);

    emitChange(sizes, nextSelectedSizes);
  };

  const changeMeasurement = (
    sizeLabel: string,
    measurement: string,
    value: string,
  ) => {
    const nextSizes = sizes.map((size) =>
      size.label === sizeLabel
        ? {
            ...size,
            measurements: {
              ...size.measurements,
              [measurement]: withUnit(value),
            },
          }
        : size,
    );
    emitChange(nextSizes, selectedSizes);
  };

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden rounded-3xl border-0 shadow-sm">
        <div className="bg-brand px-5 py-6 text-white md:px-7">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-white/75">
                <Ruler className="h-4 w-4" />
                등록 방식 선택 전 마지막 확인
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">
                생산 사이즈와 수량을 확인하세요
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/75">
                {category} 카테고리 평균 실측을 기준으로 1·2·3 사이즈를
                한눈에 비교할 수 있습니다.
              </p>
            </div>

            <div className="grid grid-cols-2 rounded-2xl bg-white/10 p-1">
              {(["남성", "여성"] as ProductionGender[]).map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant="ghost"
                  onClick={() => setSelectedGender(option)}
                  className={`h-11 rounded-xl px-5 ${
                    selectedGender === option
                      ? "bg-white text-brand hover:bg-white hover:text-brand"
                      : "text-white hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <CardContent className="p-0">
          <div className="grid border-b bg-stone-50 sm:grid-cols-3">
            {sizes.map((size) => {
              const isSelected = selectedSizes.includes(size.label);
              return (
                <button
                  key={size.number}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleSize(size.label)}
                  className={`flex items-center justify-between gap-4 border-b px-5 py-4 text-left transition-colors last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${
                    isSelected ? "bg-brand/5" : "bg-white opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-black ${
                        isSelected
                          ? "bg-brand text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {size.number}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-gray-400">
                        {selectedGender} {size.number}사이즈
                      </p>
                      <p className="text-lg font-black text-gray-950">
                        {size.domesticLabel}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                      isSelected
                        ? "border-brand bg-brand text-white"
                        : "border-gray-300 bg-white text-transparent"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-5 md:p-7">
            <div className="mb-6 grid gap-4 rounded-2xl border border-brand/15 bg-brand/5 p-5 sm:grid-cols-[1fr_220px] sm:items-center">
              <div className="flex gap-3">
                <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <div>
                  <h3 className="font-black text-gray-950">제작 의뢰 수량</h3>
                  <p className="mt-1 text-sm leading-6 text-gray-600">
                    제작 의뢰를 선택하면 이 수량이 관리자에게 전달됩니다.
                    총 20장부터 접수할 수 있으며, 펀딩을 선택하면 펀딩
                    페이지에서 MOQ와 순이익을 별도로 계산합니다.
                  </p>
                </div>
              </div>
              <div className="relative">
                <Input
                  aria-label="제작 의뢰 총수량"
                  type="number"
                  min={20}
                  step={10}
                  value={directQuantity}
                  onChange={(event) =>
                    onDirectQuantityChange?.(
                      Math.max(0, Number(event.target.value) || 0),
                    )
                  }
                  className="h-12 rounded-xl bg-white pr-12 text-right text-lg font-black"
                />
                <span className="pointer-events-none absolute right-4 top-3.5 text-sm font-bold text-gray-500">
                  장
                </span>
              </div>
            </div>

            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-lg font-black text-gray-950">
                  {category} 평균 사이즈표
                </h3>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  표준 사이즈 참고표 기준 · 단면 측정 · 단위 cm
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">
                  생산 진행:
                </span>
                {selectedSizes.map((size) => (
                  <Badge
                    key={size}
                    className="rounded-full bg-brand/10 px-3 py-1 text-brand hover:bg-brand/10"
                  >
                    {size}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full min-w-[620px] border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-950 text-white">
                    <th className="w-[28%] px-4 py-4 text-left font-bold">
                      측정 부위
                    </th>
                    {sizes.map((size) => (
                      <th
                        key={size.label}
                        className={`px-4 py-4 text-center font-bold ${
                          selectedSizes.includes(size.label)
                            ? "bg-brand"
                            : "bg-gray-800 text-gray-400"
                        }`}
                      >
                        <span className="block text-xs opacity-70">
                          {size.number}사이즈
                        </span>
                        <span className="mt-0.5 block text-base">
                          {size.domesticLabel}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {measurementKeys.map((measurement, index) => (
                    <tr
                      key={measurement}
                      className={index % 2 === 0 ? "bg-white" : "bg-stone-50"}
                    >
                      <th className="border-t px-4 py-3 text-left font-semibold text-gray-700">
                        {measurement}
                      </th>
                      {sizes.map((size) => {
                        const value = size.measurements[measurement] || "";
                        const isHeight = measurement === "추천 키";
                        const isSelected = selectedSizes.includes(size.label);

                        return (
                          <td
                            key={`${size.label}-${measurement}`}
                            className={`border-l border-t px-3 py-2 text-center ${
                              isSelected ? "" : "bg-gray-50/80"
                            }`}
                          >
                            {isHeight ? (
                              <span
                                className={
                                  isSelected
                                    ? "font-semibold text-gray-800"
                                    : "text-gray-400"
                                }
                              >
                                {value}
                              </span>
                            ) : (
                              <div className="relative mx-auto max-w-24">
                                <Input
                                  aria-label={`${size.label} ${measurement}`}
                                  inputMode="decimal"
                                  value={toNumericValue(value)}
                                  onChange={(event) =>
                                    changeMeasurement(
                                      size.label,
                                      measurement,
                                      event.target.value,
                                    )
                                  }
                                  className="h-9 rounded-lg pr-8 text-center font-semibold"
                                />
                                <span className="pointer-events-none absolute right-2 top-2.5 text-xs text-gray-400">
                                  cm
                                </span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="flex gap-3 rounded-2xl bg-brand/5 p-4 text-sm leading-6 text-gray-700">
                <Users className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <p>
                  <strong className="text-gray-950">사이즈 번호 기준</strong>
                  <br />
                  {selectedGender === "남성"
                    ? "남성 1=M(95) · 2=L(100) · 3=XL(105)"
                    : "여성 1=S(85) · 2=M(90) · 3=L(95)"}
                </p>
              </div>
              <div className="flex gap-3 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <p>
                  평균 사이즈는 생산 기준 초안이며, 패턴·샘플 제작 과정에서
                  원단과 핏에 따라 최종 실측이 조정될 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SizeStep;
