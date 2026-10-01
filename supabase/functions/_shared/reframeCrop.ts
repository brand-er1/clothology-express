import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";
import { reframeBelowHead } from "./imageQa.ts";

/**
 * 착용 컷 재구도(카메라 프레임을 어깨선 아래로 내림). 흐림 · 가림이 아니라 머리가 프레임 밖이 되도록 화면 자체를 다시 잡는다.
 * 계산할 수 없거나 디코드에 실패하면 null(호출부는 재생성 또는 실패 처리).
 */
export const cropBelowHead = async (
  base64: string,
  headBox: [number, number, number, number] | null,
): Promise<{ base64: string; mimeType: string } | null> => {
  try {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const image = await Image.decode(bytes);
    const box = reframeBelowHead(image.width, image.height, headBox);
    if (!box) return null;
    const cropped = image.crop(box.x, box.y, box.width, box.height);
    const encoded = await cropped.encode();
    let binary = "";
    for (let index = 0; index < encoded.length; index += 0x8000) {
      binary += String.fromCharCode(...encoded.subarray(index, index + 0x8000));
    }
    return { base64: btoa(binary), mimeType: "image/png" };
  } catch (error) {
    console.error("reframe crop failed:", error);
    return null;
  }
};
