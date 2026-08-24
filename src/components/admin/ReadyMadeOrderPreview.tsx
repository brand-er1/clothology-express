import { useState } from "react";
import { X, ZoomIn } from "lucide-react";
import { type Order } from "@/types/order";
import { READY_MADE_COLOR_SWATCHES } from "@/data/ready-made-pricing-config";

interface ReadyMadeOrderPreviewProps {
  order: Order;
  /** The customer's originally-uploaded artwork file (not the final rendered design) — resolved
   * by the parent dialog, which already fetches this for every order type. */
  originalImageUrl: string | null;
}

const sideLabel = (side: string) => (side === "front" ? "앞면" : "뒷면");

const PreviewTile = ({
  label,
  url,
  onExpand,
}: {
  label: string;
  url: string;
  onExpand: (url: string) => void;
}) => (
  <button
    type="button"
    onClick={() => onExpand(url)}
    className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-stone-50"
  >
    <span className="absolute left-2 top-2 z-10 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white">
      {label}
    </span>
    <img src={url} alt={label} className="h-auto max-h-[420px] w-full object-contain" />
    <span className="absolute bottom-2 right-2 z-10 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100">
      <ZoomIn className="h-4 w-4" />
    </span>
  </button>
);

/**
 * The admin's primary view into a "빠른 단체복 제작" (ready-made group wear) order: the actual
 * garment + customer-placed design exactly as they configured it (WYSIWYG capture, not the raw
 * uploaded artwork), followed by the structured order info and the preserved placement
 * coordinates. Renders nothing useful for orders submitted before this feature existed — those
 * fall back to the dialog's older generic image display.
 */
export const ReadyMadeOrderPreview = ({ order, originalImageUrl }: ReadyMadeOrderPreviewProps) => {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const design = order.ready_made_design_data;

  const sizeEntries = design
    ? Object.entries(design.sizeQuantities).filter(([, count]) => Number(count) > 0)
    : [];
  const printLocationLabels = design
    ? Array.from(new Set(design.printJobs.map((job) => job.locationLabel)))
    : [];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-base font-black text-stone-950 md:text-lg">고객 최종 제작 시안</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {order.front_preview_url && (
            <PreviewTile label="앞면 시안" url={order.front_preview_url} onExpand={setLightboxUrl} />
          )}
          {order.back_preview_url && (
            <PreviewTile label="뒷면 시안" url={order.back_preview_url} onExpand={setLightboxUrl} />
          )}
        </div>
      </div>

      {design && (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <h4 className="text-sm font-black text-stone-800">주문 정보</h4>
          <dl className="mt-2 grid grid-cols-1 gap-y-3 gap-x-4 text-xs sm:grid-cols-2 md:text-sm">
            <div className="flex items-center justify-between sm:block">
              <dt className="text-stone-500">상품명</dt>
              <dd className="font-bold text-stone-900">{design.product.name}</dd>
            </div>
            <div className="flex items-center justify-between sm:block">
              <dt className="text-stone-500">색상</dt>
              <dd className="flex items-center gap-1.5 font-bold text-stone-900">
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-black/10"
                  style={{
                    backgroundColor:
                      READY_MADE_COLOR_SWATCHES[design.color as keyof typeof READY_MADE_COLOR_SWATCHES],
                  }}
                />
                {design.color}
              </dd>
            </div>
            <div className="flex items-center justify-between sm:block">
              <dt className="text-stone-500">수량</dt>
              <dd className="font-bold text-stone-900">{design.totalQuantity.toLocaleString("ko-KR")}장</dd>
            </div>
            <div className="flex items-center justify-between sm:block">
              <dt className="text-stone-500">인쇄 위치</dt>
              <dd className="font-bold text-stone-900">{printLocationLabels.join(", ") || "-"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-stone-500">사이즈별 수량</dt>
              <dd className="mt-1.5 flex flex-wrap gap-1.5">
                {sizeEntries.length > 0 ? (
                  sizeEntries.map(([size, count]) => (
                    <span
                      key={size}
                      className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-stone-700 ring-1 ring-stone-200"
                    >
                      {size} {count}장
                    </span>
                  ))
                ) : (
                  <span className="text-stone-400">-</span>
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-stone-500">고객 요청사항</dt>
              <dd className="mt-1.5 whitespace-pre-wrap rounded-lg bg-white p-2 text-stone-800 ring-1 ring-stone-200">
                {design.requestNote || "-"}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {originalImageUrl && (
        <div>
          <h4 className="mb-2 text-sm font-black text-stone-800">고객 업로드 원본 디자인</h4>
          <button
            type="button"
            onClick={() => setLightboxUrl(originalImageUrl)}
            className="block h-40 w-40 overflow-hidden rounded-xl border border-stone-200 bg-stone-50"
          >
            <img src={originalImageUrl} alt="고객 업로드 원본 디자인" className="h-full w-full object-contain" />
          </button>
        </div>
      )}

      {design && design.printJobs.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-black text-stone-800">제작 데이터</h4>
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="bg-stone-100 text-stone-500">
                <tr>
                  <th className="px-3 py-2 font-bold">면</th>
                  <th className="px-3 py-2 font-bold">위치</th>
                  <th className="px-3 py-2 font-bold">X</th>
                  <th className="px-3 py-2 font-bold">Y</th>
                  <th className="px-3 py-2 font-bold">Width</th>
                  <th className="px-3 py-2 font-bold">Height</th>
                  <th className="px-3 py-2 font-bold">Scale</th>
                  <th className="px-3 py-2 font-bold">Rotation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {design.printJobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-3 py-2 font-semibold text-stone-800">{sideLabel(job.side)}</td>
                    <td className="px-3 py-2 text-stone-600">{job.locationLabel}</td>
                    <td className="px-3 py-2 text-stone-600">{job.x.toFixed(3)}</td>
                    <td className="px-3 py-2 text-stone-600">{job.y.toFixed(3)}</td>
                    <td className="px-3 py-2 text-stone-600">{job.width.toFixed(3)}</td>
                    <td className="px-3 py-2 text-stone-600">{job.height.toFixed(3)}</td>
                    <td className="px-3 py-2 text-stone-600">{job.scale.toFixed(2)}</td>
                    <td className="px-3 py-2 text-stone-600">{job.rotation}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="확대 이미지"
            className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
