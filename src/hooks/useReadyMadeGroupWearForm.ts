import { useCallback, useMemo, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import {
  READY_MADE_LOCATION_PLACEMENT_PRESET,
  READY_MADE_LOCATION_SIDE,
  READY_MADE_MAX_ARTWORK_WIDTH_PERCENT,
  READY_MADE_MIN_ARTWORK_WIDTH_PERCENT,
  READY_MADE_PRODUCT_OPTIONS,
  createEmptySizeQuantities,
  type ReadyMadeArtworkPlacement,
  type ReadyMadeGarmentSide,
  type ReadyMadePrintLocation,
  type ReadyMadeSize,
  type ReadyMadeSizeQuantities,
} from "@/data/ready-made-pricing-config";
import {
  calculateReadyMadeQuote,
  sumReadyMadeSizeQuantities,
} from "@/lib/ready-made-pricing";
import { prepareArtworkReference } from "@/lib/artwork-upload";
import { screenTrademarkImage } from "@/services/trademarkScreening";
import { generateReadyMadeDesignGraphic } from "@/services/readyMadeDesignGeneration";
import type { ReadyMadePrintJob, ReadyMadeQuoteResult } from "@/types/readyMadeOrder";
import type { ArtworkReference } from "@/types/customize";
import type { TrademarkScreeningResult } from "@/types/trademark";
import { createReadyMadeGroupWearRequest } from "@/services/readyMadeOrder";
import { trackSiteEvent } from "@/lib/site-analytics";

export const READY_MADE_TOTAL_STEPS = 6;

const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxFileSize = 10 * 1024 * 1024;

const createPrintJobId = () =>
  globalThis.crypto?.randomUUID?.() ?? `job-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const clampArtworkWidth = (widthPercent: number) =>
  Math.min(
    READY_MADE_MAX_ARTWORK_WIDTH_PERCENT,
    Math.max(READY_MADE_MIN_ARTWORK_WIDTH_PERCENT, widthPercent),
  );

const presetForLocation = (
  location: ReadyMadePrintLocation,
): { side: ReadyMadeGarmentSide; placement: ReadyMadeArtworkPlacement } => ({
  side: READY_MADE_LOCATION_SIDE[location],
  placement: { ...READY_MADE_LOCATION_PLACEMENT_PRESET[location] },
});

const createDefaultPrintJob = (): ReadyMadePrintJob => ({
  id: createPrintJobId(),
  location: "front_center",
  ...presetForLocation("front_center"),
});

export const useReadyMadeGroupWearForm = () => {
  const [currentStep, setCurrentStep] = useState(1);

  const [selectedProductKey, setSelectedProductKey] = useState(READY_MADE_PRODUCT_OPTIONS[0].key);
  const selectedProduct = useMemo(
    () => READY_MADE_PRODUCT_OPTIONS.find((option) => option.key === selectedProductKey) ?? READY_MADE_PRODUCT_OPTIONS[0],
    [selectedProductKey],
  );

  const [selectedColor, setSelectedColorState] = useState(READY_MADE_PRODUCT_OPTIONS[0].defaultColor);
  // Switching product always resets color back to that product's default (그레이) — the main
  // page's "gray first" promise has to hold even if the customer picked another color, went
  // back to step 1, and switched to a different item.
  const setSelectedProduct = useCallback((key: string) => {
    setSelectedProductKey(key);
    const product = READY_MADE_PRODUCT_OPTIONS.find((option) => option.key === key);
    if (product) setSelectedColorState(product.defaultColor);
  }, []);
  const setSelectedColor = setSelectedColorState;

  const [sizeQuantities, setSizeQuantities] = useState<ReadyMadeSizeQuantities>(createEmptySizeQuantities());
  const setSizeQuantity = useCallback((size: ReadyMadeSize, value: number) => {
    setSizeQuantities((previous) => ({
      ...previous,
      [size]: Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0,
    }));
  }, []);
  const totalQuantity = useMemo(() => sumReadyMadeSizeQuantities(sizeQuantities), [sizeQuantities]);

  // The design artwork (uploaded or AI-generated) and its trademark screening travel together —
  // a fresh design always needs a fresh screening, so they're managed by the same actions below
  // rather than as independently-settable state a caller could desync.
  const [designArtwork, setDesignArtwork] = useState<ArtworkReference | null>(null);
  const [isPreparingDesign, setIsPreparingDesign] = useState(false);
  const [isGeneratingDesign, setIsGeneratingDesign] = useState(false);
  const [trademarkScreening, setTrademarkScreening] = useState<TrademarkScreeningResult | null>(null);
  const [isScreeningTrademark, setIsScreeningTrademark] = useState(false);

  const designPreviewUrl = designArtwork ? `data:${designArtwork.mimeType};base64,${designArtwork.base64}` : null;

  const runTrademarkScreening = useCallback(async (artwork: ArtworkReference, previousScreeningId: string | null) => {
    setIsScreeningTrademark(true);
    try {
      const screening = await screenTrademarkImage({
        imageBase64: artwork.base64,
        mimeType: artwork.mimeType,
        source: "upload",
        selectedType: selectedProduct.label,
        previousScreeningId,
      });
      setTrademarkScreening(screening);
      if (screening.decision === "blocked") {
        toast({
          title: "상표 위험 · 제작 불가",
          description: "유명 타사 상표로 의심되는 이미지입니다. 다른 디자인을 사용해주세요.",
          variant: "destructive",
        });
      } else if (screening.decision === "review") {
        toast({
          title: "상표 검토 필요",
          description: "제작 의뢰 접수 후 관리자가 권리 관계를 확인합니다.",
        });
      }
    } catch (error) {
      setTrademarkScreening(null);
      toast({
        title: "상표 검수 실패",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsScreeningTrademark(false);
    }
  }, [selectedProduct]);

  const uploadDesignFile = useCallback(async (nextFile: File) => {
    if (!allowedImageTypes.has(nextFile.type)) {
      toast({
        title: "지원하지 않는 파일 형식",
        description: "PNG, JPG, JPEG, WEBP 이미지를 선택해주세요.",
        variant: "destructive",
      });
      return;
    }
    if (nextFile.size > maxFileSize) {
      toast({
        title: "파일 용량 초과",
        description: "10MB 이하 이미지를 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    const previousScreeningId = trademarkScreening?.id || null;
    setIsPreparingDesign(true);
    setTrademarkScreening(null);
    try {
      const artwork = await prepareArtworkReference(nextFile, "logo");
      setDesignArtwork(artwork);
      if (artwork.backgroundRemoval === "not-detected") {
        toast({
          title: "단색 배경을 찾지 못했습니다",
          description: "로고가 손상되지 않도록 원본을 유지했습니다. 흰색·단색 배경 또는 투명 PNG를 사용하면 더 정확해요.",
        });
      }
      await runTrademarkScreening(artwork, previousScreeningId);
    } catch (error) {
      setDesignArtwork(null);
      toast({
        title: "이미지 준비 실패",
        description: error instanceof Error ? error.message : "다른 이미지로 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsPreparingDesign(false);
    }
  }, [runTrademarkScreening, trademarkScreening]);

  const generateDesignFromPrompt = useCallback(async (description: string) => {
    const previousScreeningId = trademarkScreening?.id || null;
    setIsGeneratingDesign(true);
    setTrademarkScreening(null);
    try {
      const artwork = await generateReadyMadeDesignGraphic(description);
      setDesignArtwork(artwork);
      await runTrademarkScreening(artwork, previousScreeningId);
    } catch (error) {
      toast({
        title: "디자인 생성 실패",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingDesign(false);
    }
  }, [runTrademarkScreening, trademarkScreening]);

  const [printJobs, setPrintJobs] = useState<ReadyMadePrintJob[]>([createDefaultPrintJob()]);

  const addPrintJob = useCallback((location: ReadyMadePrintLocation) => {
    setPrintJobs((previous) => [
      ...previous,
      { id: createPrintJobId(), location, ...presetForLocation(location) },
    ]);
  }, []);

  const removePrintJob = useCallback((id: string) => {
    setPrintJobs((previous) => (previous.length <= 1 ? previous : previous.filter((job) => job.id !== id)));
  }, []);

  const updatePrintJob = useCallback((id: string, patch: Partial<ReadyMadePrintJob>) => {
    setPrintJobs((previous) => previous.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  }, []);

  /** Changing the location dropdown resets the on-screen placement to that location's preset —
   * matches the customer's expectation that picking "왼쪽 가슴" actually moves the artwork there,
   * while still leaving it free to drag/resize from that starting point afterward. */
  const setPrintJobLocation = useCallback(
    (id: string, location: ReadyMadePrintLocation) => updatePrintJob(id, { location, ...presetForLocation(location) }),
    [updatePrintJob],
  );

  const setPrintJobPlacement = useCallback(
    (id: string, placement: ReadyMadeArtworkPlacement) =>
      updatePrintJob(id, {
        placement: {
          xPercent: Math.min(100, Math.max(0, placement.xPercent)),
          yPercent: Math.min(100, Math.max(0, placement.yPercent)),
          widthPercent: clampArtworkWidth(placement.widthPercent),
        },
      }),
    [updatePrintJob],
  );

  const [requestNote, setRequestNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedOrderId, setSubmittedOrderId] = useState<string | null>(null);

  const quote = useMemo<ReadyMadeQuoteResult | null>(() => {
    if (totalQuantity <= 0 || printJobs.length === 0) return null;
    try {
      return calculateReadyMadeQuote({ sizeQuantities, garmentBasePrice: selectedProduct.basePrice, printJobs });
    } catch {
      return null;
    }
  }, [sizeQuantities, selectedProduct, printJobs, totalQuantity]);

  const isDesignReady =
    Boolean(designArtwork) &&
    !isPreparingDesign &&
    !isGeneratingDesign &&
    !isScreeningTrademark &&
    trademarkScreening?.decision !== "blocked";

  const stepValidity = useMemo(
    () => ({
      1: Boolean(selectedProductKey),
      2: totalQuantity > 0,
      3: isDesignReady,
      4: printJobs.length > 0,
      5: Boolean(quote),
      6: true,
    }),
    [selectedProductKey, totalQuantity, isDesignReady, printJobs.length, quote],
  );

  const handleNext = useCallback(() => {
    if (!stepValidity[currentStep as keyof typeof stepValidity]) {
      const messages: Record<number, string> = {
        2: "사이즈별 수량을 1장 이상 입력해주세요.",
        3: trademarkScreening?.decision === "blocked"
          ? "상표 위험이 감지된 디자인입니다. 다른 디자인을 사용해주세요."
          : "디자인을 업로드하거나 생성하고, 검수가 끝날 때까지 기다려주세요.",
        4: "인쇄 위치를 1곳 이상 선택해주세요.",
        5: "견적을 계산할 수 없습니다. 이전 단계를 다시 확인해주세요.",
      };
      toast({
        title: "다음 단계로 진행할 수 없습니다",
        description: messages[currentStep] || "필수 항목을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }
    setCurrentStep((step) => Math.min(READY_MADE_TOTAL_STEPS, step + 1));
  }, [currentStep, stepValidity, trademarkScreening]);

  const handleBack = useCallback(() => {
    setCurrentStep((step) => Math.max(1, step - 1));
  }, []);

  const submitRequest = useCallback(async () => {
    if (!quote || !designArtwork) {
      toast({
        title: "견적 확인이 필요합니다",
        description: "디자인과 사이즈·수량, 인쇄 옵션을 먼저 확인해주세요.",
        variant: "destructive",
      });
      return;
    }
    if (trademarkScreening?.decision === "blocked") {
      toast({
        title: "제작 의뢰가 거절되었습니다",
        description: "유명 타사 상표로 의심되는 이미지입니다. 다른 디자인을 사용해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await createReadyMadeGroupWearRequest({
        product: selectedProduct,
        color: selectedColor,
        quoteInput: { sizeQuantities, garmentBasePrice: selectedProduct.basePrice, printJobs },
        quote,
        requestNote,
        imageBase64: designArtwork.base64,
        imageMimeType: designArtwork.mimeType,
        trademarkDecision: trademarkScreening?.decision ?? null,
      });
      setSubmittedOrderId(String(result.id || "submitted"));
      toast({
        title: "제작 의뢰 접수 완료",
        description: "관리자가 확인 후 안내드립니다.",
      });
      void trackSiteEvent("ready_made_group_wear_submitted", {
        product: selectedProduct.key,
        quantity: quote.quantity,
      });
    } catch (error) {
      toast({
        title: "제작 의뢰 접수 실패",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [quote, designArtwork, trademarkScreening, selectedProduct, selectedColor, sizeQuantities, printJobs, requestNote]);

  return {
    currentStep,
    setCurrentStep,
    handleNext,
    handleBack,
    stepValidity,

    selectedProductKey,
    setSelectedProductKey: setSelectedProduct,
    selectedProduct,

    selectedColor,
    setSelectedColor,

    sizeQuantities,
    setSizeQuantity,
    totalQuantity,

    designArtwork,
    designPreviewUrl,
    isPreparingDesign,
    isGeneratingDesign,
    uploadDesignFile,
    generateDesignFromPrompt,
    trademarkScreening,
    isScreeningTrademark,

    printJobs,
    addPrintJob,
    removePrintJob,
    updatePrintJob,
    setPrintJobLocation,
    setPrintJobPlacement,

    requestNote,
    setRequestNote,
    isSubmitting,
    submittedOrderId,
    submitRequest,

    quote,
  };
};

export type UseReadyMadeGroupWearFormReturn = ReturnType<typeof useReadyMadeGroupWearForm>;
