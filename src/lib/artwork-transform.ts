/**
 * Geometry shared by every on-garment artwork editor (custom clothing's `ModifyImageStep` and the
 * ready-made `GarmentCanvas`) and by the code that bakes the result into a final image.
 *
 * Every transform field is optional so placements saved before rotation/flip existed keep loading
 * unchanged: a missing field always means "no rotation / not flipped / original proportions".
 */
export interface ArtworkTransform {
  /** Clockwise rotation around the artwork's own center, in degrees, normalized to [0, 360). */
  rotation?: number;
  /** Mirrors the artwork left↔right. */
  flipX?: boolean;
  /** Mirrors the artwork top↔bottom. */
  flipY?: boolean;
  /** Vertical stretch relative to the image's natural aspect ratio (1 = original proportions).
   * Only set when the customer resizes with "비율 유지" turned off. */
  stretchY?: number;
}

export const ROTATION_STEP_OPTIONS = [15, 30, 45, 90] as const;
export const MIN_STRETCH_Y = 0.2;
export const MAX_STRETCH_Y = 5;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

/** Wraps any angle (negative, > 360, fractional) into [0, 360), rounded to 0.1°. */
export const normalizeRotation = (degrees: number) => {
  if (!Number.isFinite(degrees)) return 0;
  const wrapped = ((degrees % 360) + 360) % 360;
  const rounded = Math.round(wrapped * 10) / 10;
  return rounded >= 360 ? 0 : rounded;
};

export const resolveRotation = (transform?: ArtworkTransform | null) =>
  normalizeRotation(transform?.rotation ?? 0);

export const resolveStretchY = (transform?: ArtworkTransform | null) => {
  const value = transform?.stretchY;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? clamp(value, MIN_STRETCH_Y, MAX_STRETCH_Y)
    : 1;
};

/**
 * Snapping used while dragging the rotation handle: holding Shift snaps to 15° steps, otherwise
 * the angle "sticks" to the nearest multiple of 45° when within `magnet` degrees so 0/90/180/270
 * are easy to hit by hand.
 */
export const snapRotation = (
  degrees: number,
  { stepLock = false, magnet = 4 }: { stepLock?: boolean; magnet?: number } = {},
) => {
  if (stepLock) return normalizeRotation(Math.round(degrees / 15) * 15);
  const nearest = Math.round(degrees / 45) * 45;
  return normalizeRotation(Math.abs(degrees - nearest) <= magnet ? nearest : degrees);
};

/** Angle of `point` around `center` in screen space: 0° = straight up, growing clockwise. */
export const angleAroundCenter = (
  center: { x: number; y: number },
  point: { x: number; y: number },
) => (Math.atan2(point.x - center.x, -(point.y - center.y)) * 180) / Math.PI;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export const rotateVector = (x: number, y: number, degrees: number) => {
  const radians = toRadians(degrees);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
};

/** Half width/height of the axis-aligned box that encloses a rotated `width`×`height` rect. */
export const rotatedHalfExtents = (width: number, height: number, degrees: number) => {
  const radians = toRadians(degrees);
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return {
    halfWidth: (width * cos + height * sin) / 2,
    halfHeight: (width * sin + height * cos) / 2,
  };
};

export type ResizeCorner = "nw" | "ne" | "sw" | "se";

const cornerSigns: Record<ResizeCorner, { x: 1 | -1; y: 1 | -1 }> = {
  nw: { x: -1, y: -1 },
  ne: { x: 1, y: -1 },
  sw: { x: -1, y: 1 },
  se: { x: 1, y: 1 },
};

/** Position (in the same pixel space as `center`) of one corner of a rotated rect. */
export const rotatedCornerPosition = (
  center: { x: number; y: number },
  width: number,
  height: number,
  degrees: number,
  corner: ResizeCorner,
) => {
  const sign = cornerSigns[corner];
  const offset = rotateVector((sign.x * width) / 2, (sign.y * height) / 2, degrees);
  return { x: center.x + offset.x, y: center.y + offset.y };
};

const oppositeCorner: Record<ResizeCorner, ResizeCorner> = {
  nw: "se",
  ne: "sw",
  sw: "ne",
  se: "nw",
};

