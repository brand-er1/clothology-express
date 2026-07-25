import type {
  ArtworkPlacement,
  ArtworkReference,
  CompositedImageReference,
} from "@/types/customize";

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

const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("합성 이미지를 저장할 수 없습니다."));
          return;
        }
        resolve(blob);
      },
      COMPOSITE_MIME_TYPE,
      COMPOSITE_QUALITY,
    );
  });

export const calculateArtworkRect = (
  canvasWidth: number,
  canvasHeight: number,
  artworkWidth: number,
  artworkHeight: number,
  placement: ArtworkPlacement,
) => {
  const width = canvasWidth * (placement.widthPercent / 100);
  const height = width * (artworkHeight / artworkWidth);
  const centerX = canvasWidth * (placement.xPercent / 100);
  const centerY = canvasHeight * (placement.yPercent / 100);

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
};

export const createExactArtworkComposite = async ({
  baseImageUrl,
  artwork,
  placement,
}: {
  baseImageUrl: string;
  artwork: ArtworkReference;
  placement: ArtworkPlacement;
}): Promise<CompositedImageReference> => {
  const baseResponse = await fetch(baseImageUrl);
  if (!baseResponse.ok) {
    throw new Error("의류 원본 이미지를 불러올 수 없습니다.");
  }

  const baseObjectUrl = URL.createObjectURL(await baseResponse.blob());
  const artworkDataUrl = `data:${artwork.mimeType};base64,${artwork.base64}`;

  try {
    const [baseImage, artworkImage] = await Promise.all([
      loadImage(baseObjectUrl),
      loadImage(artworkDataUrl),
    ]);
    if (
      !baseImage.naturalWidth ||
      !baseImage.naturalHeight ||
      !artworkImage.naturalWidth ||
      !artworkImage.naturalHeight
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

    const artworkRect = calculateArtworkRect(
      canvas.width,
      canvas.height,
      artworkImage.naturalWidth,
      artworkImage.naturalHeight,
      placement,
    );
    context.drawImage(
      artworkImage,
      artworkRect.x,
      artworkRect.y,
      artworkRect.width,
      artworkRect.height,
    );

    const blob = await canvasToBlob(canvas);
    return {
      base64: await blobToBase64(blob),
      mimeType: COMPOSITE_MIME_TYPE,
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    URL.revokeObjectURL(baseObjectUrl);
  }
};
