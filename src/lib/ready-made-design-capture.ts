import { toPng } from "html-to-image";
import { READY_MADE_PRINT_LOCATION_OPTIONS, type ReadyMadeGarmentSide } from "@/data/ready-made-pricing-config";
import type { ReadyMadeOrderDesignJob, ReadyMadePrintJob } from "@/types/readyMadeOrder";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export interface CapturedSidePreview {
  side: ReadyMadeGarmentSide;
  /** PNG, base64-encoded, no `data:` prefix. */
  base64: string;
  jobs: ReadyMadeOrderDesignJob[];
}

/**
 * Captures a clean WYSIWYG PNG of the customer's own `GarmentCanvas` DOM node for every garment
 * side that has at least one print job, and measures each job's real rendered position/size from
 * that same DOM via `getBoundingClientRect`. Positions are read from the pixels actually on
 * screen rather than recomputed from the stored percentages — the two would normally agree, but
 * measuring the real layout is what guarantees they can never quietly drift apart (e.g. from a
 * future CSS tweak to the canvas), which is exactly the "위치가 달라지는" failure this exists to
 * rule out.
 *
 * `getStageNode` must return whichever `GarmentCanvas` container is actually visible/laid out at
 * call time (the caller renders both a desktop and mobile instance, only one of which has a
 * non-zero size at any given viewport) with `captureMode` already switched on, so the DOM has no
 * selection borders, resize handles, or guide overlays in it.
 */
export const captureReadyMadeDesignPreviews = async ({
  printJobs,
  currentSide,
  setSide,
  getStageNode,
}: {
  printJobs: ReadyMadePrintJob[];
  currentSide: ReadyMadeGarmentSide;
  setSide: (side: ReadyMadeGarmentSide) => void;
  getStageNode: () => HTMLElement | null;
}): Promise<CapturedSidePreview[]> => {
  const sidesNeeded = (["front", "back"] as const).filter((side) =>
    printJobs.some((job) => job.side === side),
  );

  const results: CapturedSidePreview[] = [];
  let lastRenderedSide = currentSide;

  try {
    for (const side of sidesNeeded) {
      if (side !== lastRenderedSide) {
        setSide(side);
        lastRenderedSide = side;
        // Give React a moment to re-render and the garment mockup (including a first-time
        // color recolor, which runs on a canvas asynchronously) to settle before we snapshot it.
        await nextFrame();
        await nextFrame();
        await wait(300);
      } else {
        await nextFrame();
      }

      const node = getStageNode();
      if (!node || node.clientWidth === 0 || node.clientHeight === 0) continue;

      const containerRect = node.getBoundingClientRect();
      const jobs: ReadyMadeOrderDesignJob[] = printJobs
        .filter((job) => job.side === side)
        .map((job) => {
          const locationLabel =
            READY_MADE_PRINT_LOCATION_OPTIONS.find((option) => option.key === job.location)?.label ||
            job.location;
          const element = node.querySelector<HTMLElement>(`[data-job-id="${job.id}"]`);
          const rect = element?.getBoundingClientRect();

          if (!rect || containerRect.width === 0 || containerRect.height === 0) {
            // Falls back to the stored percentage placement if the element can't be measured
            // (e.g. hidden) — still normalized 0-1, just not DOM-measured.
            return {
              id: job.id,
              location: job.location,
              locationLabel,
              side,
              x: job.placement.xPercent / 100,
              y: job.placement.yPercent / 100,
              width: job.placement.widthPercent / 100,
              height: job.placement.widthPercent / 100,
              scale: 1,
              rotation: 0,
            };
          }

          return {
            id: job.id,
            location: job.location,
            locationLabel,
            side,
            x: (rect.left + rect.width / 2 - containerRect.left) / containerRect.width,
            y: (rect.top + rect.height / 2 - containerRect.top) / containerRect.height,
            width: rect.width / containerRect.width,
            height: rect.height / containerRect.height,
            scale: 1,
            rotation: 0,
          };
        });

      const dataUrl = await toPng(node, { pixelRatio: 2, skipFonts: true });
      const base64 = dataUrl.split(",")[1];
      if (base64) results.push({ side, base64, jobs });
    }
  } finally {
    if (lastRenderedSide !== currentSide) setSide(currentSide);
  }

  return results;
};
