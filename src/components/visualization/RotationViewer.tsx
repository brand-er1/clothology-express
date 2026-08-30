import { useCallback, useEffect, useRef, useState } from "react";
import { MoveHorizontal, RotateCcw } from "lucide-react";
import type { MultiAngleFrame } from "@/services/multiAngle";

/** Horizontal drag distance (px) needed to advance one angle frame. */
const PX_PER_STEP = 30;
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.2;
const ZOOM_STEP = 0.12;

interface RotationViewerProps {
  /** Angle frames sorted ascending by angle. Empty means only the fallback image is shown. */
  frames: MultiAngleFrame[];
  index: number;
  onIndexChange: (index: number) => void;
  fallbackImageUrl: string;
  altText: string;
  loading?: boolean;
  /** Fired on the first pointer-down of a drag session — use it to lazily kick off frame loading. */
  onDragIntent?: () => void;
  className?: string;
  imgClassName?: string;
  zoomEnabled?: boolean;
  /** Require Ctrl/Cmd+wheel to zoom, so hovering the viewer doesn't trap normal page scrolling. */
  wheelZoomRequiresCtrl?: boolean;
  showAngleBadge?: boolean;
  /** localStorage key remembering that the user already discovered the drag-to-rotate gesture. */
  hintStorageKey?: string;
  hintLabel?: string | null;
  /** Tailwind position classes for the hint block, in case a caller overlays other UI at the bottom. */
  hintPositionClassName?: string;
  /** Tailwind position classes for the small loading spinner badge (avoid clashing with other UI). */
  loadingPositionClassName?: string;
  disabled?: boolean;
}

