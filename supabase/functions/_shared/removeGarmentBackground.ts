import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";
import { removeConnectedEdgeBackground } from "./backgroundRemoval.ts";

/**
 * Best-effort background removal for a freshly generated garment image. The
 * generation prompt always asks for a "clean white background" product
 * render, so this clears that background to transparent when detected.
 *
 * This never throws: decode/processing failures (unexpected format, corrupt
 * bytes, a busy/non-solid background the detector declines to touch) fall
 * back to returning the original bytes untouched, so a background-removal
 * bug can never break image generation itself.
 */
export const tryRemoveGarmentBackground = async (
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> => {
  if (!/^image\/(png|jpeg|jpg|webp)$/.test(mimeType)) {
    return { bytes, mimeType };
  }

  try {
    const image = await Image.decode(bytes);
    const data = new Uint8ClampedArray(
      image.bitmap.buffer,
      image.bitmap.byteOffset,
      image.bitmap.byteLength,
    );
    const result = removeConnectedEdgeBackground({
      data,
      width: image.width,
      height: image.height,
    });

    if (result !== "removed") {
      return { bytes, mimeType };
    }

    const encoded = await image.encode();
    return { bytes: encoded, mimeType: "image/png" };
  } catch (error) {
    console.error("Garment background removal failed, keeping original image:", error);
    return { bytes, mimeType };
  }
};
