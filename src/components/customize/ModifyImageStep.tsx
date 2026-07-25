
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  ImageOff,
  ImagePlus,
  MapPin,
  RefreshCw,
  Send,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import { ProductionEstimateCard } from "./ProductionEstimateCard";
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

const sizeOptions: Array<{ value: ArtworkSize; label: string }> = [
  { value: "small", label: "작게" },
  { value: "medium", label: "보통" },
  { value: "large", label: "크게" },
];

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
  const [artworkSize, setArtworkSize] = useState<ArtworkSize>("medium");
  const [isPreparingArtwork, setIsPreparingArtwork] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleArtworkFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

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

  const handleApplyArtwork = async () => {
    if (!uploadedArtwork) {
      fileInputRef.current?.click();
      return;
    }

    const locationLabel =
      locationOptions.find((option) => option.value === artworkLocation)
        ?.label || "앞면";
    const sizeLabel =
      sizeOptions.find((option) => option.value === artworkSize)?.label ||
      "보통";

    await onModifyImage(
      `업로드한 이미지를 원본 형태와 색상을 유지해 옷의 ${locationLabel}에 ${sizeLabel} 크기로 자연스럽게 적용해주세요.`,
      {
        referenceImage: uploadedArtwork,
        placement: {
          location: artworkLocation,
          size: artworkSize,
        },
      },
    );
  };

  const clearArtwork = () => {
    setUploadedArtwork(null);
    setArtworkPreview(null);
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
            <div className="relative w-full max-w-xl min-h-[260px] sm:min-h-[320px] max-h-[480px] border rounded-md overflow-hidden bg-gray-50 flex items-center justify-center">
              {selectedImageUrl && !imageError ? (
                <img
                  src={selectedImageUrl}
                  alt="Selected clothing design"
                  className="max-h-[480px] w-full h-full object-contain"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                  <ImageOff className="w-12 h-12 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">이미지를 불러올 수 없습니다</p>
                </div>
              )}
              {isLoading && (
                <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
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
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
                  <img
                    src={artworkPreview}
                    alt="업로드한 프린팅 이미지"
                    className="h-20 w-20 rounded-lg bg-gray-50 object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">
                      {uploadedArtwork?.fileName}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      적용 후 AI가 로고형·사진형·일러스트형을 자동 판단합니다.
                    </p>
                  </div>
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
                    <MapPin className="h-3.5 w-3.5" /> 적용 위치
                  </p>
                  <Select
                    value={artworkLocation}
                    onValueChange={(value) =>
                      setArtworkLocation(value as DecorationLocation)
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
                <div>
                  <p className="mb-1.5 text-xs font-bold text-gray-700">
                    적용 크기
                  </p>
                  <Select
                    value={artworkSize}
                    onValueChange={(value) =>
                      setArtworkSize(value as ArtworkSize)
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sizeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
