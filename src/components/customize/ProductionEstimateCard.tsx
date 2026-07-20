import { Calculator, Info, Scissors, Shirt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getProductionEstimate } from "@/lib/production-estimates";

interface ProductionEstimateCardProps {
  selectedType: string;
}

const formatWon = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;

const formatRange = (minimum: number, maximum: number) =>
  minimum === maximum
    ? formatWon(minimum)
    : `${formatWon(minimum)} ~ ${formatWon(maximum)}`;

export const ProductionEstimateCard = ({ selectedType }: ProductionEstimateCardProps) => {
  const estimate = getProductionEstimate(selectedType);

  if (!estimate) return null;

  return (
    <Card className="w-full overflow-hidden border-brand/20 bg-gradient-to-br from-white to-brand/5">
      <div className="border-b border-brand/10 bg-brand px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-white/70">{estimate.category} · MOQ {estimate.quantity}장 기준</p>
            <h3 className="mt-1 flex items-center gap-2 text-lg font-bold">
              <Calculator className="h-5 w-5" /> 자동 예상 견적
            </h3>
            <p className="mt-1 text-xs font-semibold text-white/80">생산가 + 패턴비 + 샘플비</p>
          </div>
          <p className="text-right text-xl font-extrabold md:text-2xl">
            {formatRange(estimate.totalMin, estimate.totalMax)}
          </p>
        </div>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Shirt className="h-4 w-4" /> 생산가 ({estimate.quantity}장)
          </p>
          <p className="mt-2 font-bold text-gray-950">
            {formatRange(estimate.productionMin, estimate.productionMax)}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Scissors className="h-4 w-4" /> 패턴비
          </p>
          <p className="mt-2 font-bold text-gray-950">{formatWon(estimate.patternCost)}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Scissors className="h-4 w-4" /> 샘플비
          </p>
          <p className="mt-2 font-bold text-gray-950">{formatWon(estimate.sampleCost)}</p>
        </div>
      </div>

      <div className="mx-5 mb-5 flex items-start gap-2 rounded-xl bg-stone-100 px-4 py-3 text-xs leading-5 text-gray-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <div>
          <p className="font-bold text-brand">※ 원단 비용 별도</p>
          <p className="mt-1">
            {estimate.note ? `${estimate.note} ` : ""}
            부자재·프린팅·후가공·배송·VAT도 별도이며, 최종 금액은 디자인 난이도와 상담 후 확정됩니다.
          </p>
        </div>
      </div>
    </Card>
  );
};
