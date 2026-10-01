import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  Eye,
  History,
  Loader2,
  LogOut,
  Monitor,
  Rocket,
  Save,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DetailPreviewOverlay } from "@/components/detail-page/DetailPreviewOverlay";
import {
  parseMissingItemsError,
  validateDetailPageForPublish,
  type DetailPublishMissingItem,
} from "@/lib/detail-page/validation";
import { DetailPageRenderer } from "@/components/detail-page/DetailPageRenderer";
import { DetailSectionList } from "@/components/detail-page/DetailSectionList";
import { DetailSectionEditor } from "@/components/detail-page/DetailSectionEditor";
import { ColorOptionsPanel } from "@/components/funding/ColorOptionsPanel";
import type { FundingColor } from "@/lib/funding-colors";
import { fetchFundingColors } from "@/services/fundingColors";
import {
  LoadedInfoSummary,
  MissingInfoForm,
  SaveStatusBadge,
  TemplatePicker,
} from "@/components/detail-page/DetailStudioParts";
import {
  CreatorBriefForm,
  PublishStateBadge,
  QuotaNote,
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
  duplicateSection,
  getTextField,
  regenerateSectionText,
  REWRITE_OPTIONS,
  SECTION_META,
  setTextField,
} from "@/lib/detail-page/document";
import {
  DETAIL_IMAGE_SPECS,
  fetchLatestImageJobs,
  getDetailImageSpec,
  requestDetailImage,
  runWithConcurrency,
} from "@/lib/detail-page/imagePipeline";
import { DetailGenerationProgress, ImageTypeChecklist } from "@/components/detail-page/DetailGenerationProgress";
import { refreshBrandInSource, refreshFundingInSource } from "@/lib/detail-page/source";
import { getDetailTemplateMeta } from "@/lib/detail-page/templates";
import { fetchMyBrand } from "@/services/brand";
import { fetchFunding } from "@/services/funding";
import {
  DetailPageBrandRequiredError,
  fetchDetailImageLibrary,
  fetchDetailPage,
  fetchDetailPagePublishState,
  fetchMyAiQuota,
  generateDetailCopy,
  getDetailPageErrorMessage,
  publishDetailPage,
  recordDetailPageVersion,
  restoreDetailPageVersion,
  rewriteDetailText,
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
  DetailPageGenerationMeta,
  DetailPageSource,
  DetailPageTemplateId,
  DetailSection,
  DetailSectionType,
  DetailRewriteInstruction,
  DetailTextField,
  ProductDetailPage,
} from "@/types/detailPage";
import type { Funding } from "@/types/funding";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

type EditorTab = "sections" | "section" | "product";

const DAY_MS = 24 * 60 * 60 * 1000;

const FULL_REGENERATE_MESSAGE = "현재 수정한 상세페이지 내용이 변경될 수 있습니다. 전체 상세페이지를 다시 생성하시겠습니까?";

