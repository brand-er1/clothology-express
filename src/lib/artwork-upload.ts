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

const findDominantEdgeColor = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Rgb | null => {
  const buckets = new Map<
    number,
    { count: number; red: number; green: number; blue: number }
  >();
  const sampleStep = Math.max(1, Math.floor(Math.max(width, height) / 256));

  const addSample = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    if (data[offset + 3] < 32) return;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
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

  for (let x = 0; x < width; x += sampleStep) {
    addSample(x, 0);
    addSample(x, height - 1);
  }
  for (let y = 0; y < height; y += sampleStep) {
    addSample(0, y);
    addSample(width - 1, y);
  }

  let dominant:
    | { count: number; red: number; green: number; blue: number }
    | undefined;
  buckets.forEach((bucket) => {
    if (!dominant || bucket.count > dominant.count) dominant = bucket;
  });
  if (!dominant?.count) return null;

  return {
    r: dominant.red / dominant.count,
    g: dominant.green / dominant.count,
    b: dominant.blue / dominant.count,
  };
};

const removeConnectedEdgeBackground = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) => {
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;
  const background = findDominantEdgeColor(data, width, height);
  if (!background) return;

  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;
  const softThreshold = 92;
  const hardThreshold = 48;

  const enqueue = (pixelIndex: number) => {
    if (visited[pixelIndex]) return;
    const offset = pixelIndex * 4;
    if (
      data[offset + 3] > 8 &&
      colorDistance(data, offset, background) > softThreshold
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
  }

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    if (!visited[pixelIndex]) continue;
    const offset = pixelIndex * 4;
    const distance = colorDistance(data, offset, background);
    if (distance <= hardThreshold || data[offset + 3] <= 8) {
      data[offset + 3] = 0;
      continue;
    }
    const edgeOpacity = clamp(
      (distance - hardThreshold) / (softThreshold - hardThreshold),
      0,
      1,
    );
    data[offset + 3] = Math.round(data[offset + 3] * edgeOpacity);
  }

  context.putImageData(imageData, 0, 0);
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
        if (contentType === "logo") {
          removeConnectedEdgeBackground(
            context,
            canvas.width,
            canvas.height,
          );
        }

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
