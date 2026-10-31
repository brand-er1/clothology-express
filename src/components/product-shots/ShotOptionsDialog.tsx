import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  ANGLE_SHOTS,
  BASIC_SHOT_SET,
  DETAIL_SHOTS,
  getShotSpec,
  isShotAvailable,
  planBasicShotSet,
  uploadShotReference,
  type DesignAnalysis,
  type NormalizedRegion,
  type ProductShotType,
} from "@/services/productShots";
import { RegionSelector } from "./RegionSelector";

export type ShotDialogMode = "angle" | "detail";

export type ShotRequestPlan = {
  types: ProductShotType[];
  region: NormalizedRegion | null;
  note: string;
  referenceImageUrls: string[];
};

type Props = {
  open: boolean;
  mode: ShotDialogMode;
  onOpenChange: (open: boolean) => void;
  sourceImageUrl: string;
  analysis: DesignAnalysis | null;
  analysisState: "idle" | "loading" | "ready" | "error";
  onRetryAnalysis: () => void;
  quota: { used: number; limit: number } | null;
  onSubmit: (plan: ShotRequestPlan) => void;
};

const MAX_REFERENCES = 3;

/** 상세 컷(각도) · 디테일 컷(부위 / 직접 영역) 옵션 선택 창. */
export const ShotOptionsDialog = ({ open, mode, onOpenChange, sourceImageUrl, analysis, analysisState, onRetryAnalysis, quota, onSubmit }: Props) => {
  const [selected, setSelected] = useState<ProductShotType[]>([]);
  const [usePreset, setUsePreset] = useState(false);
  const [presetFallback, setPresetFallback] = useState<"stitching" | "skip">("stitching");
  const [detailTab, setDetailTab] = useState<"parts" | "region">("parts");
  const [region, setRegion] = useState<NormalizedRegion | null>(null);
  const [note, setNote] = useState("");
  const [references, setReferences] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setUsePreset(false);
    setPresetFallback("stitching");
    setDetailTab("parts");
    setRegion(null);
    setNote("");
  }, [open, mode]);

  const preset = useMemo(() => planBasicShotSet(analysis), [analysis]);
  const presetTypes: ProductShotType[] = useMemo(() => {
    if (!preset.needsConfirmation) return preset.shots;
    return presetFallback === "stitching" ? [...preset.shots, "stitching"] : preset.shots;
  }, [preset, presetFallback]);

  const plannedTypes: ProductShotType[] =
    mode === "angle"
      ? usePreset
        ? Array.from(new Set([...presetTypes, ...selected]))
        : selected
      : detailTab === "region"
        ? region ? ["custom_region"] : []
        : selected;

  const toggle = (type: ProductShotType) =>
    setSelected((current) => (current.includes(type) ? current.filter((entry) => entry !== type) : [...current, type]));

  const remaining = quota ? Math.max(0, quota.limit - quota.used) : null;
  const overQuota = remaining !== null && plannedTypes.length > remaining;

  const addReference = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, MAX_REFERENCES - references.length)) {
        const url = await uploadShotReference(file);
        setReferences((current) => [...current, url].slice(0, MAX_REFERENCES));
      }
    } catch (error) {
      toast({ title: "참고 이미지를 올리지 못했어요", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const shotCards = mode === "angle" ? ANGLE_SHOTS : DETAIL_SHOTS;
  const analysisLoading = analysisState === "loading";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-24px)] max-w-2xl flex-col gap-0 rounded-md p-0">
        <DialogHeader className="border-b border-stone-200 px-5 pb-4 pt-5 text-left">
          <DialogTitle className="text-[18px] font-semibold tracking-[-0.02em]">{mode === "angle" ? "상세 컷 생성" : "디테일 컷 생성"}</DialogTitle>
          <DialogDescription className="text-[13px] leading-5">
            {mode === "angle"
              ? "지금 디자인을 그대로 유지한 채 다른 각도에서 촬영한 것처럼 만듭니다. 여러 컷을 함께 고를 수 있어요."
              : "원본 디자인의 특정 부위를 확대 촬영한 것처럼 만듭니다. 원본에서 확인되지 않는 부자재는 만들지 않아요."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {analysisLoading && (
            <p className="flex items-center gap-2 rounded-md bg-stone-100 px-3 py-2 text-[12px] text-stone-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> 원본 디자인에서 프린팅 · 자수 · 부자재가 있는지 확인하는 중...
            </p>
          )}
          {analysisState === "error" && (
            <p className="flex flex-wrap items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" /> 디자인 요소를 확인하지 못했어요. 생성할 때 서버에서 다시 확인합니다.
              <button type="button" className="font-semibold underline" onClick={onRetryAnalysis}>다시 확인</button>
            </p>
          )}

          {mode === "angle" && (
            <button
              type="button"
              onClick={() => setUsePreset((value) => !value)}
              className={cn(
                "w-full rounded-md border p-4 text-left transition",
                usePreset ? "border-brand bg-brand/5" : "border-stone-200 bg-white hover:border-stone-300",
              )}
              aria-pressed={usePreset}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 text-[14px] font-bold text-stone-950">
                    <Sparkles className="h-4 w-4 text-brand" /> 기본 상품 촬영 세트
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-stone-500">
                    정면 · 후면 · 측면 · 원단 디테일 · 로고(주요 디자인) 디테일 — {BASIC_SHOT_SET.length}장
                  </p>
                </div>
                <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border", usePreset ? "border-brand bg-brand text-white" : "border-stone-300")}>
                  {usePreset && <Check className="h-3.5 w-3.5" />}
                </span>
              </div>
            </button>
          )}

          {mode === "angle" && usePreset && preset.needsConfirmation && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[12px] leading-5 text-amber-900" role="group" aria-label="세트 구성 확인">
              <p className="font-semibold">원본에서 로고 · 프린팅 · 자수가 확인되지 않았어요.</p>
              <p className="mt-0.5">없는 디자인 요소는 만들지 않습니다. 어떻게 할까요?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {([["stitching", "봉제 디테일 컷으로 대체"], ["skip", `제외하고 ${preset.shots.length}장만 생성`]] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPresetFallback(value)}
                    className={cn("rounded-full border px-3 py-1 font-semibold", presetFallback === value ? "border-brand bg-brand text-white" : "border-amber-300 bg-white text-amber-900")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "detail" && (
            <div className="grid grid-cols-2 gap-1 rounded-md bg-stone-100 p-1" role="tablist">
              {([["parts", "부위 선택"], ["region", "이미지에서 직접 선택"]] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={detailTab === value}
                  onClick={() => setDetailTab(value)}
                  className={cn("h-9 rounded-[3px] text-[13px] font-semibold", detailTab === value ? "bg-white text-stone-950 shadow-sm" : "text-stone-500")}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {(mode === "angle" || detailTab === "parts") && (
            <div>
              {mode === "angle" && <p className="mb-2 text-[13px] font-semibold text-stone-700">{usePreset ? "추가로 만들 컷" : "촬영 각도"}</p>}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {shotCards.map((spec) => {
                  const available = isShotAvailable(spec.type, analysis);
                  const inPreset = mode === "angle" && usePreset && presetTypes.includes(spec.type);
                  const checked = inPreset || selected.includes(spec.type);
                  const disabled = !available || inPreset || (Boolean(spec.requires) && analysisLoading);
                  return (
                    <button
                      key={spec.type}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggle(spec.type)}
                      aria-pressed={checked}
                      className={cn(
                        "relative min-h-[64px] rounded-md border px-3 py-2.5 text-left transition",
                        checked ? "border-brand bg-brand/5" : "border-stone-200 bg-white hover:border-stone-300",
                        !available && "cursor-not-allowed border-dashed bg-stone-50 opacity-70",
                        inPreset && "cursor-default",
                      )}
                    >
                      <span className="block pr-5 text-[13px] font-bold text-stone-900">{spec.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-stone-500">
                        {!available ? "원본에서 확인되지 않음" : inPreset ? "세트에 포함" : spec.description}
                      </span>
                      {spec.inferred === true && available && <span className="mt-1 inline-block rounded-sm bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-500">AI 추정 참고</span>}
                      {checked && <Check className="absolute right-2 top-2 h-4 w-4 text-brand" />}
                    </button>
                  );
                })}
              </div>
              {mode === "detail" && analysis && DETAIL_SHOTS.some((spec) => !isShotAvailable(spec.type, analysis)) && (
                <p className="mt-2 text-[11px] leading-4 text-stone-500">
                  원본에서 보이지 않는 부위는 임의로 만들지 않아요. 분석이 틀렸다면 ‘이미지에서 직접 선택’으로 원하는 부분을 지정해주세요.
                </p>
              )}
            </div>
          )}

          {mode === "detail" && detailTab === "region" && (
            <div className="space-y-3">
              <RegionSelector imageUrl={sourceImageUrl} value={region} onChange={setRegion} />
              <Input
                value={note}
                onChange={(event) => setNote(event.target.value.slice(0, 120))}
                placeholder="예: 가슴 로고 자수 실 질감 (선택)"
                className="h-10 text-[13px]"
              />
            </div>
          )}

          <div className="rounded-md border border-stone-200 bg-[#fbfaf8] p-3">
            <p className="text-[13px] font-semibold text-stone-800">추가 참고 이미지 (선택)</p>
            <p className="mt-1 text-[12px] leading-5 text-stone-500">
              후면 · 측면 · 안쪽처럼 원본에서 보이지 않는 부분은 AI가 추정한 <b>참고 이미지</b>로 표시됩니다. 실제 샘플 사진을 올리면 그 모습을 반영해요. (최대 {MAX_REFERENCES}장)
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {references.map((url) => (
                <div key={url} className="relative h-14 w-14 overflow-hidden rounded border border-stone-200 bg-white">
                  <img src={url} alt="참고 이미지" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setReferences((current) => current.filter((entry) => entry !== url))}
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                    aria-label="참고 이미지 삭제"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {references.length < MAX_REFERENCES && (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="flex h-14 w-14 items-center justify-center rounded border border-dashed border-stone-300 text-stone-500 hover:border-brand hover:text-brand"
                  aria-label="참고 이미지 추가"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => void addReference(event.target.files)} />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-stone-200 px-5 py-3 sm:justify-between">
          <p className={cn("text-[12px] leading-4", overQuota ? "text-red-600" : "text-stone-500")}>
            {plannedTypes.length ? `${plannedTypes.length}장 생성` : "컷을 선택해주세요"}
            {quota && <span className="block">오늘 {quota.used}/{quota.limit}장 사용{overQuota ? " · 한도 초과" : ""}</span>}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="h-11 rounded-[3px] border-stone-300 px-4" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button
              className="h-11 rounded-[3px] bg-brand px-5 font-bold hover:bg-brand-dark"
              disabled={!plannedTypes.length || overQuota || uploading}
              onClick={() =>
                onSubmit({
                  types: plannedTypes.filter((type) => Boolean(getShotSpec(type))),
                  region: plannedTypes.includes("custom_region") ? region : null,
                  note: plannedTypes.includes("custom_region") ? note : "",
                  referenceImageUrls: references,
                })
              }
            >
              생성하기
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
