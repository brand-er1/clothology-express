import type { ClosetGarment } from "@/types/closet";

export interface ImageRef {
  base64: string;
  mimeType: string;
}

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("이미지를 변환할 수 없습니다."));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("이미지를 변환할 수 없습니다."));
    reader.readAsDataURL(blob);
  });

/** Fetches any http(s) or same-origin image URL and returns it as base64 for a Gemini call. */
export const urlToImageRef = async (url: string): Promise<ImageRef> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("이미지를 불러올 수 없습니다.");
  }
  const blob = await response.blob();
  return { base64: await blobToBase64(blob), mimeType: blob.type || "image/png" };
};

/** Resolves the exact reference image for a garment — its stored design data when available. */
export const garmentToImageRef = async (garment: ClosetGarment): Promise<ImageRef> => {
  if (garment.designRef?.imageBase64 && garment.designRef.imageMimeType) {
    return { base64: garment.designRef.imageBase64, mimeType: garment.designRef.imageMimeType };
  }
  const sourceUrl = garment.designRef?.imageUrl || garment.imageUrl;
  return urlToImageRef(sourceUrl);
};
