import { useEffect, useState } from "react";
import { READY_MADE_COLOR_SWATCHES, type ReadyMadeColor } from "@/data/ready-made-pricing-config";

/**
 * Recolors a photographed black garment mockup to an arbitrary target color, purely on the
 * client (canvas pixel manipulation — no server round trip, no per-color asset files, and no
 * regenerating a new AI image per color — same base photo, same silhouette, every time).
 *
 * How it works: every base photo in `public/lovable-uploads/ready-made/` is shot on the SAME
 * garment against a near-white studio background. For each pixel we:
 *  1. Derive an alpha mask from luminosity — near-white pixels (background) get alpha ~0,
 *     dark pixels (garment) get alpha ~1.
 *  2. Within the garment mask, measure each pixel's luminosity relative to the garment's own
 *     median, and clamp that deviation to a small, fixed amplitude (`SHADING_AMPLITUDE`). This
 *     keeps just enough of the photo's real fold/shoulder shading to read as an actual garment,
 *     without stretching sensor noise / faint tonal variance in the source photo into visible
 *     washing, pigment blotches, gradients, or fade — the failure mode of a naive min–max
 *     percentile stretch, which amplifies whatever small variance is in the source black fabric
 *     into a large, uneven brightness swing once multiplied against a light target color.
 *  3. Multiply the target color by that bounded shading map, then composite over white using
 *     the alpha mask, so the studio background stays white no matter the target color.
 * The result is a solid, uniform garment color — the same shape, fit, folds, seams, and camera
 * framing as the base photo, with only the color swapped. Good enough for a quote-stage preview,
 * not a substitute for a real product photo per color.
 */

/** How much the photo's real shading may modulate brightness around the flat target color.
 * Kept small and fixed (independent of the target color) so every color reads as solid/uniform
 * rather than washed, pigment-dyed, or gradient-faded. */
const SHADING_AMPLITUDE = 0.1;

/** Blur radius (px) applied to the shading map before it modulates the target color. Camera
 * sensor noise in the source photo is per-pixel; smoothing it out keeps only the smooth,
 * large-scale shading (folds, shoulder highlight, seam shadow) that reads as real fabric instead
 * of visible speckle/grain — another contributor to the "washed" look this module fixes. */
const SHADING_BLUR_RADIUS = 3;

