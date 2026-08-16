import type {
  ArtworkPlacement,
  ArtworkReference,
  ArtworkSize,
} from "@/types/customize";
import type { DecorationLocation } from "@/types/productionEstimate";

export type ArtworkContentType = "logo" | "photo";

export const MIN_ARTWORK_WIDTH = 0.1;
export const MAX_ARTWORK_WIDTH = 50;
export const DEFAULT_ARTWORK_WIDTH = 25;

export const artworkLocationLabels: Record<DecorationLocation, string> = {
  front: "앞면",
  back: "뒷면",
  left_sleeve: "왼쪽 소매",
  right_sleeve: "오른쪽 소매",
  neck: "목 뒤",
  other: "기타 위치",
};

const locationPositionPresets: Record<
  DecorationLocation,
  { xPercent: number; yPercent: number }
> = {
  // Generated garment images show the front view on the left and back view
  // on the right. These coordinates target the garment itself, not the full
  // image center.
  front: { xPercent: 26, yPercent: 44 },
  back: { xPercent: 74, yPercent: 44 },
  left_sleeve: { xPercent: 15, yPercent: 42 },
  right_sleeve: { xPercent: 39, yPercent: 42 },
  neck: { xPercent: 74, yPercent: 27 },
  other: { xPercent: 50, yPercent: 50 },
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export const resolveArtworkSize = (widthPercent: number): ArtworkSize => {
  if (widthPercent < 18) return "small";
  if (widthPercent > 34) return "large";
  return "medium";
};

const resolveLocation = (prompt: string): DecorationLocation => {
  if (/(왼쪽|좌측)\s*소매/.test(prompt)) return "left_sleeve";
  if (/(오른쪽|우측)\s*소매/.test(prompt)) return "right_sleeve";
  if (/(목\s*뒤|뒷\s*목|넥\s*뒤|넥라인)/.test(prompt)) return "neck";
  if (/(뒷면|뒤판|등판|등\s*(중앙|상단|하단|위|아래)?)/.test(prompt)) {
    return "back";
  }
  return "front";
};

const resolvePosition = (
  prompt: string,
  location: DecorationLocation,
) => {
  const preset = locationPositionPresets[location];

  if (location === "left_sleeve" || location === "right_sleeve") {
    return preset;
  }

  if (location === "neck") {
    return { xPercent: 74, yPercent: 27 };
  }

  if (location === "back") {
    if (/(목\s*뒤|뒷\s*목|등\s*(상단|위))/.test(prompt)) {
      return { xPercent: 74, yPercent: 30 };
    }
    if (/등\s*(하단|아래)/.test(prompt)) {
      return { xPercent: 74, yPercent: 62 };
    }
    if (/(왼쪽|좌측)/.test(prompt)) {
      return { xPercent: 69, yPercent: 44 };
    }
    if (/(오른쪽|우측)/.test(prompt)) {
      return { xPercent: 79, yPercent: 44 };
    }
    return preset;
  }

  if (/(왼쪽|좌측)\s*(가슴|체스트)/.test(prompt)) {
    return { xPercent: 22, yPercent: 39 };
  }
  if (/(오른쪽|우측)\s*(가슴|체스트)/.test(prompt)) {
    return { xPercent: 30, yPercent: 39 };
  }
  if (/(가슴|앞면?)\s*(중앙|가운데)/.test(prompt)) {
    return { xPercent: 26, yPercent: 43 };
  }
  if (/(상단|위쪽|위에)/.test(prompt)) {
    return { xPercent: 26, yPercent: 32 };
  }
  if (/(하단|아래쪽|아래에)/.test(prompt)) {
    return { xPercent: 26, yPercent: 62 };
  }
  if (/(왼쪽|좌측)/.test(prompt)) {
    return { xPercent: 21, yPercent: 47 };
  }
  if (/(오른쪽|우측)/.test(prompt)) {
    return { xPercent: 31, yPercent: 47 };
  }

  return preset;
};

const resolveWidth = (prompt: string, fallbackWidth: number) => {
  const explicitWidth = prompt.match(
    /(?:폭|크기)\s*(\d{1,2}(?:\.\d)?)\s*%/,
  );
  if (explicitWidth) {
    return clamp(
      Number(explicitWidth[1]),
      MIN_ARTWORK_WIDTH,
      MAX_ARTWORK_WIDTH,
    );
  }

  if (/거의\s*안\s*보|사라질|점처럼|최소\s*크기/.test(prompt)) return 0.1;
  if (/(아주|매우)\s*작/.test(prompt)) return 1;
  if (/미니|조그맣/.test(prompt)) return 3;
  if (/작게|작은|소형/.test(prompt)) return 16;
  if (/(아주|매우)\s*크|전체|가득/.test(prompt)) return 45;
  if (/크게|큰|대형/.test(prompt)) return 36;
  if (/중간|보통/.test(prompt)) return DEFAULT_ARTWORK_WIDTH;

  return clamp(fallbackWidth, MIN_ARTWORK_WIDTH, MAX_ARTWORK_WIDTH);
};

export const resolveArtworkPlacementPrompt = (
  rawPrompt: string,
  fallbackWidth = DEFAULT_ARTWORK_WIDTH,
) => {
  const prompt = rawPrompt.trim().replace(/\s+/g, " ");
  const location = resolveLocation(prompt);
  const keywordPosition = resolvePosition(prompt, location);
  const explicitX = prompt.match(/(?:가로|왼쪽에서)\s*(\d{1,3})\s*%/);
  const explicitY = prompt.match(/(?:세로|위에서)\s*(\d{1,3})\s*%/);
  const position = {
    xPercent: explicitX
      ? clamp(Number(explicitX[1]), 5, 95)
      : keywordPosition.xPercent,
    yPercent: explicitY
      ? clamp(Number(explicitY[1]), 5, 95)
      : keywordPosition.yPercent,
  };
  const widthPercent = resolveWidth(prompt, fallbackWidth);
  const placement: ArtworkPlacement = {
    location,
    size: resolveArtworkSize(widthPercent),
    xPercent: position.xPercent,
    yPercent: position.yPercent,
    widthPercent,
  };

  return {
    placement,
    summary: summarizeArtworkPlacement(placement),
  };
};

export const formatArtworkPercent = (value: number) =>
  value < 1 ? value.toFixed(1) : String(Math.round(value));

export const summarizeArtworkPlacement = (placement: ArtworkPlacement) =>
  `${artworkLocationLabels[placement.location]} · 화면 기준 가로 ${Math.round(
    placement.xPercent,
  )}% / 세로 ${Math.round(
    placement.yPercent,
  )}% · 이미지 폭 ${formatArtworkPercent(placement.widthPercent)}%`;

type Rgb = { r: number; g: number; b: number };

type EdgeBackground = {
  color: Rgb;
  dominance: number;
  spread: number;
};

type BackgroundRemovalResult =
  | "removed"
  | "already-transparent"
  | "not-detected";

const colorDistance = (
  data: Uint8ClampedArray,
  offset: number,
  background: Rgb,
) => {
  const red = data[offset] - background.r;
  const green = data[offset + 1] - background.g;
  const blue = data[offset + 2] - background.b;
  return Math.sqrt(red * red + green * green + blue * blue);
};

const findDominantEdgeBackground = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
): EdgeBackground | null => {
  const samples: Rgb[] = [];
  const buckets = new Map<
    number,
    { count: number; red: number; green: number; blue: number }
  >();
  const sampleStep = Math.max(1, Math.floor(Math.max(width, height) / 256));
  const edgeDepth = Math.max(
    1,
    Math.min(12, Math.round(Math.min(width, height) * 0.015)),
  );
  let transparentSamples = 0;
  let totalSamples = 0;

  const addSample = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    totalSamples += 1;
    if (data[offset + 3] < 224) {
      transparentSamples += 1;
      return;
    }
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    samples.push({ r: red, g: green, b: blue });
    const key = (red >> 4) * 256 + (green >> 4) * 16 + (blue >> 4);
    const bucket = buckets.get(key) || {
      count: 0,
      red: 0,
      green: 0,
      blue: 0,
    };
    bucket.count += 1;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    buckets.set(key, bucket);
  };

  for (let depth = 0; depth < edgeDepth; depth += 1) {
    for (let x = 0; x < width; x += sampleStep) {
      addSample(x, depth);
      addSample(x, height - 1 - depth);
    }
    for (let y = edgeDepth; y < height - edgeDepth; y += sampleStep) {
      addSample(depth, y);
      addSample(width - 1 - depth, y);
    }
  }

  // A PNG that is already transparent should never be recolored or eroded.
  if (totalSamples > 0 && transparentSamples / totalSamples >= 0.04) {
    return null;
  }

  let dominant:
    | { count: number; red: number; green: number; blue: number }
    | undefined;
  buckets.forEach((bucket) => {
    if (!dominant || bucket.count > dominant.count) dominant = bucket;
  });
  if (!dominant?.count || samples.length < 8) return null;

  const seed = {
    r: dominant.red / dominant.count,
    g: dominant.green / dominant.count,
    b: dominant.blue / dominant.count,
  };
  const cluster = samples.filter((sample) => {
    const red = sample.r - seed.r;
    const green = sample.g - seed.g;
    const blue = sample.b - seed.b;
    return Math.sqrt(red * red + green * green + blue * blue) <= 32;
  });
  const dominance = cluster.length / samples.length;

  // A busy or multi-colour edge is more likely to be artwork/photo content.
  // In that case preserving the source is safer than deleting part of a logo.
  if (dominance < 0.46 || cluster.length < 8) return null;

  const color = cluster.reduce(
    (result, sample) => ({
      r: result.r + sample.r / cluster.length,
      g: result.g + sample.g / cluster.length,
      b: result.b + sample.b / cluster.length,
    }),
    { r: 0, g: 0, b: 0 },
  );
  const spread = Math.sqrt(
    cluster.reduce((sum, sample) => {
      const red = sample.r - color.r;
      const green = sample.g - color.g;
      const blue = sample.b - color.b;
      return sum + red * red + green * green + blue * blue;
    }, 0) / cluster.length,
  );

  return { color, dominance, spread };
};

