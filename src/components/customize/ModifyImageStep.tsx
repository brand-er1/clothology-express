
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  ImageOff,
  ImagePlus,
  MapPin,
  Maximize2,
  Move,
  RefreshCw,
  Send,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import { ProductionEstimateCard } from "./ProductionEstimateCard";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ArtworkPlacement,
  ArtworkReference,
  ArtworkSize,
  ImageModificationEntry,
} from "@/types/customize";
import type {
  DecorationLocation,
  UploadedArtworkAnalysis,
} from "@/types/productionEstimate";

const locationOptions: Array<{
  value: DecorationLocation;
  label: string;
}> = [
  { value: "front", label: "앞면" },
  { value: "back", label: "뒷면" },
  { value: "left_sleeve", label: "왼쪽 소매" },
  { value: "right_sleeve", label: "오른쪽 소매" },
  { value: "neck", label: "목 부분" },
];

const MIN_ARTWORK_WIDTH = 8;
const MAX_ARTWORK_WIDTH = 50;
const DEFAULT_ARTWORK_WIDTH = 25;

const resolveArtworkSize = (widthPercent: number): ArtworkSize => {
  if (widthPercent < 18) return "small";
  if (widthPercent > 34) return "large";
  return "medium";
};

type ArtworkGesture =
  | {
      mode: "move";
      pointerId: number;
      offsetXPercent: number;
      offsetYPercent: number;
    }
  | {
      mode: "resize";
      pointerId: number;
      startClientX: number;
      startWidthPercent: number;
    };

const locationPositionPresets: Record<
  DecorationLocation,
  { xPercent: number; yPercent: number }
> = {
  front: { xPercent: 50, yPercent: 45 },
  back: { xPercent: 50, yPercent: 45 },
  left_sleeve: { xPercent: 24, yPercent: 42 },
  right_sleeve: { xPercent: 76, yPercent: 42 },
  neck: { xPercent: 50, yPercent: 24 },
  other: { xPercent: 50, yPercent: 50 },
};

const prepareArtworkReference = (file: File): Promise<ArtworkReference> =>
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
        const context = canvas.getContext("2d");
        if (!context) throw new Error("이미지를 처리할 수 없습니다.");

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/webp", 0.9);
        const [metadata, base64] = dataUrl.split(",");
        const mimeType =
          metadata.match(/^data:(image\/[^;]+);base64$/)?.[1] || "image/webp";

        resolve({ base64, mimeType, fileName: file.name });
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

const formatArtworkPrice = (analysis: UploadedArtworkAnalysis) => {
  if (
    typeof analysis.unitMin !== "number" ||
    typeof analysis.unitMax !== "number"
  ) {
    return "자동견적에서 확인";
  }

  const minimum = `${analysis.unitMin.toLocaleString("ko-KR")}원`;
  const maximum = `${analysis.unitMax.toLocaleString("ko-KR")}원`;
  if (analysis.unitMin === analysis.unitMax) {
    return `${minimum}${analysis.isStartingFrom ? "부터" : ""}`;
  }
  return `${minimum} ~ ${maximum}`;
};

interface ModifyImageStepProps {
  isLoading: boolean;
  selectedImageUrl: string | null;
  selectedType: string;
  selectedMaterial: string;
  designContext?: string;
  modificationHistory: ImageModificationEntry[];
  currentArtworkAnalysis: UploadedArtworkAnalysis | null;
  onModifyImage: (
    prompt: string,
    options?: {
      referenceImage?: ArtworkReference;
      placement?: ArtworkPlacement;
    },
  ) => Promise<void>;
  onResetModifications: () => void;
  onSelectHistoryImage: (imageUrl: string | null, imagePath?: string | null, index?: number) => void;
}

