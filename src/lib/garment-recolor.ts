import { useEffect, useState } from "react";
import { READY_MADE_COLOR_SWATCHES, type ReadyMadeColor } from "@/data/ready-made-pricing-config";

/**
 * Recolors a photographed garment mockup to an arbitrary target color, purely on the client
 * (canvas pixel manipulation — no server round trip, no per-color asset files, and no
 * regenerating a new AI image per color — same base photo, same silhouette, every time).
 *
 * How it works: every base photo is shot on the SAME garment against a near-white studio
 * background — the garment itself can be any color (black, heather gray, ...) as long as it
 * contrasts with the backdrop. For each pixel we:
 *  1. Derive an alpha mask from luminosity. The garment/background split point is found per
 *     image with Otsu's method (rather than a hardcoded "dark = garment" threshold) so this
 *     works the same whether the source photo is a black tee or a gray hoodie: background
 *     pixels get alpha ~0, garment pixels get alpha ~1.
 *  2. Within the garment mask, measure each pixel's luminosity relative to the garment's own
 *     median, and clamp that deviation to a small, fixed amplitude (`SHADING_AMPLITUDE`). This
 *     keeps just enough of the photo's real fold/shoulder shading to read as an actual garment,
 *     without stretching sensor noise / faint tonal variance in the source photo into visible
 *     washing, pigment blotches, gradients, or fade — the failure mode of a naive min–max
 *     percentile stretch, which amplifies whatever small variance is in the source fabric into
 *     a large, uneven brightness swing once multiplied against a light target color.
 *  3. Multiply the target color by that bounded shading map and write it out as a real RGBA
 *     pixel — alpha from the mask, color from the shaded target — instead of pre-compositing
 *     onto an opaque white canvas. A hardcoded white composite silently erases the garment's own
 *     silhouette for light target colors: white-on-white math averages back to white at every
 *     partial-alpha edge/fold pixel, so the shirt has no visible outline and reads as "broken"
 *     rather than "clean". A transparent PNG lets the actual page background (an off-white
 *     surface, never pure #fff) show through instead, which keeps every edge and fold crisp no
 *     matter how light the target color is — exactly like a real product photo cut out with a
 *     transparent background.
 * The result is a solid, uniform garment color — the same shape, fit, folds, seams, and camera
 * framing as the base photo, with only the color swapped. Good enough for a quote-stage preview,
 * not a substitute for a real product photo per color.
 */

/** How much the photo's real shading may modulate brightness around the flat target color.
 * Kept fixed (independent of the target color) so every color reads as solid/uniform rather than
 * washed, pigment-dyed, or gradient-faded — but not so small that structural details (a pocket,
 * a hood seam) become imperceptible on darker targets, where the same percentage swing is a much
 * smaller absolute brightness difference than on a light target. Edge/silhouette definition does
 * NOT depend on this value (see the real-alpha-channel note above), so this only has to be large
 * enough to keep folds and seams legible, not to carry the garment's outline. */
const SHADING_AMPLITUDE = 0.14;

/** Blur radius (px) applied to the shading map before it modulates the target color. Camera
 * sensor noise in the source photo is per-pixel; smoothing it out keeps only the smooth,
 * large-scale shading (folds, shoulder highlight, seam shadow) that reads as real fabric instead
 * of visible speckle/grain — another contributor to the "washed" look this module fixes. */
const SHADING_BLUR_RADIUS = 4;

/** Width (in luminosity units, 0-255) of the soft transition band centered on the Otsu split
 * point. Mirrors the antialiasing already present in the source photo's own edges. */
const ALPHA_EDGE_WIDTH = 18;

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

/** Otsu's method: finds the luminosity split point that best separates a bimodal histogram into
 * two classes (here, garment vs. background), by maximizing between-class variance. Works for
 * any garment color as long as it's reasonably distinct from the near-white studio backdrop. */
const otsuThreshold = (luminosity: Float32Array): number => {
  const histogram = new Float64Array(256);
  for (let i = 0; i < luminosity.length; i += 1) {
    histogram[Math.min(255, Math.max(0, Math.round(luminosity[i])))] += 1;
  }
  const total = luminosity.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i += 1) sumAll += i * histogram[i];

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let i = 0; i < 256; i += 1) {
    weightBackground += histogram[i];
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;
    sumBackground += i * histogram[i];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sumAll - sumBackground) / weightForeground;
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }
  return threshold;
};

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
    for (let i = 0; i < pixelCount; i += 1) {
      const offset = i * 4;
      luminosity[i] = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
    }

    const otsuSplit = otsuThreshold(luminosity);

    const alpha = new Float32Array(pixelCount);
    const garmentMask = new Float32Array(pixelCount);
    const garmentLuminosities: number[] = [];

    for (let i = 0; i < pixelCount; i += 1) {
      const a = clamp01((otsuSplit + ALPHA_EDGE_WIDTH / 2 - luminosity[i]) / ALPHA_EDGE_WIDTH);
      alpha[i] = a;
      if (a > 0.5) {
        garmentMask[i] = 1;
        garmentLuminosities.push(luminosity[i]);
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
      data[offset] = clamp01((shade * targetR) / 255) * 255;
      data[offset + 1] = clamp01((shade * targetG) / 255) * 255;
      data[offset + 2] = clamp01((shade * targetB) / 255) * 255;
      data[offset + 3] = alpha[i] * 255;
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
 * falling back to the original photo while recoloring is in flight or if the color has no
 * swatch.
 */
export const useRecoloredGarmentImage = (imageUrl: string, colorName: string): string => {
  const swatch = READY_MADE_COLOR_SWATCHES[colorName as ReadyMadeColor];
  const [resolvedUrl, setResolvedUrl] = useState(imageUrl);

  useEffect(() => {
    if (!swatch) {
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
