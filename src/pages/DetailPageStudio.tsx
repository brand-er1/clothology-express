import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Monitor,
  Rocket,
  Save,
  Smartphone,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { DetailPageRenderer } from "@/components/detail-page/DetailPageRenderer";
import { DetailSectionList } from "@/components/detail-page/DetailSectionList";
import { DetailSectionEditor } from "@/components/detail-page/DetailSectionEditor";
import {
  LoadedInfoSummary,
  MissingInfoForm,
  SaveStatusBadge,
  TemplatePicker,
} from "@/components/detail-page/DetailStudioParts";
import { readUnsyncedBackup, useDetailPageAutosave } from "@/hooks/useDetailPageAutosave";
import { useMobileStickyCtaOffset } from "@/hooks/useMobileStickyCtaOffset";
import {
  applyGeneratedImage,
  buildSectionFromCopy,
  composeDetailDocument,
  createCustomSection,
  createDetailId,
  regenerateSectionText,
} from "@/lib/detail-page/document";
import {
  DETAIL_IMAGE_SPECS,
  fetchLatestImageJobs,
  requestDetailImage,
  runWithConcurrency,
} from "@/lib/detail-page/imagePipeline";
import { DetailGenerationProgress, ImageTypeChecklist } from "@/components/detail-page/DetailGenerationProgress";
import { refreshBrandInSource } from "@/lib/detail-page/source";
import { getDetailTemplateMeta } from "@/lib/detail-page/templates";
import { fetchMyBrand } from "@/services/brand";
import { fetchFunding } from "@/services/funding";
import {
  DetailPageBrandRequiredError,
  fetchDetailPage,
  generateDetailCopy,
  getDetailPageErrorMessage,
  saveDetailPage,
  startFundingFromDetailPage,
} from "@/services/detailPage";
import type {
  DetailFundingStats,
  DetailImageJob,
  DetailImageJobStatus,
  DetailImageType,
  DetailPageDocument,
  DetailPageGenerationMeta,
  DetailPageSource,
  DetailPageTemplateId,
  DetailSection,
  DetailSectionType,
  ProductDetailPage,
} from "@/types/detailPage";
import type { Funding } from "@/types/funding";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

type EditorTab = "sections" | "section" | "product";

const DAY_MS = 24 * 60 * 60 * 1000;

const statsFrom = (source: DetailPageSource, funding: Funding | null): DetailFundingStats => {
  if (funding) {
    return {
      targetQuantity: funding.moq,
      currentQuantity: funding.current_orders,
      price: funding.price,
      endDate: funding.reviewed_at ? new Date(new Date(funding.reviewed_at).getTime() + funding.funding_days * DAY_MS) : null,
      fundingDays: funding.funding_days,
      sizeOptions: funding.size_options ?? [],
      measurements: funding.measurements,
    };
  }
  return {
    targetQuantity: source.targetQuantity,
    currentQuantity: 0,
    price: source.userProvided.price,
    endDate: null,
    fundingDays: 30,
    sizeOptions: source.sizeOptions,
    measurements: source.measurements,
  };
};

