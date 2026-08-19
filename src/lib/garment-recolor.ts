import { useEffect, useState } from "react";
import { READY_MADE_COLOR_SWATCHES, type ReadyMadeColor } from "@/data/ready-made-pricing-config";

/**
 * Recolors a photographed black garment mockup to an arbitrary target color, purely on the
 * client (canvas pixel manipulation — no server round trip, no per-color asset files).
 *
 * How it works: every base photo in `public/lovable-uploads/ready-made/` is shot on the SAME
 * black garment against a near-white studio background. For each pixel we:
 *  1. Derive an alpha mask from luminosity — near-white pixels (background) get alpha ~0,
 *     dark pixels (garment) get alpha ~1.
 *  2. Within the garment mask, stretch the luminosity range (2nd–90th percentile) to the full
 *     0–1 span, so the photo's real fold/shadow shading becomes usable as a fabric shading map
 *     regardless of how dark the original black fabric was.
 *  3. Multiply the target color by that shading map (with a "floor" so shadows don't crush to
 *     pure black), then composite over white using the alpha mask, so the studio background
 *     stays white no matter the target color.
 * The result is an approximate, but visually convincing, "same garment in a different color"
 * mockup — good enough for a quote-stage preview, not a substitute for a real product photo.
 */

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
    const garmentLuminosities: number[] = [];

    for (let i = 0; i < pixelCount; i += 1) {
      const offset = i * 4;
      const l = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
      luminosity[i] = l;
      const a = Math.min(1, Math.max(0, (225 - l) / 200));
      alpha[i] = a;
      if (a > 0.5) garmentLuminosities.push(l);
    }

    const sortedGarmentLuminosities = Float64Array.from(garmentLuminosities.sort((a, b) => a - b));
    const lo = percentile(sortedGarmentLuminosities, 0.02);
    const hi = percentile(sortedGarmentLuminosities, 0.9) || 255;
    const range = Math.max(1, hi - lo);

    const [targetR, targetG, targetB] = hexToRgb(colorHex);
    const targetLuminance = (targetR + targetG + targetB) / (3 * 255);
    const floor = 0.15 + 0.5 * targetLuminance;

    for (let i = 0; i < pixelCount; i += 1) {
      const offset = i * 4;
      const normalized = Math.min(1, Math.max(0, (luminosity[i] - lo) / range));
      const shade = floor + (1 - floor) * normalized;
      const a = alpha[i];
      data[offset] = shade * targetR * a + 255 * (1 - a);
      data[offset + 1] = shade * targetG * a + 255 * (1 - a);
      data[offset + 2] = shade * targetB * a + 255 * (1 - a);
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
