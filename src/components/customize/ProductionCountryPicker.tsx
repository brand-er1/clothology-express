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
  /** "full" (default): big cards with bullet lists, for a dedicated selection screen.
   *  "compact": small tab-like cards with a one-line summary, for embedding at the top of a quote result. */
  variant?: "full" | "compact";
}

const multiplierLabel = (multiplier: number) => `${multiplier.toFixed(1)}×`;

export const ProductionCountryPicker = ({
  selected,
  onSelect,
  showHeading = true,
  variant = "full",
}: ProductionCountryPickerProps) => {
  if (variant === "compact") {
    return (
      <div>
        {showHeading && (
          <p className="mb-2 text-xs font-extrabold text-stone-600">생산 국가 선택</p>
        )}
        <div className="grid grid-cols-3 gap-2">
          {productionCountryOrder.map((countryKey) => {
            const option = productionCountryConfig[countryKey];
            const isSelected = selected === countryKey;

            return (
              <button
                key={countryKey}
                type="button"
                onClick={() => onSelect(countryKey)}
                aria-pressed={isSelected}
                className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-2 py-3 text-center transition sm:flex-row sm:items-center sm:justify-center sm:gap-2 sm:px-3 ${
                  isSelected
                    ? "border-brand bg-brand/10"
                    : "border-stone-200 bg-white hover:border-brand/40"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-lg leading-none">{option.flag}</span>
                  <span className={`text-sm font-black ${isSelected ? "text-brand" : "text-stone-900"}`}>
                    {option.label}
                  </span>
                  <span className="rounded-full bg-stone-950 px-1.5 py-0.5 text-[10px] font-black text-white">
                    {multiplierLabel(option.multiplier)}
                  </span>
                </span>
                <span className="text-[10px] font-semibold leading-4 text-stone-500 sm:text-[11px]">
                  {option.shortDescription}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

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
