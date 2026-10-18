import type {
  ArtworkLayer,
  ArtworkPlacement,
  CompositedImageReference,
} from "@/types/customize";
import { drawTransformedArtwork, resolveStretchY } from "@/lib/artwork-transform";

const MAX_COMPOSITE_DIMENSION = 1600;
const COMPOSITE_MIME_TYPE = "image/webp";
const COMPOSITE_QUALITY = 0.92;

const loadImage = (source: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("합성에 사용할 이미지를 불러올 수 없습니다."));
    image.src = source;
  });

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("합성 이미지를 변환할 수 없습니다."));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () =>
      reject(new Error("합성 이미지를 변환할 수 없습니다."));
    reader.readAsDataURL(blob);
  });

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: string,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("합성 이미지를 저장할 수 없습니다."));
          return;
        }
        resolve(blob);
      },
      mimeType,
      COMPOSITE_QUALITY,
    );
  });

/** The artwork's unrotated rect; rotation/flips are applied around its center when drawing. */
export const calculateArtworkRect = (
  canvasWidth: number,
  canvasHeight: number,
  artworkWidth: number,
  artworkHeight: number,
  placement: ArtworkPlacement,
) => {
  const width = canvasWidth * (placement.widthPercent / 100);
  const height = width * (artworkHeight / artworkWidth) * resolveStretchY(placement);
  const centerX = canvasWidth * (placement.xPercent / 100);
  const centerY = canvasHeight * (placement.yPercent / 100);

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
};

// Layers are drawn in order, so later layers sit on top of earlier ones. Each layer is drawn
// with its rotation/flips around its own center — the same math the editor preview uses — so the
// saved image is exactly what the customer saw.
export const createExactArtworkComposite = async ({
  baseImageUrl,
  layers,
  mimeType = COMPOSITE_MIME_TYPE,
  allowEmpty = false,
}: {
  baseImageUrl: string;
  layers: ArtworkLayer[];
  /** PNG for downloads; the default WEBP keeps the upload to the server small. */
  mimeType?: "image/webp" | "image/png";
  /** Lets a download export the bare garment image when nothing is placed on it. */
  allowEmpty?: boolean;
}): Promise<CompositedImageReference> => {
  if (layers.length === 0 && !allowEmpty) {
    throw new Error("합성할 이미지가 없습니다.");
  }
  const baseResponse = await fetch(baseImageUrl);
  if (!baseResponse.ok) {
    throw new Error("의류 원본 이미지를 불러올 수 없습니다.");
  }

  const baseObjectUrl = URL.createObjectURL(await baseResponse.blob());

  try {
    const [baseImage, ...artworkImages] = await Promise.all([
      loadImage(baseObjectUrl),
      ...layers.map(({ artwork }) =>
        loadImage(`data:${artwork.mimeType};base64,${artwork.base64}`),
      ),
    ]);
    if (
      !baseImage.naturalWidth ||
      !baseImage.naturalHeight ||
      artworkImages.some(
        (image) => !image.naturalWidth || !image.naturalHeight,
      )
    ) {
      throw new Error("이미지 크기 정보를 확인할 수 없습니다.");
    }

    const outputScale = Math.min(
      1,
      MAX_COMPOSITE_DIMENSION /
        Math.max(baseImage.naturalWidth, baseImage.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(
      1,
      Math.round(baseImage.naturalWidth * outputScale),
    );
    canvas.height = Math.max(
      1,
      Math.round(baseImage.naturalHeight * outputScale),
    );

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("이미지를 합성할 수 없습니다.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

    layers.forEach(({ placement }, index) => {
      const artworkImage = artworkImages[index];
      const artworkRect = calculateArtworkRect(
        canvas.width,
        canvas.height,
        artworkImage.naturalWidth,
        artworkImage.naturalHeight,
        placement,
      );
      drawTransformedArtwork(
        context,
        artworkImage,
        {
          centerX: artworkRect.x + artworkRect.width / 2,
          centerY: artworkRect.y + artworkRect.height / 2,
          width: artworkRect.width,
          height: artworkRect.height,
        },
        placement,
      );
    });

    const blob = await canvasToBlob(canvas, mimeType);
    return {
      base64: await blobToBase64(blob),
      mimeType,
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    URL.revokeObjectURL(baseObjectUrl);
  }
};
