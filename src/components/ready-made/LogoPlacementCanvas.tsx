import { useCallback, useRef, useState } from "react";
import { getAppPath } from "@/utils/appUrl";
import {
  READY_MADE_MAX_ARTWORK_WIDTH_PERCENT,
  READY_MADE_MIN_ARTWORK_WIDTH_PERCENT,
  type ReadyMadeArtworkPlacement,
  type ReadyMadeGarmentSide,
  type ReadyMadeProductOption,
} from "@/data/ready-made-pricing-config";
import type { ReadyMadePrintJob } from "@/types/readyMadeOrder";

interface LogoPlacementCanvasProps {
  product: ReadyMadeProductOption;
  designPreviewUrl: string | null;
  printJobs: ReadyMadePrintJob[];
  onPlacementChange: (jobId: string, placement: ReadyMadeArtworkPlacement) => void;
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

/**
 * Lets the customer drag/resize their uploaded or AI-generated design directly on a real front/
 * back garment mockup — the visual confirmation of "where does my logo actually go" the discrete
 * location dropdown (still used for the order text and pricing label) can't give on its own.
 * Geometry math mirrors the custom-clothing flow's artwork placement (percent-of-mockup x/y/
 * width), kept as a self-contained implementation here rather than sharing code, so nothing about
 * this new feature can regress that existing, working flow.
 */
export const LogoPlacementCanvas = ({
  product,
  designPreviewUrl,
  printJobs,
  onPlacementChange,
}: LogoPlacementCanvasProps) => {
  const [activeSide, setActiveSide] = useState<ReadyMadeGarmentSide>("front");
  const containerRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);

  const jobsForSide = printJobs.filter((job) => job.side === activeSide);
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
          xPercent: point.xPercent,
          yPercent: point.yPercent,
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

  return (
    <div>
      <div className="flex gap-2">
        {(["front", "back"] as const).map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => setActiveSide(side)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              activeSide === side ? "bg-brand text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
            }`}
          >
            {side === "front" ? "앞면" : "뒷면"} {side === "front" ? frontCount : backCount}곳
          </button>
        ))}
      </div>

      <div
        ref={containerRef}
        className="relative mt-2 aspect-[3/4] w-full touch-none overflow-hidden rounded-xl bg-stone-50"
        onPointerMove={handlePointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
      >
        <img
          src={getAppPath(product.image)}
          alt={`${product.label} ${activeSide === "front" ? "앞면" : "뒷면"}`}
          className="pointer-events-none h-full w-full select-none object-contain p-6"
        />

        {designPreviewUrl &&
          jobsForSide.map((job) => (
            <div
              key={job.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move"
              style={{
                left: `${job.placement.xPercent}%`,
                top: `${job.placement.yPercent}%`,
                width: `${job.placement.widthPercent}%`,
              }}
              onPointerDown={(event) => startGesture(event, "move", job)}
            >
              <img src={designPreviewUrl} alt="" className="pointer-events-none block w-full select-none drop-shadow" />
              <div
                className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-brand shadow"
                onPointerDown={(event) => startGesture(event, "resize", job)}
              />
            </div>
          ))}

        {jobsForSide.length === 0 && (
          <div className="absolute inset-x-0 bottom-3 text-center text-[11px] font-semibold text-stone-400">
            이 면에는 선택된 인쇄 위치가 없어요
          </div>
        )}
      </div>
      <p className="mt-2 text-[11px] leading-5 text-stone-400">
        디자인을 드래그해서 위치를, 오른쪽 아래 점을 드래그해서 크기를 조절해보세요.
      </p>
    </div>
  );
};
