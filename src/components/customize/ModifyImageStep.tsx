
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Calculator,
  ImageOff,
  ImagePlus,
  Loader2,
  MapPin,
  Maximize2,
  Move,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { createExactArtworkComposite } from "@/lib/artwork-composite";
import {
  artworkLocationLabels,
  DEFAULT_ARTWORK_WIDTH,
  formatArtworkPercent,
  MAX_ARTWORK_WIDTH,
  MIN_ARTWORK_WIDTH,
  prepareArtworkReference,
  resolveArtworkSize,
  resolveArtworkPlacementPrompt,
  summarizeArtworkPlacement,
  type ArtworkContentType,
} from "@/lib/artwork-upload";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import { ProductionEstimateCard } from "./ProductionEstimateCard";
import type {
  ArtworkPlacement,
  ArtworkReference,
  CompositedImageReference,
  ImageModificationEntry,
} from "@/types/customize";
import type {
  ProductionEstimateResult,
  UploadedArtworkAnalysis,
} from "@/types/productionEstimate";
import { screenTrademarkImage } from "@/services/trademarkScreening";
import type { TrademarkScreeningResult } from "@/types/trademark";
import type { ProductionCountry } from "@/lib/production-country";
import { inferClosetSlotFromCategory } from "@/lib/closet-character-config";

const placementExamples = [
  "앞면 왼쪽 가슴에 작게 넣어줘",
  "앞면 중앙에 크게 넣어줘",
  "등 중앙에 중간 크기로 넣어줘",
  "오른쪽 소매에 작게 넣어줘",
  "앞면 중앙에 거의 안 보이게 넣어줘",
];

const compactScoreLabels = [
  ["text", "문자"],
  ["shape", "도형"],
  ["transformation", "변형"],
  ["productClass", "상품류"],
] as const;

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
  selectedFit?: string;
  designContext?: string;
  modificationHistory: ImageModificationEntry[];
  currentArtworkAnalysis: UploadedArtworkAnalysis | null;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onEstimateChange: (estimate: ProductionEstimateResult | null) => void;
  onArtworkScreeningApplied: (screeningId: string | null) => void;
  onModifyImage: (
    prompt: string,
    options?: {
      referenceImage?: ArtworkReference;
      placement?: ArtworkPlacement;
      compositedImage?: CompositedImageReference;
    },
  ) => Promise<boolean>;
  onResetModifications: () => void;
  onSelectHistoryImage: (imageUrl: string | null, imagePath?: string | null, index?: number) => void;
  productionCountry: ProductionCountry;
  onChangeCountry: (country: ProductionCountry) => void;
  designId?: string | null;
  isSavingDesign?: boolean;
  onGoToEstimate: () => void;
}

