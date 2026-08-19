import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import {
  READY_MADE_PRODUCT_OPTIONS,
  createEmptySizeQuantities,
  type ReadyMadeGraphicSizeCategory,
  type ReadyMadePrintLocation,
  type ReadyMadePrintMethod,
  type ReadyMadeSize,
  type ReadyMadeSizeQuantities,
} from "@/data/ready-made-pricing-config";
import {
  calculateReadyMadeQuote,
  getReadyMadeQuantityTier,
  sumReadyMadeSizeQuantities,
} from "@/lib/ready-made-pricing";
import type { ReadyMadePrintJob, ReadyMadeQuoteResult } from "@/types/readyMadeOrder";
import { createReadyMadeGroupWearRequest } from "@/services/readyMadeOrder";
import { trackSiteEvent } from "@/lib/site-analytics";

export const READY_MADE_TOTAL_STEPS = 6;

const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxFileSize = 10 * 1024 * 1024;

const createPrintJobId = () =>
  globalThis.crypto?.randomUUID?.() ?? `job-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const readFileAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("이미지 파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });

export const useReadyMadeGroupWearForm = () => {
  const [currentStep, setCurrentStep] = useState(1);

  const [selectedProductKey, setSelectedProductKey] = useState(READY_MADE_PRODUCT_OPTIONS[0].key);
  const selectedProduct = useMemo(
    () => READY_MADE_PRODUCT_OPTIONS.find((option) => option.key === selectedProductKey) ?? READY_MADE_PRODUCT_OPTIONS[0],
    [selectedProductKey],
  );

  const [selectedColor, setSelectedColor] = useState(READY_MADE_PRODUCT_OPTIONS[0].colors[0]);
  useEffect(() => {
    if (!selectedProduct.colors.includes(selectedColor)) {
      setSelectedColor(selectedProduct.colors[0]);
    }
  }, [selectedProduct, selectedColor]);

  const [sizeQuantities, setSizeQuantities] = useState<ReadyMadeSizeQuantities>(createEmptySizeQuantities());
  const setSizeQuantity = useCallback((size: ReadyMadeSize, value: number) => {
    setSizeQuantities((previous) => ({
      ...previous,
      [size]: Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0,
    }));
  }, []);
  const totalQuantity = useMemo(() => sumReadyMadeSizeQuantities(sizeQuantities), [sizeQuantities]);
  const quantityTier = useMemo(() => getReadyMadeQuantityTier(totalQuantity || 1), [totalQuantity]);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isPreparingImage, setIsPreparingImage] = useState(false);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const selectDesignFile = useCallback(async (nextFile: File) => {
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

    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(nextFile);
    });
    setFile(nextFile);
    setIsPreparingImage(true);
    try {
      const base64 = await readFileAsBase64(nextFile);
      setImageBase64(base64);
    } catch (error) {
      toast({
        title: "이미지 준비 실패",
        description: error instanceof Error ? error.message : "다른 이미지로 다시 시도해주세요.",
        variant: "destructive",
      });
      setImageBase64(null);
    } finally {
      setIsPreparingImage(false);
    }
  }, []);

  const [printMethod, setPrintMethod] = useState<ReadyMadePrintMethod>("dtf");
  const [printJobs, setPrintJobs] = useState<ReadyMadePrintJob[]>([
    { id: createPrintJobId(), location: "front_center", sizeCategory: "small" },
  ]);

  const addPrintJob = useCallback((location: ReadyMadePrintLocation) => {
    setPrintJobs((previous) => [...previous, { id: createPrintJobId(), location, sizeCategory: "small" }]);
  }, []);

  const removePrintJob = useCallback((id: string) => {
    setPrintJobs((previous) => (previous.length <= 1 ? previous : previous.filter((job) => job.id !== id)));
  }, []);

  const updatePrintJob = useCallback((id: string, patch: Partial<ReadyMadePrintJob>) => {
    setPrintJobs((previous) => previous.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  }, []);

  const setPrintJobSizeCategory = useCallback(
    (id: string, sizeCategory: ReadyMadeGraphicSizeCategory) => updatePrintJob(id, { sizeCategory }),
    [updatePrintJob],
  );

  const [requestNote, setRequestNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedOrderId, setSubmittedOrderId] = useState<string | null>(null);

  const quote = useMemo<ReadyMadeQuoteResult | null>(() => {
    if (totalQuantity <= 0 || printJobs.length === 0) return null;
    try {
      return calculateReadyMadeQuote({ sizeQuantities, printMethod, printJobs });
    } catch {
      return null;
    }
  }, [sizeQuantities, printMethod, printJobs, totalQuantity]);

  const stepValidity = useMemo(
    () => ({
      1: Boolean(selectedProductKey),
      2: totalQuantity > 0,
      3: true,
      4: printJobs.length > 0,
      5: Boolean(quote),
      6: true,
    }),
    [selectedProductKey, totalQuantity, printJobs.length, quote],
  );

  const handleNext = useCallback(() => {
    if (!stepValidity[currentStep as keyof typeof stepValidity]) {
      const messages: Record<number, string> = {
        2: "사이즈별 수량을 1장 이상 입력해주세요.",
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
  }, [currentStep, stepValidity]);

  const handleBack = useCallback(() => {
    setCurrentStep((step) => Math.max(1, step - 1));
  }, []);

  const submitRequest = useCallback(async () => {
    if (!quote) {
      toast({
        title: "견적 확인이 필요합니다",
        description: "사이즈·수량과 인쇄 옵션을 먼저 확인해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await createReadyMadeGroupWearRequest({
        product: selectedProduct,
        color: selectedColor,
        quoteInput: { sizeQuantities, printMethod, printJobs },
        quote,
        requestNote,
        imageBase64,
        imageMimeType: file?.type ?? null,
      });
      setSubmittedOrderId(String(result.id || "submitted"));
      toast({
        title: "제작 의뢰 접수 완료",
        description: "관리자가 확인 후 안내드립니다.",
      });
      void trackSiteEvent("ready_made_group_wear_submitted", {
        product: selectedProduct.key,
        quantity: quote.quantity,
        printMethod,
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
  }, [quote, selectedProduct, selectedColor, sizeQuantities, printMethod, printJobs, requestNote, imageBase64, file]);

  return {
    currentStep,
    setCurrentStep,
    handleNext,
    handleBack,
    stepValidity,

    selectedProductKey,
    setSelectedProductKey,
    selectedProduct,

    selectedColor,
    setSelectedColor,

    sizeQuantities,
    setSizeQuantity,
    totalQuantity,
    quantityTier,

    file,
    previewUrl,
    isPreparingImage,
    selectDesignFile,

    printMethod,
    setPrintMethod,
    printJobs,
    addPrintJob,
    removePrintJob,
    updatePrintJob,
    setPrintJobSizeCategory,

    requestNote,
    setRequestNote,
    isSubmitting,
    submittedOrderId,
    submitRequest,

    quote,
  };
};

export type UseReadyMadeGroupWearFormReturn = ReturnType<typeof useReadyMadeGroupWearForm>;
