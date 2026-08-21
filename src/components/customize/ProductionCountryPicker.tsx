import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  productionCountryConfig,
  productionCountryOrder,
  type ProductionCountry,
} from "@/lib/production-country";

interface ProductionCountryPickerProps {
  selected: ProductionCountry | null;
  onSelect: (country: ProductionCountry) => void;
  /** Optional heading override — omit to hide the built-in title/description (e.g. inside a dialog). */
  showHeading?: boolean;
}

const multiplierLabel = (multiplier: number) => `${multiplier.toFixed(1)}×`;

export const ProductionCountryPicker = ({
  selected,
  onSelect,
  showHeading = true,
}: ProductionCountryPickerProps) => {
  return (
    <div>
      {showHeading && (
        <div className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand sm:text-xs sm:tracking-[0.2em]">
            Production country
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-stone-950 sm:text-3xl">
            어디에서 생산하시겠어요?
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-stone-500 sm:text-sm">
            생산 국가에 따라 최소 생산 수량과 예상 제작비가 달라집니다.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {productionCountryOrder.map((countryKey) => {
          const option = productionCountryConfig[countryKey];
          const isSelected = selected === countryKey;

          return (
            <Card
              key={countryKey}
              className={`relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 p-5 shadow-sm transition ${
                isSelected
                  ? "border-brand bg-brand/5"
                  : "border-stone-200 bg-white hover:border-brand/40"
              }`}
            >
              {isSelected && (
                <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-3xl leading-none">{option.flag}</span>
                  <span className="text-lg font-black text-stone-950">
                    {option.label} 생산
                  </span>
                </div>
                <span className="mt-2 inline-block rounded-full bg-stone-950 px-3 py-1 text-xs font-black text-white">
                  {multiplierLabel(option.multiplier)}
                </span>
                <p className="mt-3 text-sm font-bold text-stone-700">{option.headline}</p>
                <ul className="mt-4 space-y-2">
                  {option.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-2 text-xs leading-5 text-stone-600"
                    >
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                type="button"
                onClick={() => onSelect(countryKey)}
                className={`mt-5 h-11 w-full rounded-full text-sm font-bold ${
                  isSelected
                    ? "bg-brand hover:bg-brand-dark"
                    : "bg-stone-950 hover:bg-stone-800"
                }`}
              >
                {option.buttonLabel}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
