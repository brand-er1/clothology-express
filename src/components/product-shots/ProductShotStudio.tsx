import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Archive,
  Camera,
  Download,
  Info,
  Loader2,
  Maximize2,
  RefreshCw,
  ScanSearch,
  Shirt,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { addToMyWardrobe } from "@/lib/closet-store";
import { inferClosetSlotFromCategory } from "@/lib/closet-character-config";
import { cn } from "@/lib/utils";
import {
  ALL_SHOTS,
  analyzeDesignForShots,
  deleteDesignShot,
  downloadImageUrl,
  downloadShot,
  downloadShotsZip,
  fetchProductShotQuota,
  generateProductShot,
  getShotSpec,
  listDesignShots,
  markShotSavedToCloset,
  ProductShotError,
  runWithConcurrency,
  shotLabel,
  type DesignAnalysis,
  type DesignShot,
  type GenerateShotInput,
  type ProductShotType,
} from "@/services/productShots";
import { ShotOptionsDialog, type ShotDialogMode, type ShotRequestPlan } from "./ShotOptionsDialog";

type Props = {
  /** 지금 보고 있는 최종 디자인 이미지(수정 결과 포함). 모든 컷의 원본 참조 이미지. */
  sourceImageUrl: string | null;
  designId: string | null;
  isSavingDesign?: boolean;
  selectedType: string;
  selectedMaterial: string;
  designContext: string;
  fitLabel?: string;
  /** 파일명 · 옷장 라벨에 쓰는 짧은 이름 */
  productLabel: string;
  onGoToEstimate?: () => void;
  onProceedToFunding?: () => void;
  disabled?: boolean;
};

type ShotItem = {
  key: string;
  type: ProductShotType;
  shot: DesignShot | null;
  request: GenerateShotInput;
  status: "generating" | "succeeded" | "failed";
  error?: string | null;
};

const CONCURRENCY = 2;
// 서버 기록이 이 시간 넘게 "생성 중" 이면(응답 전에 연결이 끊긴 경우) 멈춘 것으로 보고 다시 시도할 수 있게 한다.
const STALE_GENERATING_MS = 4 * 60 * 1000;

const fromServer = (shot: DesignShot): ShotItem => {
  const stale = (shot.status === "generating" || shot.status === "queued") && Date.now() - new Date(shot.updated_at).getTime() > STALE_GENERATING_MS;
  return {
    key: shot.id,
    type: shot.shot_type,
    shot,
    request: { shotId: shot.id, sourceImageUrl: shot.source_image_url, shotType: shot.shot_type, batchId: shot.batch_id },
    status: shot.status === "succeeded" ? "succeeded" : shot.status === "failed" || stale ? "failed" : "generating",
    error: shot.status === "failed" || stale ? shot.error_message || "생성이 중단되었습니다. 다시 시도해주세요." : shot.error_message,
  };
};