export const ModifyImageStep = ({
  isLoading,
  selectedImageUrl,
  selectedType,
  selectedMaterial,
  selectedFit,
  designContext,
  modificationHistory,
  currentArtworkAnalysis,
  quantity,
  onQuantityChange,
  onEstimateChange,
  onArtworkScreeningApplied,
  onModifyImage,
  onResetModifications,
  onSelectHistoryImage,
  productionCountry,
  onChangeCountry,
  designId,
  isSavingDesign,
  onGoToEstimate,
}: ModifyImageStepProps) => {
  const navigate = useNavigate();
  const [modificationPrompt, setModificationPrompt] = useState("");
  const [imageError, setImageError] = useState(false);
  const [uploadedArtwork, setUploadedArtwork] =
    useState<ArtworkReference | null>(null);
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null);
  const [sourceArtworkFile, setSourceArtworkFile] = useState<File | null>(null);
  const [artworkContentType, setArtworkContentType] =
    useState<ArtworkContentType>("logo");
  const [artworkPlacementPrompt, setArtworkPlacementPrompt] = useState(
    placementExamples[0],
  );
  const initialPlacement = resolveArtworkPlacementPrompt(
    placementExamples[0],
    DEFAULT_ARTWORK_WIDTH,
  );
  const [resolvedPlacement, setResolvedPlacement] =
    useState<ArtworkPlacement>(initialPlacement.placement);
  const [placementSummary, setPlacementSummary] = useState(
    initialPlacement.summary,
  );
  const [lastResolvedPrompt, setLastResolvedPrompt] = useState(
    placementExamples[0],
  );
  const [placementSource, setPlacementSource] = useState<"prompt" | "drag">(
    "prompt",
  );
  const [baseImageAspectRatio, setBaseImageAspectRatio] = useState(4 / 3);
  const [isPreparingArtwork, setIsPreparingArtwork] = useState(false);
  const [isApplyingArtwork, setIsApplyingArtwork] = useState(false);
  const [trademarkScreening, setTrademarkScreening] =
    useState<TrademarkScreeningResult | null>(null);
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
      const modified = await onModifyImage(modificationPrompt);
      if (modified) {
        setModificationPrompt("");
      }
    } catch (error) {
      console.error("Error modifying image:", error);
    }
  };

  const loadArtworkFile = async (
    file: File,
    contentType = artworkContentType,
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
      const previousScreeningId = trademarkScreening?.id || null;
      setIsPreparingArtwork(true);
      setTrademarkScreening(null);
      const prepared = await prepareArtworkReference(file, contentType);
      setSourceArtworkFile(file);
      setUploadedArtwork(prepared);
      setArtworkPreview(
        `data:${prepared.mimeType};base64,${prepared.base64}`,
      );
      if (
        contentType === "logo" &&
        prepared.backgroundRemoval === "not-detected"
      ) {
        toast({
          title: "단색 배경을 찾지 못했습니다",
          description:
            "로고가 손상되지 않도록 원본을 유지했습니다. 흰색·단색 배경 또는 투명 PNG를 사용하면 더 정확합니다.",
        });
      }
      const screening = await screenTrademarkImage({
        imageBase64: prepared.base64,
        mimeType: prepared.mimeType,
        source: "upload",
        selectedType,
        selectedMaterial,
        previousScreeningId,
      });
      setTrademarkScreening(screening);

      if (screening.decision === "blocked") {
        toast({
          title: "상표 위험 이미지 적용 차단",
          description:
            "유명 타사 상표로 의심되는 이미지입니다. 다른 이미지를 사용해주세요.",
          variant: "destructive",
        });
      } else if (screening.decision === "review") {
        toast({
          title: "상표 검토 필요",
          description:
            "이미지는 적용할 수 있지만 펀딩 승인 전에 관리자가 권리 관계를 확인합니다.",
        });
      }
    } catch (error) {
      setSourceArtworkFile(null);
      setUploadedArtwork(null);
      setArtworkPreview(null);
      setTrademarkScreening(null);
      toast({
        title: "이미지 검수 실패",
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

  const handleArtworkContentTypeChange = async (
    contentType: ArtworkContentType,
  ) => {
    setArtworkContentType(contentType);
    if (sourceArtworkFile) {
      await loadArtworkFile(sourceArtworkFile, contentType);
    }
  };

  const handleResolvePlacement = () => {
    if (!artworkPlacementPrompt.trim()) {
      toast({
        title: "위치 설명 필요",
        description:
          "예: '앞면 왼쪽 가슴에 작게 넣어줘'처럼 입력해주세요.",
        variant: "destructive",
      });
      return null;
    }

    const resolved = resolveArtworkPlacementPrompt(
      artworkPlacementPrompt,
      resolvedPlacement.widthPercent,
    );
    setResolvedPlacement(resolved.placement);
    setPlacementSummary(resolved.summary);
    setLastResolvedPrompt(artworkPlacementPrompt.trim());
    setPlacementSource("prompt");
    return resolved;
  };

  const handleApplyArtwork = async () => {
    if (!uploadedArtwork || !selectedImageUrl) {
      fileInputRef.current?.click();
      return;
    }
    if (!trademarkScreening) {
      toast({
        title: "상표 검수 필요",
        description: "이미지를 다시 선택해 상표 검수를 완료해주세요.",
        variant: "destructive",
      });
      return;
    }
    if (trademarkScreening.decision === "blocked") {
      toast({
        title: "이미지 적용 불가",
        description:
          "타사 상표 사용 위험이 높아 이 이미지는 의류에 적용할 수 없습니다.",
        variant: "destructive",
      });
      return;
    }
    let placement = resolvedPlacement;
    let appliedWithDrag = placementSource === "drag";
    if (artworkPlacementPrompt.trim() !== lastResolvedPrompt) {
      const resolved = handleResolvePlacement();
      if (!resolved) return;
      placement = resolved.placement;
      appliedWithDrag = false;
    }
    const locationLabel = artworkLocationLabels[placement.location];

    try {
      setIsApplyingArtwork(true);
      const compositedImage = await createExactArtworkComposite({
        baseImageUrl: selectedImageUrl,
        artwork: uploadedArtwork,
        placement,
      });

      const applied = await onModifyImage(
        `사용자 요청 "${artworkPlacementPrompt.trim()}"${
          appliedWithDrag ? " 후 드래그로 미세 조정한 위치" : ""
        }에 따라 업로드한 ${
          selectedType === "knit"
            ? "이미지를 프린팅·직자수 없이 봉제 패치(와펜) 방식으로"
            : artworkContentType === "logo"
              ? "로고의 겉 배경을 제거하고"
              : "사진의 배경을 그대로 유지해"
        } 옷의 ${locationLabel}, 화면 기준 가로 ${Math.round(
          placement.xPercent,
        )}%·세로 ${Math.round(
          placement.yPercent,
        )}% 지점에 이미지 폭의 약 ${formatArtworkPercent(
          placement.widthPercent,
        )}% 크기로 정확히 적용했습니다.`,
        {
          referenceImage: uploadedArtwork,
          placement,
          compositedImage,
        },
      );
      if (applied) {
        onArtworkScreeningApplied(trademarkScreening.id);
        clearArtwork();
      }
    } catch (error) {
      toast({
        title: "이미지 적용 실패",
        description:
          error instanceof Error
            ? error.message
            : "이미지를 다시 올린 뒤 적용해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsApplyingArtwork(false);
    }
  };

  const clearArtwork = () => {
    setSourceArtworkFile(null);
    setUploadedArtwork(null);
    setArtworkPreview(null);
    setTrademarkScreening(null);
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
    widthPercent = resolvedPlacement.widthPercent,
  ) => {
    const xMargin = widthPercent / 2;
    const yMargin = Math.max(6, widthPercent / 4);
    return {
      xPercent: Math.min(100 - xMargin, Math.max(xMargin, xPercent)),
      yPercent: Math.min(100 - yMargin, Math.max(yMargin, yPercent)),
    };
  };

  const applyDraggedPlacement = (placement: ArtworkPlacement) => {
    setResolvedPlacement(placement);
    setPlacementSummary(summarizeArtworkPlacement(placement));
    setPlacementSource("drag");
  };

  const handleMovePointerDown = (
    event: React.PointerEvent<HTMLElement>,
  ) => {
    if (isLoading || isApplyingArtwork) return;
    const point = getPointerPercent(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    activeGestureRef.current = {
      mode: "move",
      pointerId: event.pointerId,
      offsetXPercent: point.xPercent - resolvedPlacement.xPercent,
      offsetYPercent: point.yPercent - resolvedPlacement.yPercent,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleResizePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (isLoading || isApplyingArtwork) return;
    event.preventDefault();
    event.stopPropagation();
    activeGestureRef.current = {
      mode: "resize",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startWidthPercent: resolvedPlacement.widthPercent,
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
      const position = clampArtworkPosition(
        point.xPercent - gesture.offsetXPercent,
        point.yPercent - gesture.offsetYPercent,
      );
      applyDraggedPlacement({
        ...resolvedPlacement,
        ...position,
      });
      return;
    }

    const deltaPercent =
      ((event.clientX - gesture.startClientX) / point.canvasWidth) * 100;
    const widthPercent = Math.min(
      MAX_ARTWORK_WIDTH,
      Math.max(
        MIN_ARTWORK_WIDTH,
        gesture.startWidthPercent + deltaPercent,
      ),
    );
    const position = clampArtworkPosition(
      resolvedPlacement.xPercent,
      resolvedPlacement.yPercent,
      widthPercent,
    );
    applyDraggedPlacement({
      ...resolvedPlacement,
      ...position,
      widthPercent,
      size: resolveArtworkSize(widthPercent),
    });
  };

  const handleArtworkPointerEnd = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (activeGestureRef.current?.pointerId !== event.pointerId) return;
    activeGestureRef.current = null;
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
    const point = getPointerPercent(event.clientX, event.clientY);
    if (point) {
      const position = clampArtworkPosition(point.xPercent, point.yPercent);
      applyDraggedPlacement({
        ...resolvedPlacement,
        ...position,
      });
    }
    await loadArtworkFile(file);
  };

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-8">
      {/* Image and modification input area - occupies 2/3 of the space */}
      <Card className="border-0 bg-transparent p-0 shadow-none sm:border sm:bg-card sm:p-6 sm:shadow-sm md:col-span-2">
        <div className="space-y-4">
          <div className="px-1 sm:px-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[17px] font-semibold sm:text-lg">이미지 수정</h3>
                <p className="mt-1.5 text-[14px] leading-6 text-gray-500 sm:text-sm">
                  AI에게 선택한 이미지를 어떻게 수정할지 설명해주세요.
                  디테일, 컬러, 스타일 등 변경하고 싶은 부분을 자세히 설명하세요.
                </p>
              </div>
              {selectedImageUrl && (
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    className="h-11 rounded-full bg-brand px-4 text-sm font-bold hover:bg-brand-dark"
                    onClick={onGoToEstimate}
                    disabled={isSavingDesign}
                    data-tutorial="customize-go-to-estimate"
                  >
                    {isSavingDesign ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Calculator className="mr-2 h-4 w-4" />
                    )}
                    자동 견적 확인하기
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-full border-brand/30 bg-brand/5 px-4 text-sm font-bold text-brand hover:bg-brand/10"
                    onClick={() =>
                      navigate("/closet", {
                        state: {
                          pendingGarment: {
                            id: `ai-${Date.now()}`,
                            slot: inferClosetSlotFromCategory(selectedType),
                            label: designContext?.split("\n")[0]?.slice(0, 24) || "내가 만든 디자인",
                            imageUrl: selectedImageUrl,
                            source: "ai_design",
                            designRef: {
                              imageUrl: selectedImageUrl,
                              selectedType,
                              selectedMaterial,
                              fitLabel: selectedFit,
                              designContext,
                              designId,
                            },
                          },
                        },
                      })
                    }
                  >
                    가상 마네킹에 입혀보기
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center space-y-4">
            <div
              className={`relative w-full max-w-3xl select-none overflow-hidden rounded-[1.35rem] border bg-gray-50 shadow-[0_18px_55px_rgba(36,26,24,0.08)] sm:rounded-xl ${
                artworkPreview
                  ? "border-brand/40 shadow-inner"
                  : "border-gray-200"
              }`}
              style={{ aspectRatio: baseImageAspectRatio }}
              data-tutorial="customize-modify"
            >
              <div
                ref={artworkCanvasRef}
                className="absolute inset-0"
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
                  <div className="flex h-full w-full flex-col items-center justify-center bg-gray-100">
                    <ImageOff className="mb-2 h-12 w-12 text-gray-400" />
                    <p className="text-sm text-gray-500">
                      이미지를 불러올 수 없습니다
                    </p>
                  </div>
                )}
                {artworkPreview && (
                  <>
                    <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-bold text-white shadow">
                      프롬프트 적용 후 드래그로 미세 조절
                    </div>
                    <div
                      className="absolute -translate-x-1/2 -translate-y-1/2 touch-none cursor-grab active:cursor-grabbing"
                      style={{
                        left: `${resolvedPlacement.xPercent}%`,
                        top: `${resolvedPlacement.yPercent}%`,
                        width: `${resolvedPlacement.widthPercent}%`,
                      }}
                      onPointerDown={handleMovePointerDown}
                    >
                      <img
                        src={artworkPreview}
                        alt="배치할 업로드 이미지"
                        className="block h-auto w-full object-contain"
                        draggable={false}
                      />
                      <span className="pointer-events-none absolute inset-0 rounded-lg border-2 border-dashed border-brand shadow-lg" />
                      {resolvedPlacement.widthPercent > 4 ? (
                        <span className="pointer-events-none absolute -right-2 -top-2 rounded-full bg-brand p-1 text-white shadow">
                          <Move className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="absolute right-full top-1/2 mr-2 flex h-7 w-7 -translate-y-1/2 touch-none items-center justify-center rounded-full border-2 border-white bg-brand text-white shadow-md"
                          onPointerDown={handleMovePointerDown}
                          aria-label="매우 작은 이미지 위치 이동"
                        >
                          <Move className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        className={`absolute flex h-7 w-7 touch-none cursor-nwse-resize items-center justify-center rounded-full border-2 border-white bg-brand text-white shadow-md ${
                          resolvedPlacement.widthPercent <= 4
                            ? "left-full top-1/2 ml-2 -translate-y-1/2"
                            : "-bottom-3 -right-3"
                        }`}
                        onPointerDown={handleResizePointerDown}
                        aria-label="이미지 크기 조절"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}
                {!artworkPreview && !isLoading && (
                  <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-lg bg-white/92 px-3 py-2 text-center text-[11px] font-semibold leading-4 text-gray-600 shadow-sm sm:inset-x-3 sm:bottom-3 sm:text-xs">
                    이미지 선택 또는 파일 드롭 후 프롬프트·드래그를 모두 사용할
                    수 있습니다.
                  </div>
                )}
                {(isLoading || isApplyingArtwork) && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30">
                    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-white" />
                  </div>
                )}
              </div>
            </div>

            <div
              className="w-full rounded-2xl border border-brand/15 bg-brand/5 p-4 sm:p-5"
              data-tutorial="customize-artwork"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="flex items-center gap-2 font-extrabold text-gray-950">
                    <ImagePlus className="h-5 w-5 text-brand" />
                    내 이미지 옷에 넣기
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-gray-600">
                    로고는 겉 배경을 자동으로 지우고, 사진은 배경을 유지합니다.
                    위치와 크기는 프롬프트로 지정한 뒤 드래그로 미세 조절할 수
                    있습니다.
                  </p>
                  {selectedType === "knit" && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">
                      니트에 올리는 로고·이미지는 프린팅·직자수 없이 패치(와펜)
                      방식으로만 제작됩니다.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs font-bold text-gray-700">
                  1. 추가할 이미지 유형
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                      artworkContentType === "logo"
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-gray-200 bg-white text-gray-700 hover:border-brand/30"
                    }`}
                    onClick={() =>
                      void handleArtworkContentTypeChange("logo")
                    }
                    disabled={isLoading || isPreparingArtwork}
                    aria-pressed={artworkContentType === "logo"}
                  >
                    <span className="block text-sm font-extrabold">
                      로고·일러스트
                    </span>
                    <span className="mt-1 block text-[11px] leading-4">
                      겉 배경 자동 제거
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                      artworkContentType === "photo"
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-gray-200 bg-white text-gray-700 hover:border-brand/30"
                    }`}
                    onClick={() =>
                      void handleArtworkContentTypeChange("photo")
                    }
                    disabled={isLoading || isPreparingArtwork}
                    aria-pressed={artworkContentType === "photo"}
                  >
                    <span className="block text-sm font-extrabold">사진</span>
                    <span className="mt-1 block text-[11px] leading-4">
                      원본 배경 그대로 유지
                    </span>
                  </button>
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
                    <p className="text-xs font-extrabold text-brand">
                      {artworkContentType === "logo"
                        ? uploadedArtwork?.backgroundRemoval === "removed"
                          ? "배경과 흰 테두리를 정리한 미리보기입니다."
                          : uploadedArtwork?.backgroundRemoval ===
                              "already-transparent"
                            ? "기존 투명 배경을 그대로 보존했습니다."
                            : "로고 손상 방지를 위해 원본에 가깝게 유지했습니다."
                        : "사진 배경을 제거하지 않고 원본 그대로 사용합니다."}
                    </p>
                    <p className="text-[11px] font-semibold text-gray-500">
                      {artworkContentType === "logo"
                        ? uploadedArtwork?.backgroundRemoval === "not-detected"
                          ? "원본 보호 PNG"
                          : "투명 PNG로 변환"
                        : "고화질 WEBP로 변환"}
                    </p>
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-gray-500">
                    미리보기의 이미지를 직접 끌어 위치를 조절하고, 오른쪽 아래
                    핸들로 크기를 바꿀 수도 있습니다.
                  </p>
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
                    2. JPG, PNG, WEBP · 최대 10MB
                  </span>
                </button>
              )}

              {trademarkScreening && (
                <div
                  className={`mt-4 rounded-xl border p-3 ${
                    trademarkScreening.decision === "blocked"
                      ? "border-red-200 bg-red-50"
                      : trademarkScreening.decision === "review"
                        ? "border-amber-200 bg-amber-50"
                        : "border-emerald-200 bg-emerald-50"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {trademarkScreening.decision === "clear" ? (
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    ) : (
                      <ShieldAlert
                        className={`mt-0.5 h-5 w-5 shrink-0 ${
                          trademarkScreening.decision === "blocked"
                            ? "text-red-600"
                            : "text-amber-600"
                        }`}
                      />
                    )}
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-extrabold ${
                          trademarkScreening.decision === "blocked"
                            ? "text-red-700"
                            : trademarkScreening.decision === "review"
                              ? "text-amber-700"
                              : "text-emerald-700"
                        }`}
                      >
                        {trademarkScreening.decision === "blocked"
                          ? "상표 위험 · 적용 차단"
                          : trademarkScreening.decision === "review"
                            ? "상표 검토 필요 · 관리자 확인"
                            : "상표 자동 검수 통과"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-gray-700">
                        {trademarkScreening.reason}
                      </p>
                      <div className="mt-2 rounded-lg bg-white/75 p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-gray-500">
                            복합 위험점수
                          </span>
                          <span className="text-sm font-black text-gray-900">
                            {Math.round(
                              trademarkScreening.composite_risk_score || 0,
                            )}
                            /100
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-4 gap-1.5">
                          {compactScoreLabels.map(([key, label]) => (
                            <div
                              key={key}
                              className="rounded-md border border-black/5 bg-white px-1.5 py-1 text-center"
                            >
                              <p className="text-[9px] font-bold text-gray-400">
                                {label}
                              </p>
                              <p className="text-[11px] font-extrabold text-gray-700">
                                {Math.round(
                                  trademarkScreening.similarity_scores?.[key] ||
                                    0,
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                      {trademarkScreening.detected_marks.length > 0 && (
                        <p className="mt-1 text-[11px] font-semibold text-gray-600">
                          감지 표지:{" "}
                          {trademarkScreening.detected_marks
                            .map((mark) => mark.displayName)
                            .join(", ")}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] leading-4 text-gray-500">
                        {trademarkScreening.decision === "review"
                          ? "등록 후 관리자가 상표권 보유·사용 허가 여부를 확인하고 승인 또는 거절합니다."
                          : trademarkScreening.disclaimer}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 rounded-xl border border-brand/15 bg-white p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-gray-700">
                  <MapPin className="h-3.5 w-3.5" />
                  3. 이미지 위치와 크기를 문장으로 입력
                </p>
                <Textarea
                  value={artworkPlacementPrompt}
                  onChange={(event) =>
                    setArtworkPlacementPrompt(event.target.value)
                  }
                  placeholder="예: 앞면 왼쪽 가슴에 작게 넣어줘"
                  className="min-h-[82px] resize-none"
                  disabled={isLoading || isApplyingArtwork}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {placementExamples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand"
                      onClick={() => {
                        setArtworkPlacementPrompt(example);
                        const resolved = resolveArtworkPlacementPrompt(
                          example,
                          resolvedPlacement.widthPercent,
                        );
                        setResolvedPlacement(resolved.placement);
                        setPlacementSummary(resolved.summary);
                        setLastResolvedPrompt(example);
                        setPlacementSource("prompt");
                      }}
                      disabled={isLoading || isApplyingArtwork}
                    >
                      {example.replace(" 넣어줘", "")}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-col gap-2 rounded-lg bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-brand">
                      {placementSource === "drag"
                        ? "현재 배치 · 드래그 미세 조정됨"
                        : "프롬프트로 해석된 배치"}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-gray-700">
                      {placementSummary}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResolvePlacement}
                    disabled={
                      isLoading ||
                      isApplyingArtwork ||
                      !artworkPlacementPrompt.trim()
                    }
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    위치 미리보기
                  </Button>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-gray-500">
                  왼쪽·오른쪽 가슴, 앞면·뒷면 중앙, 목 뒤, 양쪽 소매와
                  작게·중간·크게 또는 폭 20% 같은 표현을 이해합니다. 프롬프트
                  적용 뒤에는 드래그로 미세 조절하세요. 최소 폭 0.1%까지 줄일
                  수 있습니다.
                </p>
              </div>

              <Button
                type="button"
                className="mt-4 w-full bg-brand hover:bg-brand-dark"
                onClick={() => void handleApplyArtwork()}
                disabled={
                  isLoading ||
                  isPreparingArtwork ||
                  isApplyingArtwork ||
                  !trademarkScreening ||
                  trademarkScreening.decision === "blocked"
                }
              >
                {isLoading || isApplyingArtwork || isPreparingArtwork ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                    {isPreparingArtwork
                      ? "유명 브랜드 로고 검수 중..."
                      : "프롬프트 위치 적용·분석 중..."}
                  </>
                ) : trademarkScreening?.decision === "blocked" ? (
                  <>
                    <ShieldAlert className="mr-2 h-4 w-4" />
                    상표 위험으로 적용할 수 없습니다
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    프롬프트대로 옷에 적용하고 공임 분석
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
                quantity={quantity}
                onQuantityChange={onQuantityChange}
                onEstimateChange={onEstimateChange}
                productionCountry={productionCountry}
                onChangeCountry={onChangeCountry}
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
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Button
                  type="submit"
                  className="h-12 rounded-xl bg-brand hover:bg-brand-dark"
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
                  className="h-12 rounded-xl"
                >
                  <RefreshCw className="h-4 w-4 mr-2" /> 처음으로
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Card>

      {/* Chat history - occupies 1/3 of the space */}
      <Card className="flex flex-col overflow-hidden rounded-2xl p-4 sm:p-6">
        <div className="space-y-4">
          <h3 className="text-[17px] font-semibold sm:text-lg">수정 챗봇</h3>
          
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
