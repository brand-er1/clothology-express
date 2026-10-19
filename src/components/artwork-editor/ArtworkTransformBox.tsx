import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import {
  angleAroundCenter,
  artworkContentTransform,
  normalizeRotation,
  resizeFromCorner,
  resolveRotation,
  resolveStretchY,
  rotatedCornerPosition,
  snapRotation,
  type ArtworkTransform,
  type ResizeCorner,
} from "@/lib/artwork-transform";

/** Everything a gesture can change, in the stage's percent space (same units as placements). */
export interface ArtworkBoxGeometry {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  rotation: number;
  stretchY: number;
}

export interface ArtworkBoxSize {
  /** Untransformed (pre-rotation) artwork size in stage pixels. */
  widthPx: number;
  heightPx: number;
  stageWidth: number;
  stageHeight: number;
}

interface ArtworkTransformBoxProps {
  /** The positioned editor stage the percentages are relative to. */
  stageRef: React.RefObject<HTMLElement>;
  src: string;
  alt?: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  transform?: ArtworkTransform;
  selected: boolean;
  /** False renders a plain, non-interactive artwork (e.g. while a clean preview is captured). */
  interactive?: boolean;
  disabled?: boolean;
  keepAspect: boolean;
  minWidthPercent: number;
  maxWidthPercent: number;
  zIndex?: number;
  ariaLabel?: string;
  imageClassName?: string;
  /** Extra attributes for the outer (unrotated) box — e.g. `data-job-id` used by preview capture. */
  boxAttributes?: Record<string, string>;
  onSelect: () => void;
  onChange: (geometry: ArtworkBoxGeometry) => void;
  /** Optional clamp for the center point, given the artwork's real size. Defaults to 0-100%. */
  constrainCenter?: (
    geometry: ArtworkBoxGeometry,
    size: ArtworkBoxSize,
  ) => { xPercent: number; yPercent: number };
}

type Point = { x: number; y: number };

type Gesture =
  | { kind: "move"; pointerId: number; offsetX: number; offsetY: number }
  | {
      kind: "resize";
      pointerId: number;
      corner: ResizeCorner;
      /** Pointer minus the exact corner at grab time, so grabbing a handle off-center never
       * makes the artwork jump on the first move. */
      grabOffset: Point;
      startCenter: Point;
      startWidth: number;
      startHeight: number;
    }
  | { kind: "rotate"; pointerId: number; center: Point; startAngle: number; startRotation: number }
  | {
      kind: "pinch";
      pointerIds: [number, number];
      startDistance: number;
      startAngle: number;
      startMid: Point;
      startXPercent: number;
      startYPercent: number;
      startWidthPercent: number;
      startRotation: number;
    };

const CORNERS: Array<{ corner: ResizeCorner; className: string; baseAngle: number }> = [
  { corner: "nw", className: "-left-3.5 -top-3.5", baseAngle: 135 },
  { corner: "ne", className: "-right-3.5 -top-3.5", baseAngle: 45 },
  { corner: "sw", className: "-bottom-3.5 -left-3.5", baseAngle: 45 },
  { corner: "se", className: "-bottom-3.5 -right-3.5", baseAngle: 135 },
];

const COMPACT_CORNERS: typeof CORNERS = [
  { corner: "se", className: "left-full top-full ml-2.5 mt-2.5", baseAngle: 135 },
];

