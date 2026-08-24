// Deno-side port of the connected-edge background removal used for logo
// uploads in src/lib/artwork-upload.ts. The garment-generation prompts always
// ask Gemini for a "clean white background" product render, so the same
// dominant-edge-color detection + flood fill (with edge feathering) applies
// here: find the solid color that dominates the image border, clear every
// pixel connected to the border that matches it, and leave anything that
// doesn't look like a solid background (busy edges, already transparent, a
// low-confidence read) untouched rather than risk eating into the garment.

export type RgbaBuffer = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

type Rgb = { r: number; g: number; b: number };

type EdgeBackground = {
  color: Rgb;
  dominance: number;
  spread: number;
};

export type BackgroundRemovalResult =
  | "removed"
  | "already-transparent"
  | "not-detected";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

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
  // In that case preserving the source is safer than deleting part of it.
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

export const removeConnectedEdgeBackground = (
  buffer: RgbaBuffer,
): BackgroundRemovalResult => {
  const { data, width, height } = buffer;
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

  return "removed";
};