const recolorCache = new Map<string, Promise<string>>();

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;
  const int = Number.parseInt(value, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
};

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다: ${url}`));
    img.src = url;
  });

const percentile = (sortedValues: Float64Array, p: number): number => {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.floor(p * (sortedValues.length - 1))));
  return sortedValues[index];
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Separable box blur, one axis. Edge pixels clamp to the nearest in-bounds sample rather than
 * wrapping or zero-padding, so blurred values near the image border don't get pulled down. */
const boxBlur1D = (
  src: Float32Array,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean,
): Float32Array => {
  const out = new Float32Array(src.length);
  const windowSize = radius * 2 + 1;
  const outerCount = horizontal ? height : width;
  const innerCount = horizontal ? width : height;
  const index = (outer: number, inner: number) => (horizontal ? outer * width + inner : inner * width + outer);

  for (let outer = 0; outer < outerCount; outer += 1) {
    let sum = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const clamped = Math.min(innerCount - 1, Math.max(0, k));
      sum += src[index(outer, clamped)];
    }
    for (let inner = 0; inner < innerCount; inner += 1) {
      out[index(outer, inner)] = sum / windowSize;
      const enter = Math.min(innerCount - 1, Math.max(0, inner + radius + 1));
      const leave = Math.min(innerCount - 1, Math.max(0, inner - radius));
      sum += src[index(outer, enter)] - src[index(outer, leave)];
    }
  }
  return out;
};

const boxBlur2D = (src: Float32Array, width: number, height: number, radius: number): Float32Array =>
  boxBlur1D(boxBlur1D(src, width, height, radius, true), width, height, radius, false);

export const recolorGarmentPhoto = async (imageUrl: string, colorHex: string): Promise<string> => {
  const cacheKey = `${imageUrl}|${colorHex}`;
  const cached = recolorCache.get(cacheKey);
  if (cached) return cached;

  const request = (async () => {
    const img = await loadImage(imageUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("캔버스를 사용할 수 없습니다.");
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const pixelCount = canvas.width * canvas.height;

    const luminosity = new Float32Array(pixelCount);
    const alpha = new Float32Array(pixelCount);
    const garmentMask = new Float32Array(pixelCount);
    const garmentLuminosities: number[] = [];

    for (let i = 0; i < pixelCount; i += 1) {
      const offset = i * 4;
      const l = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
      luminosity[i] = l;
      const a = Math.min(1, Math.max(0, (225 - l) / 200));
      alpha[i] = a;
      if (a > 0.5) {
        garmentMask[i] = 1;
        garmentLuminosities.push(l);
      }
    }

    // Mask-aware blur: average luminosity only over garment pixels in each window, so the
    // near-white background never bleeds into the shading map at the garment's edges (which
    // would otherwise show up as a bright halo right on the silhouette outline).
    const weightedLuminosity = new Float32Array(pixelCount);
    for (let i = 0; i < pixelCount; i += 1) weightedLuminosity[i] = luminosity[i] * garmentMask[i];
    const blurredWeighted = boxBlur2D(weightedLuminosity, canvas.width, canvas.height, SHADING_BLUR_RADIUS);
    const blurredMask = boxBlur2D(garmentMask, canvas.width, canvas.height, SHADING_BLUR_RADIUS);

    const sortedGarmentLuminosities = Float64Array.from(garmentLuminosities.sort((a, b) => a - b));
    // Robust center + spread of the garment's own tonal range (median / semi-interquartile),
    // used only to detect how far a pixel sits from "typical" — never to rescale the range to
    // full contrast, which is what turned subtle fold shadows into visible washing before.
    const median = percentile(sortedGarmentLuminosities, 0.5);
    const p25 = percentile(sortedGarmentLuminosities, 0.25);
    const p75 = percentile(sortedGarmentLuminosities, 0.75);
    const spread = Math.max(8, (p75 - p25) / 2);

    const [targetR, targetG, targetB] = hexToRgb(colorHex);

    for (let i = 0; i < pixelCount; i += 1) {
      const offset = i * 4;
      const smoothedLuminosity = blurredMask[i] > 1e-3 ? blurredWeighted[i] / blurredMask[i] : luminosity[i];
      const deviation = Math.min(1, Math.max(-1, (smoothedLuminosity - median) / spread));
      const shade = 1 + deviation * SHADING_AMPLITUDE;
      const a = alpha[i];
      data[offset] = clamp01((shade * targetR) / 255) * 255 * a + 255 * (1 - a);
      data[offset + 1] = clamp01((shade * targetG) / 255) * 255 * a + 255 * (1 - a);
      data[offset + 2] = clamp01((shade * targetB) / 255) * 255 * a + 255 * (1 - a);
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  })();

  recolorCache.set(cacheKey, request);
  try {
    return await request;
  } catch (error) {
    recolorCache.delete(cacheKey);
    throw error;
  }
};

/**
 * React hook wrapper: returns the recolored image URL for the given base photo + color name,
 * falling back to the original (native black) photo while recoloring is in flight or if the
 * color has no swatch / is the native "블랙". Every base photo is already black, so "블랙" is a
 * free no-op passthrough instead of an unnecessary recolor pass.
 */
export const useRecoloredGarmentImage = (imageUrl: string, colorName: string): string => {
  const swatch = READY_MADE_COLOR_SWATCHES[colorName as ReadyMadeColor];
  const [resolvedUrl, setResolvedUrl] = useState(imageUrl);

  useEffect(() => {
    if (!swatch || colorName === "블랙") {
      setResolvedUrl(imageUrl);
      return;
    }

    let cancelled = false;
    recolorGarmentPhoto(imageUrl, swatch)
      .then((dataUrl) => {
        if (!cancelled) setResolvedUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setResolvedUrl(imageUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [imageUrl, colorName, swatch]);

  return resolvedUrl;
};
