import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";
import { type Box, cropRectForBox } from "./productShotPrompt.ts";
import type { ReferenceImage } from "./imageProviders.ts";

/**
 * 원본 디자인 이미지에서 확대할 부분(사용자 선택 영역 · 분석으로 찾은 부위 · 앞/뒤 뷰)을 잘라 추가 참조 이미지로 만든다.
 * 모델이 "어느 부분을 확대하는지"를 좌표가 아니라 실제 픽셀로 보게 해 원본과 같은 그래픽 · 봉제를 재현하게 한다.
 * 엣지 함수 CPU 한도 안에 들도록 디코드는 한 번만 하고 JPEG 로 인코딩한다. 실패하면 빈 배열(좌표 지시만으로 진행).
 */

const decodeBase64 = (base64: string) => {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
};

const encodeBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};

export type CropRequest = { box: Box; label: string; padding?: number };

export const cropReferenceImages = async (source: ReferenceImage, requests: CropRequest[]): Promise<ReferenceImage[]> => {
  if (!requests.length) return [];
  try {
    const image = await Image.decode(decodeBase64(source.data));
    const results: ReferenceImage[] = [];
    for (const request of requests) {
      const rect = cropRectForBox(image.width, image.height, request.box, request.padding ?? 0.12);
      if (rect.width < 16 || rect.height < 16) continue;
      const cropped = image.clone().crop(rect.x, rect.y, rect.width, rect.height);
      // 아주 작은 영역은 키워서 모델이 형태를 읽을 수 있게 한다(최대 1024px).
      const longest = Math.max(cropped.width, cropped.height);
      if (longest < 512) cropped.resize(Math.round((cropped.width * 512) / longest), Math.round((cropped.height * 512) / longest));
      const encoded = await cropped.encodeJPEG(90);
      results.push({ label: request.label, data: encodeBase64(encoded), mimeType: "image/jpeg" });
    }
    return results;
  } catch (error) {
    console.error("product shot crop failed:", error);
    return [];
  }
};
