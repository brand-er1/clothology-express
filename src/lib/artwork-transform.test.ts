import { describe, expect, it } from "vitest";
import {
  angleAroundCenter,
  artworkBoxTransform,
  artworkContentTransform,
  describeArtworkTransform,
  drawTransformedArtwork,
  moveLayer,
  normalizeRotation,
  resizeFromCorner,
  resolveStretchY,
  rotatedCornerPosition,
  rotatedHalfExtents,
  rotateVector,
  snapRotation,
} from "./artwork-transform";

const close = (actual: number, expected: number, digits = 6) =>
  expect(actual).toBeCloseTo(expected, digits);

describe("normalizeRotation", () => {
  it("wraps any angle into [0, 360)", () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation(-45)).toBe(315);
    expect(normalizeRotation(765)).toBe(45);
    expect(normalizeRotation(359.96)).toBe(0);
    expect(normalizeRotation(Number.NaN)).toBe(0);
  });
});

describe("snapRotation", () => {
  it("sticks to multiples of 45° within the magnet range", () => {
    expect(snapRotation(87)).toBe(90);
    expect(snapRotation(-2)).toBe(0);
    expect(snapRotation(60)).toBe(60);
  });

  it("locks to 15° steps when requested", () => {
    expect(snapRotation(37, { stepLock: true })).toBe(30);
    expect(snapRotation(38, { stepLock: true })).toBe(45);
  });
});

describe("angleAroundCenter", () => {
  it("measures clockwise from straight up", () => {
    const center = { x: 0, y: 0 };
    close(angleAroundCenter(center, { x: 0, y: -10 }), 0);
    close(angleAroundCenter(center, { x: 10, y: 0 }), 90);
    close(angleAroundCenter(center, { x: 0, y: 10 }), 180);
    close(normalizeRotation(angleAroundCenter(center, { x: -10, y: 0 })), 270);
  });
});

describe("rotatedHalfExtents", () => {
  it("grows the bounding box of a rotated square", () => {
    const { halfWidth, halfHeight } = rotatedHalfExtents(100, 100, 45);
    close(halfWidth, 50 * Math.SQRT2);
    close(halfHeight, 50 * Math.SQRT2);
  });
});

describe("resizeFromCorner", () => {
  const base = {
    startCenter: { x: 100, y: 100 },
    startWidth: 40,
    startHeight: 20,
    minWidth: 1,
    maxWidth: 1000,
  };

  it("keeps the opposite corner pinned without rotation", () => {
    const result = resizeFromCorner({
      ...base,
      corner: "se",
      pointer: { x: 160, y: 130 },
      rotation: 0,
      keepAspect: true,
    });
    // Anchor (nw) stays at (80, 90); diagonal projection of (80, 40) on (40, 20) = scale 2.
    close(result.width, 80);
    close(result.height, 40);
    close(result.center.x - result.width / 2, 80);
    close(result.center.y - result.height / 2, 90);
  });

  it("works in the artwork's own axes when rotated 45°", () => {
    const rotation = 45;
    const anchor = rotatedCornerPosition(base.startCenter, 40, 20, rotation, "nw");
    // Where the dragged (se) corner lands when the rect is exactly doubled: the full diagonal
    // (80, 40) rotated into screen space, measured from the pinned corner.
    const diagonal = rotateVector(80, 40, rotation);
    const target = { x: anchor.x + diagonal.x, y: anchor.y + diagonal.y };
    const result = resizeFromCorner({
      ...base,
      corner: "se",
      pointer: target,
      rotation,
      keepAspect: true,
    });
    close(result.width, 80);
    close(result.height, 40);
    const pinned = rotatedCornerPosition(result.center, result.width, result.height, rotation, "nw");
    close(pinned.x, anchor.x);
    close(pinned.y, anchor.y);
  });

  it("lets each axis move freely when the aspect ratio is unlocked", () => {
    const result = resizeFromCorner({
      ...base,
      corner: "se",
      pointer: { x: 140, y: 150 },
      rotation: 0,
      keepAspect: false,
    });
    close(result.width, 60);
    close(result.height, 60);
  });

  it("respects the width limits", () => {
    const result = resizeFromCorner({
      ...base,
      maxWidth: 50,
      corner: "se",
      pointer: { x: 500, y: 500 },
      rotation: 90,
      keepAspect: true,
    });
    close(result.width, 50);
    close(result.height, 25);
  });
});

describe("css transforms", () => {
  it("only adds rotation and flips when set", () => {
    expect(artworkBoxTransform(undefined)).toBe("translate(-50%, -50%)");
    expect(artworkBoxTransform({ rotation: 45 })).toBe("translate(-50%, -50%) rotate(45deg)");
    expect(artworkContentTransform({})).toBeUndefined();
    expect(artworkContentTransform({ flipX: true })).toBe("scale(-1, 1)");
    expect(artworkContentTransform({ flipX: true, flipY: true })).toBe("scale(-1, -1)");
  });
});

describe("legacy data", () => {
  it("treats missing transform fields as the identity", () => {
    expect(resolveStretchY({})).toBe(1);
    expect(resolveStretchY({ stretchY: 0 })).toBe(1);
    expect(describeArtworkTransform({})).toBe("");
    expect(describeArtworkTransform({ rotation: 45, flipX: true })).toBe("회전 45° · 좌우 반전");
  });
});

describe("moveLayer", () => {
  it("swaps with the neighbour and ignores out-of-range moves", () => {
    expect(moveLayer(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveLayer(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    const items = ["a", "b"];
    expect(moveLayer(items, 1, 1)).toBe(items);
  });
});

describe("drawTransformedArtwork", () => {
  it("rotates and flips around the artwork center, like the CSS preview", () => {
    const calls: Array<[string, ...number[]]> = [];
    const context = {
      save: () => calls.push(["save"]),
      restore: () => calls.push(["restore"]),
      translate: (x: number, y: number) => calls.push(["translate", x, y]),
      rotate: (radians: number) => calls.push(["rotate", radians]),
      scale: (x: number, y: number) => calls.push(["scale", x, y]),
      drawImage: (_image: unknown, x: number, y: number, w: number, h: number) =>
        calls.push(["drawImage", x, y, w, h]),
    } as unknown as CanvasRenderingContext2D;

    drawTransformedArtwork(
      context,
      {} as CanvasImageSource,
      { centerX: 100, centerY: 50, width: 40, height: 20 },
      { rotation: 90, flipX: true },
    );

    expect(calls).toEqual([
      ["save"],
      ["translate", 100, 50],
      ["rotate", Math.PI / 2],
      ["scale", -1, 1],
      ["drawImage", -20, -10, 40, 20],
      ["restore"],
    ]);
  });
});