const DetailPageStudio = () => {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const stickyRef = useMobileStickyCtaOffset();
  const [page, setPage] = useState<ProductDetailPage | null>(null);
  const [document, setDocument] = useState<DetailPageDocument | null>(null);
  const [source, setSource] = useState<DetailPageSource | null>(null);
  const [generation, setGeneration] = useState<DetailPageGenerationMeta>({});
  const [funding, setFunding] = useState<Funding | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorTab, setEditorTab] = useState<EditorTab>("sections");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [previewWidth, setPreviewWidth] = useState<"mobile" | "desktop">("desktop");
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmFunding, setConfirmFunding] = useState(false);
  const [startingFunding, setStartingFunding] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [imageJobs, setImageJobs] = useState<Partial<Record<DetailImageType, DetailImageJob>>>({});
  const [copyStatus, setCopyStatus] = useState<"idle" | "generating" | "done">("idle");
  const [imageTypes, setImageTypes] = useState<DetailImageType[]>(
    DETAIL_IMAGE_SPECS.filter((spec) => spec.defaultOn).map((spec) => spec.type),
  );
  const [regeneratingImageIds, setRegeneratingImageIds] = useState<string[]>([]);

  const snapshot = useMemo(
    () => (document && source ? { document, source, generation } : null),
    [document, source, generation],
  );
  const autosave = useDetailPageAutosave(page?.id ?? null, snapshot);
  const { resetBaseline } = autosave;

  useEffect(() => {
    if (!pageId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const loaded = await fetchDetailPage(pageId);
        const { data: session } = await supabase.auth.getSession();
        if (session.session?.user.id !== loaded.userId) throw new Error("이 상세페이지를 편집할 권한이 없습니다.");
        const brand = await fetchMyBrand().catch(() => null);
        const linkedFunding = loaded.fundingId ? await fetchFunding(loaded.fundingId).catch(() => null) : null;
        const jobs = await fetchLatestImageJobs(loaded.id);
        if (cancelled) return;
        const serverSnapshot = {
          document: loaded.document,
          source: refreshBrandInSource(loaded.source, brand),
          generation: loaded.generation,
        };
        resetBaseline(serverSnapshot);
        const backup = readUnsyncedBackup(loaded.id, loaded.updatedAt);
        const restored = backup ?? serverSnapshot;
        // Images that finished after the creator left the page are placed now.
        let restoredDocument = restored.document;
        for (const job of Object.values(jobs)) {
          if (job?.status === "completed" && job.url && job.assetId) {
            const waiting = restoredDocument.sections.some((section) =>
              section.images.some((image) => image.slot === job.imageType && image.source === "design"),
            );
            if (waiting) restoredDocument = applyGeneratedImage(restoredDocument, job.imageType, { url: job.url, assetId: job.assetId });
          }
        }
        const initial = { ...restored, document: restoredDocument };
        setImageJobs(jobs);
        if (backup) {
          toast({ title: "저장되지 않았던 마지막 편집 내용을 복원했어요", description: "자동으로 다시 저장합니다." });
        }
        setPage(loaded);
        setFunding(linkedFunding);
        setDocument(initial.document);
        setSource(initial.source);
        setGeneration(initial.generation);
        setSelectedId(initial.document.sections[0]?.id ?? null);
      } catch (error) {
        if (!cancelled) setLoadError(getDetailPageErrorMessage(error, "상세페이지를 불러오지 못했습니다."));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [pageId, resetBaseline]);

  const stats = useMemo(() => (source ? statsFrom(source, funding) : null), [source, funding]);
  const imageStatus = useMemo(() => {
    const map: Partial<Record<DetailImageType, DetailImageJobStatus>> = {};
    for (const job of Object.values(imageJobs)) if (job) map[job.imageType] = job.status;
    return map;
  }, [imageJobs]);
  const hasContent = Boolean(document?.sections.length);
  const inSetup = !hasContent || showSetup;
  const selectedSection = document?.sections.find((section) => section.id === selectedId) ?? null;

  const updateDocument = useCallback((updater: (current: DetailPageDocument) => DetailPageDocument) => {
    setDocument((current) => (current ? updater(current) : current));
  }, []);

  const updateSection = useCallback(
    (next: DetailSection) =>
      updateDocument((current) => ({
        ...current,
        sections: current.sections.map((section) => (section.id === next.id ? next : section)),
      })),
    [updateDocument],
  );

  const setJob = useCallback((imageType: DetailImageType, patch: Partial<DetailImageJob>) => {
    setImageJobs((current) => ({
      ...current,
      [imageType]: {
        imageType,
        status: "pending",
        assetId: null,
        url: null,
        error: null,
        ...current[imageType],
        ...patch,
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  /**
   * Generates the given AI images, two at a time. Each finished image is placed into its
   * slots immediately; a failure only marks that image as failed (retry per image).
   */
  const generateImages = useCallback(
    async (types: DetailImageType[], template: DetailPageTemplateId) => {
      if (!page || !types.length) return;
      types.forEach((type) => setJob(type, { status: "pending", error: null }));
      await runWithConcurrency(types, 2, async (imageType) => {
        setJob(imageType, { status: "generating", error: null });
        try {
          const generated = await requestDetailImage({ detailPageId: page.id, imageType, style: template });
          setDocument((current) => (current ? applyGeneratedImage(current, imageType, generated) : current));
          setJob(imageType, { status: "completed", assetId: generated.assetId, url: generated.url, error: null });
        } catch (error) {
          setJob(imageType, { status: "failed", error: getDetailPageErrorMessage(error, "이미지 생성 실패") });
        }
      });
    },
    [page, setJob],
  );

  const runGeneration = async () => {
    if (!document || !source || !page) return;
    setGenerating(true);
    setConfirmRegenerate(false);
    setCopyStatus("generating");
    try {
      const result = await generateDetailCopy(source, document.template);
      const composed = composeDetailDocument(source, result.copy, document.template, imageTypes);
      // Keep sections the creator added by hand (not the auto MOOD section, which is rebuilt).
      const keptCustom = document.sections.filter(
        (section) =>
          (section.type === "custom_text" || section.type === "custom_image") && !section.images.some((image) => image.slot),
      );
      const nextDocument = { ...composed, sections: [...composed.sections, ...keptCustom] };
      const nextGeneration: DetailPageGenerationMeta = {
        provider: result.provider,
        generatedAt: new Date().toISOString(),
        fallbackReason: result.fallbackReason,
      };
      setCopyStatus("done");

      // Persist first: the image function reads the page's design/source from the database.
      await saveDetailPage({ id: page.id, document: nextDocument, source, generation: nextGeneration });
      resetBaseline({ document: nextDocument, source, generation: nextGeneration });
      setDocument(nextDocument);
      setGeneration(nextGeneration);
      setSelectedId(nextDocument.sections[0]?.id ?? null);
      setShowSetup(false);
      setEditorTab("sections");
      setImageJobs({});
      toast(
        result.provider === "ai"
          ? { title: "상세페이지 문구와 구성을 완성했어요", description: `AI 이미지 ${imageTypes.length}장을 생성하는 동안 미리보기를 확인할 수 있어요.` }
          : {
              title: "기본 문구로 상세페이지를 구성했어요",
              description: "AI 문구 연결이 원활하지 않아 입력한 정보만으로 작성했습니다. 이미지는 계속 생성합니다.",
            },
      );
      setGenerating(false);
      void generateImages(imageTypes, nextDocument.template);
    } catch (error) {
      setCopyStatus("idle");
      toast({ title: "상세페이지를 만들지 못했어요", description: getDetailPageErrorMessage(error), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const regenerateImage = async (imageId: string, slot: DetailImageType, instruction: string) => {
    if (!page || !document) return;
    setRegeneratingImageIds((current) => [...current, imageId]);
    try {
      await autosave.saveNow().catch(() => undefined);
      const generated = await requestDetailImage({
        detailPageId: page.id,
        imageType: slot,
        style: document.template,
        userInstruction: instruction,
      });
      updateDocument((current) => ({
        ...current,
        sections: current.sections.map((section) => ({
          ...section,
          images: section.images.map((image) =>
            image.id === imageId
              ? { ...image, url: generated.url, crop: "full", source: "generated", slot, assetId: generated.assetId }
              : image,
          ),
        })),
      }));
      setJob(slot, { status: "completed", assetId: generated.assetId, url: generated.url, error: null });
      toast({ title: "이미지를 다시 생성했어요" });
    } catch (error) {
      toast({ title: "이미지를 다시 생성하지 못했어요", description: getDetailPageErrorMessage(error), variant: "destructive" });
    } finally {
      setRegeneratingImageIds((current) => current.filter((id) => id !== imageId));
    }
  };

  const regenerateSection = async (section: DetailSection) => {
    if (!source || !document) return;
    setRegeneratingId(section.id);
    try {
      const result = await generateDetailCopy(source, document.template);
      updateSection(regenerateSectionText(section, source, result.copy));
      if (result.provider === "fallback") {
        toast({ title: "AI 연결이 원활하지 않아 기본 문구로 채웠어요", description: result.fallbackReason ?? undefined });
      }
    } finally {
      setRegeneratingId(null);
    }
  };

  const regenerateProductCopy = async () => {
    if (!source || !document) return;
    setRegeneratingId("product");
    try {
      const { copy, provider } = await generateDetailCopy(source, document.template);
      updateDocument((current) => ({
        ...current,
        productName: copy.productName,
        productNameEn: copy.productNameEn,
        subtitle: copy.oneLiner,
        mainCopy: copy.mainCopy,
        sections: current.sections.map((section) =>
          section.type === "hero" ? { ...section, title: copy.productName, description: copy.oneLiner } : section,
        ),
      }));
      if (provider === "fallback") toast({ title: "AI 연결이 원활하지 않아 기본 문구로 채웠어요" });
    } finally {
      setRegeneratingId(null);
    }
  };

  const moveSection = (from: number, to: number) =>
    updateDocument((current) => {
      if (to < 0 || to >= current.sections.length) return current;
      const sections = [...current.sections];
      const [moved] = sections.splice(from, 1);
      sections.splice(to, 0, moved);
      return { ...current, sections };
    });

  const addSection = (type: DetailSectionType) => {
    if (!source || !document) return;
    const fallbackCopy = {
      productName: document.productName,
      productNameEn: document.productNameEn,
      oneLiner: document.subtitle,
      mainCopy: document.mainCopy,
    };
    const created =
      type === "custom_text" || type === "custom_image"
        ? createCustomSection(type)
        : buildSectionFromCopy(type, source, {
            ...fallbackCopy,
            story: document.subtitle,
            designDescription: "",
            designPoints: [{ title: "포인트", text: "내용을 입력하세요." }],
            fabricDescription: source.material ? `${source.material} 원단으로 제작합니다.` : "원단 설명을 입력하세요.",
            fitDescription: "",
            colorDescription: "",
            productionMethod: "",
            styling: [],
            sizeGuide: "",
            care: [],
            fundingGuide: "",
            productionSchedule: "",
            shippingGuide: "",
            notices: [],
            missingInfo: [],
          }) ?? { ...createCustomSection("custom_text"), type, id: createDetailId() };
    updateDocument((current) => ({ ...current, sections: [...current.sections, created] }));
    setSelectedId(created.id);
    setEditorTab("section");
  };

  const removeSection = (id: string) => {
    updateDocument((current) => ({ ...current, sections: current.sections.filter((section) => section.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  };

  const handleManualSave = async (status: "draft" | "ready") => {
    try {
      await autosave.saveNow(status);
      toast({ title: status === "ready" ? "상세페이지를 저장했어요" : "임시저장했어요" });
    } catch (error) {
      toast({ title: "저장 실패", description: getDetailPageErrorMessage(error), variant: "destructive" });
    }
  };

  const handleStartFunding = async () => {
    if (!page || !document || !source) return;
    setStartingFunding(true);
    setConfirmFunding(false);
    try {
      await autosave.saveNow(page.fundingId ? undefined : "ready");
      const { fundingId, linked } = await startFundingFromDetailPage({ ...page, document, source });
      if (!linked) {
        toast({
          title: "펀딩은 만들어졌지만 상세페이지 연결에 실패했어요",
          description: "펀딩 편집 화면의 ‘AI 상세페이지’에서 다시 연결할 수 있습니다.",
          variant: "destructive",
        });
      } else if (!page.fundingId) {
        toast({ title: "펀딩 초안을 만들고 상세페이지를 연결했어요", description: "가격·수량·기간을 확인한 뒤 승인 요청을 보내주세요." });
      }
      navigate(`/fundings/${fundingId}/edit`);
    } catch (error) {
      if (error instanceof DetailPageBrandRequiredError) {
        toast({ title: "내 브랜드를 먼저 등록해주세요", description: error.message });
        navigate(`/my-brand?returnTo=${encodeURIComponent(`/detail-pages/${page.id}`)}`);
        return;
      }
      toast({ title: "펀딩을 시작하지 못했어요", description: getDetailPageErrorMessage(error), variant: "destructive" });
    } finally {
      setStartingFunding(false);
    }
  };

  const selectFromPreview = (id: string) => {
    setSelectedId(id);
    setEditorTab("section");
    setMobileView("edit");
  };

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#f3f1ed]">
        <Header />
        <main className="mx-auto max-w-lg px-5 pt-28 text-center">
          <h1 className="text-xl font-bold">상세페이지를 열 수 없어요</h1>
          <p className="mt-3 text-sm text-stone-500">{loadError}</p>
          <Button asChild className="mt-6 rounded-md bg-brand hover:bg-brand-dark">
            <Link to="/customize">디자인 스튜디오로</Link>
          </Button>
        </main>
      </div>
    );
  }

  if (!page || !document || !source || !stats) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f1ed]">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  const templateMeta = getDetailTemplateMeta(document.template);
  const setTemplate = (template: DetailPageTemplateId) => updateDocument((current) => ({ ...current, template }));

  /* ───────── Setup (before first generation, or "전체 다시 생성") ───────── */
  if (inSetup) {
    return (
      <div className="min-h-screen bg-[#f3f1ed] text-stone-900">
        <Header />
        <main className="mx-auto max-w-[960px] px-4 pb-40 pt-20 sm:px-6 sm:pt-24 md:pb-24">
          <button
            type="button"
            onClick={() => (hasContent ? setShowSetup(false) : navigate(-1))}
            className="inline-flex items-center text-xs font-bold uppercase tracking-[0.14em] text-stone-500 hover:text-brand"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> {hasContent ? "편집으로 돌아가기" : "이전"}
          </button>
          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-brand">AI Detail Page</p>
          <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-[-0.03em] sm:text-4xl">AI 상세페이지 만들기</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-6 text-stone-600">
            디자인 단계에서 입력한 정보는 자동으로 불러왔어요. 스타일을 고르고 빠진 정보만 채우면 쇼핑몰 수준의 상세페이지가 완성됩니다.
          </p>

          <section className="mt-10">
            <h2 className="text-sm font-bold">1. 상세페이지 스타일</h2>
            <div className="mt-3">
              <TemplatePicker value={document.template} onChange={setTemplate} />
            </div>
          </section>

          <section className="mt-10 grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:gap-10">
            <div>
              <h2 className="text-sm font-bold">2. 자동으로 불러온 정보</h2>
              <div className="mt-3 flex gap-3">
                {source.imageUrl && (
                  <img src={source.imageUrl} alt="디자인 이미지" className="h-28 w-36 shrink-0 bg-white object-contain" />
                )}
                <p className="text-xs leading-5 text-stone-500">
                  앞면·뒷면이 함께 있는 디자인 이미지를 섹션마다 앞면/뒷면으로 나눠 사용합니다. 기존 이미지 생성 결과는 그대로 유지됩니다.
                </p>
              </div>
              <div className="mt-4">
                <LoadedInfoSummary source={source} />
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold">3. 추가 정보 (선택)</h2>
              <div className="mt-3">
                <MissingInfoForm source={source} onChange={(userProvided) => setSource({ ...source, userProvided })} />
              </div>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-sm font-bold">4. AI가 생성할 상세페이지 이미지</h2>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              선택한 스타일({templateMeta.name})의 촬영 무드로 생성됩니다. 스타일은 배경·조명·연출만 바꾸고 제품 디자인은 바꾸지 않습니다.
            </p>
            <div className="mt-3">
              <ImageTypeChecklist value={imageTypes} onChange={setImageTypes} />
            </div>
          </section>
        </main>

        <div
          ref={stickyRef}
          data-mascot-safezone
          className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-40 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur md:bottom-0"
        >
          <div className="mx-auto flex max-w-[960px] items-center gap-3">
            <p className="hidden min-w-0 flex-1 truncate text-sm text-stone-500 sm:block">
              {templateMeta.number} {templateMeta.name} 스타일로 생성합니다
            </p>
            <Button
              type="button"
              onClick={() => (hasContent ? setConfirmRegenerate(true) : void runGeneration())}
              disabled={generating}
              className="h-12 w-full rounded-md bg-brand px-6 text-[15px] font-bold hover:bg-brand-dark sm:w-auto"
            >
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {generating ? "상세페이지 작성 중..." : hasContent ? "AI 상세페이지 다시 생성" : "✨ AI 상세페이지 생성"}
            </Button>
          </div>
        </div>

        <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
          <AlertDialogContent className="rounded-md">
            <AlertDialogHeader>
              <AlertDialogTitle>상세페이지를 다시 생성할까요?</AlertDialogTitle>
              <AlertDialogDescription>
                기본 섹션의 문구와 이미지가 새로 작성됩니다. 직접 추가한 텍스트·이미지 섹션은 유지됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-md">취소</AlertDialogCancel>
              <AlertDialogAction className="rounded-md bg-brand hover:bg-brand-dark" onClick={() => void runGeneration()}>
                다시 생성
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  /* ───────── Editor + preview ───────── */
  const retryImage = (type: DetailImageType) => void generateImages([type], document.template);
  const slotTypesInPage = Array.from(
    new Set(document.sections.flatMap((section) => section.images.map((image) => image.slot).filter(Boolean))),
  ) as DetailImageType[];

  const editorPanel = (
    <div className="bg-white">
      {(Object.keys(imageJobs).length > 0 || copyStatus === "generating") && (
        <div className="border-b border-stone-200 p-3">
          <DetailGenerationProgress copyStatus={copyStatus} jobs={imageJobs} onRetry={retryImage} />
        </div>
      )}
      <div className="grid grid-cols-3 border-b border-stone-200" role="tablist">
        {(
          [
            ["sections", "섹션 구성"],
            ["section", "섹션 편집"],
            ["product", "상품 정보"],
          ] as Array<[EditorTab, string]>
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={editorTab === tab}
            onClick={() => setEditorTab(tab)}
            className={cn(
              "h-12 border-b-2 text-sm font-semibold transition",
              editorTab === tab ? "border-brand text-brand" : "border-transparent text-stone-500 hover:text-stone-900",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="p-4 sm:p-5">
        {editorTab === "sections" && (
          <>
            <p className="mb-3 text-xs leading-5 text-stone-500">
              <span className="hidden sm:inline">핸들을 끌어 순서를 바꾸거나 </span>↑↓ 버튼으로 이동하세요. 섹션을 누르면 편집할 수 있어요.
            </p>
            <DetailSectionList
              sections={document.sections}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setEditorTab("section");
              }}
              onMove={moveSection}
              onToggle={(id) =>
                updateDocument((current) => ({
                  ...current,
                  sections: current.sections.map((section) => (section.id === id ? { ...section, visible: !section.visible } : section)),
                }))
              }
              onRemove={removeSection}
              onAdd={addSection}
            />
          </>
        )}
        {editorTab === "section" &&
          (selectedSection ? (
            <DetailSectionEditor
              key={selectedSection.id}
              section={selectedSection}
              source={source}
              onChange={updateSection}
              onRegenerate={() => void regenerateSection(selectedSection)}
              regenerating={regeneratingId === selectedSection.id}
              onRegenerateImage={regenerateImage}
              regeneratingImageIds={regeneratingImageIds}
              imageStatus={imageStatus}
            />
          ) : (
            <p className="py-10 text-center text-sm text-stone-500">‘섹션 구성’ 또는 미리보기에서 편집할 섹션을 선택하세요.</p>
          ))}
        {editorTab === "product" && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="product-name" className="text-xs font-semibold">상품명</Label>
              <Input
                id="product-name"
                value={document.productName}
                maxLength={60}
                onChange={(event) => {
                  const productName = event.target.value;
                  updateDocument((current) => ({
                    ...current,
                    productName,
                    sections: current.sections.map((section) => (section.type === "hero" ? { ...section, title: productName } : section)),
                  }));
                }}
                className="h-11 rounded-md text-base sm:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product-name-en" className="text-xs font-semibold">영문 상품명</Label>
              <Input
                id="product-name-en"
                value={document.productNameEn}
                maxLength={60}
                onChange={(event) => updateDocument((current) => ({ ...current, productNameEn: event.target.value.toUpperCase() }))}
                className="h-11 rounded-md text-base uppercase sm:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product-subtitle" className="text-xs font-semibold">한 줄 소개</Label>
              <Input
                id="product-subtitle"
                value={document.subtitle}
                maxLength={120}
                onChange={(event) => {
                  const subtitle = event.target.value;
                  updateDocument((current) => ({
                    ...current,
                    subtitle,
                    sections: current.sections.map((section) => (section.type === "hero" ? { ...section, description: subtitle } : section)),
                  }));
                }}
                className="h-11 rounded-md text-base sm:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product-main-copy" className="text-xs font-semibold">메인 카피</Label>
              <Textarea
                id="product-main-copy"
                value={document.mainCopy}
                maxLength={120}
                onChange={(event) => updateDocument((current) => ({ ...current, mainCopy: event.target.value }))}
                className="min-h-[72px] rounded-md text-base sm:text-sm"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void regenerateProductCopy()}
              disabled={regeneratingId === "product"}
              className="h-11 w-full rounded-md"
            >
              {regeneratingId === "product" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
              상품명 · 카피 AI 다시 쓰기
            </Button>

            <div className="border-t border-stone-200 pt-5">
              <p className="text-xs font-semibold">템플릿</p>
              <div className="mt-2">
                <TemplatePicker value={document.template} onChange={setTemplate} compact />
              </div>
              {slotTypesInPage.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 h-11 w-full rounded-md"
                  disabled={Object.values(imageJobs).some((job) => job?.status === "generating" || job?.status === "pending")}
                  onClick={() => {
                    void autosave.saveNow().catch(() => undefined).then(() => generateImages(slotTypesInPage, document.template));
                  }}
                >
                  <Sparkles className="mr-1.5 h-4 w-4" /> {templateMeta.name} 스타일로 AI 이미지 {slotTypesInPage.length}장 다시 생성
                </Button>
              )}
              <p className="mt-2 text-[11px] leading-4 text-stone-500">템플릿을 바꾸면 레이아웃은 즉시 바뀌고, 이미지 무드는 위 버튼으로 새 스타일에 맞춰 다시 생성할 수 있어요.</p>
            </div>

            <div className="border-t border-stone-200 pt-5">
              <p className="text-xs font-semibold">추가 정보</p>
              <div className="mt-3">
                <MissingInfoForm source={source} onChange={(userProvided) => setSource({ ...source, userProvided })} />
              </div>
            </div>

            <Button type="button" variant="ghost" onClick={() => setShowSetup(true)} className="h-11 w-full rounded-md text-stone-600">
              <Wand2 className="mr-1.5 h-4 w-4" /> 전체 AI 다시 생성
            </Button>
            {generation.provider === "fallback" && (
              <p className="text-[11px] leading-4 text-amber-700">
                마지막 생성은 AI 연결 실패로 기본 문구를 사용했습니다{generation.fallbackReason ? ` (${generation.fallbackReason})` : ""}.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const preview = (
    <div className={cn("mx-auto bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)]", previewWidth === "mobile" ? "max-w-[390px]" : "max-w-none")}>
      <DetailPageRenderer
        document={document}
        source={source}
        stats={stats}
        imageStatus={imageStatus}
        selectedSectionId={selectedId}
        onSelectSection={selectFromPreview}
      />
    </div>
  );

  const primaryAction = page.fundingId ? (
    <Button asChild className="h-12 min-w-0 flex-1 rounded-md bg-brand px-4 text-sm font-bold hover:bg-brand-dark md:h-10 md:flex-none">
      <Link to={`/fundings/${page.fundingId}/edit`}>
        <ExternalLink className="mr-1.5 h-4 w-4" /> 연결된 펀딩 보기
      </Link>
    </Button>
  ) : (
    <Button
      type="button"
      onClick={() => setConfirmFunding(true)}
      disabled={startingFunding}
      className="h-12 min-w-0 flex-1 rounded-md bg-brand px-4 text-sm font-bold hover:bg-brand-dark md:h-10 md:flex-none"
    >
      {startingFunding ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Rocket className="mr-1.5 h-4 w-4" />}
      <span className="truncate md:hidden">펀딩 시작하기</span>
      <span className="hidden md:inline">이 상세페이지로 펀딩 시작하기</span>
    </Button>
  );

  return (
    <div className="min-h-screen bg-[#ebe9e5] text-stone-900">
      <Header />
      <div className="pt-16 sm:pt-20">
        {/* Toolbar */}
        <div className="border-b border-stone-300 bg-white">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand">
                AI 상세페이지 · {templateMeta.number} {templateMeta.name}
                {page.fundingId && <span className="ml-2 text-stone-400">펀딩 연결됨</span>}
              </p>
              <p className="truncate text-base font-bold">{document.productName || "상품명 없음"}</p>
            </div>
            <SaveStatusBadge status={autosave.status} lastSavedAt={autosave.lastSavedAt} error={autosave.error} />
            <div className="hidden items-center gap-2 md:flex">
              <div className="flex border border-stone-300" role="group" aria-label="미리보기 너비">
                <button type="button" onClick={() => setPreviewWidth("mobile")} className={cn("flex h-10 w-10 items-center justify-center", previewWidth === "mobile" && "bg-stone-900 text-white")} aria-label="모바일 미리보기">
                  <Smartphone className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setPreviewWidth("desktop")} className={cn("flex h-10 w-10 items-center justify-center", previewWidth === "desktop" && "bg-stone-900 text-white")} aria-label="데스크톱 미리보기">
                  <Monitor className="h-4 w-4" />
                </button>
              </div>
              <Button type="button" variant="outline" className="h-10 rounded-md" onClick={() => void handleManualSave("draft")}>
                임시저장
              </Button>
              <Button type="button" variant="outline" className="h-10 rounded-md" onClick={() => void handleManualSave("ready")}>
                <Save className="mr-1.5 h-4 w-4" /> 저장
              </Button>
              {primaryAction}
            </div>
          </div>
          {/* Mobile: edit / preview switch */}
          <div className="grid grid-cols-2 border-t border-stone-200 md:hidden" role="tablist">
            {(["edit", "preview"] as const).map((view) => (
              <button
                key={view}
                type="button"
                role="tab"
                aria-selected={mobileView === view}
                onClick={() => setMobileView(view)}
                className={cn("h-11 border-b-2 text-sm font-semibold", mobileView === view ? "border-brand text-brand" : "border-transparent text-stone-500")}
              >
                {view === "edit" ? "편집" : "미리보기"}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto grid max-w-[1600px] gap-0 pb-40 md:grid-cols-[400px_minmax(0,1fr)] md:gap-6 md:px-6 md:pb-12 md:pt-6">
          <aside className={cn("md:sticky md:top-24 md:block md:max-h-[calc(100vh-7rem)] md:self-start md:overflow-y-auto md:border md:border-stone-300", mobileView === "edit" ? "block" : "hidden")}>
            {editorPanel}
          </aside>
          <section className={cn("min-w-0 md:block", mobileView === "preview" ? "block" : "hidden")} aria-label="상세페이지 미리보기">
            {preview}
          </section>
        </div>
      </div>

      {/* Mobile action bar: above the bottom tab bar, never covering content (page has pb-40). */}
      <div
        ref={stickyRef}
        data-mascot-safezone
        className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-40 border-t border-stone-200 bg-white/95 px-3 py-2.5 backdrop-blur md:hidden"
      >
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <Button type="button" variant="outline" className="h-12 shrink-0 rounded-md px-3 text-sm" onClick={() => void handleManualSave("draft")}>
            임시저장
          </Button>
          <Button type="button" variant="outline" className="h-12 shrink-0 rounded-md px-3 text-sm" onClick={() => void handleManualSave("ready")}>
            저장
          </Button>
          {primaryAction}
        </div>
      </div>

      <AlertDialog open={confirmFunding} onOpenChange={setConfirmFunding}>
        <AlertDialogContent className="rounded-md">
          <AlertDialogHeader>
            <AlertDialogTitle>이 상세페이지로 펀딩을 시작할까요?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              상표 검수 후 펀딩 초안이 만들어지고 상세페이지가 연결됩니다. 다음 화면에서 판매가·수량·기간을 확인하고 승인 요청을 보내면 관리자 승인 후 펀딩이 시작됩니다.
              연결 후에도 상세페이지는 계속 수정할 수 있어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-md">취소</AlertDialogCancel>
            <AlertDialogAction className="rounded-md bg-brand hover:bg-brand-dark" onClick={() => void handleStartFunding()}>
              펀딩 시작하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DetailPageStudio;
