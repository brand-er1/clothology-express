import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ImagePlus,
  Loader2,
  Maximize2,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Star,
  Upload,
  X,
} from "lucide-react";
import { Header } from "@/components/Header";
import { useMascotPageContext } from "@/components/guide/MascotContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ProductionEstimateCard } from "@/components/customize/ProductionEstimateCard";
import { toast } from "@/components/ui/use-toast";
import { createDirectProductionRequest } from "@/services/orderCreation";
import { trackSiteEvent } from "@/lib/site-analytics";
import type { ProductionEstimateResult } from "@/types/productionEstimate";

const allowedImageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const maxFileSize = 10 * 1024 * 1024;
const maxImageCount = 10;

const analysisSteps = [
  "의류 종류 확인",
  "앞/뒤/디테일 이미지 분류",
  "프린팅·자수·부자재 확인",
  "중복 디자인 제거",
  "제작 난이도 분석",
  "예상 견적 계산",
];

const formatWonRange = (minimum: number, maximum: number) =>
  minimum === maximum
    ? `${minimum.toLocaleString("ko-KR")}원`
    : `${minimum.toLocaleString("ko-KR")}원 ~ ${maximum.toLocaleString("ko-KR")}원`;

type UploadedImage = {
  id: string;
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
};

const readFileAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.split(",")[1] || "");
    };
    reader.onerror = () => reject(new Error("이미지 파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });

const DesignQuote = () => {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [zoomImageId, setZoomImageId] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [estimate, setEstimate] = useState<ProductionEstimateResult | null>(null);
  const [requestNote, setRequestNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedOrderId, setSubmittedOrderId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<UploadedImage[]>([]);
  imagesRef.current = images;

  useEffect(
    () => () => {
      for (const image of imagesRef.current) {
        URL.revokeObjectURL(image.previewUrl);
      }
    },
    [],
  );

  useMascotPageContext({ page: "design-quote", hasEstimate: Boolean(estimate) });

  const resetAnalysis = () => {
    setAnalysisStarted(false);
    setIsAnalyzing(false);
    setEstimate(null);
    setRequestNote("");
    setSubmittedOrderId(null);
  };

  const addFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const room = maxImageCount - imagesRef.current.length;
    if (room <= 0) {
      toast({
        title: "업로드 개수 초과",
        description: `이미지는 최대 ${maxImageCount}장까지 업로드할 수 있습니다.`,
        variant: "destructive",
      });
      return;
    }

    const accepted: File[] = [];
    for (const file of files) {
      if (!allowedImageTypes.has(file.type)) {
        toast({
          title: "지원하지 않는 파일 형식",
          description: "PNG, JPG, JPEG, WEBP 이미지를 선택해주세요.",
          variant: "destructive",
        });
        continue;
      }
      if (file.size > maxFileSize) {
        toast({
          title: "파일 용량 초과",
          description: "10MB 이하 이미지를 선택해주세요.",
          variant: "destructive",
        });
        continue;
      }
      accepted.push(file);
    }

    const toAdd = accepted.slice(0, room);
    if (accepted.length > toAdd.length) {
      toast({
        title: "업로드 개수 초과",
        description: `이미지는 최대 ${maxImageCount}장까지 업로드할 수 있어 일부 이미지는 제외되었습니다.`,
        variant: "destructive",
      });
    }
    if (toAdd.length === 0) return;

    try {
      setIsPreparing(true);
      const prepared = await Promise.all(
        toAdd.map(async (file) => ({
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          previewUrl: URL.createObjectURL(file),
          base64: await readFileAsBase64(file),
          mimeType: file.type,
        })),
      );
      setImages((current) => [...current, ...prepared]);
      setPrimaryId((current) => current ?? prepared[0]?.id ?? null);
      resetAnalysis();
    } catch (error) {
      toast({
        title: "이미지 준비 실패",
        description:
          error instanceof Error
            ? error.message
            : "다른 이미지로 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsPreparing(false);
    }
  };

  const removeImage = (id: string) => {
    setImages((current) => {
      const target = current.find((image) => image.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const next = current.filter((image) => image.id !== id);
      setPrimaryId((currentPrimary) =>
        currentPrimary === id ? next[0]?.id ?? null : currentPrimary,
      );
      return next;
    });
    resetAnalysis();
  };

  const moveImage = (id: string, direction: -1 | 1) => {
    setImages((current) => {
      const index = current.findIndex((image) => image.id === id);
      const targetIndex = index + direction;
      if (index === -1 || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const next = current.slice();
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
    resetAnalysis();
  };

  const setPrimaryImage = (id: string) => {
    setPrimaryId(id);
    resetAnalysis();
  };

  const cardImages = useMemo(
    () => images.map((image) => ({ base64: image.base64, mimeType: image.mimeType })),
    [images],
  );

  useEffect(() => {
    if (!isAnalyzing) {
      setProgressStep(0);
      return;
    }
    setProgressStep(0);
    const interval = setInterval(() => {
      setProgressStep((step) => (step < analysisSteps.length - 1 ? step + 1 : step));
    }, 900);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const startAnalysis = () => {
    if (images.length === 0) {
      fileInputRef.current?.click();
      return;
    }
    setIsAnalyzing(true);
    setAnalysisStarted(true);
  };

  const zoomImage = images.find((image) => image.id === zoomImageId) || null;

  const startOver = () => {
    for (const image of imagesRef.current) {
      URL.revokeObjectURL(image.previewUrl);
    }
    setImages([]);
    setPrimaryId(null);
    resetAnalysis();
    fileInputRef.current?.click();
  };

  const submitProductionRequest = async () => {
    if (!analysisStarted || !estimate) {
      toast({
        title: "견적 확인이 필요합니다",
        description: "AI 분석과 견적 계산이 끝난 뒤 제작 의뢰를 접수해주세요.",
        variant: "destructive",
      });
      return;
    }
    const primaryImage = images.find((image) => image.id === primaryId) || images[0];
    if (!primaryImage) {
      toast({
        title: "이미지가 없습니다",
        description: "제작 의뢰에 첨부할 이미지를 업로드해주세요.",
        variant: "destructive",
      });
      return;
    }

    const decorationSummary = estimate.decorations.length
      ? estimate.decorations
          .map(
            (item) =>
              `${item.locationLabel} ${item.label}`,
          )
          .join(", ")
      : "없음";
    const accessorySummary = estimate.accessories.length
      ? estimate.accessories
          .map((item) => `${item.label} ${item.count}개`)
          .join(", ")
      : "없음";
    const detailDescription = [
      "[내 디자인 자동견적 제작 의뢰]",
      `의류 종류: ${estimate.garment.label}`,
      `소재: ${estimate.material.composition}`,
      `후가공: ${decorationSummary}`,
      `부자재: ${accessorySummary}`,
      `제작 수량: ${estimate.totals.quantity}장`,
      `예상 제작비: ${formatWonRange(
        estimate.totals.totalMin,
        estimate.totals.totalMax,
      )} (원단 제외)`,
      images.length > 1
        ? `업로드 이미지: 총 ${images.length}장 (대표 이미지 첨부)`
        : "",
      requestNote.trim() ? `추가 요청: ${requestNote.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      setIsSubmitting(true);
      const result = await createDirectProductionRequest({
        clothType: estimate.garment.label,
        material: estimate.material.composition,
        detailDescription,
        size: "상담 후 확정",
        measurements: null,
        generatedImageUrl: null,
        imagePath: null,
        imageBase64: primaryImage.base64,
        imageMimeType: primaryImage.mimeType,
        requestSource: "design_upload",
        requestTitle: `${estimate.garment.label} 내 디자인 견적`,
        requestedQuantity: estimate.totals.quantity,
        estimateSnapshot: estimate,
      });
      setSubmittedOrderId(String(result.id || "submitted"));
      toast({
        title: "제작 의뢰 접수 완료",
        description: "관리자가 이미지와 견적을 확인한 뒤 연락드립니다.",
      });
      void trackSiteEvent("design_quote_submitted", {
        garment: estimate.garment.label,
        quantity: estimate.totals.quantity,
        imageCount: images.length,
      });
    } catch (error) {
      toast({
        title: "제작 의뢰 접수 실패",
        description:
          error instanceof Error
            ? error.message
            : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f0ea]">
      <Header />
      <main className="mx-auto max-w-[1240px] px-4 pb-24 pt-24 sm:px-6 sm:pt-28 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
              Brand-er AI estimate
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-stone-950 sm:text-5xl">
              디자인 견적
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-stone-500">
              디자인을 분석해 예상 제작비를 자동으로 확인해보세요. 정면·후면·
              측면·디테일·프린트/자수 확대 이미지를 최대 10장까지 함께 올리면
              AI가 한 제품으로 종합 분석해 기존 브랜더 계산식으로 예상 견적을
              만듭니다.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              asChild
              variant="outline"
              className="h-12 rounded-full border-stone-300 bg-white px-6"
            >
              <Link to="/customize">
                <Sparkles className="mr-2 h-4 w-4" />
                AI 디자인 생성하기
              </Link>
            </Button>
            <Button className="h-12 rounded-full bg-brand px-6 hover:bg-brand-dark">
              <Upload className="mr-2 h-4 w-4" />
              자동견적 확인하기
            </Button>
          </div>
        </div>

        <div className="mb-6 grid gap-2 sm:grid-cols-3" data-tutorial="quote-steps">
          {[
            { label: "1. 디자인 업로드", done: images.length > 0 },
            { label: "2. AI 분석·견적", done: Boolean(estimate) },
            { label: "3. 제작 의뢰 접수", done: Boolean(submittedOrderId) },
          ].map((step) => (
            <div
              key={step.label}
              className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
                step.done
                  ? "border-brand bg-brand text-white"
                  : "border-stone-200 bg-white text-stone-400"
              }`}
            >
              {step.done && <CheckCircle2 className="mr-2 inline h-4 w-4" />}
              {step.label}
            </div>
          ))}
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[0.78fr_1.22fr]">
          <Card className="overflow-hidden rounded-[1.75rem] border-stone-200 bg-[#fbfaf8] p-4 shadow-sm sm:p-6 lg:sticky lg:top-24">
            {images.length === 0 ? (
              <button
                type="button"
                className={`flex min-h-[430px] w-full flex-col items-center justify-center overflow-hidden rounded-[1.35rem] border-2 border-dashed transition ${
                  isDragging
                    ? "border-brand bg-brand/5"
                    : "border-stone-300 bg-white hover:border-brand/50"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  if (event.dataTransfer.files?.length) {
                    void addFiles(event.dataTransfer.files);
                  }
                }}
                aria-label="견적을 받을 의류 이미지 업로드"
                data-tutorial="quote-upload"
              >
                <div className="px-6 text-center">
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <ImagePlus className="h-7 w-7" />
                  </span>
                  <p className="mt-5 text-lg font-extrabold text-stone-950">
                    의류 이미지를 올려주세요
                  </p>
                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    클릭하거나 파일을 끌어다 놓으세요. 최대 {maxImageCount}장까지
                    한 번에 선택할 수 있습니다.
                    <br />
                    PNG · JPG · JPEG · WEBP / 장당 최대 10MB
                  </p>
                </div>
              </button>
            ) : (
              <div
                className={`rounded-[1.35rem] border-2 border-dashed p-3 transition ${
                  isDragging ? "border-brand bg-brand/5" : "border-transparent"
                }`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  if (event.dataTransfer.files?.length) {
                    void addFiles(event.dataTransfer.files);
                  }
                }}
                data-tutorial="quote-upload"
              >
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
                  {images.map((image, index) => {
                    const isPrimary = image.id === primaryId;
                    return (
                      <div
                        key={image.id}
                        className="group relative aspect-square overflow-hidden rounded-xl border border-stone-200 bg-white"
                      >
                        <img
                          src={image.previewUrl}
                          alt={`업로드 이미지 ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                        {isPrimary && (
                          <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-extrabold text-white shadow">
                            <Star className="h-2.5 w-2.5 fill-white" />
                            대표 이미지
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(image.id)}
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-90 transition hover:bg-black/80"
                          aria-label={`이미지 ${index + 1} 삭제`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1.5 pt-4">
                          <button
                            type="button"
                            onClick={() => moveImage(image.id, -1)}
                            disabled={index === 0}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white disabled:opacity-30"
                            aria-label={`이미지 ${index + 1} 앞으로 이동`}
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setZoomImageId(image.id)}
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white"
                              aria-label={`이미지 ${index + 1} 확대 보기`}
                            >
                              <Maximize2 className="h-3.5 w-3.5" />
                            </button>
                            {!isPrimary && (
                              <button
                                type="button"
                                onClick={() => setPrimaryImage(image.id)}
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white"
                                aria-label={`이미지 ${index + 1} 대표 이미지로 지정`}
                              >
                                <Star className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => moveImage(image.id, 1)}
                            disabled={index === images.length - 1}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white disabled:opacity-30"
                            aria-label={`이미지 ${index + 1} 뒤로 이동`}
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {images.length < maxImageCount && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-stone-300 bg-white text-stone-400 transition hover:border-brand/50 hover:text-brand"
                      aria-label="이미지 추가"
                    >
                      <Plus className="h-5 w-5" />
                      <span className="text-[11px] font-bold">추가</span>
                    </button>
                  )}
                </div>
                <p className="mt-3 text-xs font-semibold text-stone-400">
                  {images.length}/{maxImageCount}장 업로드됨
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              multiple
              className="sr-only"
              onChange={(event) => {
                if (event.target.files?.length) void addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                if (event.target.files?.length) void addFiles(event.target.files);
                event.target.value = "";
              }}
            />

            {images.length > 0 && images.length < maxImageCount && (
              <Button
                type="button"
                variant="outline"
                className="mt-3 h-11 w-full rounded-full border-stone-300 bg-white text-sm font-bold"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="mr-2 h-4 w-4" />
                사진 촬영으로 추가
              </Button>
            )}

            <p className="mt-4 rounded-xl bg-brand/5 px-3.5 py-3 text-xs font-semibold leading-5 text-brand">
              정면, 후면, 디테일 이미지를 함께 등록하면 더욱 정확한 견적을 받을
              수 있습니다.
            </p>

            <Button
              type="button"
              className="mt-4 h-12 w-full rounded-full bg-brand text-base font-bold hover:bg-brand-dark"
              onClick={startAnalysis}
              disabled={isPreparing}
              data-tutorial="quote-analyze"
            >
              {isPreparing ? "이미지 준비 중..." : "AI 분석 및 견적 생성"}
              {!isPreparing && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </Card>

          <div data-tutorial="quote-result">
            {analysisStarted && cardImages.length > 0 ? (
              <div className="space-y-5">
                {isAnalyzing && (
                  <Card className="w-full overflow-hidden border-brand/20">
                    <div className="px-6 py-8">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-brand/10 p-2.5 text-brand">
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                        <div>
                          <p className="font-extrabold text-stone-950">
                            이미지 {cardImages.length}장을 분석하고 있습니다
                          </p>
                          <p className="mt-0.5 text-xs text-stone-500">
                            여러 이미지를 하나의 제품으로 종합해 분석 중입니다.
                          </p>
                        </div>
                      </div>
                      <ol className="mt-6 space-y-2.5">
                        {analysisSteps.map((label, index) => (
                          <li key={label} className="flex items-center gap-3 text-sm">
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold transition ${
                                index < progressStep
                                  ? "bg-emerald-500 text-white"
                                  : index === progressStep
                                    ? "bg-brand text-white"
                                    : "bg-stone-100 text-stone-400"
                              }`}
                            >
                              {index < progressStep ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                index + 1
                              )}
                            </span>
                            <span
                              className={
                                index <= progressStep
                                  ? "font-bold text-stone-900"
                                  : "text-stone-400"
                              }
                            >
                              {label}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </Card>
                )}

                {estimate && !isAnalyzing && (
                  <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {estimate.imageCount ?? cardImages.length}장의 이미지를 종합하여{" "}
                    {estimate.items?.length ?? 1}개의 제품으로 분석했습니다.
                  </div>
                )}

                <div className={isAnalyzing ? "hidden" : ""}>
                  <ProductionEstimateCard
                    key={images.map((image) => image.id).join(",")}
                    selectedType=""
                    selectedMaterial=""
                    images={cardImages}
                    designContext="사용자가 기존에 보유한 의류 디자인 이미지"
                    editable
                    onEstimateChange={setEstimate}
                    onLoadingChange={setIsAnalyzing}
                  />
                </div>

                {estimate &&
                  !isAnalyzing &&
                  (submittedOrderId ? (
                    <Card className="rounded-[1.75rem] border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                          <CheckCircle2 className="h-5 w-5" />
                        </span>
                        <div>
                          <h2 className="text-xl font-black text-emerald-950">
                            제작 의뢰가 접수되었습니다
                          </h2>
                          <p className="mt-2 text-sm leading-6 text-emerald-800">
                            관리자에게 업로드 이미지, 수정된 분석 결과와 견적서가
                            함께 전달되었습니다. 확인 후 등록된 연락처로 안내드립니다.
                          </p>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-2 sm:grid-cols-2">
                        <Button asChild className="h-11 rounded-full bg-emerald-700 hover:bg-emerald-800">
                          <Link to="/orders">내 제작 의뢰 확인</Link>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-full border-emerald-300 bg-white"
                          onClick={startOver}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          다른 디자인 견적받기
                        </Button>
                      </div>
                    </Card>
                  ) : (
                    <Card className="rounded-[1.75rem] border-brand/20 bg-white p-6 shadow-sm">
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                          <ClipboardCheck className="h-5 w-5" />
                        </span>
                        <div>
                          <h2 className="text-xl font-black text-stone-950">
                            이 견적으로 제작 의뢰하기
                          </h2>
                          <p className="mt-1 text-sm leading-6 text-stone-500">
                            접수하면 관리자 페이지에 이미지와 견적서가 함께 저장됩니다.
                          </p>
                        </div>
                      </div>
                      <div className="mt-5 rounded-2xl bg-stone-50 p-4">
                        <div className="flex items-center justify-between gap-4 text-sm">
                          <span className="font-semibold text-stone-500">
                            {estimate.totals.quantity}장 기준 예상 제작비
                          </span>
                          <span className="text-lg font-black text-brand">
                            {formatWonRange(
                              estimate.totals.totalMin,
                              estimate.totals.totalMax,
                            )}
                          </span>
                        </div>
                        <p className="mt-1 text-right text-xs font-semibold text-stone-400">
                          원단비 제외
                        </p>
                      </div>
                      <label className="mt-5 block text-sm font-bold text-stone-700">
                        관리자에게 전달할 추가 요청사항
                        <Textarea
                          value={requestNote}
                          onChange={(event) => setRequestNote(event.target.value)}
                          placeholder="희망 수량, 일정, 수정할 부분이 있으면 적어주세요. (선택)"
                          maxLength={1000}
                          className="mt-2 min-h-24 resize-none bg-white"
                        />
                      </label>
                      <Button
                        type="button"
                        className="mt-4 h-12 w-full rounded-full bg-brand text-base font-black hover:bg-brand-dark"
                        onClick={() => void submitProductionRequest()}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            제작 의뢰 접수 중...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            이 견적으로 제작 의뢰 접수
                          </>
                        )}
                      </Button>
                    </Card>
                  ))}
              </div>
            ) : (
              <Card className="flex min-h-[430px] flex-col items-center justify-center rounded-[1.75rem] border-stone-200 bg-[#fbfaf8] p-8 text-center shadow-sm">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                  <Sparkles className="h-6 w-6" />
                </span>
                <h2 className="mt-5 text-xl font-extrabold text-stone-950">
                  분석 결과와 자동 견적서
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-stone-500">
                  정면·후면·측면·디테일·프린트/자수 확대 이미지를 함께 올리면
                  AI가 종합 분석해 의류 종류·소재·프린트 위치와 개수·워싱·
                  부자재·예상 난이도·AI 신뢰도를 확인할 수 있습니다.
                </p>
                <div className="mt-6 grid w-full max-w-lg grid-cols-2 gap-2 text-left text-xs text-stone-500 sm:grid-cols-4">
                  {["의류·소재", "프린팅·자수", "워싱·피그먼트", "부자재"].map(
                    (label) => (
                      <span
                        key={label}
                        className="rounded-xl border border-stone-200 bg-white px-3 py-3 text-center font-semibold"
                      >
                        {label}
                      </span>
                    ),
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>

      <Dialog open={Boolean(zoomImage)} onOpenChange={(open) => !open && setZoomImageId(null)}>
        <DialogContent className="max-w-3xl border-0 bg-black/95 p-2 sm:p-3">
          <DialogTitle className="sr-only">이미지 확대 보기</DialogTitle>
          {zoomImage && (
            <img
              src={zoomImage.previewUrl}
              alt="업로드 이미지 확대 보기"
              className="max-h-[80vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DesignQuote;
