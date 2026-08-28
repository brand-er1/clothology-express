import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Gamepad2,
  ImagePlus,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
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
import { createFundingDraft } from "@/services/funding";
import { screenTrademarkImage } from "@/services/trademarkScreening";
import { trackSiteEvent } from "@/lib/site-analytics";
import type {
  ProductionEstimateImageInput,
  ProductionEstimateResult,
} from "@/types/productionEstimate";
import {
  productionCountryConfig,
  type ProductionCountry,
} from "@/lib/production-country";
import { characterConfig, inferClosetSlotFromCategory } from "@/lib/closet-character-config";
import {
  buildQuoteDesignContext,
  clearPendingQuoteSnapshot,
  loadPendingQuoteSnapshot,
  type QuoteGarmentHandoff,
} from "@/lib/quote-garment-handoff";
import { getDesign, getDesignErrorMessage, type DesignRecord } from "@/services/designs";

const allowedImageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const maxFileSize = 10 * 1024 * 1024;
const maxImageCount = 10;

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

interface ClosetHandoffState {
  presetImages?: ProductionEstimateImageInput[];
  fromCloset?: QuoteGarmentHandoff;
}

const DesignQuote = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const designId = searchParams.get("designId");
  const locationHandoff = (location.state as ClosetHandoffState | null) || null;
  // location.state (fresh navigation from /closet) always wins. It disappears on a page refresh —
  // for that case (and for guest/upload garments with no designId to reload from) fall back to the
  // short-lived sessionStorage snapshot the closet page saved right before navigating here, so the
  // selected garment/design/fit info a visitor was just looking at never just vanishes.
  const [snapshotHandoff] = useState<ClosetHandoffState | null>(() => {
    if (locationHandoff?.presetImages?.length) return null;
    if (designId) return null;
    const snapshot = loadPendingQuoteSnapshot();
    if (!snapshot?.presetImages?.length) return null;
    return { presetImages: snapshot.presetImages, fromCloset: snapshot.handoff };
  });
  const closetHandoff = locationHandoff?.presetImages?.length ? locationHandoff : snapshotHandoff;
  const [closetImages] = useState<ProductionEstimateImageInput[] | null>(
    closetHandoff?.presetImages?.length ? closetHandoff.presetImages : null,
  );
  const [design, setDesign] = useState<DesignRecord | null>(null);
  const [isLoadingDesign, setIsLoadingDesign] = useState(Boolean(designId));
  const [designLoadError, setDesignLoadError] = useState<string | null>(null);
  const [isFundingSubmitting, setIsFundingSubmitting] = useState(false);
  const [fundingCreated, setFundingCreated] = useState(false);
  const [productionCountry, setProductionCountry] = useState<ProductionCountry>("korea");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [zoomImageId, setZoomImageId] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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
      return current.filter((image) => image.id !== id);
    });
    resetAnalysis();
  };

  const cardImages = useMemo<ProductionEstimateImageInput[]>(
    () => images.map((image) => ({ base64: image.base64, mimeType: image.mimeType })),
    [images],
  );
  const designImages = useMemo<ProductionEstimateImageInput[] | null>(() => {
    if (!design) return null;
    const list: ProductionEstimateImageInput[] = [{ url: design.frontImageUrl, mimeType: "image/png" }];
    if (design.backImageUrl) list.push({ url: design.backImageUrl, mimeType: "image/png" });
    return list;
  }, [design]);
  // closetImages (richer — every worn item, via a one-shot location.state handoff) wins on first
  // load; designImages (via ?designId=, resolved from Supabase) is what survives a refresh once
  // that location.state is gone.
  const effectiveImages = closetImages ?? designImages ?? cardImages;

  // Loads the shared `design` record by ?designId=... so this page (and a refresh of it) never
  // depends on ephemeral location.state — see src/services/designs.ts.
  useEffect(() => {
    if (!designId) {
      setIsLoadingDesign(false);
      return;
    }
    let active = true;
    setIsLoadingDesign(true);
    setDesignLoadError(null);
    getDesign(designId)
      .then((record) => {
        if (!active) return;
        if (!record) {
          setDesignLoadError("디자인을 찾을 수 없습니다. 다시 생성하거나 이미지를 직접 업로드해주세요.");
          return;
        }
        setDesign(record);
        setProductionCountry((current) =>
          record.productionCountry === "korea" || record.productionCountry === "china" || record.productionCountry === "japan"
            ? (record.productionCountry as ProductionCountry)
            : current,
        );
        setIsAnalyzing(true);
        setAnalysisStarted(true);
      })
      .catch((error) => {
        if (!active) return;
        setDesignLoadError(getDesignErrorMessage(error, "디자인을 불러오지 못했습니다."));
      })
      .finally(() => {
        if (active) setIsLoadingDesign(false);
      });
    return () => {
      active = false;
    };
  }, [designId]);

  useEffect(() => {
    if (closetImages?.length) {
      setIsAnalyzing(true);
      setAnalysisStarted(true);
    }
    // Only ever runs against the images this page mounted with — closet handoff is a one-shot seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    resetAnalysis();
    clearPendingQuoteSnapshot();
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
    const primaryImage = images[0];
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
      `생산 국가: ${productionCountryConfig[productionCountry].label}`,
      `의류 종류: ${estimate.garment.label}`,
      `소재: ${estimate.material.composition}`,
      `후가공: ${decorationSummary}`,
      `부자재: ${accessorySummary}`,
      `제작 수량: ${estimate.totals.quantity}장`,
      `예상 제작비: ${formatWonRange(
        estimate.totals.totalMin,
        estimate.totals.totalMax,
      )} (원단 제외)`,
      images.length > 1 ? `업로드 이미지: 총 ${images.length}장` : "",
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
        images: images.map((image) => ({ base64: image.base64, mimeType: image.mimeType })),
        requestSource: "design_upload",
        requestTitle: `${estimate.garment.label} 내 디자인 견적`,
        requestedQuantity: estimate.totals.quantity,
        estimateSnapshot: estimate,
      });
      setSubmittedOrderId(String(result.id || "submitted"));
      clearPendingQuoteSnapshot();
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

  const startFundingFromCloset = async () => {
    const fromCloset = closetHandoff?.fromCloset;
    if (!estimate || !fromCloset?.imageUrl) return;

    try {
      setIsFundingSubmitting(true);
      const trademarkScreening = await screenTrademarkImage({
        imageUrl: fromCloset.imageUrl,
        source: "final_design",
        selectedType: fromCloset.selectedType || undefined,
        selectedMaterial: fromCloset.selectedMaterial || undefined,
      });
      if (trademarkScreening.decision === "blocked") {
        toast({
          title: "펀딩 등록이 거절되었습니다",
          description: "유명 타사 상표 또는 매우 유사한 로고가 감지되었습니다.",
          variant: "destructive",
        });
        return;
      }

      const clothTypeLabel = fromCloset.selectedType || estimate.garment.label;
      const materialLabel = fromCloset.selectedMaterial || estimate.material.composition;
      const description = [
        `${fromCloset.garmentLabel} 디자인입니다. 목표 인원이 모이면 브랜더가 실제 제품으로 제작합니다.`,
        `BRAND-ER AI 가상 피팅에서 ${characterConfig[fromCloset.character].label} ${fromCloset.mannequinSize.toUpperCase()} 체형에 입혀보고 만든 펀딩입니다.`,
      ].join("\n");

      const funding = await createFundingDraft({
        productName: fromCloset.garmentLabel,
        clothType: clothTypeLabel,
        material: materialLabel,
        color: "기본 색상",
        size: "M",
        sizeOptions: ["M"],
        measurements: null,
        imageUrl: fromCloset.imageUrl,
        imagePath: fromCloset.imagePath,
        description,
        estimateDirectUnitMin: estimate.totals.directUnitMin,
        estimateDirectUnitMax: estimate.totals.directUnitMax,
        estimateDevelopmentTotal: estimate.totals.developmentTotal,
        trademarkScreeningId: trademarkScreening.id,
      });

      setFundingCreated(true);
      toast({
        title:
          trademarkScreening.decision === "review"
            ? "펀딩이 상표 검토 대기로 등록되었습니다"
            : "펀딩 페이지가 만들어졌습니다",
      });
      navigate(`/fundings/${funding.id}/edit`);
    } catch (error) {
      toast({
        title: "펀딩 시작 실패",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsFundingSubmitting(false);
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
              디테일 이미지를 최대 10장까지 함께 올리면 AI가 한 제품으로 종합
              분석해 기존 브랜더 계산식으로 예상 견적을 만듭니다.
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
            <Button
              type="button"
              className="h-12 rounded-full bg-brand px-6 hover:bg-brand-dark"
              onClick={() => {
                if (effectiveImages.length > 0) {
                  setIsAnalyzing(true);
                  setAnalysisStarted(true);
                  return;
                }
                startAnalysis();
              }}
            >
              <Upload className="mr-2 h-4 w-4" />
              자동견적 확인하기
            </Button>
          </div>
        </div>

        {closetHandoff?.fromCloset && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm font-bold text-brand">
            <Gamepad2 className="h-4 w-4" />
            AI 가상 피팅에서 가져온 디자인 · {closetHandoff.fromCloset.garmentLabel}
          </div>
        )}

        <div className="mb-6 grid gap-2 sm:grid-cols-3" data-tutorial="quote-steps">
          {[
            { label: "1. 디자인 업로드", done: effectiveImages.length > 0 },
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

        {designId && isLoadingDesign && (
          <Card className="mb-6 flex items-center gap-3 rounded-2xl border-brand/20 bg-white px-5 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
            <p className="text-sm font-bold text-stone-600">디자인을 불러오고 있습니다...</p>
          </Card>
        )}

        {designLoadError && !isLoadingDesign && (
          <Card className="mb-6 flex items-start gap-3 rounded-2xl border-rose-200 bg-rose-50/60 px-5 py-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div className="flex-1">
              <p className="text-sm font-bold text-rose-900">{designLoadError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 bg-white"
                onClick={() => {
                  setDesignLoadError(null);
                  setDesign(null);
                  setIsLoadingDesign(true);
                  getDesign(designId as string)
                    .then((record) => {
                      if (!record) {
                        setDesignLoadError("디자인을 찾을 수 없습니다. 다시 생성하거나 이미지를 직접 업로드해주세요.");
                        return;
                      }
                      setDesign(record);
                      setIsAnalyzing(true);
                      setAnalysisStarted(true);
                    })
                    .catch((error) => setDesignLoadError(getDesignErrorMessage(error, "디자인을 불러오지 못했습니다.")))
                    .finally(() => setIsLoadingDesign(false));
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                다시 불러오기
              </Button>
            </div>
          </Card>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[0.78fr_1.22fr]">
          {designImages || closetImages ? (
            <Card className="overflow-hidden rounded-[1.75rem] border-stone-200 bg-[#fbfaf8] p-4 shadow-sm sm:p-6 lg:sticky lg:top-24">
              <p className="text-sm font-extrabold text-stone-950">가져온 디자인 이미지</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(designImages || closetImages || []).map((image, index) => (
                  <div
                    key={index}
                    className="aspect-square overflow-hidden rounded-xl border border-stone-200 bg-white"
                  >
                    <img
                      src={image.url || `data:${image.mimeType || "image/png"};base64,${image.base64}`}
                      alt={`가져온 디자인 ${index + 1}`}
                      className="h-full w-full object-contain"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-stone-500">
                AI 가상 피팅에서 입힌 디자인으로 자동 분석을 진행했습니다. 이미지를 다시
                올릴 필요는 없어요.
              </p>
            </Card>
          ) : (
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
                  {images.map((image, index) => (
                    <div
                      key={image.id}
                      className="relative aspect-square overflow-hidden rounded-xl border border-stone-200 bg-white"
                    >
                      <button
                        type="button"
                        onClick={() => setZoomImageId(image.id)}
                        className="h-full w-full"
                        aria-label={`이미지 ${index + 1} 확대 보기`}
                      >
                        <img
                          src={image.previewUrl}
                          alt={`업로드 이미지 ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(image.id)}
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-90 transition hover:bg-black/80"
                        aria-label={`이미지 ${index + 1} 삭제`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
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
                  {images.length}/{maxImageCount}장 업로드됨 · 이미지를 눌러 확대해 보세요
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
          )}

          <div data-tutorial="quote-result">
            {analysisStarted && effectiveImages.length > 0 ? (
              <div className="space-y-5">
                {isAnalyzing && (
                  <Card className="flex min-h-48 w-full flex-col items-center justify-center gap-3 border-brand/20 px-6 py-10 text-center">
                    <div className="rounded-full bg-brand/10 p-3 text-brand">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-950">
                        {closetHandoff?.fromCloset
                          ? "가상 피팅에 사용한 원본 의류를 분석하고 있습니다."
                          : `이미지 ${effectiveImages.length}장을 분석하고 있습니다`}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {closetHandoff?.fromCloset
                          ? "AI가 생성한 마네킹 착용 이미지가 아닌, 실제 등록한 의류 이미지로만 분석합니다."
                          : "여러 이미지를 하나의 제품으로 종합해 견적을 계산합니다."}
                      </p>
                    </div>
                  </Card>
                )}

                {estimate && !isAnalyzing && (
                  <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {estimate.imageCount ?? effectiveImages.length}장의 이미지를 종합하여{" "}
                    {estimate.items?.length ?? 1}개의 제품으로 분석했습니다.
                  </div>
                )}

                <div className={isAnalyzing ? "hidden" : ""}>
                  <ProductionEstimateCard
                    key={design?.id || (closetImages ? "closet" : images.map((image) => image.id).join(","))}
                    selectedType={design?.productType || closetHandoff?.fromCloset?.selectedType || ""}
                    selectedMaterial={design?.fabric || closetHandoff?.fromCloset?.selectedMaterial || ""}
                    images={effectiveImages}
                    designContext={buildQuoteDesignContext(
                      closetHandoff?.fromCloset
                        ? {
                            slot: closetHandoff.fromCloset.slot,
                            label: closetHandoff.fromCloset.garmentLabel,
                            fitInfo: closetHandoff.fromCloset.fitInfo,
                          }
                        : null,
                      design,
                      "사용자가 기존에 보유한 의류 디자인 이미지",
                    )}
                    editable
                    onEstimateChange={setEstimate}
                    onLoadingChange={setIsAnalyzing}
                    productionCountry={productionCountry}
                    onChangeCountry={setProductionCountry}
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

                      {closetHandoff?.fromCloset ? (
                        closetHandoff.fromCloset.imageUrl ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="mt-3 h-12 w-full rounded-full border-brand/30 bg-white text-base font-black text-brand hover:bg-brand/5"
                            onClick={() => void startFundingFromCloset()}
                            disabled={isFundingSubmitting || fundingCreated}
                          >
                            {isFundingSubmitting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                펀딩 준비 중...
                              </>
                            ) : fundingCreated ? (
                              "🚀 펀딩이 시작됐어요"
                            ) : (
                              "🚀 이 디자인으로 펀딩 시작하기"
                            )}
                          </Button>
                        ) : (
                          <p className="mt-3 text-center text-xs font-semibold text-stone-400">
                            AI로 만든 디자인만 바로 펀딩으로 연결할 수 있어요. 업로드한 디자인은
                            제작 의뢰로 진행해주세요.
                          </p>
                        )
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-3 h-12 w-full rounded-full border-stone-300 bg-white text-base font-black text-stone-700 hover:bg-stone-50"
                          onClick={() =>
                            navigate("/closet", {
                              state: {
                                pendingGarment: {
                                  id: `${design ? "ai" : "upload"}-${Date.now()}`,
                                  slot: inferClosetSlotFromCategory(estimate.analysis.categoryKey),
                                  label: estimate.garment.label,
                                  imageUrl: images[0]?.previewUrl || design?.frontImageUrl || effectiveImages[0]?.url || "",
                                  source: design ? "ai_design" : "upload",
                                  designRef: {
                                    imageUrl: design?.frontImageUrl || effectiveImages[0]?.url || null,
                                    imagePath: design?.imagePath || null,
                                    imageBase64: images[0]?.base64 || effectiveImages[0]?.base64,
                                    imageMimeType: images[0]?.mimeType || effectiveImages[0]?.mimeType,
                                    selectedType: design?.productType || estimate.analysis.categoryKey,
                                    selectedMaterial: design?.fabric || estimate.material.composition,
                                    fitLabel: design?.fit || undefined,
                                    designId: design?.id || null,
                                  },
                                },
                              },
                            })
                          }
                        >
                          가상 마네킹에 입혀보기
                        </Button>
                      )}
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
                  정면·후면·디테일 이미지를 함께 올리면 AI가 종합 분석해 의류
                  종류·소재·프린트 위치와 개수·워싱·부자재·예상 난이도를
                  확인할 수 있습니다.
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