/** Resize cursor that still points along the diagonal after the artwork is rotated. */
const cursorForAngle = (degrees: number) => {
  const angle = ((degrees % 180) + 180) % 180;
  if (angle < 22.5 || angle >= 157.5) return "ew-resize";
  if (angle < 67.5) return "nesw-resize";
  if (angle < 112.5) return "ns-resize";
  return "nwse-resize";
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * One artwork on an editor stage, with Canva-style editing: drag to move, corner handles to
 * resize (opposite corner stays put, works while rotated), a top handle to rotate around the
 * center, and a two-finger pinch on touch screens to scale + rotate at once.
 *
 * All pointer tracking happens on `window` while a gesture is active, so mouse, pen and touch
 * behave identically and a fast drag never "drops" the artwork when the pointer leaves it.
 */
export const ArtworkTransformBox = ({
  stageRef,
  src,
  alt = "",
  xPercent,
  yPercent,
  widthPercent,
  transform,
  selected,
  interactive = true,
  disabled = false,
  keepAspect,
  minWidthPercent,
  maxWidthPercent,
  zIndex,
  ariaLabel,
  imageClassName = "",
  boxAttributes,
  onSelect,
  onChange,
  constrainCenter,
}: ArtworkTransformBoxProps) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const detachRef = useRef<(() => void) | null>(null);
  const [naturalAspect, setNaturalAspect] = useState<number | null>(null);
  const [activeKind, setActiveKind] = useState<Gesture["kind"] | null>(null);

  const rotation = resolveRotation(transform);
  const stretchY = resolveStretchY(transform);

  // Window listeners outlive a render, so they read the latest props through this ref.
  const latest = useRef({
    xPercent,
    yPercent,
    widthPercent,
    rotation,
    stretchY,
    keepAspect,
    minWidthPercent,
    maxWidthPercent,
    naturalAspect,
    onChange,
    constrainCenter,
  });
  latest.current = {
    xPercent,
    yPercent,
    widthPercent,
    rotation,
    stretchY,
    keepAspect,
    minWidthPercent,
    maxWidthPercent,
    naturalAspect,
    onChange,
    constrainCenter,
  };

  const stageRect = () => stageRef.current?.getBoundingClientRect() ?? null;

  const emit = useCallback(
    (geometry: ArtworkBoxGeometry) => {
      const props = latest.current;
      const rect = stageRect();
      const box = boxRef.current;
      let { xPercent: nextX, yPercent: nextY } = geometry;
      if (rect && box && props.constrainCenter) {
        const widthPx = (geometry.widthPercent / 100) * rect.width;
        const aspect = props.naturalAspect ?? box.offsetHeight / Math.max(1, box.offsetWidth);
        const constrained = props.constrainCenter(geometry, {
          widthPx,
          heightPx: widthPx * aspect * geometry.stretchY,
          stageWidth: rect.width,
          stageHeight: rect.height,
        });
        nextX = constrained.xPercent;
        nextY = constrained.yPercent;
      } else {
        nextX = clamp(nextX, 0, 100);
        nextY = clamp(nextY, 0, 100);
      }
      props.onChange({ ...geometry, xPercent: nextX, yPercent: nextY });
    },
    // stageRef is a stable ref object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const currentGeometry = (): ArtworkBoxGeometry => {
    const props = latest.current;
    return {
      xPercent: props.xPercent,
      yPercent: props.yPercent,
      widthPercent: props.widthPercent,
      rotation: props.rotation,
      stretchY: props.stretchY,
    };
  };

  const endGesture = useCallback(() => {
    gestureRef.current = null;
    pointersRef.current.clear();
    detachRef.current?.();
    detachRef.current = null;
    setActiveKind(null);
  }, []);

  useEffect(() => endGesture, [endGesture]);

  const startPinch = (pointerIds: [number, number]) => {
    const first = pointersRef.current.get(pointerIds[0]);
    const second = pointersRef.current.get(pointerIds[1]);
    if (!first || !second) return;
    const props = latest.current;
    gestureRef.current = {
      kind: "pinch",
      pointerIds,
      startDistance: Math.max(1, distance(first, second)),
      startAngle: angleAroundCenter(first, second),
      startMid: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
      startXPercent: props.xPercent,
      startYPercent: props.yPercent,
      startWidthPercent: props.widthPercent,
      startRotation: props.rotation,
    };
    setActiveKind("pinch");
  };

  const handleWindowPointerMove = useCallback(
    (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture) return;
      if (pointersRef.current.has(event.pointerId)) {
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }
      const rect = stageRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const props = latest.current;
      const geometry = currentGeometry();

      if (gesture.kind === "pinch") {
        if (!gesture.pointerIds.includes(event.pointerId)) return;
        const first = pointersRef.current.get(gesture.pointerIds[0]);
        const second = pointersRef.current.get(gesture.pointerIds[1]);
        if (!first || !second) return;
        event.preventDefault();
        const scale = distance(first, second) / gesture.startDistance;
        const mid = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
        emit({
          ...geometry,
          xPercent: gesture.startXPercent + ((mid.x - gesture.startMid.x) / rect.width) * 100,
          yPercent: gesture.startYPercent + ((mid.y - gesture.startMid.y) / rect.height) * 100,
          widthPercent: clamp(
            gesture.startWidthPercent * scale,
            props.minWidthPercent,
            props.maxWidthPercent,
          ),
          rotation: snapRotation(
            gesture.startRotation + angleAroundCenter(first, second) - gesture.startAngle,
            { magnet: 3 },
          ),
        });
        return;
      }

      if (event.pointerId !== gesture.pointerId) return;
      event.preventDefault();
      const xPx = event.clientX - rect.left;
      const yPx = event.clientY - rect.top;

      if (gesture.kind === "move") {
        emit({
          ...geometry,
          xPercent: (xPx / rect.width) * 100 - gesture.offsetX,
          yPercent: (yPx / rect.height) * 100 - gesture.offsetY,
        });
        return;
      }

      if (gesture.kind === "rotate") {
        const angle = angleAroundCenter(gesture.center, { x: event.clientX, y: event.clientY });
        emit({
          ...geometry,
          rotation: snapRotation(gesture.startRotation + angle - gesture.startAngle, {
            stepLock: event.shiftKey,
          }),
        });
        return;
      }

      const result = resizeFromCorner({
        corner: gesture.corner,
        pointer: { x: xPx - gesture.grabOffset.x, y: yPx - gesture.grabOffset.y },
        startCenter: gesture.startCenter,
        startWidth: gesture.startWidth,
        startHeight: gesture.startHeight,
        rotation: props.rotation,
        keepAspect: props.keepAspect,
        minWidth: (props.minWidthPercent / 100) * rect.width,
        maxWidth: (props.maxWidthPercent / 100) * rect.width,
      });
      const aspect = props.naturalAspect ?? gesture.startHeight / Math.max(1, gesture.startWidth);
      emit({
        ...geometry,
        xPercent: (result.center.x / rect.width) * 100,
        yPercent: (result.center.y / rect.height) * 100,
        widthPercent: (result.width / rect.width) * 100,
        stretchY: props.keepAspect
          ? geometry.stretchY
          : result.height / Math.max(0.001, result.width * aspect),
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [emit],
  );

  const handleWindowPointerEnd = useCallback(
    (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture) return;
      const ended =
        gesture.kind === "pinch"
          ? gesture.pointerIds.includes(event.pointerId)
          : gesture.pointerId === event.pointerId;
      if (ended) endGesture();
    },
    [endGesture],
  );

  // A second finger anywhere on the stage turns a one-finger drag into pinch-zoom + rotate, so
  // tiny logos can still be pinched without both fingers landing on the artwork itself.
  const handleStageSecondPointer = useCallback((event: PointerEvent) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.kind === "pinch" || event.pointerType !== "touch") return;
    if (pointersRef.current.size !== 1) return;
    event.preventDefault();
    event.stopPropagation();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const [firstId] = pointersRef.current.keys();
    startPinch([firstId, event.pointerId]);
  }, []);

  const beginGesture = (event: React.PointerEvent, gesture: Gesture) => {
    gestureRef.current = gesture;
    pointersRef.current.clear();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setActiveKind(gesture.kind);
    detachRef.current?.();
    const stage = stageRef.current;
    window.addEventListener("pointermove", handleWindowPointerMove, { passive: false });
    window.addEventListener("pointerup", handleWindowPointerEnd);
    window.addEventListener("pointercancel", handleWindowPointerEnd);
    stage?.addEventListener("pointerdown", handleStageSecondPointer, { capture: true });
    detachRef.current = () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerEnd);
      window.removeEventListener("pointercancel", handleWindowPointerEnd);
      stage?.removeEventListener("pointerdown", handleStageSecondPointer, { capture: true });
    };
  };

  const claimPointer = (event: React.PointerEvent) => {
    event.stopPropagation();
    onSelect();
    if (disabled || event.button > 0) return false;
    event.preventDefault();
    return true;
  };

  const handleMoveStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!claimPointer(event)) return;
    const rect = stageRect();
    if (!rect) return;
    beginGesture(event, {
      kind: "move",
      pointerId: event.pointerId,
      offsetX: ((event.clientX - rect.left) / rect.width) * 100 - xPercent,
      offsetY: ((event.clientY - rect.top) / rect.height) * 100 - yPercent,
    });
  };

  const handleResizeStart = (event: React.PointerEvent<HTMLElement>, corner: ResizeCorner) => {
    if (!claimPointer(event)) return;
    const rect = stageRect();
    const box = boxRef.current;
    if (!rect || !box) return;
    const startCenter = { x: (xPercent / 100) * rect.width, y: (yPercent / 100) * rect.height };
    // offsetWidth/offsetHeight are the layout size, unaffected by the rotate() transform.
    const startWidth = box.offsetWidth;
    const startHeight = box.offsetHeight;
    const cornerPoint = rotatedCornerPosition(startCenter, startWidth, startHeight, rotation, corner);
    beginGesture(event, {
      kind: "resize",
      pointerId: event.pointerId,
      corner,
      grabOffset: {
        x: event.clientX - rect.left - cornerPoint.x,
        y: event.clientY - rect.top - cornerPoint.y,
      },
      startCenter,
      startWidth,
      startHeight,
    });
  };

  const handleRotateStart = (event: React.PointerEvent<HTMLElement>) => {
    if (!claimPointer(event)) return;
    const rect = stageRect();
    if (!rect) return;
    const center = {
      x: rect.left + (xPercent / 100) * rect.width,
      y: rect.top + (yPercent / 100) * rect.height,
    };
    beginGesture(event, {
      kind: "rotate",
      pointerId: event.pointerId,
      center,
      startAngle: angleAroundCenter(center, { x: event.clientX, y: event.clientY }),
      startRotation: rotation,
    });
  };

  const showControls = interactive && selected;
  // Very small artwork (the custom editor allows widths down to 0.1%) gets a finger-sized grab
  // area and a single, offset resize handle so the handles don't bury the artwork itself.
  const renderedWidth = ((stageRef.current?.clientWidth ?? 0) * widthPercent) / 100;
  const compact = renderedWidth > 0 && renderedWidth < 36;
  const corners = compact ? COMPACT_CORNERS : CORNERS;
  const aspectRatio = naturalAspect ? `1 / ${naturalAspect * stretchY}` : undefined;

  return (
    <div
      ref={boxRef}
      {...boxAttributes}
      className="pointer-events-none absolute"
      style={{
        left: `${xPercent}%`,
        top: `${yPercent}%`,
        width: `${widthPercent}%`,
        aspectRatio,
        transform: "translate(-50%, -50%)",
        zIndex,
      }}
    >
      <div
        className={`${naturalAspect ? "absolute inset-0" : "relative"} ${
          interactive ? "pointer-events-auto touch-none" : ""
        } ${interactive && !disabled ? "cursor-move" : ""}`}
        style={{ transform: rotation ? `rotate(${rotation}deg)` : undefined }}
        onPointerDown={interactive ? handleMoveStart : undefined}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? -1 : undefined}
        aria-label={ariaLabel}
        aria-pressed={interactive ? selected : undefined}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          onLoad={(event) => {
            const image = event.currentTarget;
            if (image.naturalWidth && image.naturalHeight) {
              setNaturalAspect(image.naturalHeight / image.naturalWidth);
            }
          }}
          className={`pointer-events-none select-none ${
            naturalAspect ? "block h-full w-full" : "block h-auto w-full"
          } ${imageClassName}`}
          style={{ transform: artworkContentTransform(transform) }}
        />

        {interactive && compact && (
          <span aria-hidden className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full" />
        )}

        {showControls && (
          <>
            <span className="pointer-events-none absolute inset-0 rounded-[2px] border-2 border-brand shadow-[0_0_0_1px_rgba(255,255,255,0.8)]" />
            <span className="pointer-events-none absolute bottom-full left-1/2 h-5 w-0.5 -translate-x-1/2 bg-brand" />
            <button
              type="button"
              data-handle="rotate"
              aria-label="회전 핸들"
              className="absolute -top-[3.4rem] left-1/2 flex h-9 w-9 -translate-x-1/2 touch-none cursor-grab items-center justify-center active:cursor-grabbing"
              onPointerDown={handleRotateStart}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-brand bg-white text-brand shadow-md">
                <RotateCw className="h-3.5 w-3.5" />
              </span>
            </button>
            {corners.map(({ corner, className, baseAngle }) => (
              <button
                key={corner}
                type="button"
                data-handle={`resize-${corner}`}
                aria-label="크기 조절 핸들"
                className={`absolute flex h-7 w-7 touch-none items-center justify-center ${className}`}
                style={{ cursor: cursorForAngle(baseAngle + rotation) }}
                onPointerDown={(event) => handleResizeStart(event, corner)}
              >
                <span className="h-3.5 w-3.5 rounded-full border-2 border-brand bg-white shadow" />
              </button>
            ))}
          </>
        )}
      </div>

      {showControls && (activeKind === "rotate" || activeKind === "pinch") && (
        <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-3 -translate-x-1/2 whitespace-nowrap rounded-full bg-stone-950/80 px-2.5 py-1 text-[11px] font-bold text-white shadow">
          {normalizeRotation(rotation)}°
        </span>
      )}
    </div>
  );
};