const fieldLabel = (target: DetailTextField) => {
  if (target.scope === "document") return { productName: "상품명", productNameEn: "영문 상품명", subtitle: "한 줄 소개", mainCopy: "메인 카피" }[target.field];
  if (target.scope === "section") return { eyebrow: "라벨", title: "제목", description: "본문" }[target.field];
  if (target.scope === "item") return target.field === "title" ? "항목 제목" : "항목 내용";
  return target.field === "label" ? "정보 항목명" : "정보 값";
};

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
  // 모바일: "preview" = 페이지(인라인 편집 캔버스), "edit" = 섹션 설정 패널
  const [mobileView, setMobileView] = useState<"edit" | "preview">("preview");
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
  const [readOnly, setReadOnly] = useState(false);
  const [publishState, setPublishState] = useState<DetailPagePublishState | null>(null);
  const [quota, setQuota] = useState<AiQuota | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeField, setActiveField] = useState<DetailTextField | null>(null);
  const [rewritingKey, setRewritingKey] = useState<string | null>(null);
  const [missingItems, setMissingItems] = useState<DetailPublishMissingItem[] | null>(null);
  const [publishDone, setPublishDone] = useState<{ first: boolean; version: number } | null>(null);
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
  // 비동기 작업(AI 재작성 등)이 끝난 시점의 최신 문서를 읽기 위한 참조
  const documentRef = useRef<DetailPageDocument | null>(null);
  documentRef.current = document;

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
          // 브랜드 · 펀딩(가격/사이즈/MOQ/기간) 최신 값을 사실 데이터에 반영한다(다음 저장 때 함께 저장).
          source: viewOnly ? loaded.source : refreshFundingInSource(refreshBrandInSource(loaded.source, brand), linkedFunding),
          generation: loaded.generation,
        };
        resetBaseline(serverSnapshot, loaded.updatedAt);
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
      refreshMeta();
    },
    [page, setJob, refreshMeta],
  );

  const runGeneration = async () => {
    if (!document || !source || !page) return;
    setGenerating(true);
    setConfirmRegenerate(false);
    setCopyStatus("generating");
    try {
      if (hasContent) {
        // 전체 재생성 전 현재 편집본을 버전으로 남긴다(버전 이력에서 되돌릴 수 있음).
        await autosave.saveNow().catch(() => undefined);
        await recordDetailPageVersion(page.id, "manual_save", "전체 재생성 전 자동 백업");
      }
      const result = await generateDetailCopy(source, document.template, { detailPageId: page.id });
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
      void recordDetailPageVersion(page.id, "ai_generated", result.provider === "ai" ? "AI 최초 생성" : "기본 문구로 생성").then(refreshMeta);
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
      // 하루 생성 한도를 넘는 요청은 보내지 않는다(남은 횟수만큼 우선순위 순서대로).
      const remaining = quota ? Math.max(0, quota.imageLimit - quota.imageUsed) : imageTypes.length;
      const allowedTypes = imageTypes.slice(0, remaining);
      if (allowedTypes.length < imageTypes.length) {
        toast({ title: `오늘 남은 AI 이미지 생성 횟수로 ${allowedTypes.length}장만 생성해요`, description: "나머지 이미지 칸은 원본 디자인으로 표시되고 내일 다시 생성할 수 있어요." });
      }
      void generateImages(allowedTypes, nextDocument.template);
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
      window.setTimeout(() => {
        void autosave.saveNow().catch(() => undefined).then(() => recordDetailPageVersion(page.id, "image_regenerated", getDetailImageSpec(slot).label)).then(refreshMeta);
      }, 0);
    } catch (error) {
      toast({ title: "이미지를 다시 생성하지 못했어요", description: getDetailPageErrorMessage(error), variant: "destructive" });
    } finally {
      setRegeneratingImageIds((current) => current.filter((id) => id !== imageId));
    }
  };

  /** 섹션 전체 재생성: 이 섹션의 문구만 바꾸고(이미지·순서·표시 여부 유지) 다른 섹션은 건드리지 않는다. */
  const regenerateSection = async (section: DetailSection, tone?: DetailCopyTone) => {
    if (!source || !document || !page) return;
    setRegeneratingId(section.id);
    try {
      const result = await generateDetailCopy(source, document.template, { tone, detailPageId: page.id });
      updateDocument((current) => {
        const target = current.sections.find((entry) => entry.id === section.id);
        if (!target) return current;
        const next = regenerateSectionText(target, source, result.copy);
        let updated = { ...current, sections: current.sections.map((entry) => (entry.id === section.id ? next : entry)) };
        if (target.type === "hero") {
          updated = setTextField(updated, { scope: "section", sectionId: section.id, field: "title" }, result.copy.productName);
          updated = setTextField(updated, { scope: "section", sectionId: section.id, field: "description" }, result.copy.oneLiner);
        }
        return updated;
      });
      window.setTimeout(() => {
        void autosave.saveNow().catch(() => undefined).then(() => recordDetailPageVersion(page.id, "copy_regenerated", tone ? `톤: ${tone}` : undefined)).then(refreshMeta);
      }, 0);
      if (result.provider === "fallback") {
        toast({ title: "AI 연결이 원활하지 않아 기본 문구로 채웠어요", description: result.fallbackReason ?? undefined });
      }
    } catch (error) {
      toast({ title: "섹션을 다시 생성하지 못했어요", description: getDetailPageErrorMessage(error), variant: "destructive" });
    } finally {
      setRegeneratingId(null);
    }
  };

  /**
   * 부분 재작성: 선택한 문구 하나만 AI로 다시 쓴다. 요청 중 사용자가 그 문구를 직접 고쳤다면
   * 결과를 버려서 사용자의 수정을 덮어쓰지 않는다. 다른 필드/섹션은 절대 바뀌지 않는다.
   */
  const rewriteField = async (target: DetailTextField, instruction: DetailRewriteInstruction) => {
    if (!page || !source || !documentRef.current) return;
    const original = getTextField(documentRef.current, target);
    if (!original.trim()) {
      toast({ title: "다시 작성할 문구가 비어 있어요", description: "문구를 먼저 입력하거나 ‘섹션 전체 재생성’을 사용하세요." });
      return;
    }
    const key = JSON.stringify(target);
    setRewritingKey(key);
    try {
      const sectionType =
        target.scope === "document" ? "hero" : documentRef.current.sections.find((entry) => entry.id === target.sectionId)?.type ?? "";
      const field = target.scope === "item" ? (target.field === "title" ? "itemTitle" : "itemText") : target.field;
      const result = await rewriteDetailText({
        source,
        template: documentRef.current.template,
        text: original,
        instruction,
        field,
        sectionType,
        detailPageId: page.id,
      });
      if (!documentRef.current || getTextField(documentRef.current, target) !== original) {
        toast({ title: "AI 결과를 적용하지 않았어요", description: "요청하는 동안 문구가 직접 수정되어 수정한 내용을 유지합니다." });
        return;
      }
      updateDocument((current) => setTextField(current, target, result.text));
      const label = REWRITE_OPTIONS.find((option) => option.value === instruction)?.label ?? "부분 재작성";
      toast({
        title: result.provider === "ai" ? `‘${label}’ 적용했어요` : "AI 연결이 원활하지 않아 문장을 줄였어요",
        description: "다른 섹션과 직접 수정한 내용은 그대로입니다.",
      });
      window.setTimeout(() => {
        void autosave.saveNow().catch(() => undefined).then(() => recordDetailPageVersion(page.id, "copy_regenerated", label)).then(refreshMeta);
      }, 0);
    } catch (error) {
      toast({ title: "다시 작성하지 못했어요", description: getDetailPageErrorMessage(error), variant: "destructive" });
    } finally {
      setRewritingKey(null);
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

  const handleDuplicate = (id: string) => {
    if (!documentRef.current) return;
    const result = duplicateSection(documentRef.current, id);
    if (!result.id) return;
    setDocument(result.document);
    setSelectedId(result.id);
    toast({ title: "섹션을 복제했어요", description: "바로 아래에 추가되었습니다." });
  };

  const loadLibrary = useCallback(
    () =>
      page && source && documentRef.current
        ? fetchDetailImageLibrary({ pageId: page.id, document: documentRef.current, source, colors: fundingColors })
        : Promise.resolve([]),
    [page, source, fundingColors],
  );

  const inlineEdit = useMemo(
    () => ({
      onChange: (target: DetailTextField, value: string) => updateDocument((current) => setTextField(current, target, value)),
      onFocusField: (target: DetailTextField) => {
        setActiveField(target);
        if (target.scope !== "document") setSelectedId(target.sectionId);
      },
    }),
    [updateDocument],
  );

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
      toast({
        title: "임시저장했어요",
        description: (publishState ? publishState.publishedVersion : page.publishedVersion)
          ? "실제 펀딩 상세페이지에는 ‘변경사항 저장’을 눌러야 반영됩니다."
          : "실제 펀딩 상세페이지에는 ‘상세페이지 등록’을 눌러야 표시됩니다.",
      });
    } catch (error) {
      toast({ title: "저장 실패", description: getDetailPageErrorMessage(error), variant: "destructive" });
    }
  };

  /**
   * 상세페이지 등록 / 변경사항 저장: 저장 → 필수 항목 검증(화면 + 서버) → 게시본 고정.
   * 펀딩(가격·수량·참여자 등)은 읽기만 하고 바꾸지 않는다.
   */
  const handlePublish = async () => {
    if (!page || !source) return;
    setPublishing(true);
    try {
      await autosave.saveNow();
      const freshFunding = page.fundingId ? await fetchFunding(page.fundingId).catch(() => funding) : null;
      if (freshFunding) setFunding(freshFunding);
      const colorRows = page.fundingId ? await fetchFundingColors(page.fundingId).catch(() => fundingColors) : [];
      const missing = validateDetailPageForPublish({
        document: documentRef.current ?? page.document,
        source,
        funding: freshFunding,
        fundingColorCount: colorRows.length,
      });
      if (missing.length) {
        setMissingItems(missing);
        return;
      }
      const first = !(publishState ? publishState.publishedVersion : page.publishedVersion);
      const result = await publishDetailPage(page.id, first ? "상세페이지 등록" : "변경사항 저장");
      refreshMeta();
      setPublishDone({ first, version: result.published_version });
      toast({ title: first ? "상세페이지 등록이 완료되었습니다." : "변경사항이 실제 펀딩 상세페이지에 반영되었습니다." });
    } catch (error) {
      const missing = parseMissingItemsError(error);
      if (missing?.length) setMissingItems(missing);
      else toast({ title: "등록하지 못했어요", description: getDetailPageErrorMessage(error), variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const openPreview = () => {
    void autosave.saveNow().catch(() => undefined);
    setActiveField(null);
    setPreviewOpen(true);
  };

  /** 등록 검증에서 빠진 항목을 고치는 곳으로 이동 */
  const fixMissing = (item: DetailPublishMissingItem) => {
    setMissingItems(null);
    if (item.target === "funding") {
      if (page?.fundingId) navigate(`/fundings/${page.fundingId}/edit`);
      else setConfirmFunding(true);
      return;
    }
    const hero = documentRef.current?.sections.find((section) => section.type === "hero");
    if (item.key === "hero_image" && hero) {
      setSelectedId(hero.id);
      setEditorTab("section");
    } else {
      setEditorTab("product");
    }
    setMobileView("edit");
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

  // 미리보기(캔버스)에서 섹션을 누르면 선택만 한다. 모바일에서는 캔버스에 머물러 인라인 편집을 계속할 수 있다.
  const selectFromPreview = (id: string) => {
    setSelectedId(id);
    setEditorTab("section");
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
            <div className={cn("mx-auto bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)]", previewWidth === "mobile" ? "max-w-[390px]" : "max-w-none")}>
              <DetailPageRenderer document={document} source={source} stats={stats} colors={fundingColors} />
            </div>
          </div>
        </div>
        <VersionHistoryDialog pageId={page.id} open={versionsOpen} onOpenChange={setVersionsOpen} onRestore={async () => undefined} readOnly />
      </div>
    );
  }

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
            <h2 className="text-sm font-bold">4. 제품 핵심 정보 · 강조할 요소 (선택)</h2>
            <p className="mt-1 text-xs leading-5 text-stone-500">입력한 내용만 사실로 사용합니다. 비워두면 AI가 임의로 만들지 않아요.</p>
            <div className="mt-3 max-w-2xl">
              <CreatorBriefForm value={source.userProvided} onChange={(userProvided) => setSource({ ...source, userProvided })} />
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-sm font-bold">5. 참고자료 (선택)</h2>
            <div className="mt-3">
              <ReferenceUploader page={page} />
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-sm font-bold">6. AI가 생성할 상세페이지 이미지</h2>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              선택한 스타일({templateMeta.name})의 촬영 무드로 생성됩니다. 스타일은 배경·조명·연출만 바꾸고 제품 디자인은 바꾸지 않습니다.
            </p>
            <div className="mt-3">
              <ImageTypeChecklist value={imageTypes} onChange={setImageTypes} />
            </div>
            <div className="mt-2"><QuotaNote quota={quota} requested={imageTypes.length} /></div>
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
              {generating ? "상세페이지 작성 중..." : hasContent ? "AI 상세페이지 다시 생성" : "✨ AI로 제작하기"}
            </Button>
          </div>
        </div>

        <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
          <AlertDialogContent className="rounded-md">
            <AlertDialogHeader>
              <AlertDialogTitle>전체 상세페이지 다시 생성</AlertDialogTitle>
              <AlertDialogDescription className="leading-6">
                {FULL_REGENERATE_MESSAGE}
                <span className="mt-2 block text-xs text-stone-500">현재 편집본은 버전 이력에 자동 백업되고, 직접 추가한 텍스트·이미지 섹션은 유지됩니다.</span>
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
              ⋮⋮ 핸들을 끌어(모바일은 길게 눌러 끌기) 순서를 바꾸거나 ↑↓ 버튼으로 이동하세요. ⋯ 에서 복제·삭제할 수 있어요.
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
              onDuplicate={handleDuplicate}
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
              onRegenerate={(tone) => void regenerateSection(selectedSection, tone)}
              regenerating={regeneratingId === selectedSection.id}
              onRegenerateImage={regenerateImage}
              regeneratingImageIds={regeneratingImageIds}
              imageStatus={imageStatus}
              loadLibrary={loadLibrary}
              hasFundingColors={fundingColors.length > 0}
              rewriting={rewritingKey === JSON.stringify({ scope: "section", sectionId: selectedSection.id, field: "description" })}
              onRewriteDescription={(instruction) =>
                void rewriteField({ scope: "section", sectionId: selectedSection.id, field: "description" }, instruction)
              }
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
              <div className="mt-5">
                <CreatorBriefForm value={source.userProvided} onChange={(userProvided) => setSource({ ...source, userProvided })} />
              </div>
            </div>

            <div className="border-t border-stone-200 pt-5">
              <p className="text-xs font-semibold">참고자료</p>
              <div className="mt-3"><ReferenceUploader page={page} /></div>
            </div>

            <Button type="button" variant="outline" onClick={() => setConfirmRegenerate(true)} disabled={generating} className="h-11 w-full rounded-md">
              <Wand2 className="mr-1.5 h-4 w-4" /> 전체 상세페이지 다시 생성
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowSetup(true)} className="h-10 w-full rounded-md text-xs text-stone-500">
              스타일 · 생성 이미지 설정 바꿔서 다시 생성
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

  const activeKey = activeField ? JSON.stringify(activeField) : null;
  const rewriteBar = activeField && (
    <div
      className="sticky top-16 z-20 border-b border-stone-200 bg-white/95 px-3 py-2 backdrop-blur sm:top-20"
      data-testid="rewrite-toolbar"
    >
      <div className="flex items-center gap-1.5 overflow-x-auto">
        <span className="shrink-0 pr-1 text-[11px] font-bold text-brand">
          <Sparkles className="mr-1 inline h-3 w-3" />
          {fieldLabel(activeField)}
        </span>
        {REWRITE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={rewritingKey !== null}
            onClick={() => void rewriteField(activeField, option.value)}
            className="h-8 shrink-0 border border-stone-300 bg-white px-2.5 text-[11px] font-semibold text-stone-700 hover:border-brand hover:text-brand disabled:opacity-50"
          >
            {rewritingKey === activeKey ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> : null}
            {option.label}
          </button>
        ))}
        {activeField.scope !== "document" && selectedSection && !["custom_text", "custom_image", "brand"].includes(selectedSection.type) && (
          <button
            type="button"
            disabled={regeneratingId === selectedSection.id}
            onClick={() => void regenerateSection(selectedSection)}
            className="h-8 shrink-0 border border-brand bg-brand/5 px-2.5 text-[11px] font-semibold text-brand disabled:opacity-50"
          >
            {regeneratingId === selectedSection.id ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> : null}
            이 섹션 전체 재생성
          </button>
        )}
        <button type="button" onClick={() => setActiveField(null)} className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center text-stone-400" aria-label="AI 도구 닫기">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const preview = (
    <div>
      {rewriteBar}
      <p className="hidden px-1 pb-2 pt-1 text-[11px] text-stone-500 md:block">
        글자를 눌러 바로 수정하세요. 이미지·섹션 구성은 왼쪽 패널에서 바꿀 수 있어요.
      </p>
      <div className={cn("mx-auto bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)]", previewWidth === "mobile" ? "max-w-[390px]" : "max-w-none")}>
        <DetailPageRenderer
          document={document}
          source={source}
          stats={stats}
          imageStatus={imageStatus}
          colors={fundingColors}
          selectedSectionId={selectedId}
          onSelectSection={selectFromPreview}
          edit={inlineEdit}
        />
      </div>
    </div>
  );

  // 상태 RPC 응답 전에도 페이지 row 의 등록 버전으로 바로 올바른 버튼 이름을 보여준다.
  const isPublished = Boolean(publishState ? publishState.publishedVersion : page.publishedVersion);
  const publishLabel = isPublished ? "변경사항 저장" : "상세페이지 등록";
  const publishButton = (
    <Button
      type="button"
      onClick={() => void handlePublish()}
      disabled={publishing}
      data-testid="publish-button"
      className="h-12 min-w-0 flex-1 rounded-md bg-brand px-4 text-sm font-bold hover:bg-brand-dark md:h-10 md:flex-none"
    >
      {publishing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Rocket className="mr-1.5 h-4 w-4" />}
      <span className="truncate">{publishLabel}</span>
    </Button>
  );

  const startFundingButton = (
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
  // 펀딩에 연결된 상세페이지만 "등록"할 수 있다. 연결 전에는 펀딩 시작(=생성 후 자동 등록)이 다음 단계.
  const primaryAction = page.fundingId ? publishButton : startFundingButton;

  const aiMenu = (compact: boolean) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={generating}
          className={cn("rounded-md", compact ? "h-12 w-14 shrink-0 flex-col gap-0.5 px-0 text-[10px] font-semibold" : "h-10")}
          aria-label="AI 재생성"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          <span className={cn(!compact && "ml-1.5")}>AI 재생성</span>
          {!compact && <ChevronDown className="ml-1 h-3.5 w-3.5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {activeField && (
          <>
            <DropdownMenuLabel className="text-xs text-stone-500">선택한 문구 · {fieldLabel(activeField)}</DropdownMenuLabel>
            {REWRITE_OPTIONS.map((option) => (
              <DropdownMenuItem key={option.value} onSelect={() => void rewriteField(activeField, option.value)}>
                {option.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        {selectedSection && !["custom_text", "custom_image", "brand"].includes(selectedSection.type) && (
          <>
            <DropdownMenuItem onSelect={() => void regenerateSection(selectedSection)}>
              선택한 섹션 전체 재생성 · {SECTION_META[selectedSection.type].label}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {!activeField && <DropdownMenuLabel className="text-[11px] font-normal leading-4 text-stone-500">문구 하나만 바꾸려면 페이지에서 글자를 먼저 누르세요.</DropdownMenuLabel>}
        <DropdownMenuItem className="font-semibold text-brand focus:text-brand" onSelect={() => setConfirmRegenerate(true)}>
          <Wand2 className="mr-2 h-4 w-4" /> 전체 상세페이지 다시 생성
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen bg-[#ebe9e5] text-stone-900">
      <Header />
      <div className="pt-16 sm:pt-20">
        {/* Toolbar: [임시저장] [미리보기] [AI 재생성] [상세페이지 등록] */}
        <div className="border-b border-stone-300 bg-white">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand">
                AI 상세페이지 · {templateMeta.number} {templateMeta.name}
                {page.fundingId && <span className="ml-2 text-stone-400">펀딩 연결됨</span>}
              </p>
              <p className="truncate text-base font-bold">{document.productName || "상품명 없음"}</p>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <SaveStatusBadge status={autosave.status} lastSavedAt={autosave.lastSavedAt} error={autosave.error} />
              <PublishStateBadge state={publishState} />
              <Button type="button" variant="ghost" size="icon" className="ml-auto h-10 w-10 md:hidden" onClick={() => setVersionsOpen(true)} aria-label="버전 이력">
                <History className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 md:hidden" onClick={() => setConfirmCancel(true)} aria-label="나가기">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <div className="flex border border-stone-300" role="group" aria-label="편집 화면 너비">
                <button type="button" onClick={() => setPreviewWidth("mobile")} className={cn("flex h-10 w-10 items-center justify-center", previewWidth === "mobile" && "bg-stone-900 text-white")} aria-label="모바일 너비로 편집">
                  <Smartphone className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setPreviewWidth("desktop")} className={cn("flex h-10 w-10 items-center justify-center", previewWidth === "desktop" && "bg-stone-900 text-white")} aria-label="데스크톱 너비로 편집">
                  <Monitor className="h-4 w-4" />
                </button>
              </div>
              <Button type="button" variant="ghost" className="h-10 rounded-md px-2.5" onClick={() => setVersionsOpen(true)}>
                <History className="mr-1.5 h-4 w-4" /> 버전
              </Button>
              <Button type="button" variant="ghost" className="h-10 rounded-md px-2.5" onClick={() => setConfirmCancel(true)}>
                <LogOut className="mr-1.5 h-4 w-4" /> 나가기
              </Button>
              <Button type="button" variant="outline" className="h-10 rounded-md" onClick={() => void handleManualSave()} data-testid="manual-save">
                <Save className="mr-1.5 h-4 w-4" /> 임시저장
              </Button>
              <Button type="button" variant="outline" className="h-10 rounded-md" onClick={openPreview} data-testid="open-preview">
                <Eye className="mr-1.5 h-4 w-4" /> 미리보기
              </Button>
              {aiMenu(false)}
              {primaryAction}
            </div>
          </div>
          {/* Mobile: 페이지(인라인 편집) / 섹션 설정 */}
          <div className="grid grid-cols-2 border-t border-stone-200 md:hidden" role="tablist">
            {(["preview", "edit"] as const).map((view) => (
              <button
                key={view}
                type="button"
                role="tab"
                aria-selected={mobileView === view}
                onClick={() => setMobileView(view)}
                className={cn("h-11 border-b-2 text-sm font-semibold", mobileView === view ? "border-brand text-brand" : "border-transparent text-stone-500")}
              >
                {view === "preview" ? "페이지 편집" : "섹션 · 이미지 설정"}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto grid max-w-[1600px] gap-0 pb-40 md:grid-cols-[400px_minmax(0,1fr)] md:gap-6 md:px-6 md:pb-12 md:pt-6">
          <aside className={cn("md:sticky md:top-24 md:block md:max-h-[calc(100vh-7rem)] md:self-start md:overflow-y-auto md:border md:border-stone-300", mobileView === "edit" ? "block" : "hidden")}>
            {editorPanel}
          </aside>
          <section className={cn("min-w-0 md:block", mobileView === "preview" ? "block" : "hidden")} aria-label="상세페이지 편집 캔버스">
            {preview}
          </section>
        </div>
      </div>

      {/* Mobile: 선택한 섹션의 이미지·구성 편집으로 이동 */}
      {mobileView === "preview" && selectedSection && (
        <button
          type="button"
          onClick={() => {
            setEditorTab("section");
            setMobileView("edit");
          }}
          className="fixed bottom-[calc(132px+env(safe-area-inset-bottom))] right-4 z-40 inline-flex h-11 items-center gap-1.5 rounded-full bg-stone-900 px-4 text-xs font-bold text-white shadow-lg md:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" /> {SECTION_META[selectedSection.type].label} 섹션 설정
        </button>
      )}

      {/* Mobile action bar: above the bottom tab bar, never covering content (page has pb-40). */}
      <div
        ref={stickyRef}
        data-mascot-safezone
        className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-40 border-t border-stone-200 bg-white/95 px-3 py-2.5 backdrop-blur md:hidden"
      >
        <div className="mx-auto flex max-w-lg items-center gap-1.5">
          <button type="button" className="flex h-12 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border border-stone-300 text-[10px] font-semibold text-stone-700" onClick={() => void handleManualSave()}>
            <Save className="h-4 w-4" />임시저장
          </button>
          <button type="button" className="flex h-12 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border border-stone-300 text-[10px] font-semibold text-stone-700" onClick={openPreview}>
            <Eye className="h-4 w-4" />미리보기
          </button>
          {aiMenu(true)}
          {primaryAction}
        </div>
      </div>

      <DetailPreviewOverlay
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        document={document}
        source={source}
        stats={stats}
        colors={fundingColors}
        fundingId={page.fundingId}
      />

      <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
        <AlertDialogContent className="rounded-md">
          <AlertDialogHeader>
            <AlertDialogTitle>전체 상세페이지 다시 생성</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              {FULL_REGENERATE_MESSAGE}
              <span className="mt-2 block text-xs text-stone-500">현재 편집본은 버전 이력에 자동 백업되고, 직접 추가한 텍스트·이미지 섹션은 유지됩니다.</span>
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

      {/* 등록 전 필수 항목 누락 */}
      <AlertDialog open={missingItems !== null} onOpenChange={(open) => !open && setMissingItems(null)}>
        <AlertDialogContent className="rounded-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-brand" /> 입력이 필요한 항목이 있어요
            </AlertDialogTitle>
            <AlertDialogDescription>아래 항목을 채운 뒤 다시 {publishLabel}을 눌러주세요.</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="divide-y divide-stone-200 border-y border-stone-200" data-testid="missing-items">
            {(missingItems ?? []).map((item) => (
              <li key={item.key} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{item.label}</p>
                  <p className="text-xs leading-5 text-stone-500">{item.message}</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 rounded-md" onClick={() => fixMissing(item)}>
                  {item.target === "funding" ? (page.fundingId ? "펀딩 정보 수정" : "펀딩 시작하기") : "바로 입력"}
                </Button>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-md">닫기</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 등록 완료 */}
      <AlertDialog open={publishDone !== null} onOpenChange={(open) => !open && setPublishDone(null)}>
        <AlertDialogContent className="rounded-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{publishDone?.first ? "상세페이지 등록이 완료되었습니다." : "변경사항이 저장되었습니다."}</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              {publishDone?.first
                ? "지금 편집한 내용이 펀딩 상세페이지에 표시됩니다. 등록 후에도 마이페이지 → 내가 만든 펀딩 → 펀딩 관리 → 상세페이지 수정에서 언제든 고칠 수 있어요."
                : "실제 펀딩 상세페이지에 반영되었습니다. 이전 버전은 버전 이력에서 되돌릴 수 있어요."}
              {publishDone && <span className="mt-1 block text-xs text-stone-500">등록 버전 v{publishDone.version}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-md">계속 수정하기</AlertDialogCancel>
            {page.fundingId && (
              <AlertDialogAction asChild className="rounded-md bg-brand hover:bg-brand-dark">
                <Link to={`/fundings/${page.fundingId}`}>
                  <ExternalLink className="mr-1.5 h-4 w-4" /> 실제 펀딩 상세페이지 보기
                </Link>
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent className="rounded-md">
          <AlertDialogHeader>
            <AlertDialogTitle>편집을 마칠까요?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              지금까지 편집한 내용은 자동 저장되어 다음에 이어서 작업할 수 있어요. ‘{publishLabel}’을 누르지 않았다면 고객에게 보이는 상세페이지는 바뀌지 않습니다.
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

      <AlertDialog open={confirmFunding} onOpenChange={setConfirmFunding}>
        <AlertDialogContent className="rounded-md">
          <AlertDialogHeader>
            <AlertDialogTitle>이 상세페이지로 펀딩을 시작할까요?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              상표 검수 후 펀딩 초안이 만들어지고 상세페이지가 연결·등록됩니다. 다음 화면에서 판매가·수량·기간을 확인하고 승인 요청을 보내면 관리자 승인 후 펀딩이 시작됩니다.
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