export const RotationViewer = ({
  frames,
  index,
  onIndexChange,
  fallbackImageUrl,
  altText,
  loading = false,
  onDragIntent,
  className = "",
  imgClassName = "",
  zoomEnabled = true,
  wheelZoomRequiresCtrl = false,
  showAngleBadge = false,
  hintStorageKey,
  hintLabel = "드래그하여 360° 보기",
  hintPositionClassName = "bottom-2",
  loadingPositionClassName = "right-3 top-3",
  disabled = false,
}: RotationViewerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);

  const indexRef = useRef(index);
  indexRef.current = index;
  const frameCountRef = useRef(frames.length);
  frameCountRef.current = frames.length;
  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;
  const onDragIntentRef = useRef(onDragIntent);
  onDragIntentRef.current = onDragIntent;

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragCarryRef = useRef(0);
  const pendingDeltaRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const movedRef = useRef(false);

  const [hintVisible, setHintVisible] = useState(() => {
    if (!hintStorageKey) return true;
    try {
      return window.localStorage.getItem(hintStorageKey) !== "1";
    } catch {
      return true;
    }
  });

  const dismissHint = useCallback(() => {
    setHintVisible(false);
    if (!hintStorageKey) return;
    try {
      window.localStorage.setItem(hintStorageKey, "1");
    } catch {
      /* private mode / blocked storage — hint just won't persist across visits */
    }
  }, [hintStorageKey]);

  // Converts accumulated drag distance into whole angle steps, applied at most once per animation
  // frame so bursts of pointermove events never trigger more than one React state update per tick.
  const applyCarry = useCallback(() => {
    const frameCount = frameCountRef.current;
    if (frameCount < 2) return;
    const steps = Math.trunc(dragCarryRef.current / PX_PER_STEP);
    if (steps === 0) return;
    dragCarryRef.current -= steps * PX_PER_STEP;
    const next = (((indexRef.current - steps) % frameCount) + frameCount) % frameCount;
    indexRef.current = next;
    onIndexChangeRef.current(next);
  }, []);

  const flushFrame = useCallback(() => {
    rafRef.current = null;
    if (pendingDeltaRef.current !== 0) {
      dragCarryRef.current += pendingDeltaRef.current;
      pendingDeltaRef.current = 0;
      applyCarry();
    }
  }, [applyCarry]);

  const scheduleFrame = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(flushFrame);
  }, [flushFrame]);

  // If the user started dragging before the angle frames finished loading, the carried distance is
  // preserved and applied the instant frames become available — the gesture never feels "lost".
  useEffect(() => {
    if (frames.length > 1) applyCarry();
  }, [frames.length, applyCarry]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!zoomEnabled) return;
    const el = containerRef.current;
    if (!el) return;
    const handler = (event: WheelEvent) => {
      if (wheelZoomRequiresCtrl && !event.ctrlKey) return;
      event.preventDefault();
      const direction = event.deltaY > 0 ? -1 : 1;
      setZoom((current) =>
        Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(current + direction * ZOOM_STEP).toFixed(3))),
      );
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [zoomEnabled, wheelZoomRequiresCtrl]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    // Only the primary mouse button drives rotation, so right-click still opens the context menu.
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.pointerType !== "touch") event.preventDefault();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* some browsers reject capture for a pointer id they consider already inactive — safe to ignore */
    }
    onDragIntentRef.current?.();

    if (pointers.current.size === 2 && zoomEnabled) {
      const [a, b] = [...pointers.current.values()];
      pinchRef.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    } else if (pointers.current.size === 1) {
      dragCarryRef.current = 0;
      pendingDeltaRef.current = 0;
      movedRef.current = false;
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(event.pointerId);
    if (!prev) return;
    const current = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, current);

    if (pointers.current.size === 2 && zoomEnabled && pinchRef.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const ratio = distance / (pinchRef.current.distance || distance);
      setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchRef.current.zoom * ratio)));
      return;
    }

    if (pointers.current.size !== 1 || disabled) return;
    const deltaX = current.x - prev.x;
    const deltaY = current.y - prev.y;
    if (deltaX === 0 && deltaY === 0) return;
    if (!movedRef.current && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
      movedRef.current = true;
      dismissHint();
    }
    pendingDeltaRef.current += deltaX;
    scheduleFrame();
  };

  const releasePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
    if (pointers.current.size === 0) movedRef.current = false;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const frameCount = frames.length;
    if (frameCount < 2) return;
    if (event.key === "ArrowLeft") onIndexChange((index - 1 + frameCount) % frameCount);
    if (event.key === "ArrowRight") onIndexChange((index + 1) % frameCount);
  };

  const currentFrame = frames.length ? frames[((index % frames.length) + frames.length) % frames.length] : null;
  const imageUrl = currentFrame?.imageUrl || fallbackImageUrl;

  return (
    <div
      ref={containerRef}
      role={frames.length > 1 ? "application" : undefined}
      aria-label={frames.length > 1 ? `${altText}. 좌우 드래그 또는 방향키로 360도 회전` : undefined}
      tabIndex={frames.length > 1 ? 0 : undefined}
      className={`relative touch-pan-y select-none overflow-hidden outline-none [-webkit-user-drag:none] ${
        disabled ? "" : "cursor-grab active:cursor-grabbing"
      } ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
      onKeyDown={onKeyDown}
      onDoubleClick={zoomEnabled ? () => setZoom(1) : undefined}
    >
      <div className="h-full w-full" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}>
        <img
          key={imageUrl}
          src={imageUrl}
          alt={altText}
          draggable={false}
          className={`pointer-events-none h-full w-full select-none ${imgClassName}`}
        />
      </div>

      {showAngleBadge && currentFrame && (
        <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-stone-950/85 px-2.5 py-1 text-[10px] font-black text-white">
          {currentFrame.label || `${currentFrame.angle}°`}
        </span>
      )}

      {loading && (
        <div
          className={`pointer-events-none absolute z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow ${loadingPositionClassName}`}
        >
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" />
        </div>
      )}

      {zoomEnabled && zoom > 1.02 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setZoom(1);
          }}
          className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-full bg-stone-950/85 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-lg"
        >
          <RotateCcw className="h-3 w-3" /> {Math.round(zoom * 100)}%
        </button>
      )}

      {hintLabel && (
        <div
          className={`pointer-events-none absolute inset-x-0 z-10 flex flex-col items-center gap-1 ${hintPositionClassName}`}
        >
          {hintVisible && (
            <span className="flex animate-swipe-hint items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-stone-500 shadow">
              <MoveHorizontal className="h-3.5 w-3.5" />
            </span>
          )}
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium text-stone-400 backdrop-blur-sm">
            {hintLabel} ↔
          </span>
        </div>
      )}
    </div>
  );
};