export const ModifyImageStep = ({
  isLoading,
  selectedImageUrl,
  selectedType,
  selectedMaterial,
  designContext,
  modificationHistory,
  currentArtworkAnalysis,
  onModifyImage,
  onResetModifications,
  onSelectHistoryImage,
}: ModifyImageStepProps) => {
  const [modificationPrompt, setModificationPrompt] = useState("");
  const [imageError, setImageError] = useState(false);
  const [uploadedArtwork, setUploadedArtwork] =
    useState<ArtworkReference | null>(null);
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null);
  const [artworkLocation, setArtworkLocation] =
    useState<DecorationLocation>("front");
  const [artworkWidthPercent, setArtworkWidthPercent] = useState(
    DEFAULT_ARTWORK_WIDTH,
  );
  const [artworkPosition, setArtworkPosition] = useState(
    locationPositionPresets.front,
  );
  const [baseImageAspectRatio, setBaseImageAspectRatio] = useState(4 / 3);
  const [isPreparingArtwork, setIsPreparingArtwork] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const artworkCanvasRef = useRef<HTMLDivElement>(null);
  const activeGestureRef = useRef<ArtworkGesture | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modificationPrompt.trim()) {
      toast({
        title: "입력 필요",
        description: "수정할 내용을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      await onModifyImage(modificationPrompt);
      setModificationPrompt("");
    } catch (error) {
      console.error("Error modifying image:", error);
    }
  };

  const loadArtworkFile = async (
    file: File,
    initialPosition = locationPositionPresets[artworkLocation],
  ) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "이미지 파일 필요",
        description: "JPG, PNG, WEBP 이미지 파일을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "파일 용량 초과",
        description: "10MB 이하 이미지를 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsPreparingArtwork(true);
      const prepared = await prepareArtworkReference(file);
      setUploadedArtwork(prepared);
      setArtworkPreview(
        `data:${prepared.mimeType};base64,${prepared.base64}`,
      );
      setArtworkPosition(initialPosition);
    } catch (error) {
      toast({
        title: "이미지 처리 실패",
        description:
          error instanceof Error
            ? error.message
            : "다른 이미지로 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsPreparingArtwork(false);
    }
  };

  const handleArtworkFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await loadArtworkFile(file);
  };

  const handleApplyArtwork = async () => {
    if (!uploadedArtwork) {
      fileInputRef.current?.click();
      return;
    }

    const locationLabel =
      locationOptions.find((option) => option.value === artworkLocation)
        ?.label || "앞면";
    const artworkSize = resolveArtworkSize(artworkWidthPercent);

    await onModifyImage(
      `업로드한 이미지를 원본 형태와 색상을 유지해 옷의 ${locationLabel}, 화면 기준 왼쪽 ${Math.round(artworkPosition.xPercent)}%·위쪽 ${Math.round(artworkPosition.yPercent)}% 지점에 이미지 폭의 약 ${Math.round(artworkWidthPercent)}% 크기로 자연스럽게 적용해주세요.`,
      {
        referenceImage: uploadedArtwork,
        placement: {
          location: artworkLocation,
          size: artworkSize,
          xPercent: artworkPosition.xPercent,
          yPercent: artworkPosition.yPercent,
          widthPercent: artworkWidthPercent,
        },
      },
    );
  };

  const clearArtwork = () => {
    setUploadedArtwork(null);
    setArtworkPreview(null);
    setArtworkPosition(locationPositionPresets.front);
    setArtworkWidthPercent(DEFAULT_ARTWORK_WIDTH);
  };

  const getPointerPercent = (clientX: number, clientY: number) => {
    const canvas = artworkCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      xPercent: ((clientX - rect.left) / rect.width) * 100,
      yPercent: ((clientY - rect.top) / rect.height) * 100,
      canvasWidth: rect.width,
    };
  };

  const clampArtworkPosition = (
    xPercent: number,
    yPercent: number,
    widthPercent = artworkWidthPercent,
  ) => {
    const xMargin = widthPercent / 2;
    const yMargin = Math.max(6, widthPercent / 4);
    return {
      xPercent: Math.min(100 - xMargin, Math.max(xMargin, xPercent)),
      yPercent: Math.min(100 - yMargin, Math.max(yMargin, yPercent)),
    };
  };

  const handleCanvasPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!artworkPreview || isLoading) return;
    if (event.target !== event.currentTarget) return;
    const point = getPointerPercent(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    setArtworkPosition(
      clampArtworkPosition(point.xPercent, point.yPercent),
    );
  };

  const handleMovePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (isLoading) return;
    const point = getPointerPercent(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    activeGestureRef.current = {
      mode: "move",
      pointerId: event.pointerId,
      offsetXPercent: point.xPercent - artworkPosition.xPercent,
      offsetYPercent: point.yPercent - artworkPosition.yPercent,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleResizePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (isLoading) return;
    event.preventDefault();
    event.stopPropagation();
    activeGestureRef.current = {
      mode: "resize",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startWidthPercent: artworkWidthPercent,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleArtworkPointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const gesture = activeGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const point = getPointerPercent(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();

    if (gesture.mode === "move") {
      setArtworkPosition(
        clampArtworkPosition(
          point.xPercent - gesture.offsetXPercent,
          point.yPercent - gesture.offsetYPercent,
        ),
      );
      return;
    }

    const deltaPercent =
      ((event.clientX - gesture.startClientX) / point.canvasWidth) * 100;
    const nextWidth = Math.min(
      MAX_ARTWORK_WIDTH,
      Math.max(
        MIN_ARTWORK_WIDTH,
        gesture.startWidthPercent + deltaPercent,
      ),
    );
    setArtworkWidthPercent(nextWidth);
    setArtworkPosition((current) =>
      clampArtworkPosition(
        current.xPercent,
        current.yPercent,
        nextWidth,
      ),
    );
  };

  const handleArtworkPointerEnd = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (activeGestureRef.current?.pointerId !== event.pointerId) return;
    activeGestureRef.current = null;
  };

  const handleLocationChange = (value: DecorationLocation) => {
    setArtworkLocation(value);
    setArtworkPosition(locationPositionPresets[value]);
  };

  const handleArtworkWidthChange = (values: number[]) => {
    const nextWidth = Math.min(
      MAX_ARTWORK_WIDTH,
      Math.max(MIN_ARTWORK_WIDTH, values[0] || DEFAULT_ARTWORK_WIDTH),
    );
    setArtworkWidthPercent(nextWidth);
    setArtworkPosition((current) =>
      clampArtworkPosition(
        current.xPercent,
        current.yPercent,
        nextWidth,
      ),
    );
  };

  const handleArtworkDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleArtworkDrop = async (
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    event.preventDefault();

    const canvas = artworkCanvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const dropPosition = rect
      ? {
          xPercent: Math.min(
            92,
            Math.max(8, ((event.clientX - rect.left) / rect.width) * 100),
          ),
          yPercent: Math.min(
            92,
            Math.max(8, ((event.clientY - rect.top) / rect.height) * 100),
          ),
        }
      : locationPositionPresets[artworkLocation];

    await loadArtworkFile(file, dropPosition);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Image and modification input area - occupies 2/3 of the space */}
      <Card className="p-6 md:col-span-2">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">이미지 수정</h3>
          <p className="text-sm text-gray-500">
            AI에게 선택한 이미지를 어떻게 수정할지 설명해주세요. 
            디테일, 컬러, 스타일 등 변경하고 싶은 부분을 자세히 설명하세요.
          </p>
          
          <div className="flex flex-col items-center space-y-4">
            <div
              ref={artworkCanvasRef}
              className={`relative w-full max-w-xl touch-pan-y select-none overflow-hidden rounded-xl border bg-gray-50 ${
                artworkPreview
                  ? "cursor-crosshair border-brand/40 shadow-inner"
                  : "border-gray-200"
              }`}
              style={{ aspectRatio: baseImageAspectRatio }}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleArtworkPointerMove}
              onPointerUp={handleArtworkPointerEnd}
              onPointerCancel={handleArtworkPointerEnd}
              onDragOver={handleArtworkDragOver}
              onDrop={(event) => void handleArtworkDrop(event)}
            >
              {selectedImageUrl && !imageError ? (
                <img
                  src={selectedImageUrl}
                  alt="이미지 배치 대상 의류"
                  className="pointer-events-none h-full w-full object-contain"
                  draggable={false}
                  onError={() => setImageError(true)}
                  onLoad={(event) => {
                    const image = event.currentTarget;
                    if (image.naturalWidth && image.naturalHeight) {
                      setBaseImageAspectRatio(
                        image.naturalWidth / image.naturalHeight,
                      );
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                  <ImageOff className="w-12 h-12 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">이미지를 불러올 수 없습니다</p>
                </div>
              )}
              {artworkPreview && (
                <>
                  <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-bold text-white shadow">
                    로고를 누른 채 원하는 위치로 이동
                  </div>
                  <div
                    className="absolute -translate-x-1/2 -translate-y-1/2 touch-none cursor-grab rounded-lg border-2 border-dashed border-brand bg-white/15 p-1 shadow-lg active:cursor-grabbing"
                    style={{
                      left: `${artworkPosition.xPercent}%`,
                      top: `${artworkPosition.yPercent}%`,
                      width: `${artworkWidthPercent}%`,
                    }}
                    onPointerDown={handleMovePointerDown}
                  >
                    <img
                      src={artworkPreview}
                      alt="배치할 업로드 이미지"
                      className="block h-auto w-full object-contain"
                      draggable={false}
                    />
                    <span className="pointer-events-none absolute -right-2 -top-2 rounded-full bg-brand p-1 text-white shadow">
                      <Move className="h-3 w-3" />
                    </span>
                    <button
                      type="button"
                      className="absolute -bottom-3 -right-3 flex h-7 w-7 touch-none items-center justify-center rounded-full border-2 border-white bg-brand text-white shadow-md cursor-nwse-resize"
                      onPointerDown={handleResizePointerDown}
                      aria-label="이미지 크기 조절"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
              {!artworkPreview && !isLoading && (
                <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-lg bg-white/90 px-3 py-2 text-center text-xs font-semibold text-gray-600 shadow-sm">
                  PC에서는 로고 파일을 이 옷 위로 바로 끌어 놓을 수 있습니다.
                </div>
              )}
              {isLoading && (
                <div className="absolute inset-0 z-20 bg-black bg-opacity-30 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                </div>
              )}
            </div>

            <div className="w-full rounded-2xl border border-brand/15 bg-brand/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="flex items-center gap-2 font-extrabold text-gray-950">
                    <ImagePlus className="h-5 w-5 text-brand" />
                    내 이미지 옷에 넣기
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-gray-600">
                    휴대폰이나 PC의 로고·사진·일러스트를 올리면 AI가 유형과
                    적합한 인쇄 방식을 분석해 장당 공임에 반영합니다.
                  </p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleArtworkFile}
              />

              {artworkPreview ? (
                <div className="mt-4 rounded-xl border border-brand/20 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-xs font-semibold text-gray-700">
                      {uploadedArtwork?.fileName}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading}
                      >
                        교체
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={clearArtwork}
                        disabled={isLoading}
                        aria-label="업로드 이미지 제거"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2">
                    <p className="flex items-center gap-1.5 text-xs font-extrabold text-brand">
                      <Move className="h-4 w-4" />
                      로고를 이동하거나 모서리로 크기를 조절하세요
                    </p>
                    <p className="text-[11px] font-semibold text-gray-500">
                      현재 위치 {Math.round(artworkPosition.xPercent)}% ·{" "}
                      {Math.round(artworkPosition.yPercent)}% · 크기{" "}
                      {Math.round(artworkWidthPercent)}%
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="mt-4 flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand/25 bg-white px-4 py-7 text-center transition-colors hover:border-brand/50 hover:bg-brand/5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || isPreparingArtwork}
                >
                  <Upload className="h-6 w-6 text-brand" />
                  <span className="mt-2 text-sm font-bold text-gray-900">
                    {isPreparingArtwork
                      ? "이미지 준비 중..."
                      : "이미지를 선택해주세요"}
                  </span>
                  <span className="mt-1 text-xs text-gray-500">
                    JPG, PNG, WEBP · 최대 10MB
                  </span>
                </button>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 flex items-center gap-1 text-xs font-bold text-gray-700">
                    <MapPin className="h-3.5 w-3.5" /> 제작 위치 구분
                  </p>
                  <Select
                    value={artworkLocation}
                    onValueChange={(value) =>
                      handleLocationChange(value as DecorationLocation)
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {locationOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-lg bg-white px-3 py-2.5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="flex items-center gap-1 text-xs font-bold text-gray-700">
                      <Maximize2 className="h-3.5 w-3.5" /> 이미지 크기
                    </p>
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-extrabold text-brand">
                      {Math.round(artworkWidthPercent)}%
                    </span>
                  </div>
                  <Slider
                    value={[artworkWidthPercent]}
                    min={MIN_ARTWORK_WIDTH}
                    max={MAX_ARTWORK_WIDTH}
                    step={1}
                    onValueChange={handleArtworkWidthChange}
                    disabled={isLoading || !artworkPreview}
                    aria-label="업로드 이미지 크기"
                  />
                  <p className="mt-2 text-[11px] leading-4 text-gray-500">
                    슬라이더 또는 이미지 오른쪽 아래 핸들로 조절
                  </p>
                </div>
              </div>

              <Button
                type="button"
                className="mt-4 w-full bg-brand hover:bg-brand-dark"
                onClick={() => void handleApplyArtwork()}
                disabled={isLoading || isPreparingArtwork}
              >
                {isLoading ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                    이미지 적용·분석 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    옷에 적용하고 공임 분석
                  </>
                )}
              </Button>

              {currentArtworkAnalysis && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-bold text-emerald-700">
                    AI 업로드 이미지 분석 완료
                  </p>
                  <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-extrabold text-gray-950">
                      {currentArtworkAnalysis.artworkTypeLabel} ·{" "}
                      {currentArtworkAnalysis.priceLabel || "인쇄 방식 상담"}
                    </p>
                    <p className="text-sm font-black text-brand">
                      장당 {formatArtworkPrice(currentArtworkAnalysis)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-gray-600">
                    {currentArtworkAnalysis.reason}
                  </p>
                </div>
              )}
            </div>

            {selectedImageUrl && (
              <ProductionEstimateCard
                selectedType={selectedType}
                selectedMaterial={selectedMaterial}
                imageUrl={selectedImageUrl}
                designContext={designContext}
                uploadedArtwork={currentArtworkAnalysis}
              />
            )}
            
            <form onSubmit={handleSubmit} className="w-full space-y-4">
              <Textarea
                placeholder="이미지를 어떻게 수정할지 설명해주세요. (예: '소매를 짧게 만들어주세요', '색상을 파란색으로 변경해주세요')"
                value={modificationPrompt}
                onChange={(e) => setModificationPrompt(e.target.value)}
                className="min-h-[120px] resize-none"
                disabled={isLoading}
              />
              <div className="flex space-x-2">
                <Button
                  type="submit"
                  className="bg-brand hover:bg-brand-dark flex-1"
                  disabled={isLoading || !modificationPrompt.trim()}
                >
                  {isLoading ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></span>
                      수정 중...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" /> 수정하기
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onResetModifications}
                  disabled={isLoading || modificationHistory.length === 0}
                >
                  <RefreshCw className="h-4 w-4 mr-2" /> 처음으로
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Card>

      {/* Chat history - occupies 1/3 of the space */}
      <Card className="p-6 overflow-hidden flex flex-col">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">수정 챗봇</h3>
          
          {modificationHistory.length > 0 ? (
            <div className="overflow-y-auto max-h-[500px] flex flex-col space-y-4 pr-2">
              {modificationHistory.map((entry, index) => (
                <div key={index} className="space-y-2">
                  <div className="bg-gray-100 p-3 rounded-lg rounded-br-none ml-auto max-w-[90%]">
                    <p className="text-sm font-medium">나</p>
                    <p className="text-sm whitespace-pre-wrap">{entry.prompt}</p>
                  </div>
                  <div className="bg-brand/10 p-3 rounded-lg rounded-bl-none mr-auto max-w-[90%] space-y-2">
                    <p className="text-sm font-medium">AI</p>
                    <p className="text-sm whitespace-pre-wrap">{entry.response}</p>
                    {entry.imageUrl && (
                      <div className="mt-2 overflow-hidden rounded-lg border">
                        <img
                          src={entry.imageUrl}
                          alt="수정된 이미지"
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => onSelectHistoryImage(entry.imageUrl, entry.imagePath, index)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2 w-full"
                          onClick={() => onSelectHistoryImage(entry.imageUrl, entry.imagePath, index)}
                          disabled={isLoading}
                        >
                          이 이미지로 계속 수정
                        </Button>
                      </div>
                    )}
                  </div>
                  {index < modificationHistory.length - 1 && (
                    <Separator className="my-2" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              아직 수정 내역이 없습니다. 수정 요청을 입력해보세요.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