export const ProductShotStudio = ({
  sourceImageUrl,
  designId,
  isSavingDesign,
  selectedType,
  selectedMaterial,
  designContext,
  fitLabel,
  productLabel,
  onGoToEstimate,
  onProceedToFunding,
  disabled,
}: Props) => {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [items, setItems] = useState<ShotItem[]>([]);
  const [dialogMode, setDialogMode] = useState<ShotDialogMode | null>(null);
  const [analysis, setAnalysis] = useState<DesignAnalysis | null>(null);
  const [analysisState, setAnalysisState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
  const [preview, setPreview] = useState<ShotItem | null>(null);
  const [zipping, setZipping] = useState(false);
  const analyzedFor = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => active && setIsLoggedIn(Boolean(data.session?.user)));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setIsLoggedIn(Boolean(session?.user)));
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const refreshQuota = useCallback(() => {
    void fetchProductShotQuota().then(setQuota);
  }, []);

  // 이 디자인에서 이전에 만든 컷 불러오기(새로고침해도 남아 있도록).
  const reload = useCallback(async () => {
    if (!isLoggedIn || (!designId && !sourceImageUrl)) return;
    try {
      const shots = await listDesignShots({ designId, sourceImageUrl });
      setItems((current) => {
        const serverIds = new Set(shots.map((shot) => shot.id));
        // 서버에 기록이 없는 진행 중/실패 항목(요청 전 단계 오류 등)은 그대로 둔다.
        const localOnly = current.filter((item) => !item.shot || !serverIds.has(item.shot.id));
        const inFlight = new Map(current.filter((item) => item.shot && item.status === "generating").map((item) => [item.shot!.id, item]));
        return [...localOnly.filter((item) => !item.shot), ...shots.map((shot) => inFlight.get(shot.id) ?? fromServer(shot))];
      });
    } catch (error) {
      console.error("load design shots failed:", error);
    }
  }, [designId, isLoggedIn, sourceImageUrl]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (isLoggedIn) refreshQuota();
  }, [isLoggedIn, refreshQuota]);

  const runAnalysis = useCallback(async () => {
    if (!sourceImageUrl) return;
    analyzedFor.current = sourceImageUrl;
    setAnalysisState("loading");
    try {
      const result = await analyzeDesignForShots({ designId, sourceImageUrl });
      if (analyzedFor.current !== sourceImageUrl) return;
      setAnalysis(result);
      setAnalysisState("ready");
    } catch (error) {
      console.error("design analysis failed:", error);
      if (analyzedFor.current !== sourceImageUrl) return;
      setAnalysis(null);
      setAnalysisState("error");
    }
  }, [designId, sourceImageUrl]);

  // 디자인 이미지가 바뀌면(수정) 분석을 다시 한다.
  useEffect(() => {
    setAnalysis(null);
    setAnalysisState("idle");
    analyzedFor.current = null;
  }, [sourceImageUrl]);

  const requireLogin = () => {
    if (isLoggedIn) return true;
    toast({ title: "로그인이 필요합니다", description: "상세 컷은 로그인한 뒤 내 디자인에서 만들 수 있어요. 디자인은 로그인 후에도 그대로 이어집니다." });
    navigate("/auth?returnTo=/customize");
    return false;
  };

  const openDialog = (mode: ShotDialogMode) => {
    if (!sourceImageUrl) return;
    if (!requireLogin()) return;
    setDialogMode(mode);
    refreshQuota();
    if (analysisState === "idle" || (analysisState === "error" && analyzedFor.current !== sourceImageUrl)) void runAnalysis();
  };

  const runOne = useCallback(async (item: ShotItem) => {
    try {
      const shot = await generateProductShot(item.request);
      setItems((current) =>
        current.map((entry) => (entry.key === item.key ? { ...fromServer(shot), key: item.key, request: { ...item.request, shotId: shot.id } } : entry)),
      );
    } catch (error) {
      const failure = error instanceof ProductShotError ? error : new ProductShotError(error instanceof Error ? error.message : "상세 컷을 만들지 못했습니다.");
      setItems((current) =>
        current.map((entry) => {
          if (entry.key !== item.key) return entry;
          if (failure.shot) {
            const next = fromServer(failure.shot);
            return {
              ...next,
              key: item.key,
              request: { ...item.request, shotId: failure.shot.id },
              // 다시 생성이 실패해도 이전 결과는 남긴다(오류만 표시).
              status: failure.shot.image_url ? "succeeded" : "failed",
              error: failure.message,
            };
          }
          return { ...entry, status: entry.shot?.image_url ? "succeeded" : "failed", error: failure.message };
        }),
      );
      if (failure.quotaExceeded) toast({ title: "오늘 상세 컷 생성 한도를 모두 사용했어요", description: failure.message, variant: "destructive" });
      throw failure;
    }
  }, []);

  const runQueue = useCallback(
    async (queue: ShotItem[]) => {
      let failed = 0;
      await runWithConcurrency(queue, CONCURRENCY, async (item) => {
        try {
          await runOne(item);
        } catch (error) {
          failed += 1;
          throw error;
        }
      });
      refreshQuota();
      if (queue.length > 1 || failed) {
        toast({
          title: failed ? `${queue.length - failed}장 완료 · ${failed}장 실패` : `${queue.length}장 생성 완료`,
          description: failed ? "성공한 컷은 그대로 두고, 실패한 컷만 다시 시도할 수 있어요." : undefined,
          variant: failed && failed === queue.length ? "destructive" : undefined,
        });
      }
      // 응답 전에 연결이 끊긴 컷도 서버 기록으로 맞춘다.
      void reload();
    },
    [refreshQuota, reload, runOne],
  );

  const handleSubmit = (plan: ShotRequestPlan) => {
    if (!sourceImageUrl) return;
    setDialogMode(null);
    const batchId = crypto.randomUUID();
    const queue: ShotItem[] = plan.types.map((type) => ({
      key: `local-${crypto.randomUUID()}`,
      type,
      shot: null,
      status: "generating",
      request: {
        designId,
        sourceImageUrl,
        shotType: type,
        region: type === "custom_region" ? plan.region : null,
        note: type === "custom_region" ? plan.note : null,
        referenceImageUrls: plan.referenceImageUrls,
        batchId,
      },
    }));
    setItems((current) => [...queue, ...current]);
    void runQueue(queue);
  };

  const retryItems = (targets: ShotItem[]) => {
    if (!targets.length) return;
    const queue = targets.map((item) => ({ ...item, status: "generating" as const, error: null }));
    setItems((current) => current.map((entry) => queue.find((item) => item.key === entry.key) ?? entry));
    void runQueue(queue);
  };

  const saveToCloset = (imageUrl: string, label: string, idSuffix: string) => {
    addToMyWardrobe({
      id: `ai-${idSuffix}`,
      slot: inferClosetSlotFromCategory(selectedType),
      label: label.slice(0, 40),
      imageUrl,
      source: "ai_design",
      designRef: {
        // 견적 · 펀딩은 항상 원본 디자인 이미지를 기준으로 한다.
        imageUrl: sourceImageUrl,
        selectedType,
        selectedMaterial,
        designContext,
        fitLabel,
        designId,
      },
    });
  };

  const saveShotToCloset = (item: ShotItem) => {
    if (!item.shot?.image_url) return;
    saveToCloset(item.shot.image_url, `${productLabel} · ${shotLabel(item.type)}`, `shot-${item.shot.id}`);
    void markShotSavedToCloset(item.shot.id);
    setItems((current) =>
      current.map((entry) => (entry.key === item.key && entry.shot ? { ...entry, shot: { ...entry.shot, saved_to_closet_at: new Date().toISOString() } } : entry)),
    );
    toast({ title: "내 옷장에 저장했어요", description: "옷장 > 내 옷장에서 확인할 수 있어요." });
  };

  const removeItem = async (item: ShotItem) => {
    if (item.shot) {
      try {
        await deleteDesignShot(item.shot.id);
      } catch (error) {
        toast({ title: "삭제하지 못했어요", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
        return;
      }
    }
    setItems((current) => current.filter((entry) => entry.key !== item.key));
  };

  const fileBase = productLabel || "brander-design";
  const succeeded = items.filter((item) => item.status === "succeeded" && item.shot?.image_url);
  const failedItems = items.filter((item) => item.status === "failed");
  const generatingCount = items.filter((item) => item.status === "generating").length;
  // 최근 요청 묶음이 위로, 한 묶음 안에서는 촬영 세트 순서(정면 → 후면 → … → 디테일)로 보여준다.
  const ordered = useMemo(() => {
    const groupOf = (item: ShotItem) => item.request.batchId || item.shot?.batch_id || item.shot?.id || item.key;
    const groupTime = new Map<string, number>();
    items.forEach((item, index) => {
      const key = groupOf(item);
      // 아직 서버 기록이 없는(방금 요청한) 항목은 가장 최근으로 본다.
      const time = item.shot ? new Date(item.shot.created_at).getTime() : Number.MAX_SAFE_INTEGER - index;
      groupTime.set(key, Math.max(groupTime.get(key) ?? 0, time));
    });
    const typeOrder = (type: string) => ALL_SHOTS.findIndex((spec) => spec.type === type);
    return [...items].sort(
      (a, b) => (groupTime.get(groupOf(b)) ?? 0) - (groupTime.get(groupOf(a)) ?? 0) || typeOrder(a.type) - typeOrder(b.type),
    );
  }, [items]);
  const currentSourceItems = ordered.filter((item) => !item.shot || item.shot.source_image_url === sourceImageUrl);
  const olderItems = ordered.filter((item) => item.shot && item.shot.source_image_url !== sourceImageUrl);

  const downloadOne = async (item: ShotItem) => {
    try {
      await downloadShot(item.shot!, fileBase);
    } catch (error) {
      toast({ title: "다운로드하지 못했어요", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    }
  };

  const downloadAll = async () => {
    setZipping(true);
    try {
      await downloadShotsZip(succeeded.map((item) => item.shot!), fileBase, sourceImageUrl);
    } catch (error) {
      toast({ title: "ZIP 파일을 만들지 못했어요", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setZipping(false);
    }
  };

  if (!sourceImageUrl) return null;

  const renderCard = (item: ShotItem) => {
    const spec = getShotSpec(item.type);
    const image = item.shot?.image_url;
    const differences = item.shot?.qa && item.shot.qa.matchesReference === false ? item.shot.qa.designDifferences ?? [] : [];
    return (
      <li key={item.key} className="overflow-hidden rounded-md border border-stone-200 bg-white">
        <div className="relative aspect-[4/5] bg-[#efefef]" data-shot-ratio={spec?.aspectRatio}>
          {image && (
            <button type="button" className="group absolute inset-0 cursor-zoom-in" onClick={() => setPreview(item)} aria-label={`${shotLabel(item.type)} 크게 보기`}>
              <img src={image} alt={shotLabel(item.type)} className="h-full w-full object-contain" loading="lazy" />
              <span className="absolute bottom-2 right-2 rounded-full bg-black/65 p-1.5 text-white opacity-90 sm:opacity-0 sm:group-hover:opacity-100">
                <Maximize2 className="h-3.5 w-3.5" />
              </span>
            </button>
          )}
          {item.status === "generating" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/75 text-center backdrop-blur-[1px]">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
              <p className="px-3 text-[12px] font-semibold text-stone-600">{image ? "다시 생성 중..." : "생성 중... (약 20~60초)"}</p>
            </div>
          )}
          {item.status === "failed" && !image && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <p className="line-clamp-4 text-[12px] leading-4 text-stone-600">{item.error || "생성에 실패했습니다."}</p>
            </div>
          )}
          <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1">
            {item.shot?.is_inferred && (
              <span className="rounded-sm bg-stone-900/80 px-1.5 py-0.5 text-[10px] font-bold text-white" title="원본에서 보이지 않는 부분은 AI가 추정했습니다">참고 이미지</span>
            )}
            {differences.length > 0 && (
              <span className="rounded-sm bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white" title={differences.join(", ")}>원본과 차이 확인</span>
            )}
          </div>
        </div>
        <div className="space-y-2 p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-stone-900">{shotLabel(item.type)}</p>
              {item.shot?.note && <p className="truncate text-[11px] text-stone-500">{item.shot.note}</p>}
            </div>
            {item.shot?.saved_to_closet_at && <span className="shrink-0 rounded-sm bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">옷장 저장됨</span>}
          </div>
          {item.error && image && item.status !== "generating" && <p className="text-[11px] leading-4 text-red-600">다시 생성 실패: {item.error}</p>}
          <div className="grid grid-cols-4 gap-1">
            <IconAction label="다운로드" disabled={!image} onClick={() => void downloadOne(item)} icon={<Download className="h-4 w-4" />} />
            <IconAction
              label={item.status === "failed" ? "다시 시도" : "다시 생성"}
              disabled={item.status === "generating" || disabled}
              onClick={() => retryItems([item])}
              icon={<RefreshCw className="h-4 w-4" />}
              emphasized={item.status === "failed"}
            />
            <IconAction label="옷장 저장" disabled={!image} onClick={() => saveShotToCloset(item)} icon={<Shirt className="h-4 w-4" />} />
            <IconAction label="삭제" disabled={item.status === "generating"} onClick={() => void removeItem(item)} icon={<Trash2 className="h-4 w-4" />} />
          </div>
        </div>
      </li>
    );
  };

  return (
    <section className="mt-6 border-t border-stone-200 px-1 pt-5 sm:px-0" aria-label="상세 컷 · 디테일 컷" data-mascot-safezone>
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-bold text-stone-950">상품 촬영 컷 만들기</p>
        <p className="text-[13px] leading-5 text-stone-500">
          지금 디자인을 그대로 유지한 채 다른 각도의 상세 컷과 부위별 디테일 컷을 만들어 상세페이지 · 펀딩에 활용하세요.
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button onClick={() => openDialog("angle")} disabled={disabled} className="h-11 rounded-[3px] bg-brand px-4 text-[13px] font-bold hover:bg-brand-dark">
          <Camera className="mr-1.5 h-4 w-4" /> 상세 컷 생성
        </Button>
        <Button
          onClick={() => openDialog("detail")}
          disabled={disabled}
          variant="outline"
          className="h-11 rounded-[3px] border-brand px-4 text-[13px] font-bold text-brand hover:bg-brand/5 hover:text-brand"
        >
          <ScanSearch className="mr-1.5 h-4 w-4" /> 디테일 컷 생성
        </Button>
        <Button
          variant="outline"
          className="h-11 rounded-[3px] border-stone-300 px-4 text-[13px] font-bold"
          onClick={() =>
            void downloadImageUrl(sourceImageUrl, `${fileBase}_디자인`).catch((error) =>
              toast({ title: "다운로드하지 못했어요", description: error instanceof Error ? error.message : undefined, variant: "destructive" }),
            )
          }
        >
          <Download className="mr-1.5 h-4 w-4" /> 이미지 다운로드
        </Button>
        <Button
          variant="outline"
          className="h-11 rounded-[3px] border-stone-300 px-4 text-[13px] font-bold"
          onClick={() => {
            saveToCloset(sourceImageUrl, productLabel || "내가 만든 디자인", designId ? `design-${designId}` : `design-${Date.now()}`);
            toast({ title: "내 옷장에 저장했어요", description: "옷장 > 내 옷장에서 가상 마네킹에 입혀볼 수 있어요." });
          }}
        >
          <Shirt className="mr-1.5 h-4 w-4" /> 내 옷장에 저장
        </Button>
      </div>
      {isSavingDesign && !designId && (
        <p className="mt-2 text-[12px] text-stone-500">디자인을 저장하는 중이에요. 저장되면 만든 컷이 이 디자인에 함께 보관됩니다.</p>
      )}

      {items.length > 0 && (
        <div className="mt-5 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] font-semibold text-stone-700" aria-live="polite">
              {generatingCount ? (
                <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin text-brand" /> {generatingCount}장 생성 중 · </span>
              ) : null}
              완료 {succeeded.length}장{failedItems.length ? ` · 실패 ${failedItems.length}장` : ""}
              {quota && <span className="ml-2 font-normal text-stone-400">오늘 {quota.used}/{quota.limit}</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {failedItems.length > 0 && (
                <Button size="sm" variant="outline" className="h-9 rounded-[3px] border-red-300 text-[12px] font-bold text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => retryItems(failedItems)} disabled={disabled}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> 실패한 컷 다시 시도
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-9 rounded-[3px] border-stone-300 text-[12px] font-bold" onClick={() => void downloadAll()} disabled={!succeeded.length || zipping}>
                {zipping ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Archive className="mr-1 h-3.5 w-3.5" />} 전체 ZIP 다운로드
              </Button>
            </div>
          </div>

          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">{currentSourceItems.map(renderCard)}</ul>

          {olderItems.length > 0 && (
            <details className="rounded-md border border-stone-200 bg-white p-3">
              <summary className="cursor-pointer text-[13px] font-semibold text-stone-600">이전 버전 디자인에서 만든 컷 {olderItems.length}장</summary>
              <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">{olderItems.map(renderCard)}</ul>
            </details>
          )}

          <div className="flex flex-col gap-2 rounded-md bg-[#f3f1ef] p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-1.5 text-[12px] leading-5 text-stone-600">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              만든 컷은 이 디자인에 저장되어 AI 상세페이지의 ‘이미지 불러오기’에서 바로 쓸 수 있어요. ‘참고 이미지’ 표시 컷은 원본에서 보이지 않는 부분을 AI가 추정한 것이라 실제 제품과 다를 수 있어요.
            </p>
            <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
              {onGoToEstimate && (
                <Button size="sm" variant="outline" className="h-9 rounded-[3px] border-brand text-[12px] font-bold text-brand hover:bg-brand/5 hover:text-brand" onClick={onGoToEstimate} disabled={disabled}>
                  제작 견적 보기
                </Button>
              )}
              {onProceedToFunding && (
                <Button size="sm" className="h-9 rounded-[3px] bg-brand text-[12px] font-bold hover:bg-brand-dark" onClick={onProceedToFunding} disabled={disabled}>
                  펀딩 등록하기
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {dialogMode && (
        <ShotOptionsDialog
          open={Boolean(dialogMode)}
          mode={dialogMode}
          onOpenChange={(open) => !open && setDialogMode(null)}
          sourceImageUrl={sourceImageUrl}
          analysis={analysis}
          analysisState={analysisState}
          onRetryAnalysis={() => void runAnalysis()}
          quota={quota}
          onSubmit={handleSubmit}
        />
      )}

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="flex h-[100dvh] max-h-none w-screen max-w-none flex-col gap-2 rounded-none border-white/15 bg-black p-2 [&>button]:text-white [&>button]:opacity-90 sm:h-[94vh] sm:w-[96vw] sm:max-w-[96vw] sm:rounded-lg sm:p-3">
          <DialogTitle className="px-1 text-[14px] font-semibold text-white">{preview ? shotLabel(preview.type) : ""}</DialogTitle>
          <DialogDescription className="sr-only">생성된 상세 컷 크게 보기</DialogDescription>
          {preview?.shot?.image_url && (
            <>
              <div className="relative min-h-0 flex-1">
                <img src={preview.shot.image_url} alt={shotLabel(preview.type)} className="h-full w-full object-contain" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1">
                <p className="text-[12px] text-white/70">
                  {preview.shot.is_inferred ? "참고 이미지 · 원본에서 보이지 않는 부분은 AI 추정" : "원본 디자인 기준 생성"}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" className="h-9 rounded-[3px]" onClick={() => void downloadOne(preview)}>
                    <Download className="mr-1 h-4 w-4" /> 다운로드
                  </Button>
                  <Button size="sm" variant="secondary" className="h-9 rounded-[3px]" onClick={() => saveShotToCloset(preview)}>
                    <Shirt className="mr-1 h-4 w-4" /> 옷장 저장
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

const IconAction = ({
  label,
  icon,
  onClick,
  disabled,
  emphasized,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  emphasized?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={label}
    className={cn(
      "flex h-11 flex-col items-center justify-center gap-0.5 rounded-[3px] border text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
      emphasized ? "border-brand bg-brand text-white hover:bg-brand-dark" : "border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50",
    )}
  >
    {icon}
    <span>{label}</span>
  </button>
);
