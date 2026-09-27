import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  Eye,
  History,
  Loader2,
  Monitor,
  Rocket,
  Save,
  Smartphone,
  Sparkles,
  Tablet,
  Wand2,
  X,
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
import { ColorOptionsPanel } from "@/components/funding/ColorOptionsPanel";
import type { FundingColor } from "@/lib/funding-colors";
import { fetchFundingColors } from "@/services/fundingColors";
import {
  MissingInfoForm,
  SaveStatusBadge,
  TemplatePicker,
} from "@/components/detail-page/DetailStudioParts";
import {
  CreatorBriefForm,
  PublishStateBadge,
  ReferenceUploader,
  VersionHistoryDialog,
} from "@/components/detail-page/DetailStudioExtras";
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
  fetchLatestImageJobs,
  getDetailImageSpec,
  requestDetailImage,
  runWithConcurrency,
} from "@/lib/detail-page/imagePipeline";
import { DetailGenerationProgress, EditorialGenerationProgress } from "@/components/detail-page/DetailGenerationProgress";
import { ConceptStep, ProductInfoStep, SetupActions, missingRequired } from "@/components/detail-page/DetailSetupFlow";
import { ConceptSwitcher } from "@/components/detail-page/ConceptPicker";
import { ProductAnalysisPanel } from "@/components/detail-page/ProductAnalysisPanel";
import { SectionToolbar } from "@/components/detail-page/SectionToolbar";
import { AiImagePanel } from "@/components/detail-page/AiImagePanel";
import { ImageRegenerateDialog } from "@/components/detail-page/ImageRegenerateDialog";
import { buildFallbackAnalysis } from "@/lib/detail-page/analysis";
import { buildDirection, getConcept, nextVariant, planImages, seedKeyFor, type PlannedImage } from "@/lib/detail-page/artDirection";
import { applyConcept, composeEditorialDocument, createEditorialSection } from "@/lib/detail-page/editorialCompose";
import { buildFallbackCopy } from "@/lib/detail-page/fallbackCopy";
import { refreshBrandInSource } from "@/lib/detail-page/source";
import { getDetailTemplateMeta } from "@/lib/detail-page/templates";
import { fetchMyBrand } from "@/services/brand";
import { fetchFunding } from "@/services/funding";
import {
  DetailPageBrandRequiredError,
  fetchDetailPage,
  fetchDetailPagePublishState,
  analyzeDetailProduct,
  fetchMyAiQuota,
  generateDetailCopy,
  getDetailPageErrorMessage,
  publishDetailPage,
  recordDetailPageVersion,
  restoreDetailPageVersion,
  saveDetailPage,
  startFundingFromDetailPage,
} from "@/services/detailPage";
import type {
  AiQuota,
  DetailCopyTone,
  DetailPagePublishState,
  DetailPageVersion,
  DetailFundingStats,
  DetailImageJob,
  DetailImageJobStatus,
  DetailImageType,
  DetailPageDocument,
  DetailPageCopy,
  DetailPageGenerationMeta,
  DetailPageSource,
  DetailPageTemplateId,
  DetailProductAnalysis,
  DetailSection,
  DetailSectionBackground,
  DetailSectionType,
  ProductDetailPage,
} from "@/types/detailPage";
import type { Funding } from "@/types/funding";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

type EditorTab = "sections" | "section" | "images" | "product";
type SetupStep = "info" | "concept";
type PreviewWidth = "mobile" | "tablet" | "desktop";

const PREVIEW_MAX: Record<PreviewWidth, string> = { mobile: "max-w-[390px]", tablet: "max-w-[768px]", desktop: "max-w-none" };
const BACKGROUND_CYCLE: DetailSectionBackground[] = ["default", "light", "dark", "white", "brand"];

/** Sections a regeneration keeps: the creator's own text / image / video sections (not AI slots). */
const keepCreatorSections = (document: DetailPageDocument) =>
  document.sections.filter(
    (section) =>
      ["custom_text", "custom_image", "video"].includes(section.type) && !section.images.some((image) => image.slot),
  );

