import { characterConfig, closetSlotLabel } from "@/lib/closet-character-config";
import { mannequinSizeShortLabel } from "@/lib/mannequin-presets";
import type { Order } from "@/types/order";
import type { ProductionEstimateItem } from "@/types/productionEstimate";

interface FittingOutfitOrderPreviewProps {
  order: Order;
}

const formatWonRange = (min: number, max: number) =>
  min === max ? `${min.toLocaleString("ko-KR")}원` : `${min.toLocaleString("ko-KR")}원 ~ ${max.toLocaleString("ko-KR")}원`;

/**
 * Admin view for a 제작의뢰 created from the 3D 가상피팅 "현재 착용 의류 전체 견적받기" flow (spec
 * §14: "관리자 페이지에서도 고객이 어떤 마네킹에 어떤 옷을 착용한 상태로 제작을 요청했는지 확인할
 * 수 있어야 한다"). `order.fitting_state` carries the mannequin (gender/size) + per-slot garments;
 * `order.estimate_snapshot.items[]` (already produced by getCombinedFittingEstimate on the client,
 * same shape the single-garment estimate has always used) carries the per-item price breakdown.
 */
export const FittingOutfitOrderPreview = ({ order }: FittingOutfitOrderPreviewProps) => {
  const fittingState = order.fitting_state;
  const items = (order.estimate_snapshot?.items ?? []) as ProductionEstimateItem[];

  if (!fittingState) return null;

  return (
    <div className="space-y-4">
      {order.fitting_preview_url && (
        <div>
          <h3 className="mb-2 text-base font-black text-stone-950 md:text-lg">마네킹 미리보기</h3>
          <img
            src={order.fitting_preview_url}
            alt="3D 마네킹 / AI 피팅 미리보기"
            className="max-h-[420px] w-full rounded-2xl border border-stone-200 bg-stone-50 object-contain"
          />
        </div>
      )}

      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
        <h4 className="text-sm font-black text-stone-800">
          마네킹 · {characterConfig[fittingState.gender].label} {mannequinSizeShortLabel[fittingState.size]}
        </h4>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {fittingState.slots.map((slot) => {
            const priced = items.find((item) => item.itemLabel.endsWith(slot.label));
            return (
              <div key={`${slot.slot}-${slot.id}`} className="flex items-center gap-3 rounded-xl bg-white p-2 ring-1 ring-stone-200">
                <img src={slot.imageUrl} alt={slot.label} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-stone-500">{closetSlotLabel[slot.slot]}</p>
                  <p className="truncate text-sm font-bold text-stone-900">{slot.label}</p>
                  {priced && (
                    <p className="text-xs font-bold text-brand">
                      {formatWonRange(priced.totals.totalMin, priced.totals.totalMax)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
