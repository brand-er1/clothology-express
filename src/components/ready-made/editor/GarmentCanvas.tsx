import { useCallback, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { ReadyMadeGarmentImage } from "@/components/ready-made/ReadyMadeGarmentImage";
import { ArtworkEditToolbar } from "@/components/artwork-editor/ArtworkEditToolbar";
import { ArtworkTransformBox } from "@/components/artwork-editor/ArtworkTransformBox";
import { normalizeRotation, resolveRotation, resolveStretchY } from "@/lib/artwork-transform";
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
  /** Returns the copy's id (when known) so it becomes the selection. */
  onDuplicateJob: (jobId: string) => string | void;
  onDeleteJob: (jobId: string) => void;
  /** Paint order: +1 brings the job one step forward, -1 sends it one step back. */
  onMoveJob?: (jobId: string, direction: 1 | -1) => void;
  /** Total jobs across both sides — the last remaining job can't be deleted. */
  totalJobCount?: number;
  /** Downloads the finished design exactly as shown (rotation included). */
  onDownload?: () => void;
  isDownloading?: boolean;
  /** True only for the brief moment a final-design preview image is being captured from this
   * exact DOM node — hides every editing affordance (safe-zone guide, selection border, resize/
   * rotation handles, edit toolbar, duplicate/delete buttons, empty-state hint) so the capture is a clean product shot,
   * not a screenshot of the editor UI. Never true during normal editing. */
  captureMode?: boolean;
  /** Exposes the captured canvas container node to a parent that needs to snapshot it (see
   * `captureReadyMadeDesignPreviews`). Purely additive — normal editing never sets this. */
  stageRef?: React.Ref<HTMLDivElement>;
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
  onMoveJob,
  totalJobCount,
  onDownload,
  isDownloading = false,
  captureMode = false,
  stageRef,
}: GarmentCanvasProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (typeof stageRef === "function") stageRef(node);
      else if (stageRef && "current" in stageRef) {
        (stageRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [stageRef],
  );
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [keepAspect, setKeepAspect] = useState(true);

  const jobsForSide = printJobs.filter((job) => job.side === side);
  const frontCount = printJobs.filter((job) => job.side === "front").length;
  const backCount = printJobs.filter((job) => job.side === "back").length;
  const selectedJob = jobsForSide.find((job) => job.id === selectedJobId) ?? null;
  const selectedIndex = selectedJob ? jobsForSide.indexOf(selectedJob) : -1;

  const updatePlacement = (job: ReadyMadePrintJob, patch: Partial<ReadyMadeArtworkPlacement>) =>
    onPlacementChange(job.id, { ...job.placement, ...patch });

  const anyOutOfBounds = jobsForSide.some((job) => isOutOfBounds(job.placement));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-center gap-2">
        {(["front", "back"] as const).map((s) => (
          <button
            key={s}
            type="button"
            data-testid={`side-toggle-${s}`}
            onClick={() => {
              onSideChange(s);
              setSelectedJobId(null);
            }}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              side === s ? "bg-brand text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
            }`}
          >
            {s === "front" ? "앞면" : "뒷면"} {s === "front" ? frontCount : backCount}곳
          </button>
        ))}
      </div>

      <div
        ref={setContainerRef}
        data-testid="garment-stage"
        className="relative mt-3 h-[52vh] min-h-[360px] w-full touch-none select-none overflow-hidden rounded-lg bg-stone-50 sm:h-[60vh] lg:h-[70vh]"
        onPointerDown={() => setSelectedJobId(null)}
      >
        <ReadyMadeGarmentImage
          product={product}
          color={color}
          side={side}
          alt={`${product.label} ${side === "front" ? "앞면" : "뒷면"}`}
          className="pointer-events-none h-full w-full select-none p-8"
        />

        {!captureMode && (
          <div
            className="pointer-events-none absolute rounded-lg border border-dashed border-brand/25 bg-brand/[0.03]"
            style={{
              left: `${SAFE_ZONE.left}%`,
              top: `${SAFE_ZONE.top}%`,
              right: `${100 - SAFE_ZONE.right}%`,
              bottom: `${100 - SAFE_ZONE.bottom}%`,
            }}
          />
        )}

        {designPreviewUrl &&
          jobsForSide.map((job, index) => {
            const isSelected = !captureMode && job.id === selectedJobId;
            return (
              <ArtworkTransformBox
                key={job.id}
                stageRef={containerRef}
                src={designPreviewUrl}
                xPercent={job.placement.xPercent}
                yPercent={job.placement.yPercent}
                widthPercent={job.placement.widthPercent}
                transform={job.placement}
                selected={isSelected}
                interactive={!captureMode}
                keepAspect={keepAspect}
                minWidthPercent={READY_MADE_MIN_ARTWORK_WIDTH_PERCENT}
                maxWidthPercent={READY_MADE_MAX_ARTWORK_WIDTH_PERCENT}
                // Paint order follows the job list; the selected one is lifted so its handles
                // are never hidden under another artwork.
                zIndex={isSelected ? 100 : 10 + index}
                ariaLabel={`인쇄 디자인 ${index + 1} 선택`}
                imageClassName="drop-shadow"
                boxAttributes={{ "data-job-id": job.id }}
                onSelect={() => setSelectedJobId(job.id)}
                onChange={(geometry) =>
                  onPlacementChange(job.id, {
                    ...job.placement,
                    xPercent: geometry.xPercent,
                    yPercent: geometry.yPercent,
                    widthPercent: geometry.widthPercent,
                    rotation: geometry.rotation,
                    ...(geometry.stretchY !== 1 || job.placement.stretchY !== undefined
                      ? { stretchY: geometry.stretchY }
                      : {}),
                  })
                }
              />
            );
          })}

        {!captureMode && jobsForSide.length === 0 && (
          <div className="absolute inset-x-0 bottom-4 text-center text-xs font-semibold text-stone-400">
            {designPreviewUrl ? "이 면에는 아직 인쇄 위치가 없어요" : "디자인을 업로드하면 여기에 표시돼요"}
          </div>
        )}
      </div>

      {anyOutOfBounds && (
        <p className="mt-2 text-center text-xs font-bold text-amber-600">인쇄 가능 영역을 벗어났습니다.</p>
      )}

      {!captureMode && selectedJob && designPreviewUrl ? (
        <ArtworkEditToolbar
          className="mt-3"
          rotation={resolveRotation(selectedJob.placement)}
          onRotationChange={(rotation) => updatePlacement(selectedJob, { rotation: normalizeRotation(rotation) })}
          widthPercent={selectedJob.placement.widthPercent}
          minWidthPercent={READY_MADE_MIN_ARTWORK_WIDTH_PERCENT}
          maxWidthPercent={READY_MADE_MAX_ARTWORK_WIDTH_PERCENT}
          onWidthChange={(widthPercent) => updatePlacement(selectedJob, { widthPercent })}
          keepAspect={keepAspect}
          onKeepAspectChange={setKeepAspect}
          onResetProportions={
            resolveStretchY(selectedJob.placement) !== 1
              ? () => updatePlacement(selectedJob, { stretchY: 1 })
              : undefined
          }
          flipX={Boolean(selectedJob.placement.flipX)}
          flipY={Boolean(selectedJob.placement.flipY)}
          onToggleFlip={(axis) =>
            updatePlacement(
              selectedJob,
              axis === "x" ? { flipX: !selectedJob.placement.flipX } : { flipY: !selectedJob.placement.flipY },
            )
          }
          onBringForward={onMoveJob ? () => onMoveJob(selectedJob.id, 1) : undefined}
          onSendBackward={onMoveJob ? () => onMoveJob(selectedJob.id, -1) : undefined}
          canBringForward={selectedIndex < jobsForSide.length - 1}
          canSendBackward={selectedIndex > 0}
          onDuplicate={() => {
            const duplicateId = onDuplicateJob(selectedJob.id);
            if (duplicateId) setSelectedJobId(duplicateId);
          }}
          onDelete={() => {
            onDeleteJob(selectedJob.id);
            setSelectedJobId(null);
          }}
          canDelete={(totalJobCount ?? printJobs.length) > 1}
        />
      ) : (
        !captureMode && (
          <p className="mt-2 text-center text-[11px] leading-5 text-stone-400">
            디자인을 눌러 선택하면 드래그로 이동, 모서리 점으로 크기, 위쪽 핸들로 회전할 수 있어요.
            <span className="hidden sm:inline"> Shift를 누른 채 회전하면 15° 단위로 맞춰져요.</span>
            <span className="sm:hidden"> 두 손가락으로 벌리거나 돌려도 돼요.</span>
          </p>
        )
      )}

      {!captureMode && onDownload && designPreviewUrl && (
        <button
          type="button"
          data-testid="download-design"
          onClick={onDownload}
          disabled={isDownloading}
          className="mx-auto mt-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 text-xs font-bold text-stone-600 transition hover:border-brand/40 hover:text-brand disabled:opacity-50"
        >
          {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          시안 이미지 다운로드
        </button>
      )}
    </div>
  );
};