/**
 * Canva-style corner resize for a rotated rect: the corner opposite the dragged one stays pinned
 * in place, and the pointer is projected into the artwork's own (rotated) axes so dragging works
 * the same at 0° and at 45°. All inputs/outputs share one pixel space (the editor stage).
 *
 * With `keepAspect`, the pointer is projected onto the original diagonal so width and height scale
 * together; otherwise each axis follows the pointer independently.
 */
export const resizeFromCorner = ({
  corner,
  pointer,
  startCenter,
  startWidth,
  startHeight,
  rotation,
  keepAspect,
  minWidth,
  maxWidth,
  minHeight = 4,
}: {
  corner: ResizeCorner;
  pointer: { x: number; y: number };
  startCenter: { x: number; y: number };
  startWidth: number;
  startHeight: number;
  rotation: number;
  keepAspect: boolean;
  minWidth: number;
  maxWidth: number;
  minHeight?: number;
}) => {
  const sign = cornerSigns[corner];
  const anchor = rotatedCornerPosition(
    startCenter,
    startWidth,
    startHeight,
    rotation,
    oppositeCorner[corner],
  );
  const local = rotateVector(pointer.x - anchor.x, pointer.y - anchor.y, -rotation);
  const alongX = local.x * sign.x;
  const alongY = local.y * sign.y;

  let width: number;
  let height: number;
  if (keepAspect || startWidth <= 0 || startHeight <= 0) {
    const diagonalLengthSquared = startWidth * startWidth + startHeight * startHeight;
    const scale =
      diagonalLengthSquared > 0
        ? (alongX * startWidth + alongY * startHeight) / diagonalLengthSquared
        : 1;
    const minScale = Math.max(minWidth / startWidth, minHeight / startHeight);
    const maxScale = maxWidth / startWidth;
    const clampedScale = clamp(scale, minScale, Math.max(minScale, maxScale));
    width = startWidth * clampedScale;
    height = startHeight * clampedScale;
  } else {
    width = clamp(alongX, minWidth, maxWidth);
    height = Math.max(minHeight, alongY);
  }

  const centerOffset = rotateVector((sign.x * width) / 2, (sign.y * height) / 2, rotation);
  return {
    width,
    height,
    center: { x: anchor.x + centerOffset.x, y: anchor.y + centerOffset.y },
  };
};

/** CSS transform for the positioned (centered) artwork box. */
export const artworkBoxTransform = (transform?: ArtworkTransform | null) => {
  const rotation = resolveRotation(transform);
  return rotation ? `translate(-50%, -50%) rotate(${rotation}deg)` : "translate(-50%, -50%)";
};

/** CSS transform for the image inside the box — flips mirror the pixels, not the handles. */
export const artworkContentTransform = (transform?: ArtworkTransform | null) => {
  if (!transform?.flipX && !transform?.flipY) return undefined;
  return `scale(${transform.flipX ? -1 : 1}, ${transform.flipY ? -1 : 1})`;
};

/**
 * Draws `image` into `context` centered at (`centerX`, `centerY`) with the given size, rotation
 * and flips — the canvas twin of `artworkBoxTransform` + `artworkContentTransform`, so the baked
 * image matches the editor preview exactly.
 */
export const drawTransformedArtwork = (
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  {
    centerX,
    centerY,
    width,
    height,
  }: { centerX: number; centerY: number; width: number; height: number },
  transform?: ArtworkTransform | null,
) => {
  context.save();
  context.translate(centerX, centerY);
  const rotation = resolveRotation(transform);
  if (rotation) context.rotate(toRadians(rotation));
  if (transform?.flipX || transform?.flipY) {
    context.scale(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1);
  }
  context.drawImage(image, -width / 2, -height / 2, width, height);
  context.restore();
};

/** Short Korean description of the non-default transform fields, e.g. "회전 45° · 좌우 반전". */
export const describeArtworkTransform = (transform?: ArtworkTransform | null) => {
  const parts: string[] = [];
  const rotation = resolveRotation(transform);
  if (rotation) parts.push(`회전 ${Number.isInteger(rotation) ? rotation : rotation.toFixed(1)}°`);
  if (transform?.flipX) parts.push("좌우 반전");
  if (transform?.flipY) parts.push("상하 반전");
  if (resolveStretchY(transform) !== 1) parts.push("비율 변경");
  return parts.join(" · ");
};

/** Moves the item at `index` one step toward the front (+1) or back (-1) of a paint-order list. */
export const moveLayer = <T>(items: T[], index: number, direction: 1 | -1): T[] => {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};