/** Fields filled from existing design / funding / brand data (marked "자동 불러옴"). */
const autoLoadedKeys = (source: DetailPageSource, productName: string) => {
  const keys = new Set<string>();
  if (productName.trim()) keys.add("productName");
  if (source.clothType) keys.add("clothType");
  if (source.userProvided.price) keys.add("price");
  if (source.designDescription) keys.add("designDescription");
  if (source.material) keys.add("material");
  if (source.fit) keys.add("fit");
  for (const [key, value] of Object.entries(source.userProvided)) {
    if (typeof value === "string" && value.trim()) keys.add(key);
  }
  return keys;
};

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
  // 펀딩 컬러 옵션(상품 데이터 공유). COLOR 섹션 생성과 미리보기에 사용한다.
  const [fundingColors, setFundingColors] = useState<FundingColor[]>([]);
  const [generation, setGeneration] = useState<DetailPageGenerationMeta>({});
  const [funding, setFunding] = useState<Funding | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorTab, setEditorTab] = useState<EditorTab>("sections");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [previewWidth, setPreviewWidth] = useState<PreviewWidth>("desktop");
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmFunding, setConfirmFunding] = useState(false);
  const [startingFunding, setStartingFunding] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [imageJobs, setImageJobs] = useState<Partial<Record<DetailImageType, DetailImageJob>>>({});
  const [copyStatus, setCopyStatus] = useState<"idle" | "generating" | "done">("idle");
  const [setupStep, setSetupStep] = useState<SetupStep>("info");
  const [analyzing, setAnalyzing] = useState(false);
  const [autoLoaded, setAutoLoaded] = useState<Set<string>>(new Set());
  /** Photos planned by the last editorial generation (drives the 6-stage progress). */
  const [plannedTypes, setPlannedTypes] = useState<DetailImageType[]>([]);
  const [showProgress, setShowProgress] = useState(false);
  const [busySlots, setBusySlots] = useState<DetailImageType[]>([]);
  const [toolbarRegen, setToolbarRegen] = useState<{ imageId: string; slot: DetailImageType } | null>(null);
  /** Photos finished during the current generation, re-applied when the copy re-composes the page. */
  const completedRef = useRef(new Map<DetailImageType, { url: string; assetId: string; ratio?: string }>());
  const [regeneratingImageIds, setRegeneratingImageIds] = useState<string[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [publishState, setPublishState] = useState<DetailPagePublishState | null>(null);
  const [quota, setQuota] = useState<AiQuota | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const snapshot = useMemo(
    () => (document && source ? { document, source, generation } : null),
    [document, source, generation],
  );
  // 관리자 열람(read-only)에서는 자동저장을 끈다.
  const autosave = useDetailPageAutosave(readOnly ? null : page?.id ?? null, readOnly ? null : snapshot);
  const { resetBaseline } = autosave;

  useEffect(() => {
    if (!pageId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const loaded = await fetchDetailPage(pageId);
        const { data: session } = await supabase.auth.getSession();
        let viewOnly = false;
        if (session.session?.user.id !== loaded.userId) {
          // 다른 제작자의 상세페이지는 편집 불가. 관리자는 확인(읽기 전용)만 가능.
          const { data: canView } = await supabase.rpc("has_admin_permission" as never, { p_permission: "fundings.view" } as never);
          if (canView !== true) throw new Error("이 상세페이지를 편집할 권한이 없습니다.");
          viewOnly = true;
        }
        const brand = viewOnly ? null : await fetchMyBrand().catch(() => null);
        const linkedFunding = loaded.fundingId ? await fetchFunding(loaded.fundingId).catch(() => null) : null;
        const jobs = await fetchLatestImageJobs(loaded.id);
        const colorRows = loaded.fundingId ? await fetchFundingColors(loaded.fundingId).catch(() => [] as FundingColor[]) : [];
        if (cancelled) return;
        setFundingColors(colorRows);
        const serverSnapshot = {
          document: loaded.document,
          source: viewOnly ? loaded.source : refreshBrandInSource(loaded.source, brand),
          generation: loaded.generation,
        };
        resetBaseline(serverSnapshot);
        const backup = viewOnly ? null : readUnsyncedBackup(loaded.id, loaded.updatedAt);
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
        setReadOnly(viewOnly);
        setPage(loaded);
        setFunding(linkedFunding);
        void fetchDetailPagePublishState(loaded.id).then((state) => { if (!cancelled) setPublishState(state); });
        if (!viewOnly) void fetchMyAiQuota().then((value) => { if (!cancelled) setQuota(value); });
        setDocument(initial.document);
        setSource(colorRows.length ? { ...initial.source, availableColors: colorRows.map((color) => color.name) } : initial.source);
        setGeneration(initial.generation);
        setSelectedId(initial.document.sections[0]?.id ?? null);
        setAutoLoaded(autoLoadedKeys(initial.source, initial.document.productName));
        setSetupStep(initial.generation.analysis && initial.generation.concepts?.length && !initial.document.sections.length ? "concept" : "info");
      } catch (error) {
        if (!cancelled) setLoadError(getDetailPageErrorMessage(error, "상세페이지를 불러오지 못했습니다."));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [pageId, resetBaseline, reloadKey]);

  const refreshMeta = useCallback(() => {
    if (!page) return;
    void fetchDetailPagePublishState(page.id).then(setPublishState);
    if (!readOnly) void fetchMyAiQuota().then(setQuota);
  }, [page, readOnly]);

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

  /** Ratio the page wants for a slot (set by the art direction when it was planned). */
  const ratioForSlot = useCallback(
    (type: DetailImageType) => {
      for (const section of document?.sections ?? []) {
        const image = section.images.find((entry) => entry.slot === type && entry.ratio);
        if (image?.ratio) return image.ratio;
      }
      return undefined;
    },
    [document],
  );

  /**
   * Generates the given AI images, two at a time. Each finished image is placed into its
   * slots immediately (the preview fills in progressively); a failure only marks that image as
   * failed (retry per image).
   */
  const generateImages = useCallback(
    async (items: Array<Pick<PlannedImage, "type" | "ratio">>, template: DetailPageTemplateId) => {
      if (!page || !items.length) return;
      items.forEach((item) => setJob(item.type, { status: "pending", error: null }));
      await runWithConcurrency(items, 2, async ({ type: imageType, ratio }) => {
        setJob(imageType, { status: "generating", error: null });
        try {
          const generated = await requestDetailImage({ detailPageId: page.id, imageType, style: template, aspectRatio: ratio });
          const placed = { url: generated.url, assetId: generated.assetId, ratio: generated.ratio ?? ratio };
          completedRef.current.set(imageType, placed);
          setDocument((current) => (current ? applyGeneratedImage(current, imageType, placed) : current));
          setJob(imageType, { status: "completed", assetId: generated.assetId, url: generated.url, error: null });
        } catch (error) {
          setJob(imageType, { status: "failed", error: getDetailPageErrorMessage(error, "이미지 생성 실패") });
        }
      });
      refreshMeta();
    },
    [page, setJob, refreshMeta],
  );

  const validationError = source && document ? missingRequired(source, document.productName) : [];

  /** 상품 분석 → 콘셉트 3개 추천. `autoPilot` continues straight into generation with the top concept. */
  const handleAnalyze = async (autoPilot: boolean) => {
    if (!page || !source || !document) return;
    setAnalyzing(true);
    try {
      await autosave.saveNow().catch(() => undefined);
      const result = await analyzeDetailProduct(source, page.id);
      const conceptId = result.concepts[0]?.id ?? "minimal";
      setGeneration((current) => ({ ...current, analysis: result.analysis, concepts: result.concepts, conceptId }));
      if (result.fallbackReason) {
        toast({ title: "입력한 정보로 상품을 분석했어요", description: "AI 이미지 분석 연결이 원활하지 않아 제작자 입력 정보만 사용했습니다." });
      }
      if (autoPilot) await runEditorialGeneration(conceptId, result.analysis, result.concepts);
      else setSetupStep("concept");
    } finally {
      setAnalyzing(false);
    }
  };

  /**
   * Builds the page for a concept. The layout (with the creator's design in every photo slot) is
   * saved and shown right away; photos and copy are then produced in parallel and fill in as they
   * finish.
   */
  const runEditorialGeneration = async (
    conceptId: DetailPageTemplateId,
    analysisInput?: DetailProductAnalysis,
    conceptsInput?: DetailPageGenerationMeta["concepts"],
  ) => {
    if (!document || !source || !page) return;
    const analysis = analysisInput ?? generation.analysis ?? buildFallbackAnalysis(source);
    const direction = buildDirection(conceptId, analysis, seedKeyFor(source));
    const remaining = quota ? Math.max(0, quota.imageLimit - quota.imageUsed) : 10;
    const fullPlan = planImages(direction, analysis, source);
    const plan = fullPlan.slice(0, remaining);
    const productName = document.productName.trim();
    const kept = keepCreatorSections(document);
    const compose = (copy: DetailPageCopy) => {
      const composed = composeEditorialDocument({ source, copy: { ...copy, productName: productName || copy.productName }, direction, analysis, plan });
      return { ...composed, sections: [...composed.sections, ...kept] };
    };

    setGenerating(true);
    setConfirmRegenerate(false);
    completedRef.current.clear();
    setImageJobs({});
    setPlannedTypes(plan.map((item) => item.type));
    setShowProgress(true);
    setCopyStatus("generating");
    try {
      const draft = compose(buildFallbackCopy(source));
      const draftGeneration: DetailPageGenerationMeta = {
        ...generation,
        analysis,
        concepts: conceptsInput ?? generation.concepts,
        conceptId,
      };
      // Persist first: the image function reads the page's design, concept and analysis from the database.
      await saveDetailPage({ id: page.id, document: draft, source, generation: draftGeneration });
      resetBaseline({ document: draft, source, generation: draftGeneration });
      setDocument(draft);
      setGeneration(draftGeneration);
      setSelectedId(draft.sections[0]?.id ?? null);
      setShowSetup(false);
      setEditorTab("sections");
      setMobileView("preview");
      if (plan.length < fullPlan.length) {
        toast({ title: `오늘 남은 AI 이미지 생성 횟수로 ${plan.length}컷만 촬영해요`, description: "나머지 칸은 원본 디자인으로 표시되고 ‘AI 이미지’ 탭에서 나중에 만들 수 있어요." });
      }
    } catch (error) {
      setCopyStatus("idle");
      setShowProgress(false);
      setGenerating(false);
      toast({ title: "상세페이지를 만들지 못했어요", description: getDetailPageErrorMessage(error), variant: "destructive" });
      return;
    }
    setGenerating(false);

    const images = generateImages(plan, conceptId);
    const copy = (async () => {
      const result = await generateDetailCopy(source, conceptId, { detailPageId: page.id, analysis });
      const composed = compose(result.copy);
      setDocument(() => {
        let next = composed;
        for (const [type, placed] of completedRef.current) next = applyGeneratedImage(next, type, placed);
        return next;
      });
      setGeneration((current) => ({
        ...current,
        provider: result.provider,
        generatedAt: new Date().toISOString(),
        fallbackReason: result.fallbackReason,
      }));
      setCopyStatus("done");
      if (result.provider === "fallback") {
        toast({ title: "입력한 정보로 문구를 작성했어요", description: "AI 문구 연결이 원활하지 않아 확인된 정보만으로 작성했습니다. 섹션별로 다시 작성할 수 있어요." });
      }
    })();
    await Promise.allSettled([images, copy]);
    window.setTimeout(() => {
      void autosave
        .saveNow()
        .catch(() => undefined)
        .then(() => recordDetailPageVersion(page.id, "ai_generated", `AI 생성 · ${getConcept(conceptId).name}`))
        .then(refreshMeta);
    }, 0);
  };

  const regenerateImage = async (imageId: string, slot: DetailImageType, instruction: string) => {
    if (!page || !document) return;
    setRegeneratingImageIds((current) => [...current, imageId]);
    try {
      await autosave.saveNow().catch(() => undefined);
      const currentImage = document.sections.flatMap((section) => section.images).find((image) => image.id === imageId);
      const ratio = currentImage?.ratio ?? ratioForSlot(slot);
      const generated = await requestDetailImage({
        detailPageId: page.id,
        imageType: slot,
        style: document.template,
        userInstruction: instruction,
        aspectRatio: ratio,
      });
      updateDocument((current) => ({
        ...current,
        sections: current.sections.map((section) => ({
          ...section,
          images: section.images.map((image) =>
            image.id === imageId
              ? {
                  ...image,
                  url: generated.url,
                  crop: "full",
                  source: "generated",
                  slot,
                  assetId: generated.assetId,
                  ...((generated.ratio ?? ratio) ? { ratio: generated.ratio ?? ratio } : {}),
                }
              : image,
          ),
        })),
      }));
      setJob(slot, { status: "completed", assetId: generated.assetId, url: generated.url, error: null });
      toast({ title: "이미지를 다시 생성했어요" });
      window.setTimeout(() => {
        void autosave.saveNow().catch(() => undefined).then(() => recordDetailPageVersion(page.id, "image_regenerated", getDetailImageSpec(slot).label)).then(refreshMeta);
      }, 0);
    } catch (error) {
      toast({ title: "이미지를 다시 생성하지 못했어요", description: getDetailPageErrorMessage(error), variant: "destructive" });
    } finally {
      setRegeneratingImageIds((current) => current.filter((id) => id !== imageId));
    }
  };

  /** "이 컷만 다시 촬영" from the AI 이미지 panel: every slot of that shot type gets the new photo. */
  const regenerateSlot = async (slot: DetailImageType, instruction: string) => {
    if (!page || !document) return;
    setBusySlots((current) => [...current, slot]);
    setJob(slot, { status: "generating", error: null });
    try {
      await autosave.saveNow().catch(() => undefined);
      const ratio = ratioForSlot(slot);
      const generated = await requestDetailImage({ detailPageId: page.id, imageType: slot, style: document.template, userInstruction: instruction, aspectRatio: ratio });
      updateDocument((current) => applyGeneratedImage(current, slot, { url: generated.url, assetId: generated.assetId, ratio: generated.ratio ?? ratio }));
      setJob(slot, { status: "completed", assetId: generated.assetId, url: generated.url, error: null });
      toast({ title: `${getDetailImageSpec(slot).label} 이미지를 다시 만들었어요` });
      window.setTimeout(() => {
        void autosave.saveNow().catch(() => undefined).then(() => recordDetailPageVersion(page.id, "image_regenerated", getDetailImageSpec(slot).label)).then(refreshMeta);
      }, 0);
    } catch (error) {
      setJob(slot, { status: "failed", error: getDetailPageErrorMessage(error, "이미지 생성 실패") });
      toast({ title: "이미지를 다시 생성하지 못했어요", description: getDetailPageErrorMessage(error), variant: "destructive" });
    } finally {
      setBusySlots((current) => current.filter((entry) => entry !== slot));
    }
  };

  /** Editorial pages: the section's text comes from a re-composition with the new copy (same facts). */
  const rewriteEditorialSection = (section: DetailSection, copy: DetailPageCopy): DetailSection => {
    if (!document?.direction || !source) return section;
    const analysis = generation.analysis ?? buildFallbackAnalysis(source);
    const composed = composeEditorialDocument({ source, copy, direction: document.direction, analysis, plan: [] });
    const match = composed.sections.find((entry) => entry.type === section.type);
    if (!match) return section;
    if (section.type === "hero") return { ...section, description: match.description };
    return { ...section, title: match.title || section.title, description: match.description, items: match.items.length ? match.items : section.items };
  };

  const regenerateSection = async (section: DetailSection, tone?: DetailCopyTone) => {
    if (!source || !document || !page) return;
    setRegeneratingId(section.id);
    try {
      const result = await generateDetailCopy(source, document.template, { tone, detailPageId: page.id, analysis: generation.analysis });
      updateSection(document.direction ? rewriteEditorialSection(section, result.copy) : regenerateSectionText(section, source, result.copy));
      window.setTimeout(() => {
        void autosave.saveNow().catch(() => undefined).then(() => recordDetailPageVersion(page.id, "copy_regenerated", tone ? `톤: ${tone}` : undefined)).then(refreshMeta);
      }, 0);
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
      const { copy, provider } = await generateDetailCopy(source, document.template, { detailPageId: page?.id });
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
    const created = document.direction
      ? createEditorialSection(type, source, document)
      : type === "custom_text" || type === "custom_image"
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
    updateDocument((current) => ({
      ...current,
      sections: type === "hero" ? [created, ...current.sections] : [...current.sections, created],
    }));
    setSelectedId(created.id);
    setEditorTab("section");
  };

  const removeSection = (id: string) => {
    updateDocument((current) => ({ ...current, sections: current.sections.filter((section) => section.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  };

  /** 임시저장: 초안을 저장하고 버전 이력에 남긴다. 고객 화면(적용본)은 바뀌지 않는다. */
  const handleManualSave = async () => {
    if (!page) return;
    try {
      await autosave.saveNow();
      await recordDetailPageVersion(page.id, "manual_save", "임시저장");
      refreshMeta();
      toast({ title: "임시저장했어요", description: "고객에게 보이는 상세페이지는 ‘상세페이지 적용’을 눌러야 바뀝니다." });
    } catch (error) {
      toast({ title: "저장 실패", description: getDetailPageErrorMessage(error), variant: "destructive" });
    }
  };

  /** 상세페이지 적용: 현재 편집본을 게시본으로 고정한다. 펀딩(가격·수량·참여자 등)은 건드리지 않는다. */
  const handlePublish = async () => {
    if (!page) return;
    setConfirmPublish(false);
    setPublishing(true);
    try {
      await autosave.saveNow();
      const result = await publishDetailPage(page.id);
      refreshMeta();
      toast({
        title: `상세페이지를 적용했어요 (v${result.published_version})`,
        description: page.fundingId ? "펀딩 상세화면에 반영되었습니다." : "펀딩을 시작하면 이 상세페이지가 표시됩니다.",
      });
    } catch (error) {
      toast({ title: "적용하지 못했어요", description: getDetailPageErrorMessage(error), variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const leaveEditor = () => {
    setConfirmCancel(false);
    if (page?.fundingId) navigate(`/fundings/${page.fundingId}/edit`);
    else navigate(-1);
  };

  const handleRestore = async (version: DetailPageVersion) => {
    if (!page) return;
    try {
      await autosave.saveNow().catch(() => undefined);
      await restoreDetailPageVersion(page.id, version.id);
      toast({ title: `Version ${version.version}으로 되돌렸어요`, description: "복구 전 편집본은 자동 백업 버전으로 남아 있어요." });
      setPage(null);
      setDocument(null);
      setReloadKey((key) => key + 1);
    } catch (error) {
      toast({ title: "복구하지 못했어요", description: getDetailPageErrorMessage(error), variant: "destructive" });
      throw error;
    }
  };

  const handleStartFunding = async () => {
    if (!page || !document || !source) return;
    setStartingFunding(true);
    setConfirmFunding(false);
    try {
      await autosave.saveNow(page.fundingId ? undefined : "ready");
      await recordDetailPageVersion(page.id, "manual_save", "펀딩 시작 전 저장");
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
    // Editorial pages show a toolbar on the tapped section, so phones stay on the preview.
    if (!document?.direction) setMobileView("edit");
  };

  const moveSectionById = (id: string, delta: -1 | 1) => {
    const index = document?.sections.findIndex((section) => section.id === id) ?? -1;
    if (index >= 0) moveSection(index, index + 1 * delta);
  };

  const patchSectionLayout = (id: string, patch: (section: DetailSection) => DetailSection["layout"]) =>
    updateDocument((current) => ({
      ...current,
      sections: current.sections.map((section) => (section.id === id ? { ...section, layout: patch(section) } : section)),
    }));

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

  /* ───────── 관리자 열람 (읽기 전용) ───────── */
  if (readOnly) {
    return (
      <div className="min-h-screen bg-[#ebe9e5] text-stone-900">
        <Header />
        <div className="pt-16 sm:pt-20">
          <div className="border-b border-stone-300 bg-white">
            <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand">관리자 열람 · 읽기 전용</p>
                <p className="truncate text-base font-bold">{document.productName || "상품명 없음"}</p>
              </div>
              <PublishStateBadge state={publishState} />
              <div className="flex border border-stone-300" role="group" aria-label="미리보기 너비">
                <button type="button" onClick={() => setPreviewWidth("mobile")} className={cn("flex h-10 w-10 items-center justify-center", previewWidth === "mobile" && "bg-stone-900 text-white")} aria-label="모바일 미리보기"><Smartphone className="h-4 w-4" /></button>
                <button type="button" onClick={() => setPreviewWidth("desktop")} className={cn("flex h-10 w-10 items-center justify-center", previewWidth === "desktop" && "bg-stone-900 text-white")} aria-label="PC 미리보기"><Monitor className="h-4 w-4" /></button>
              </div>
              <Button type="button" variant="outline" className="h-10 rounded-md" onClick={() => setVersionsOpen(true)}><History className="mr-1.5 h-4 w-4" />버전 이력</Button>
            </div>
          </div>
          <div className="mx-auto max-w-[1200px] px-0 py-6 sm:px-6">
            <p className="mb-3 px-4 text-xs text-stone-500 sm:px-0">제작자의 현재 편집본입니다. 관리자는 확인만 할 수 있으며 수정·생성·적용은 제작자 본인만 가능합니다.</p>
            <div className={cn("mx-auto bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)]", PREVIEW_MAX[previewWidth])}>
              <DetailPageRenderer document={document} source={source} stats={stats} colors={fundingColors} />
            </div>
          </div>
        </div>
        <VersionHistoryDialog pageId={page.id} open={versionsOpen} onOpenChange={setVersionsOpen} onRestore={async () => undefined} readOnly />
      </div>
    );
  }

  const setTemplate = (template: DetailPageTemplateId) => updateDocument((current) => ({ ...current, template }));

  /* ───────── Setup: 상품 정보 → AI 분석 · 콘셉트 선택 (before first generation, or "전체 다시 생성") ───────── */
  if (inSetup) {
    const analysis = generation.analysis;
    const concepts = generation.concepts ?? [];
    const onConceptStep = setupStep === "concept" && analysis && concepts.length > 0;
    const conceptId = generation.conceptId ?? concepts[0]?.id ?? null;
    const plannedShots = analysis && conceptId ? planImages(buildDirection(conceptId, analysis, seedKeyFor(source)), analysis, source).length : 0;
    const blockedReason = validationError.length ? `${validationError.join(", ")}을(를) 입력해주세요` : null;
    const start = (id: DetailPageTemplateId | null) => {
      if (!id) return;
      if (hasContent) {
        setGeneration((current) => ({ ...current, conceptId: id }));
        setConfirmRegenerate(true);
      } else void runEditorialGeneration(id);
    };
    const steps: Array<[SetupStep | "make", string]> = [["info", "상품 정보"], ["concept", "분석 · 콘셉트"], ["make", "제작 · 편집"]];
    return (
      <div className="min-h-screen bg-[#f3f1ed] text-stone-900">
        <Header />
        <main className="mx-auto max-w-[1080px] px-4 pb-44 pt-20 sm:px-6 sm:pt-24 md:pb-28">
          <button
            type="button"
            onClick={() => (onConceptStep ? setSetupStep("info") : hasContent ? setShowSetup(false) : navigate(-1))}
            className="inline-flex min-h-10 items-center text-xs font-bold uppercase tracking-[0.14em] text-stone-500 hover:text-brand"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> {onConceptStep ? "상품 정보" : hasContent ? "편집으로 돌아가기" : "이전"}
          </button>
          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-brand">AI Detail Page</p>
          <h1 className="mt-2 text-[26px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[34px]">
            {onConceptStep ? "콘셉트를 골라주세요" : "AI 상세페이지 만들기"}
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-6 text-stone-600">
            {onConceptStep
              ? "상품을 분석해 어울리는 콘셉트 3개를 골랐어요. 하나를 선택하면 촬영 컷·카피·레이아웃을 만들어요."
              : "이미 입력한 디자인·펀딩·브랜드 정보는 자동으로 불러왔어요. 필수 정보만 확인하면 됩니다."}
          </p>
          <ol className="mt-6 flex gap-4 border-b border-stone-300 text-xs font-semibold" aria-label="진행 단계">
            {steps.map(([key, label], index) => {
              const active = key === (onConceptStep ? "concept" : "info");
              return (
                <li key={key} className={cn("-mb-px border-b-2 pb-2.5", active ? "border-brand text-brand" : "border-transparent text-stone-400")}>
                  {String(index + 1).padStart(2, "0")} {label}
                </li>
              );
            })}
          </ol>

          <div className="mt-8">
            {onConceptStep ? (
              <ConceptStep
                analysis={analysis}
                concepts={concepts}
                conceptId={conceptId}
                source={source}
                productName={document.productName}
                stats={stats}
                onAnalysisChange={(next) => setGeneration((current) => ({ ...current, analysis: next }))}
                onConceptChange={(id) => setGeneration((current) => ({ ...current, conceptId: id }))}
                onEditInfo={() => setSetupStep("info")}
              />
            ) : (
              <ProductInfoStep
                page={page}
                source={source}
                productName={document.productName}
                autoLoaded={autoLoaded}
                onSourceChange={setSource}
                onProductNameChange={(productName) =>
                  updateDocument((current) => ({
                    ...current,
                    productName,
                    sections: current.sections.map((section) => (section.type === "hero" ? { ...section, title: productName } : section)),
                  }))
                }
              />
            )}
          </div>
        </main>

        <div
          ref={stickyRef}
          data-mascot-safezone
          className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-40 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur md:bottom-0"
        >
          <SetupActions
            step={onConceptStep ? "concept" : "info"}
            busy={analyzing || generating}
            busyLabel={analyzing ? "상품 분석 중..." : "구성 중..."}
            blockedReason={blockedReason}
            quota={quota}
            plannedShots={plannedShots}
            onAutoPilot={() => (onConceptStep ? start(concepts[0]?.id ?? null) : void handleAnalyze(!hasContent))}
            onNext={() => (onConceptStep ? start(conceptId) : void handleAnalyze(false))}
          />
        </div>

        <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
          <AlertDialogContent className="rounded-md">
            <AlertDialogHeader>
              <AlertDialogTitle>상세페이지를 새로 만들까요?</AlertDialogTitle>
              <AlertDialogDescription>
                AI가 만든 섹션의 문구와 이미지가 새로 만들어집니다. 직접 추가한 텍스트·이미지·동영상 섹션은 유지되고, 지금 편집본은 버전 이력에서 복구할 수 있어요.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-md">취소</AlertDialogCancel>
              <AlertDialogAction
                className="rounded-md bg-brand hover:bg-brand-dark"
                onClick={() => {
                  void (async () => {
                    await recordDetailPageVersion(page.id, "manual_save", "새로 만들기 전 자동 백업");
                    await runEditorialGeneration(generation.conceptId ?? concepts[0]?.id ?? "minimal");
                  })();
                }}
              >
                새로 만들기
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  /* ───────── Editor + preview ───────── */
  const retryImage = (type: DetailImageType) => void generateImages([{ type, ratio: ratioForSlot(type) ?? "" }], document.template);
  const slotTypesInPage = Array.from(
    new Set(document.sections.flatMap((section) => section.images.map((image) => image.slot).filter(Boolean))),
  ) as DetailImageType[];

  const editorPanel = (
    <div className="bg-white">
      {showProgress && plannedTypes.length > 0 ? (
        <div className="relative border-b border-stone-200 p-3">
          <EditorialGenerationProgress copyStatus={copyStatus} planned={plannedTypes} jobs={imageJobs} onRetry={retryImage} />
          {copyStatus === "done" && !Object.values(imageJobs).some((job) => job?.status === "generating" || job?.status === "pending") && (
            <button type="button" onClick={() => setShowProgress(false)} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center text-stone-400 hover:text-stone-900" aria-label="진행 상황 닫기">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        !document.direction &&
        (Object.keys(imageJobs).length > 0 || copyStatus === "generating") && (
          <div className="border-b border-stone-200 p-3">
            <DetailGenerationProgress copyStatus={copyStatus} jobs={imageJobs} onRetry={retryImage} />
          </div>
        )
      )}
      <div className="grid grid-cols-4 border-b border-stone-200" role="tablist">
        {(
          [
            ["sections", "섹션 구성"],
            ["section", "섹션 편집"],
            ["images", "AI 이미지"],
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
            {page.fundingId && (
              <ColorOptionsPanel
                fundingId={page.fundingId}
                colors={fundingColors}
                readOnly={readOnly}
                hasColorSection={document.sections.some((section) => section.type === "color")}
                onAddColorSection={() => addSection("color")}
                returnTo={`/detail-pages/${page.id}`}
              />
            )}
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
              editorial={Boolean(document.direction)}
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
              onRegenerate={(tone) => void regenerateSection(selectedSection, tone)}
              regenerating={regeneratingId === selectedSection.id}
              onRegenerateImage={regenerateImage}
              regeneratingImageIds={regeneratingImageIds}
              imageStatus={imageStatus}
              direction={document.direction}
            />
          ) : (
            <p className="py-10 text-center text-sm text-stone-500">‘섹션 구성’ 또는 미리보기에서 편집할 섹션을 선택하세요.</p>
          ))}
        {editorTab === "images" && (
          <AiImagePanel document={document} imageStatus={imageStatus} busyTypes={busySlots} onRegenerate={(type, instruction) => void regenerateSlot(type, instruction)} />
        )}
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

            {document.direction ? (
              <div className="border-t border-stone-200 pt-5">
                <p className="text-xs font-semibold">콘셉트</p>
                <p className="mt-1 text-[11px] leading-4 text-stone-500">바꾸면 팔레트·타이포·섹션 순서·레이아웃이 즉시 바뀌고 내용은 유지돼요.</p>
                <div className="mt-2">
                  <ConceptSwitcher
                    value={document.template}
                    onChange={(id) => {
                      updateDocument((current) => applyConcept(current, id, generation.analysis, seedKeyFor(source)));
                      setGeneration((current) => ({ ...current, conceptId: id }));
                    }}
                  />
                </div>
                {slotTypesInPage.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 h-11 w-full rounded-md"
                    disabled={Object.values(imageJobs).some((job) => job?.status === "generating" || job?.status === "pending")}
                    onClick={() => {
                      void autosave.saveNow().catch(() => undefined).then(() =>
                        generateImages(slotTypesInPage.map((type) => ({ type, ratio: ratioForSlot(type) ?? "" })), document.template),
                      );
                    }}
                  >
                    <Sparkles className="mr-1.5 h-4 w-4" /> {getConcept(document.template).name} 무드로 AI 이미지 {slotTypesInPage.length}컷 다시 촬영
                  </Button>
                )}
                {generation.analysis && (
                  <details className="mt-5 border-t border-stone-200 pt-4">
                    <summary className="flex min-h-10 cursor-pointer items-center text-xs font-semibold">AI 상품 분석 결과 · 디테일 확인</summary>
                    <div className="mt-3">
                      <ProductAnalysisPanel analysis={generation.analysis} onChange={(next) => setGeneration((current) => ({ ...current, analysis: next }))} />
                    </div>
                  </details>
                )}
              </div>
            ) : (
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
                    void autosave.saveNow().catch(() => undefined).then(() => generateImages(slotTypesInPage.map((type) => ({ type, ratio: "" })), document.template));
                  }}
                >
                  <Sparkles className="mr-1.5 h-4 w-4" /> {templateMeta.name} 스타일로 AI 이미지 {slotTypesInPage.length}장 다시 생성
                </Button>
              )}
              <p className="mt-2 text-[11px] leading-4 text-stone-500">템플릿을 바꾸면 레이아웃은 즉시 바뀌고, 이미지 무드는 위 버튼으로 새 스타일에 맞춰 다시 생성할 수 있어요.</p>
            </div>

            )}
            <div className="border-t border-stone-200 pt-5">
              <p className="text-xs font-semibold">추가 정보</p>
              <div className="mt-3">
                <MissingInfoForm source={source} onChange={(userProvided) => setSource({ ...source, userProvided })} />
              </div>
              <div className="mt-5">
                <CreatorBriefForm value={source.userProvided} onChange={(userProvided) => setSource({ ...source, userProvided })} />
              </div>
            </div>

            <div className="border-t border-stone-200 pt-5">
              <p className="text-xs font-semibold">참고자료</p>
              <div className="mt-3"><ReferenceUploader page={page} /></div>
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

  const renderToolbar = (section: DetailSection) => {
    const index = document.sections.findIndex((entry) => entry.id === section.id);
    const slotImage = section.images.find((image) => image.slot);
    return (
      <SectionToolbar
        section={section}
        isFirst={index === 0}
        isLast={index === document.sections.length - 1}
        busy={regeneratingId === section.id || Boolean(slotImage && regeneratingImageIds.includes(slotImage.id))}
        actions={{
          onEdit: () => {
            setSelectedId(section.id);
            setEditorTab("section");
            setMobileView("edit");
          },
          onMove: (delta) => moveSectionById(section.id, delta),
          onCycleLayout: () => patchSectionLayout(section.id, (entry) => ({ ...entry.layout, variant: nextVariant(entry.type, entry.layout?.variant) })),
          onCycleBackground: () =>
            patchSectionLayout(section.id, (entry) => {
              const current = BACKGROUND_CYCLE.indexOf(entry.layout?.background ?? "default");
              return { ...entry.layout, background: BACKGROUND_CYCLE[(current + 1) % BACKGROUND_CYCLE.length] };
            }),
          onChangeImage: () => {
            setSelectedId(section.id);
            setEditorTab("section");
            setMobileView("edit");
          },
          onRegenerateImage: () => slotImage?.slot && setToolbarRegen({ imageId: slotImage.id, slot: slotImage.slot }),
          onRewrite: () => void regenerateSection(section),
          onRemove: () => removeSection(section.id),
        }}
      />
    );
  };

  const preview = (
    <div className={cn("mx-auto bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)] transition-[max-width]", PREVIEW_MAX[previewWidth])}>
      <DetailPageRenderer
        document={document}
        source={source}
        stats={stats}
        imageStatus={imageStatus}
        colors={fundingColors}
        selectedSectionId={selectedId}
        onSelectSection={selectFromPreview}
        renderToolbar={document.direction ? renderToolbar : undefined}
      />
    </div>
  );

  const widthSwitch = (
    <div className="flex border border-stone-300" role="group" aria-label="미리보기 너비">
      {(
        [
          ["mobile", Smartphone, "모바일 미리보기"],
          ["tablet", Tablet, "태블릿 미리보기"],
          ["desktop", Monitor, "데스크톱 미리보기"],
        ] as const
      ).map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => setPreviewWidth(value)}
          className={cn("flex h-10 w-10 items-center justify-center", previewWidth === value && "bg-stone-900 text-white")}
          aria-label={label}
          aria-pressed={previewWidth === value}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );

  const publishButton = (
    <Button
      type="button"
      onClick={() => setConfirmPublish(true)}
      disabled={publishing}
      className="h-12 min-w-0 flex-1 rounded-md bg-brand px-4 text-sm font-bold hover:bg-brand-dark md:h-10 md:flex-none"
    >
      {publishing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Eye className="mr-1.5 h-4 w-4" />}
      상세페이지 적용
    </Button>
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
      <span className="truncate md:hidden">펀딩 등록하기</span>
      <span className="hidden md:inline">이 상세페이지로 펀딩 등록하기</span>
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
            <PublishStateBadge state={publishState} />
            <div className="hidden items-center gap-2 md:flex">
              {widthSwitch}
              <Button type="button" variant="ghost" className="h-10 rounded-md" onClick={() => setVersionsOpen(true)}>
                <History className="mr-1.5 h-4 w-4" /> 버전 이력
              </Button>
              <Button type="button" variant="ghost" className="h-10 rounded-md" onClick={() => setConfirmCancel(true)}>
                <X className="mr-1.5 h-4 w-4" /> 취소
              </Button>
              <Button type="button" variant="outline" className="h-10 rounded-md" onClick={() => void handleManualSave()}>
                <Save className="mr-1.5 h-4 w-4" /> 임시저장
              </Button>
              {publishButton}
              {!page.fundingId && primaryAction}
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
            {showProgress && plannedTypes.length > 0 && (() => {
              const done = plannedTypes.filter((type) => imageJobs[type]?.status === "completed" || imageJobs[type]?.status === "failed").length;
              if (copyStatus === "done" && done === plannedTypes.length) return null;
              return (
                <button type="button" onClick={() => setMobileView("edit")} className="flex min-h-11 w-full items-center gap-2 border-b border-stone-200 bg-white px-4 text-left text-xs font-semibold md:hidden" aria-live="polite">
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand" />
                  <span className="min-w-0 flex-1 truncate">
                    {copyStatus !== "done" ? "상품 설명 작성 중" : "상세페이지 이미지 제작 중"} · 촬영 {done}/{plannedTypes.length}
                  </span>
                  <span className="shrink-0 text-stone-400">자세히</span>
                </button>
              );
            })()}
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
          <Button type="button" variant="outline" className="h-12 shrink-0 rounded-md px-2.5 text-sm" onClick={() => setVersionsOpen(true)} aria-label="버전 이력">
            <History className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" className="h-12 shrink-0 rounded-md px-3 text-sm" onClick={() => void handleManualSave()}>
            임시저장
          </Button>
          {page.fundingId ? publishButton : primaryAction}
        </div>
      </div>

      <AlertDialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <AlertDialogContent className="rounded-md">
          <AlertDialogHeader>
            <AlertDialogTitle>이 상세페이지를 적용할까요?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              지금 편집한 내용이 {page.fundingId ? "펀딩 상세화면에 바로 표시" : "펀딩 시작 후 표시될 적용본으로 저장"}됩니다. 판매가·목표수량·참여자·주문·결제 등 펀딩 정보는 바뀌지 않으며, 이전 적용본은 버전 이력에서 복구할 수 있어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-md">취소</AlertDialogCancel>
            <AlertDialogAction className="rounded-md bg-brand hover:bg-brand-dark" onClick={() => void handlePublish()}>
              상세페이지 적용
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent className="rounded-md">
          <AlertDialogHeader>
            <AlertDialogTitle>편집을 마칠까요?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              지금까지 편집한 내용은 임시저장되어 다음에 이어서 작업할 수 있어요. ‘상세페이지 적용’을 누르지 않았다면 고객에게 보이는 상세페이지는 바뀌지 않습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-md">계속 편집</AlertDialogCancel>
            <AlertDialogAction className="rounded-md bg-stone-900 hover:bg-stone-700" onClick={leaveEditor}>
              나가기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VersionHistoryDialog pageId={page.id} open={versionsOpen} onOpenChange={setVersionsOpen} onRestore={handleRestore} />

      <ImageRegenerateDialog
        open={toolbarRegen !== null}
        label={toolbarRegen ? getDetailImageSpec(toolbarRegen.slot).label : undefined}
        onOpenChange={(open) => !open && setToolbarRegen(null)}
        onSubmit={(instruction) => toolbarRegen && void regenerateImage(toolbarRegen.imageId, toolbarRegen.slot, instruction)}
      />

      <AlertDialog open={confirmFunding} onOpenChange={setConfirmFunding}>
        <AlertDialogContent className="rounded-md">
          <AlertDialogHeader>
            <AlertDialogTitle>이 상세페이지로 펀딩을 등록할까요?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              상품명·대표 이미지·판매가·설명·사이즈·브랜드 정보가 펀딩 등록 화면에 그대로 전달돼 다시 입력할 필요가 없어요.
              상표 검수 후 펀딩 초안이 만들어지고 상세페이지가 연결됩니다. 다음 화면에서 판매가·수량·기간을 확인하고 승인 요청을 보내면 관리자 승인 후 펀딩이 시작됩니다.
              연결 후에도 상세페이지는 계속 수정할 수 있어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-md">취소</AlertDialogCancel>
            <AlertDialogAction className="rounded-md bg-brand hover:bg-brand-dark" onClick={() => void handleStartFunding()}>
              펀딩 등록하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DetailPageStudio;
