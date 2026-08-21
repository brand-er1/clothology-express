import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ProductionCountryPicker } from "./ProductionCountryPicker";
import {
  getProductionCountryMoq,
  productionCountryConfig,
  type ProductionCountry,
} from "@/lib/production-country";

interface ProductionCountryBadgeProps {
  country: ProductionCountry;
  /** Domestic (Korea-baseline) MOQ for the current garment — used to resolve the displayed MOQ. */
  domesticMoq: number;
  onChangeCountry: (country: ProductionCountry) => void;
}

export const ProductionCountryBadge = ({
  country,
  domesticMoq,
  onChangeCountry,
}: ProductionCountryBadgeProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const option = productionCountryConfig[country];
  const moq = getProductionCountryMoq(country, domesticMoq);

  return (
    <>
      <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-bold text-stone-700 shadow-sm">
        <span className="text-stone-400">선택한 생산 국가</span>
        <span className="flex items-center gap-1 text-stone-950">
          {option.flag} {option.label} · MOQ {moq.toLocaleString("ko-KR")}장
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-brand transition hover:bg-brand/10"
        >
          변경
        </button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl border-0 bg-[#f9f7f3] p-6 sm:p-8">
          <DialogTitle className="sr-only">생산 국가 변경</DialogTitle>
          <ProductionCountryPicker
            selected={country}
            onSelect={(next) => {
              onChangeCountry(next);
              setIsOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
