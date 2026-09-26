/**
 * Image generation service layer.
 *
 * Edge functions depend only on `ImageProvider`, never on a vendor SDK/URL, so the model or
 * vendor can be swapped by adding a provider here and setting the DETAIL_IMAGE_PROVIDER
 * secret. Every provider receives the creator's design as the primary reference plus
 * optional extra references (sample/fabric/detail photos) and must return raw image bytes;
 * callers store the result in Supabase Storage themselves (never provider temp URLs).
 */

export type ReferenceImage = {
  /** Human label placed next to the image in the request, e.g. "creator's fabric photo". */
  label: string;
  data: string; // base64
  mimeType: string;
};

export type ImageGenerationRequest = {
  prompt: string;
  references: ReferenceImage[];
  aspectRatio: string;
};

export type ImageGenerationResult = {
  base64: string;
  mimeType: string;
  provider: string;
  model: string;
};

export interface ImageProvider {
  readonly name: string;
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export class ImageProviderConfigError extends Error {}

/** Gemini image models, tried in order (same chain as BRAND-ER's other image functions). */
class GeminiImageProvider implements ImageProvider {
  readonly name = "gemini";
  constructor(private apiKey: string, private models: string[]) {}

  async generate({ prompt, references, aspectRatio }: ImageGenerationRequest): Promise<ImageGenerationResult> {
    let lastError = "no_image_returned";
    const parts: Array<Record<string, unknown>> = [];
    references.forEach((reference, index) => {
      parts.push({ text: `${index === 0 ? "REFERENCE IMAGE 1 (primary, immutable product identity)" : `REFERENCE IMAGE ${index + 1}`} — ${reference.label}:` });
      parts.push({ inlineData: { data: reference.data, mimeType: reference.mimeType } });
    });
    parts.push({ text: prompt });

    for (const model of this.models) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
            imageConfig: model === "gemini-2.5-flash-image" ? { aspectRatio } : { aspectRatio, imageSize: "2K" },
          },
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        lastError = `model=${model} status=${response.status}: ${body.slice(0, 400)}`;
        console.error("gemini image provider error", lastError);
        if (![403, 404, 429].includes(response.status) && response.status < 500) break;
        continue;
      }
      const data = await response.json();
      const responseParts = data?.candidates?.[0]?.content?.parts || [];
      const imagePart = responseParts.find((part: { inlineData?: { data?: string } }) => part?.inlineData?.data);
      if (imagePart) {
        return {
          base64: imagePart.inlineData.data as string,
          mimeType: (imagePart.inlineData.mimeType || "image/png") as string,
          provider: this.name,
          model,
        };
      }
      const text = responseParts.map((part: { text?: string }) => part.text || "").join(" ").trim();
      lastError = `model=${model} returned no image${text ? `: ${text.slice(0, 200)}` : ""}`;
    }
    throw new Error(lastError);
  }
}

const DEFAULT_GEMINI_MODELS = ["gemini-3.1-flash-image", "gemini-3-pro-image", "gemini-2.5-flash-image"];

/**
 * Resolves the configured provider.
 *   DETAIL_IMAGE_PROVIDER  = "gemini" (default)
 *   DETAIL_IMAGE_MODELS    = optional comma-separated model override for that provider
 */
export const getImageProvider = (): ImageProvider => {
  const name = (Deno.env.get("DETAIL_IMAGE_PROVIDER") || "gemini").trim().toLowerCase();
  const models = (Deno.env.get("DETAIL_IMAGE_MODELS") || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  switch (name) {
    case "gemini": {
      const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
      if (!apiKey) throw new ImageProviderConfigError("GEMINI_API_KEY가 설정되지 않았습니다.");
      return new GeminiImageProvider(apiKey, models.length ? models : DEFAULT_GEMINI_MODELS);
    }
    default:
      throw new ImageProviderConfigError(`지원하지 않는 이미지 생성 provider 입니다: ${name}`);
  }
};

const MAX_REFERENCE_BYTES = 12 * 1024 * 1024;

const toBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
};

/** Downloads an https image as a reference. Returns null (skip) for non-images or oversized files. */
export const fetchReferenceImage = async (url: string, label: string, required = false): Promise<ReferenceImage | null> => {
  if (!/^https:\/\//.test(url)) {
    if (required) throw new Error("참조할 이미지 주소가 올바르지 않습니다.");
    return null;
  }
  const response = await fetch(url);
  if (!response.ok) {
    if (required) throw new Error(`참조 이미지를 불러오지 못했습니다 (${response.status})`);
    return null;
  }
  const mimeType = (response.headers.get("content-type") || "image/png").split(";")[0];
  const buffer = await response.arrayBuffer();
  if (!mimeType.startsWith("image/") || buffer.byteLength > MAX_REFERENCE_BYTES) {
    if (required) throw new Error("참조 이미지 형식 또는 크기를 확인해주세요.");
    return null;
  }
  return { label, data: toBase64(buffer), mimeType };
};
