import { useCallback, useRef, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { ReadyMadeGarmentImage } from "@/components/ready-made/ReadyMadeGarmentImage";
import {
  READY_MADE_MAX_ARTWORK_WIDTH_PERCENT,
  READY_MADE_MIN_ARTWORK_WIDTH_PERCENT,
  type ReadyMadeArtworkPlacement,
  type ReadyMadeGarmentSide,
  type ReadyMadeProductOption,
} from "@/data/ready-made-pricing-config";
import type { ReadyMadePrintJob } from "@/types/readyMadeOrder";

interface GarmentCanvasProps {
  product: ReadyMadeProductOption;
  color: string;
  side: ReadyMadeGarmentSide;
  onSideChange: (side: ReadyMadeGarmentSide) => void;
  designPreviewUrl: string | null;
  printJobs: ReadyMadePrintJob[];
  onPlacementChange: (jobId: string, placement: ReadyMadeArtworkPlacement) => void;
  onDuplicateJob: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
}

type GestureKind = "move" | "resize";

interface Gesture {
  kind: GestureKind;
  jobId: string;
  pointerId: number;
  rect: DOMRect;
  startXPercent: number;
  startYPercent: number;
}

/** Purely visual guide for where print tends to land cleanly — does not clip or constrain
 * dragging. There's no per-garment printable-area data in the pricing catalog, so this is a
 * single generous safe zone shared by every product rather than an invented per-product table. */
const SAFE_ZONE = { left: 8, top: 6, right: 92, bottom: 94 };

const isOutOfBounds = (placement: ReadyMadeArtworkPlacement) => {
  const half = placement.widthPercent / 2;
  return (
    placement.xPercent - half < SAFE_ZONE.left - 2 ||
    placement.xPercent + half > SAFE_ZONE.right + 2 ||
    placement.yPercent < SAFE_ZONE.top - 2 ||
    placement.yPercent > SAFE_ZONE.bottom + 2
  );
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const GarmentCanvas = ({
  product,
  color,
  side,
  onSideChange,
  designPreviewUrl,
  printJobs,
  onPlacementChange,
  onDuplicateJob,
  onDeleteJob,
}: GarmentCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const jobsForSide = printJobs.filter((job) => job.side === side);
  const frontCount = printJobs.filter((job) => job.side === "front").length;
  const backCount = printJobs.filter((job) => job.side === "back").length;

  const percentFromEvent = (event: React.PointerEvent, rect: DOMRect) => ({
    xPercent: ((event.clientX - rect.left) / rect.width) * 100,
    yPercent: ((event.clientY - rect.top) / rect.height) * 100,
  });

  const startGesture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, kind: GestureKind, job: ReadyMadePrintJob) => {
      const container = containerRef.current;
      if (!container) return;
      event.preventDefault();
      event.stopPropagation();
      setSelectedJobId(job.id);
      gestureRef.current = {
        kind,
        jobId: job.id,
        pointerId: event.pointerId,
        rect: container.getBoundingClientRect(),
        startXPercent: job.placement.xPercent,
        startYPercent: job.placement.yPercent,
      };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const job = printJobs.find((entry) => entry.id === gesture.jobId);
      if (!job) return;
      const point = percentFromEvent(event, gesture.rect);

      if (gesture.kind === "move") {
        onPlacementChange(gesture.jobId, {
          xPercent: clamp(point.xPercent, 0, 100),
          yPercent: clamp(point.yPercent, 0, 100),
          widthPercent: job.placement.widthPercent,
        });
        return;
      }

      const widthPercent = Math.min(
        READY_MADE_MAX_ARTWORK_WIDTH_PERCENT,
        Math.max(
          READY_MADE_MIN_ARTWORK_WIDTH_PERCENT,
          Math.abs(point.xPercent - gesture.startXPercent) * 2,
        ),
      );
      onPlacementChange(gesture.jobId, {
        xPercent: gesture.startXPercent,
        yPercent: gesture.startYPercent,
        widthPercent,
      });
    },
    [onPlacementChange, printJobs],
  );

  const endGesture = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (gestureRef.current?.pointerId === event.pointerId) gestureRef.current = null;
  }, []);

  const anyOutOfBounds = jobsForSide.some((job) => isOutOfBounds(job.placement));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-center gap-2">
        {(["front", "back"] as const).map((s) => (
          <button
            key={s}
            type="button"
            data-testid={`side-toggle-${s}`}
            onClick={() => onSideChange(s)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              side === s ? "bg-brand text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
            }`}
          >
            {s === "front" ? "앞면" : "뒷면"} {s === "front" ? frontCount : backCount}곳
          </button>
        ))}
      </div>

      <div
        ref={containerRef}
        className="relative mt-3 h-[52vh] min-h-[360px] w-full touch-none overflow-hidden rounded-2xl bg-stone-50 sm:h-[60vh] lg:h-[70vh]"
        onPointerMove={handlePointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onPointerDown={() => setSelectedJobId(null)}
      >
        <ReadyMadeGarmentImage
          product={product}
          color={color}
          side={side}
          alt={`${product.label} ${side === "front" ? "앞면" : "뒷면"}`}
          className="pointer-events-none h-full w-full select-none p-8"
        />

        <div
          className="pointer-events-none absolute rounded-lg border border-dashed border-brand/25 bg-brand/[0.03]"
          style={{
            left: `${SAFE_ZONE.left}%`,
            top: `${SAFE_ZONE.top}%`,
            right: `${100 - SAFE_ZONE.right}%`,
            bottom: `${100 - SAFE_ZONE.bottom}%`,
          }}
        />

        {designPreviewUrl &&
          jobsForSide.map((job) => {
            const isSelected = job.id === selectedJobId;
            return (
              <div
                key={job.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move"
                style={{
                  left: `${job.placement.xPercent}%`,
                  top: `${job.placement.yPercent}%`,
                  width: `${job.placement.widthPercent}%`,
                  zIndex: isSelected ? 20 : 10,
                }}
                onPointerDown={(event) => startGesture(event, "move", job)}
              >
                <img src={designPreviewUrl} alt="" className="pointer-events-none block w-full select-none drop-shadow" />
                {isSelected && (
                  <>
                    <div className="pointer-events-none absolute inset-0 rounded border-2 border-brand" />
                    <div
                      className="absolute -bottom-2.5 -right-2.5 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-white bg-brand shadow"
                      onPointerDown={(event) => startGesture(event, "resize", job)}
                    />
                    <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 -translate-y-full gap-1">
                      <button
                        type="button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          onDuplicateJob(job.id);
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-stone-500 shadow ring-1 ring-stone-200 hover:text-brand"
                        aria-label="디자인 복제"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      {jobsForSide.length > 1 && (
                        <button
                          type="button"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteJob(job.id);
                            setSelectedJobId(null);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-stone-500 shadow ring-1 ring-stone-200 hover:text-red-500"
                          aria-label="디자인 삭제"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}

        {jobsForSide.length === 0 && (
          <div className="absolute inset-x-0 bottom-4 text-center text-xs font-semibold text-stone-400">
            {designPreviewUrl ? "이 면에는 아직 인쇄 위치가 없어요" : "디자인을 업로드하면 여기에 표시돼요"}
          </div>
        )}
      </div>

      {anyOutOfBounds && (
        <p className="mt-2 text-center text-xs font-bold text-amber-600">인쇄 가능 영역을 벗어났습니다.</p>
      )}
      <p className="mt-2 text-center text-[11px] leading-5 text-stone-400">
        디자인을 드래그해서 위치를, 오른쪽 아래 점을 드래그해서 크기를 조절하세요.
      </p>
    </div>
  );
};