const removeConnectedEdgeBackground = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): BackgroundRemovalResult => {
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;
  const pixelCount = width * height;
  let edgePixelCount = 0;
  let transparentEdgePixelCount = 0;
  const sampleEdgeAlpha = (pixelIndex: number) => {
    edgePixelCount += 1;
    if (data[pixelIndex * 4 + 3] < 224) {
      transparentEdgePixelCount += 1;
    }
  };
  for (let x = 0; x < width; x += 1) {
    sampleEdgeAlpha(x);
    sampleEdgeAlpha((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    sampleEdgeAlpha(y * width);
    sampleEdgeAlpha(y * width + width - 1);
  }
  if (
    edgePixelCount > 0 &&
    transparentEdgePixelCount / edgePixelCount >= 0.04
  ) {
    return "already-transparent";
  }

  const backgroundAnalysis = findDominantEdgeBackground(data, width, height);
  if (!backgroundAnalysis) return "not-detected";
  const { color: background, spread, dominance } = backgroundAnalysis;
  const originalData = new Uint8ClampedArray(data);

  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;
  const hardThreshold = clamp(18 + spread * 1.2, 18, 34);
  const softThreshold = clamp(
    hardThreshold + 38 + (1 - dominance) * 22,
    54,
    78,
  );

  const enqueue = (pixelIndex: number) => {
    if (visited[pixelIndex]) return;
    const offset = pixelIndex * 4;
    if (
      data[offset + 3] > 8 &&
      colorDistance(data, offset, background) > hardThreshold
    ) {
      return;
    }
    visited[pixelIndex] = 1;
    queue[tail++] = pixelIndex;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const pixelIndex = queue[head++];
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (x > 0) enqueue(pixelIndex - 1);
    if (x < width - 1) enqueue(pixelIndex + 1);
    if (y > 0) enqueue(pixelIndex - width);
    if (y < height - 1) enqueue(pixelIndex + width);
    if (x > 0 && y > 0) enqueue(pixelIndex - width - 1);
    if (x < width - 1 && y > 0) enqueue(pixelIndex - width + 1);
    if (x > 0 && y < height - 1) enqueue(pixelIndex + width - 1);
    if (x < width - 1 && y < height - 1) {
      enqueue(pixelIndex + width + 1);
    }
  }

  if (tail < Math.max(8, pixelCount * 0.003)) {
    return "not-detected";
  }

  const decontaminateEdgeColor = (offset: number, opacity: number) => {
    if (opacity <= 0.08 || opacity >= 0.98) return;
    const inverseOpacity = 1 - opacity;
    data[offset] = clamp(
      (data[offset] - inverseOpacity * background.r) / opacity,
      0,
      255,
    );
    data[offset + 1] = clamp(
      (data[offset + 1] - inverseOpacity * background.g) / opacity,
      0,
      255,
    );
    data[offset + 2] = clamp(
      (data[offset + 2] - inverseOpacity * background.b) / opacity,
      0,
      255,
    );
  };

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    if (visited[pixelIndex]) data[pixelIndex * 4 + 3] = 0;
  }

  // Feather only a narrow ring around the definite background. Unlike a
  // high-threshold flood fill, this removes JPEG/anti-alias halos without
  // leaking through pale lettering or thin logo strokes.
  const featherQueue = new Int32Array(pixelCount);
  const featherRing = new Uint8Array(pixelCount);
  let featherHead = 0;
  let featherTail = 0;
  const enqueueFeather = (pixelIndex: number, ring: number) => {
    if (
      pixelIndex < 0 ||
      pixelIndex >= pixelCount ||
      visited[pixelIndex] ||
      featherRing[pixelIndex]
    ) {
      return;
    }
    const offset = pixelIndex * 4;
    if (colorDistance(data, offset, background) > softThreshold) return;
    featherRing[pixelIndex] = ring;
    featherQueue[featherTail++] = pixelIndex;
  };

  const enqueueNeighbours = (pixelIndex: number, ring: number) => {
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (x > 0) enqueueFeather(pixelIndex - 1, ring);
    if (x < width - 1) enqueueFeather(pixelIndex + 1, ring);
    if (y > 0) enqueueFeather(pixelIndex - width, ring);
    if (y < height - 1) enqueueFeather(pixelIndex + width, ring);
  };

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    if (visited[pixelIndex]) enqueueNeighbours(pixelIndex, 1);
  }

  while (featherHead < featherTail) {
    const pixelIndex = featherQueue[featherHead++];
    const ring = featherRing[pixelIndex];
    const offset = pixelIndex * 4;
    const distance = colorDistance(data, offset, background);
    const rawOpacity = clamp(
      (distance - hardThreshold) / (softThreshold - hardThreshold),
      0,
      1,
    );
    const opacity = rawOpacity * rawOpacity * (3 - 2 * rawOpacity);
    decontaminateEdgeColor(offset, opacity);
    data[offset + 3] = Math.round(data[offset + 3] * opacity);
    if (ring < 3) enqueueNeighbours(pixelIndex, ring + 1);
  }

  let retainedPixels = 0;
  for (let offset = 3; offset < data.length; offset += 4) {
    if (data[offset] >= 96) retainedPixels += 1;
  }
  if (retainedPixels < Math.max(8, pixelCount * 0.002)) {
    data.set(originalData);
    return "not-detected";
  }

  context.putImageData(imageData, 0, 0);
  return "removed";
};

export const prepareArtworkReference = (
  file: File,
  contentType: ArtworkContentType,
): Promise<ArtworkReference> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const maxDimension = 1024;
        const scale = Math.min(
          1,
          maxDimension / Math.max(image.naturalWidth, image.naturalHeight),
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d", {
          willReadFrequently: contentType === "logo",
        });
        if (!context) throw new Error("이미지를 처리할 수 없습니다.");

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const backgroundRemoval =
          contentType === "logo"
            ? removeConnectedEdgeBackground(
                context,
                canvas.width,
                canvas.height,
              )
            : "preserved";

        const mimeType =
          contentType === "logo" ? "image/png" : "image/webp";
        const dataUrl = canvas.toDataURL(mimeType, 0.92);
        const [metadata, base64] = dataUrl.split(",");
        const resolvedMimeType =
          metadata.match(/^data:(image\/[^;]+);base64$/)?.[1] || mimeType;

        resolve({
          base64,
          mimeType: resolvedMimeType,
          fileName: file.name,
          backgroundRemoval,
        });
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지를 불러올 수 없습니다."));
    };
    image.src = objectUrl;
  });
