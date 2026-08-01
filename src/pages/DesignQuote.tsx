import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileImage,
  ImagePlus,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  Upload,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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

const formatWonRange = (minimum: number, maximum: number) =>
  minimum === maximum
    ? `${minimum.toLocaleString("ko-KR")}원`
    : `${minimum.toLocaleString("ko-KR")}원 ~ ${maximum.toLocaleString("ko-KR")}원`;

type AnalysisInput = {
  base64: string;
  mimeType: string;
  fileName: string;
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
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [analysisInput, setAnalysisInput] = useState<AnalysisInput | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [estimate, setEstimate] = useState<ProductionEstimateResult | null>(null);
  const [requestNote, setRequestNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedOrderId, setSubmittedOrderId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const selectFile = (nextFile: File) => {
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

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setAnalysisInput(null);
    setEstimate(null);
    setRequestNote("");
    setSubmittedOrderId(null);
  };

  const startAnalysis = async () => {
    if (!file) {
      inputRef.current?.click();
      return;
    }

    try {
      setIsPreparing(true);
      const base64 = await readFileAsBase64(file);
      setAnalysisInput({
        base64,
        mimeType: file.type,
        fileName: file.name,
      });
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

  const submitProductionRequest = async () => {
    if (!analysisInput || !estimate) {
      toast({
        title: "견적 확인이 필요합니다",
        description: "AI 분석과 견적 계산이 끝난 뒤 제작 의뢰를 접수해주세요.",
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
        imageBase64: analysisInput.base64,
        imageMimeType: analysisInput.mimeType,
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
              내 디자인으로 견적받기
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-stone-500">
              이미 제작한 의류 이미지를 올리면 의류 종류, 소재, 후가공과
              부자재를 분석해 기존 브랜더 계산식으로 예상 견적을 만듭니다.
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
              내 디자인으로 견적받기
            </Button>
          </div>
        </div>

        <div className="mb-6 grid gap-2 sm:grid-cols-3">
          {[
            { label: "1. 디자인 업로드", done: Boolean(file) },
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
            <button
              type="button"
              className={`flex min-h-[430px] w-full flex-col items-center justify-center overflow-hidden rounded-[1.35rem] border-2 border-dashed transition ${
                isDragging
                  ? "border-brand bg-brand/5"
                  : "border-stone-300 bg-white hover:border-brand/50"
              }`}
              onClick={() => inputRef.current?.click()}
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
                const droppedFile = event.dataTransfer.files?.[0];
                if (droppedFile) selectFile(droppedFile);
              }}
              aria-label="견적을 받을 의류 이미지 업로드"
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="업로드한 의류 디자인 미리보기"
                  className="h-full max-h-[560px] w-full object-contain p-3"
                />
              ) : (
                <div className="px-6 text-center">
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <ImagePlus className="h-7 w-7" />
                  </span>
                  <p className="mt-5 text-lg font-extrabold text-stone-950">
                    의류 이미지를 올려주세요
                  </p>
                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    클릭하거나 파일을 끌어다 놓으세요.
                    <br />
                    PNG · JPG · JPEG · WEBP / 최대 10MB
                  </p>
                </div>
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(event) => {
                const nextFile = event.target.files?.[0];
                event.target.value = "";
                if (nextFile) selectFile(nextFile);
              }}
            />

            {file && (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-stone-200">
                <FileImage className="h-5 w-5 shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-stone-800">
                    {file.name}
                  </p>
                  <p className="text-xs text-stone-400">
                    {(file.size / 1024 / 1024).toFixed(1)}MB
                  </p>
                </div>
              </div>
            )}

            <Button
              type="button"
              className="mt-4 h-12 w-full rounded-full bg-brand text-base font-bold hover:bg-brand-dark"
              onClick={() => void startAnalysis()}
              disabled={isPreparing}
            >
              {isPreparing ? "이미지 준비 중..." : "AI 분석 및 견적 생성"}
              {!isPreparing && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </Card>

          <div>
            {analysisInput ? (
              <div className="space-y-5">
                <ProductionEstimateCard
                  key={`${analysisInput.fileName}-${analysisInput.base64.length}`}
                  selectedType=""
                  selectedMaterial=""
                  imageBase64={analysisInput.base64}
                  imageMimeType={analysisInput.mimeType}
                  designContext="사용자가 기존에 보유한 의류 디자인 이미지"
                  editable
                  onEstimateChange={setEstimate}
                />

                {estimate &&
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
                          onClick={() => inputRef.current?.click()}
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
                  이미지를 올리면 의류 종류·소재·프린트 위치와 개수·워싱·
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
    </div>
  );
};

export default DesignQuote;
