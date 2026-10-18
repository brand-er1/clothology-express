
import { AiImageEditMenu } from "@/components/ai-image/AiImageEditMenu";
import type { AiImageEditPreset } from "@/services/aiImageEdit";

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Calculator,
  Copy,
  Download,
  ImageOff,
  ImagePlus,
  Loader2,
  MapPin,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { createExactArtworkComposite } from "@/lib/artwork-composite";
import {
  artworkContentTransform,
  describeArtworkTransform,
  moveLayer,
  normalizeRotation,
  resolveRotation,
  resolveStretchY,
  rotatedHalfExtents,
} from "@/lib/artwork-transform";
import {
  clearEditorDraft,
  loadEditorDraft,
  saveEditorDraft,
} from "@/lib/editor-draft-store";
import {
  ArtworkTransformBox,
  type ArtworkBoxGeometry,
  type ArtworkBoxSize,
} from "@/components/artwork-editor/ArtworkTransformBox";
import { ArtworkEditToolbar } from "@/components/artwork-editor/ArtworkEditToolbar";
import {
  artworkLocationLabels,
  DEFAULT_ARTWORK_WIDTH,
  formatArtworkPercent,
  MAX_ARTWORK_WIDTH,
  MIN_ARTWORK_WIDTH,
  prepareArtworkReference,
  resolveArtworkSize,
  resolveArtworkPlacementPrompt,
  summarizeArtworkPlacement,
  type ArtworkContentType,
} from "@/lib/artwork-upload";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import { ProductionEstimateCard } from "./ProductionEstimateCard";
import type {
  ArtworkLayer,
  ArtworkPlacement,
  ArtworkReference,
  CompositedImageReference,
  ImageModificationEntry,
} from "@/types/customize";
import type {
  ProductionEstimateResult,
  UploadedArtworkAnalysis,
} from "@/types/productionEstimate";
import { screenTrademarkImage } from "@/services/trademarkScreening";
import type { TrademarkScreeningResult } from "@/types/trademark";
import type { ProductionCountry } from "@/lib/production-country";
import { inferClosetSlotFromCategory } from "@/lib/closet-character-config";

/** 디자인 이미지용 "AI 이미지 수정" 요청 문구(기존 디자인 수정 기능 modify-generated-image 로 전달). */
const buildDesignEditRequest = (preset: AiImageEditPreset, prompt?: string) => {
  const keep = "핏·실루엣·색상·원단·디테일·배경·구도·앞뒤 배치는 그대로 유지하세요.";
  switch (preset) {
    case "remove_logo":
      return `의류에 있는 모든 로고·브랜드 마크·엠블럼(BRAND-ER 로고와 글자 포함)만 자연스럽게 지우고, 그 자리는 주변 원단의 색상·질감·주름이 이어지도록 채워주세요. ${keep}`;
    case "remove_text":
      return `의류와 이미지에 있는 모든 글자·숫자·문구·워터마크만 자연스럽게 지우고, 그 자리는 주변 원단의 색상·질감·주름이 이어지도록 채워주세요. ${keep}`;
    case "color":
      return `컬러만 수정: ${prompt ?? ""}. 원단 질감·주름·음영과 다른 디테일은 그대로 유지하세요.`;
    case "design":
      return `디자인 수정: ${prompt ?? ""}. 요청한 부분 외에는 ${keep}`;
    default:
      return `${prompt ?? ""}. 요청한 부분 외에는 ${keep}`;
  }
};

const placementExamples = [
  "앞면 왼쪽 가슴에 작게 넣어줘",
  "앞면 중앙에 크게 넣어줘",
  "등 중앙에 중간 크기로 넣어줘",
  "오른쪽 소매에 작게 넣어줘",
  "앞면 중앙에 거의 안 보이게 넣어줘",
];

const compactScoreLabels = [
  ["text", "문자"],
  ["shape", "도형"],
  ["transformation", "변형"],
  ["productClass", "상품류"],
] as const;

// One uploaded image placed at one spot on the garment. Every layer stays editable until the
// customer applies them all at once; array order is paint order (later layers sit on top), and
// the same image can appear in several layers.
interface EditorLayer {
  id: string;
  sourceFile: File;
  artwork: ArtworkReference;
  preview: string;
  contentType: ArtworkContentType;
  /** Null while the trademark screening for this image is still running (or failed). */
  screening: TrademarkScreeningResult | null;
  placement: ArtworkPlacement;
  placementPrompt: string;
  /** The prompt text `placement` was last resolved from — a differing prompt is re-resolved
   * before applying, so typed-but-not-previewed instructions are never silently ignored. */
  lastResolvedPrompt: string;
  placementSource: "prompt" | "drag";
}

const createLayerId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Unsent layers are kept per garment image, so a reload or coming back to the same design
 * restores every logo with its position, size, rotation and flips. */
const ARTWORK_DRAFT_VERSION = 1;
const artworkDraftKey = (imageUrl: string) => `customize-artwork:${imageUrl}`;

/** Keeps the rotated artwork's whole bounding box inside the garment image while dragging. */
const constrainArtworkCenter = (
  geometry: ArtworkBoxGeometry,
  size: ArtworkBoxSize,
) => {
  const { halfWidth, halfHeight } = rotatedHalfExtents(
    size.widthPx,
    size.heightPx,
    geometry.rotation,
  );
  const xMargin = Math.min(50, (halfWidth / size.stageWidth) * 100);
  const yMargin = Math.min(50, (halfHeight / size.stageHeight) * 100);
  return {
    xPercent: Math.min(100 - xMargin, Math.max(xMargin, geometry.xPercent)),
    yPercent: Math.min(100 - yMargin, Math.max(yMargin, geometry.yPercent)),
  };
};

/** Re-resolving a prompt only changes where/how big the artwork is — never its rotation/flips. */
const withTransformOf = (
  placement: ArtworkPlacement,
  source: ArtworkPlacement,
): ArtworkPlacement => ({
  ...placement,
  rotation: source.rotation,
  flipX: source.flipX,
  flipY: source.flipY,
  stretchY: source.stretchY,
});

const formatArtworkPrice = (analysis: UploadedArtworkAnalysis) => {
  if (
    typeof analysis.unitMin !== "number" ||
    typeof analysis.unitMax !== "number"
  ) {
    return "자동견적에서 확인";
  }

  const minimum = `${analysis.unitMin.toLocaleString("ko-KR")}원`;
  const maximum = `${analysis.unitMax.toLocaleString("ko-KR")}원`;
  if (analysis.unitMin === analysis.unitMax) {
    return `${minimum}${analysis.isStartingFrom ? "부터" : ""}`;
  }
  return `${minimum} ~ ${maximum}`;
};

interface ModifyImageStepProps {
  isLoading: boolean;
  selectedImageUrl: string | null;
  selectedType: string;
  selectedMaterial: string;
  selectedFit?: string;
  designContext?: string;
  modificationHistory: ImageModificationEntry[];
  currentArtworkAnalyses: UploadedArtworkAnalysis[];
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onEstimateChange: (estimate: ProductionEstimateResult | null) => void;
  onArtworkScreeningApplied: (screeningId: string | null) => void;
  onModifyImage: (
    prompt: string,
    options?: {
      artworkLayers?: ArtworkLayer[];
      compositedImage?: CompositedImageReference;
    },
  ) => Promise<boolean>;
  onResetModifications: () => void;
  onSelectHistoryImage: (imageUrl: string | null, imagePath?: string | null, index?: number) => void;
  productionCountry: ProductionCountry;
  onChangeCountry: (country: ProductionCountry) => void;
  designId?: string | null;
  isSavingDesign?: boolean;
  onGoToEstimate: () => void;
}

export const ModifyImageStep = ({
  isLoading,
  selectedImageUrl,
  selectedType,
  selectedMaterial,
  selectedFit,
  designContext,
  modificationHistory,
  currentArtworkAnalyses,
  quantity,
  onQuantityChange,
  onEstimateChange,
  onArtworkScreeningApplied,
  onModifyImage,
  onResetModifications,
  onSelectHistoryImage,
  productionCountry,
  onChangeCountry,
  designId,
  isSavingDesign,
  onGoToEstimate,
}: ModifyImageStepProps) => {
  const navigate = useNavigate();
  const [modificationPrompt, setModificationPrompt] = useState("");
  const [imageError, setImageError] = useState(false);
  const [layers, setLayers] = useState<EditorLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  // Prompt (and image type) used for the NEXT upload while no layer is selected.
  const [draftPlacementPrompt, setDraftPlacementPrompt] = useState(
    placementExamples[0],
  );
  const [artworkContentType, setArtworkContentType] =
    useState<ArtworkContentType>("logo");
  const [keepAspect, setKeepAspect] = useState(true);
  const [baseImageAspectRatio, setBaseImageAspectRatio] = useState(4 / 3);
  const [isPreparingArtwork, setIsPreparingArtwork] = useState(false);
  const [isApplyingArtwork, setIsApplyingArtwork] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const artworkCanvasRef = useRef<HTMLDivElement>(null);
  // Which layer the next picked file replaces ("교체"); null adds a new layer.
  const replaceTargetIdRef = useRef<string | null>(null);
  const pendingDropPositionRef = useRef<{ xPercent: number; yPercent: number } | null>(null);
  const layersRef = useRef(layers);
  layersRef.current = layers;

  const selectedLayer =
    layers.find((layer) => layer.id === selectedLayerId) ?? null;
  const selectedLayerIndex = selectedLayer ? layers.indexOf(selectedLayer) : -1;
  const trademarkScreening = selectedLayer?.screening ?? null;
  const artworkPlacementPrompt =
    selectedLayer?.placementPrompt ?? draftPlacementPrompt;
  const placementSource = selectedLayer?.placementSource ?? "prompt";
  const placementSummary = selectedLayer
    ? summarizeArtworkPlacement(selectedLayer.placement)
    : resolveArtworkPlacementPrompt(draftPlacementPrompt, DEFAULT_ARTWORK_WIDTH)
        .summary;
  const isEditingLocked = isLoading || isApplyingArtwork;
  const allLayersScreened =
    layers.length > 0 &&
    layers.every(
      (layer) => layer.screening && layer.screening.decision !== "blocked",
    );
  const hasBlockedLayer = layers.some(
    (layer) => layer.screening?.decision === "blocked",
  );

  // Restore the unsent layers saved for this garment image (only into an empty editor, so
  // switching images never throws away logos the customer is placing right now).
  const restoredDraftKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedImageUrl) return;
    const key = artworkDraftKey(selectedImageUrl);
    let cancelled = false;
    restoredDraftKeyRef.current = null;
    void loadEditorDraft<EditorLayer[]>(key, ARTWORK_DRAFT_VERSION).then(
      (draft) => {
        if (cancelled) return;
        if (draft?.length && layersRef.current.length === 0) {
          setLayers(draft);
          setSelectedLayerId(null);
        }
        restoredDraftKeyRef.current = key;
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selectedImageUrl]);

  useEffect(() => {
    if (!selectedImageUrl) return;
    const key = artworkDraftKey(selectedImageUrl);
    if (restoredDraftKeyRef.current !== key) return;
    const timer = window.setTimeout(() => {
      if (layers.length === 0) void clearEditorDraft(key);
      else void saveEditorDraft(key, ARTWORK_DRAFT_VERSION, layers);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [layers, selectedImageUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modificationPrompt.trim()) {
      toast({
        title: "입력 필요",
        description: "수정할 내용을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      const modified = await onModifyImage(modificationPrompt);
      if (modified) {
        setModificationPrompt("");
      }
    } catch (error) {
      console.error("Error modifying image:", error);
    }
  };

  const updateLayer = (
    id: string,
    patch: Partial<EditorLayer> | ((layer: EditorLayer) => Partial<EditorLayer>),
  ) =>
    setLayers((previous) =>
      previous.map((layer) =>
        layer.id === id
          ? { ...layer, ...(typeof patch === "function" ? patch(layer) : patch) }
          : layer,
      ),
    );

  const selectLayer = (id: string | null) => {
    setSelectedLayerId(id);
    const layer = layersRef.current.find((item) => item.id === id);
    if (layer) setArtworkContentType(layer.contentType);
  };

  // Suggests a spot no other layer was placed at by prompt, so a new logo doesn't land on top
  // of the ones already placed.
  const unusedPlacementPrompt = (existing: EditorLayer[]) => {
    const usedPrompts = new Set(existing.map((item) => item.placementPrompt));
    return (
      placementExamples.find((example) => !usedPrompts.has(example)) ??
      placementExamples[existing.length % placementExamples.length]
    );
  };

  const loadArtworkFile = async (
    file: File,
    contentType = artworkContentType,
    replaceId: string | null = null,
  ) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "이미지 파일 필요",
        description: "JPG, PNG, WEBP 이미지 파일을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "파일 용량 초과",
        description: "10MB 이하 이미지를 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    const replaced = replaceId
      ? layersRef.current.find((layer) => layer.id === replaceId) ?? null
      : null;
    const dropPosition = pendingDropPositionRef.current;
    pendingDropPositionRef.current = null;
    let layerId: string | null = null;

    try {
      setIsPreparingArtwork(true);
      const prepared = await prepareArtworkReference(file, contentType);
      const preview = `data:${prepared.mimeType};base64,${prepared.base64}`;

      if (replaced) {
        layerId = replaced.id;
        updateLayer(replaced.id, {
          sourceFile: file,
          artwork: prepared,
          preview,
          contentType,
          screening: null,
        });
      } else {
        layerId = createLayerId();
        const existing = layersRef.current;
        const prompt = existing.some(
          (layer) => layer.placementPrompt === draftPlacementPrompt,
        )
          ? unusedPlacementPrompt(existing)
          : draftPlacementPrompt;
        const resolved = resolveArtworkPlacementPrompt(
          prompt,
          DEFAULT_ARTWORK_WIDTH,
        );
        const newLayer: EditorLayer = {
          id: layerId,
          sourceFile: file,
          artwork: prepared,
          preview,
          contentType,
          screening: null,
          placement: dropPosition
            ? { ...resolved.placement, ...dropPosition }
            : resolved.placement,
          placementPrompt: prompt,
          lastResolvedPrompt: prompt,
          placementSource: dropPosition ? "drag" : "prompt",
        };
        setLayers((previous) => [...previous, newLayer]);
        setSelectedLayerId(layerId);
      }

      if (
        contentType === "logo" &&
        prepared.backgroundRemoval === "not-detected"
      ) {
        toast({
          title: "단색 배경을 찾지 못했습니다",
          description:
            "로고가 손상되지 않도록 원본을 유지했습니다. 흰색·단색 배경 또는 투명 PNG를 사용하면 더 정확합니다.",
        });
      }
      const screening = await screenTrademarkImage({
        imageBase64: prepared.base64,
        mimeType: prepared.mimeType,
        source: "upload",
        selectedType,
        selectedMaterial,
        previousScreeningId: replaced?.screening?.id || null,
      });
      updateLayer(layerId, { screening });

      if (screening.decision === "blocked") {
        toast({
          title: "상표 위험 이미지 적용 차단",
          description:
            "유명 타사 상표로 의심되는 이미지입니다. 다른 이미지를 사용해주세요.",
          variant: "destructive",
        });
      } else if (screening.decision === "review") {
        toast({
          title: "상표 검토 필요",
          description:
            "이미지는 적용할 수 있지만 펀딩 승인 전에 관리자가 권리 관계를 확인합니다.",
        });
      }
    } catch (error) {
      // A failed upload never leaves a half-ready layer behind: a replaced layer gets its
      // previous image back, a new one is removed.
      if (replaced) {
        updateLayer(replaced.id, replaced);
      } else if (layerId) {
        const failedId = layerId;
        setLayers((previous) => previous.filter((layer) => layer.id !== failedId));
        setSelectedLayerId((current) => (current === failedId ? null : current));
      }
      toast({
        title: "이미지 검수 실패",
        description:
          error instanceof Error
            ? error.message
            : "다른 이미지로 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsPreparingArtwork(false);
    }
  };

  const openFilePicker = (replaceId: string | null = null) => {
    replaceTargetIdRef.current = replaceId;
    fileInputRef.current?.click();
  };

  const handleArtworkFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    const replaceId = replaceTargetIdRef.current;
    replaceTargetIdRef.current = null;
    if (!file) return;
    await loadArtworkFile(file, artworkContentType, replaceId);
  };

  const handleArtworkContentTypeChange = async (
    contentType: ArtworkContentType,
  ) => {
    setArtworkContentType(contentType);
    if (selectedLayer) {
      await loadArtworkFile(
        selectedLayer.sourceFile,
        contentType,
        selectedLayer.id,
      );
    }
  };

  const setArtworkPlacementPrompt = (prompt: string) => {
    if (selectedLayer) updateLayer(selectedLayer.id, { placementPrompt: prompt });
    else setDraftPlacementPrompt(prompt);
  };

  const resolveLayerPrompt = (layer: EditorLayer, prompt: string) => {
    const resolved = resolveArtworkPlacementPrompt(
      prompt,
      layer.placement.widthPercent,
    );
    return withTransformOf(resolved.placement, layer.placement);
  };

  const applyPromptToSelection = (prompt: string) => {
    if (!prompt.trim()) {
      toast({
        title: "위치 설명 필요",
        description:
          "예: '앞면 왼쪽 가슴에 작게 넣어줘'처럼 입력해주세요.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedLayer) {
      setDraftPlacementPrompt(prompt);
      return;
    }
    updateLayer(selectedLayer.id, {
      placementPrompt: prompt,
      lastResolvedPrompt: prompt.trim(),
      placement: resolveLayerPrompt(selectedLayer, prompt),
      placementSource: "prompt",
    });
  };

  const handleResolvePlacement = () =>
    applyPromptToSelection(artworkPlacementPrompt);

  const updateSelectedPlacement = (patch: Partial<ArtworkPlacement>) => {
    if (!selectedLayer) return;
    updateLayer(selectedLayer.id, (layer) => {
      const placement = { ...layer.placement, ...patch };
      return {
        placement: { ...placement, size: resolveArtworkSize(placement.widthPercent) },
        placementSource: "drag",
      };
    });
  };

  /** `toUnusedSpot` places the copy at a fresh preset spot (the panel's "같은 이미지 하나 더");
   * otherwise it's nudged next to the original like Canva's duplicate. */
  const duplicateLayer = (id: string, { toUnusedSpot = false } = {}) => {
    const source = layersRef.current.find((layer) => layer.id === id);
    if (!source) return;
    const duplicateId = createLayerId();
    let duplicate: EditorLayer;
    if (toUnusedSpot) {
      const prompt = unusedPlacementPrompt(layersRef.current);
      const resolved = resolveArtworkPlacementPrompt(prompt, source.placement.widthPercent);
      duplicate = {
        ...source,
        id: duplicateId,
        placement: withTransformOf(resolved.placement, source.placement),
        placementPrompt: prompt,
        lastResolvedPrompt: prompt,
        placementSource: "prompt",
      };
    } else {
      duplicate = {
        ...source,
        id: duplicateId,
        placement: {
          ...source.placement,
          xPercent: Math.min(95, source.placement.xPercent + 4),
          yPercent: Math.min(95, source.placement.yPercent + 4),
        },
        placementSource: "drag",
      };
    }
    setLayers((previous) => {
      const index = previous.findIndex((layer) => layer.id === id);
      const next = [...previous];
      next.splice(index + 1, 0, duplicate);
      return next;
    });
    setSelectedLayerId(duplicateId);
  };

  const removeLayer = (id: string) => {
    setLayers((previous) => previous.filter((layer) => layer.id !== id));
    setSelectedLayerId((current) => (current === id ? null : current));
  };

  const moveSelectedLayer = (direction: 1 | -1) => {
    if (selectedLayerIndex < 0) return;
    setLayers((previous) => moveLayer(previous, selectedLayerIndex, direction));
  };

  const describeArtworkLayer = (layer: EditorLayer) => {
    const transform = describeArtworkTransform(layer.placement);
    return `${
      selectedType === "knit"
        ? "이미지를 프린팅·직자수 없이 봉제 패치(와펜) 방식으로"
        : layer.contentType === "logo"
          ? "로고의 겉 배경을 제거하고"
          : "사진의 배경을 그대로 유지해"
    } 옷의 ${artworkLocationLabels[layer.placement.location]}, 화면 기준 가로 ${Math.round(
      layer.placement.xPercent,
    )}%·세로 ${Math.round(
      layer.placement.yPercent,
    )}% 지점에 이미지 폭의 약 ${formatArtworkPercent(
      layer.placement.widthPercent,
    )}% 크기로${transform ? `(${transform})` : ""}`;
  };

  const describeLayerRequest = (layer: EditorLayer) =>
    `"${layer.placementPrompt}"${
      layer.placementSource === "drag" ? " 후 드래그로 미세 조정한 위치" : ""
    }`;

  // Validates every layer and resolves any prompt typed since its last preview. Returns null
  // (explaining why via toast) when something can't be applied yet.
  const finalizeLayers = (): EditorLayer[] | null => {
    const finalized: EditorLayer[] = [];
    for (const [index, layer] of layers.entries()) {
      if (!layer.screening) {
        setSelectedLayerId(layer.id);
        toast({
          title: "상표 검수 필요",
          description: `${index + 1}번 이미지의 상표 검수가 끝나지 않았습니다. 이미지를 다시 선택해주세요.`,
          variant: "destructive",
        });
        return null;
      }
      if (layer.screening.decision === "blocked") {
        setSelectedLayerId(layer.id);
        toast({
          title: "이미지 적용 불가",
          description:
            "타사 상표 사용 위험이 높아 이 이미지는 의류에 적용할 수 없습니다.",
          variant: "destructive",
        });
        return null;
      }
      if (layer.placementPrompt.trim() !== layer.lastResolvedPrompt) {
        if (!layer.placementPrompt.trim()) {
          setSelectedLayerId(layer.id);
          toast({
            title: "위치 설명 필요",
            description:
              "예: '앞면 왼쪽 가슴에 작게 넣어줘'처럼 입력해주세요.",
            variant: "destructive",
          });
          return null;
        }
        finalized.push({
          ...layer,
          placement: resolveLayerPrompt(layer, layer.placementPrompt),
          lastResolvedPrompt: layer.placementPrompt.trim(),
          placementSource: "prompt",
        });
      } else {
        finalized.push(layer);
      }
    }
    setLayers(finalized);
    return finalized;
  };

  const handleApplyArtwork = async () => {
    if (!selectedImageUrl || layers.length === 0) {
      openFilePicker();
      return;
    }
    const applied = finalizeLayers();
    if (!applied) return;

    try {
      setIsApplyingArtwork(true);
      const compositedImage = await createExactArtworkComposite({
        baseImageUrl: selectedImageUrl,
        layers: applied,
      });

      const prompt =
        applied.length === 1
          ? `사용자 요청 ${describeLayerRequest(applied[0])}에 따라 업로드한 ${describeArtworkLayer(
              applied[0],
            )} 정확히 적용했습니다.`
          : `업로드한 이미지 ${applied.length}개를 각각 지정한 위치에 정확히 적용했습니다.\n${applied
              .map(
                (layer, index) =>
                  `${index + 1}. 사용자 요청 ${describeLayerRequest(
                    layer,
                  )}에 따라 ${describeArtworkLayer(layer)} 적용`,
              )
              .join("\n")}`;

      // Every layer is sent so each logo gets its own print analysis and
      // is charged separately in the estimate.
      const wasApplied = await onModifyImage(prompt, {
        artworkLayers: applied.map(({ artwork, placement }) => ({
          artwork,
          placement,
        })),
        compositedImage,
      });
      if (wasApplied) {
        // A logo that needs manual trademark review must stay visible to the
        // admin, so prefer it over ones that passed automatically.
        const screeningToTrack =
          applied.find((layer) => layer.screening?.decision === "review") ??
          applied[applied.length - 1];
        onArtworkScreeningApplied(screeningToTrack.screening?.id ?? null);
        // The logos are now baked into the new design image; the draft saved for the old
        // image is no longer needed.
        void clearEditorDraft(artworkDraftKey(selectedImageUrl));
        setLayers([]);
        setSelectedLayerId(null);
      }
    } catch (error) {
      toast({
        title: "이미지 적용 실패",
        description:
          error instanceof Error
            ? error.message
            : "이미지를 다시 올린 뒤 적용해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsApplyingArtwork(false);
    }
  };

  // Same compositing as "적용" (rotation and flips included), saved as a PNG on the device.
  const handleDownloadDesign = async () => {
    if (!selectedImageUrl) return;
    try {
      setIsDownloading(true);
      const image = await createExactArtworkComposite({
        baseImageUrl: selectedImageUrl,
        layers: layers.map(({ artwork, placement }) => ({ artwork, placement })),
        mimeType: "image/png",
        allowEmpty: true,
      });
      const link = document.createElement("a");
      link.href = `data:${image.mimeType};base64,${image.base64}`;
      link.download = `brander-design-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast({
        title: "다운로드 실패",
        description:
          error instanceof Error
            ? error.message
            : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const getPointerPercent = (clientX: number, clientY: number) => {
    const canvas = artworkCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      xPercent: ((clientX - rect.left) / rect.width) * 100,
      yPercent: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  const handleArtworkDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleArtworkDrop = async (
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    event.preventDefault();
    const point = getPointerPercent(event.clientX, event.clientY);
    if (point) {
      pendingDropPositionRef.current = {
        xPercent: Math.min(95, Math.max(5, point.xPercent)),
        yPercent: Math.min(95, Math.max(5, point.yPercent)),
      };
    }
    await loadArtworkFile(file);
  };

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-8">
      {/* Image and modification input area - occupies 2/3 of the space */}
      <Card className="border-0 bg-transparent p-0 shadow-none sm:border sm:bg-card sm:p-6 sm:shadow-sm md:col-span-2">
        <div className="space-y-4">
          <div className="px-1 sm:px-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[17px] font-semibold sm:text-lg">이미지 수정</h3>
                <p className="mt-1.5 text-[14px] leading-6 text-gray-500 sm:text-sm">
                  AI에게 선택한 이미지를 어떻게 수정할지 설명해주세요.
                  디테일, 컬러, 스타일 등 변경하고 싶은 부분을 자세히 설명하세요.
                </p>
              </div>
              {selectedImageUrl && (
                <div className="flex min-w-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    className="h-11 rounded-[3px] bg-brand px-4 text-sm font-bold hover:bg-brand-dark"
                    onClick={onGoToEstimate}
                    disabled={isSavingDesign}
                    data-tutorial="customize-go-to-estimate"
                  >
                    {isSavingDesign ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Calculator className="mr-2 h-4 w-4" />
                    )}
                    자동 견적 확인하기
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-[3px] border-brand/30 bg-brand/5 px-4 text-sm font-bold text-brand hover:bg-brand/10"
                    onClick={() =>
                      navigate("/closet", {
                        state: {
                          pendingGarment: {
                            id: `ai-${Date.now()}`,
                            slot: inferClosetSlotFromCategory(selectedType),
                            label: designContext?.split("\n")[0]?.slice(0, 24) || "내가 만든 디자인",
                            imageUrl: selectedImageUrl,
                            source: "ai_design",
                            designRef: {
                              imageUrl: selectedImageUrl,
                              selectedType,
                              selectedMaterial,
                              fitLabel: selectedFit,
                              designContext,
                              designId,
                            },
                          },
                        },
                      })
                    }
                  >
                    가상 마네킹에 입혀보기
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center space-y-4">
            <div
              className={`relative w-full max-w-3xl select-none overflow-hidden rounded-xl border bg-gray-50 sm:rounded-xl ${
                layers.length > 0
                  ? "border-brand/40 shadow-inner"
                  : "border-gray-200"
              }`}
              style={{ aspectRatio: baseImageAspectRatio }}
              data-tutorial="customize-modify"
            >
              <div
                ref={artworkCanvasRef}
                data-testid="artwork-stage"
                className="absolute inset-0 touch-none"
                onPointerDown={() => setSelectedLayerId(null)}
                onDragOver={handleArtworkDragOver}
                onDrop={(event) => void handleArtworkDrop(event)}
              >
                {selectedImageUrl && !imageError ? (
                  <img
                    src={selectedImageUrl}
                    alt="이미지 배치 대상 의류"
                    className="pointer-events-none h-full w-full object-contain"
                    draggable={false}
                    onError={() => setImageError(true)}
                    onLoad={(event) => {
                      const image = event.currentTarget;
                      if (image.naturalWidth && image.naturalHeight) {
                        setBaseImageAspectRatio(
                          image.naturalWidth / image.naturalHeight,
                        );
                      }
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-gray-100">
                    <ImageOff className="mb-2 h-12 w-12 text-gray-400" />
                    <p className="text-sm text-gray-500">
                      이미지를 불러올 수 없습니다
                    </p>
                  </div>
                )}
                {layers.map((layer, index) => {
                  const isSelected = layer.id === selectedLayerId;
                  return (
                    <ArtworkTransformBox
                      key={layer.id}
                      stageRef={artworkCanvasRef}
                      src={layer.preview}
                      alt={isSelected ? "배치할 업로드 이미지" : ""}
                      xPercent={layer.placement.xPercent}
                      yPercent={layer.placement.yPercent}
                      widthPercent={layer.placement.widthPercent}
                      transform={layer.placement}
                      selected={isSelected}
                      disabled={isEditingLocked}
                      keepAspect={keepAspect}
                      minWidthPercent={MIN_ARTWORK_WIDTH}
                      maxWidthPercent={MAX_ARTWORK_WIDTH}
                      zIndex={isSelected ? 15 : 5 + index}
                      ariaLabel={`배치한 이미지 ${index + 1} 선택`}
                      boxAttributes={{ "data-layer-id": layer.id }}
                      constrainCenter={constrainArtworkCenter}
                      onSelect={() => selectLayer(layer.id)}
                      onChange={(geometry) =>
                        updateLayer(layer.id, {
                          placement: {
                            ...layer.placement,
                            xPercent: geometry.xPercent,
                            yPercent: geometry.yPercent,
                            widthPercent: geometry.widthPercent,
                            size: resolveArtworkSize(geometry.widthPercent),
                            rotation: geometry.rotation,
                            ...(geometry.stretchY !== 1 ||
                            layer.placement.stretchY !== undefined
                              ? { stretchY: geometry.stretchY }
                              : {}),
                          },
                          placementSource: "drag",
                        })
                      }
                    />
                  );
                })}
                {selectedLayer && (
                  <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-bold text-white shadow">
                    드래그로 이동 · 모서리로 크기 · 위 핸들로 회전
                  </div>
                )}
                {layers.length === 0 && !isLoading && (
                  <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-lg bg-white/92 px-3 py-2 text-center text-[11px] font-semibold leading-4 text-gray-600 shadow-sm sm:inset-x-3 sm:bottom-3 sm:text-xs">
                    이미지 선택 또는 파일 드롭 후 프롬프트·드래그를 모두 사용할
                    수 있습니다.
                  </div>
                )}
                {(isLoading || isApplyingArtwork) && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30">
                    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-white" />
                  </div>
                )}
              </div>
            </div>

            {selectedLayer ? (
              <ArtworkEditToolbar
                className="w-full max-w-3xl"
                title={`선택한 이미지 편집 · ${selectedLayerIndex + 1}/${layers.length}`}
                rotation={resolveRotation(selectedLayer.placement)}
                onRotationChange={(rotation) =>
                  updateSelectedPlacement({ rotation: normalizeRotation(rotation) })
                }
                widthPercent={selectedLayer.placement.widthPercent}
                minWidthPercent={MIN_ARTWORK_WIDTH}
                maxWidthPercent={MAX_ARTWORK_WIDTH}
                onWidthChange={(widthPercent) => {
                  // Grows/shrinks around the center, then nudges back inside the image.
                  const canvas = artworkCanvasRef.current;
                  const placement = { ...selectedLayer.placement, widthPercent };
                  if (!canvas) {
                    updateSelectedPlacement({ widthPercent });
                    return;
                  }
                  const widthPx = (widthPercent / 100) * canvas.clientWidth;
                  const box = canvas.querySelector<HTMLElement>(
                    `[data-layer-id="${selectedLayer.id}"]`,
                  );
                  const aspect = box ? box.offsetHeight / Math.max(1, box.offsetWidth) : 1;
                  const center = constrainArtworkCenter(
                    {
                      xPercent: placement.xPercent,
                      yPercent: placement.yPercent,
                      widthPercent,
                      rotation: resolveRotation(placement),
                      stretchY: resolveStretchY(placement),
                    },
                    {
                      widthPx,
                      heightPx: widthPx * aspect,
                      stageWidth: canvas.clientWidth,
                      stageHeight: canvas.clientHeight,
                    },
                  );
                  updateSelectedPlacement({ widthPercent, ...center });
                }}
                keepAspect={keepAspect}
                onKeepAspectChange={setKeepAspect}
                onResetProportions={
                  resolveStretchY(selectedLayer.placement) !== 1
                    ? () => updateSelectedPlacement({ stretchY: 1 })
                    : undefined
                }
                flipX={Boolean(selectedLayer.placement.flipX)}
                flipY={Boolean(selectedLayer.placement.flipY)}
                onToggleFlip={(axis) =>
                  updateSelectedPlacement(
                    axis === "x"
                      ? { flipX: !selectedLayer.placement.flipX }
                      : { flipY: !selectedLayer.placement.flipY },
                  )
                }
                onBringForward={() => moveSelectedLayer(1)}
                onSendBackward={() => moveSelectedLayer(-1)}
                canBringForward={selectedLayerIndex < layers.length - 1}
                canSendBackward={selectedLayerIndex > 0}
                onDuplicate={() => duplicateLayer(selectedLayer.id)}
                onDelete={() => removeLayer(selectedLayer.id)}
                disabled={isEditingLocked}
              />
            ) : (
              layers.length > 0 && (
                <p className="w-full max-w-3xl text-center text-[11px] leading-5 text-gray-500">
                  이미지를 눌러 선택하면 회전·크기·반전·순서·복제·삭제를 편집할 수 있어요.
                  두 손가락으로 벌리거나 돌려도 됩니다.
                </p>
              )
            )}

            {selectedImageUrl && !imageError && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-end"
                data-testid="download-design"
                onClick={() => void handleDownloadDesign()}
                disabled={isDownloading || isEditingLocked}
              >
                {isDownloading ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-4 w-4" />
                )}
                {layers.length > 0 ? "편집 중인 디자인 다운로드" : "디자인 이미지 다운로드"}
              </Button>
            )}

            <div
              className="w-full rounded-lg border border-brand/15 bg-brand/5 p-4 sm:p-5"
              data-tutorial="customize-artwork"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="flex items-center gap-2 font-bold text-gray-950">
                    <ImagePlus className="h-5 w-5 text-brand" />
                    내 이미지 옷에 넣기
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-gray-600">
                    로고는 겉 배경을 자동으로 지우고, 사진은 배경을 유지합니다.
                    위치와 크기는 프롬프트로 지정한 뒤 드래그로 미세 조절하고,
                    위쪽 핸들로 자유롭게 회전할 수 있습니다. 로고를 여러 개
                    넣으려면 하나씩 추가한 뒤 각각 선택해 따로 편집하세요. 같은
                    이미지도 여러 번 넣을 수 있습니다.
                  </p>
                  {selectedType === "knit" && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">
                      니트에 올리는 로고·이미지는 프린팅·직자수 없이 패치(와펜)
                      방식으로만 제작됩니다.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs font-bold text-gray-700">
                  1. 추가할 이미지 유형
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                      artworkContentType === "logo"
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-gray-200 bg-white text-gray-700 hover:border-brand/30"
                    }`}
                    onClick={() =>
                      void handleArtworkContentTypeChange("logo")
                    }
                    disabled={isLoading || isPreparingArtwork}
                    aria-pressed={artworkContentType === "logo"}
                  >
                    <span className="block text-sm font-bold">
                      로고·일러스트
                    </span>
                    <span className="mt-1 block text-[11px] leading-4">
                      겉 배경 자동 제거
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                      artworkContentType === "photo"
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-gray-200 bg-white text-gray-700 hover:border-brand/30"
                    }`}
                    onClick={() =>
                      void handleArtworkContentTypeChange("photo")
                    }
                    disabled={isLoading || isPreparingArtwork}
                    aria-pressed={artworkContentType === "photo"}
                  >
                    <span className="block text-sm font-bold">사진</span>
                    <span className="mt-1 block text-[11px] leading-4">
                      원본 배경 그대로 유지
                    </span>
                  </button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleArtworkFile}
              />

              {layers.length > 0 && (
                <div className="mt-4 rounded-xl border border-brand/20 bg-white p-3">
                  <p className="text-xs font-bold text-gray-700">
                    배치한 이미지 {layers.length}개
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-gray-500">
                    적용 버튼을 누르면 모든 이미지가 한 번에 옷에 들어갑니다.
                    미리보기나 목록에서 선택해 각각 따로 편집할 수 있고, 아래쪽
                    이미지가 위에 그려집니다.
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {layers.map((item, index) => (
                      <li
                        key={item.id}
                        className={`flex items-center gap-2 rounded-lg p-2 ${
                          item.id === selectedLayerId
                            ? "bg-brand/10 ring-1 ring-brand/40"
                            : "bg-gray-50"
                        }`}
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          onClick={() => selectLayer(item.id)}
                          aria-pressed={item.id === selectedLayerId}
                        >
                          <img
                            src={item.preview}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded border border-gray-200 bg-white object-contain"
                            style={{
                              transform: `rotate(${resolveRotation(item.placement)}deg) ${
                                artworkContentTransform(item.placement) ?? ""
                              }`,
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-gray-800">
                              {index + 1}. {item.artwork.fileName}
                            </span>
                            <span className="block truncate text-[11px] text-gray-500">
                              {summarizeArtworkPlacement(item.placement)}
                            </span>
                          </span>
                        </button>
                        {!item.screening ? (
                          <Loader2
                            className="h-4 w-4 shrink-0 animate-spin text-gray-400"
                            aria-label="상표 검수 중"
                          />
                        ) : (
                          item.screening.decision !== "clear" && (
                            <ShieldAlert
                              className={`h-4 w-4 shrink-0 ${
                                item.screening.decision === "blocked"
                                  ? "text-red-600"
                                  : "text-amber-600"
                              }`}
                              aria-label={
                                item.screening.decision === "blocked"
                                  ? "상표 위험 · 적용 불가"
                                  : "상표 검토 필요"
                              }
                            />
                          )
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            duplicateLayer(item.id, { toUnusedSpot: true })
                          }
                          disabled={isEditingLocked}
                          aria-label={`배치한 이미지 ${index + 1} 복제`}
                          title="같은 이미지 하나 더 배치"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLayer(item.id)}
                          disabled={isEditingLocked}
                          aria-label={`배치한 이미지 ${index + 1} 제거`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedLayer ? (
                <div className="mt-4 rounded-xl border border-brand/20 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-xs font-semibold text-gray-700">
                      {selectedLayer.artwork.fileName}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openFilePicker(selectedLayer.id)}
                        disabled={isLoading || isPreparingArtwork}
                      >
                        교체
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLayer(selectedLayer.id)}
                        disabled={isLoading}
                        aria-label="업로드 이미지 제거"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2">
                    <p className="text-xs font-bold text-brand">
                      {selectedLayer.contentType === "logo"
                        ? selectedLayer.artwork.backgroundRemoval === "removed"
                          ? "배경과 흰 테두리를 정리한 미리보기입니다."
                          : selectedLayer.artwork.backgroundRemoval ===
                              "already-transparent"
                            ? "기존 투명 배경을 그대로 보존했습니다."
                            : "로고 손상 방지를 위해 원본에 가깝게 유지했습니다."
                        : "사진 배경을 제거하지 않고 원본 그대로 사용합니다."}
                    </p>
                    <p className="text-[11px] font-semibold text-gray-500">
                      {selectedLayer.contentType === "logo"
                        ? selectedLayer.artwork.backgroundRemoval === "not-detected"
                          ? "원본 보호 PNG"
                          : "투명 PNG로 변환"
                        : "고화질 WEBP로 변환"}
                    </p>
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-gray-500">
                    미리보기의 이미지를 직접 끌어 위치를 조절하고, 모서리 점으로
                    크기를, 위쪽 핸들로 각도를 바꿀 수 있습니다.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-brand/30 text-brand hover:bg-brand/5"
                      onClick={() => openFilePicker()}
                      disabled={isEditingLocked || isPreparingArtwork}
                    >
                      <ImagePlus className="mr-1.5 h-4 w-4" />
                      다른 로고 추가
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-brand/30 text-brand hover:bg-brand/5"
                      onClick={() =>
                        duplicateLayer(selectedLayer.id, { toUnusedSpot: true })
                      }
                      disabled={isEditingLocked || isPreparingArtwork}
                    >
                      <Copy className="mr-1.5 h-4 w-4" />
                      같은 이미지 하나 더
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="mt-4 flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand/25 bg-white px-4 py-7 text-center transition-colors hover:border-brand/50 hover:bg-brand/5"
                  onClick={() => openFilePicker()}
                  disabled={isLoading || isPreparingArtwork}
                >
                  <Upload className="h-6 w-6 text-brand" />
                  <span className="mt-2 text-sm font-bold text-gray-900">
                    {isPreparingArtwork
                      ? "이미지 준비 중..."
                      : layers.length > 0
                        ? "다른 이미지 추가하기"
                        : "이미지를 선택해주세요"}
                  </span>
                  <span className="mt-1 text-xs text-gray-500">
                    2. JPG, PNG, WEBP · 최대 10MB
                  </span>
                </button>
              )}

              {trademarkScreening && (
                <div
                  className={`mt-4 rounded-xl border p-3 ${
                    trademarkScreening.decision === "blocked"
                      ? "border-red-200 bg-red-50"
                      : trademarkScreening.decision === "review"
                        ? "border-amber-200 bg-amber-50"
                        : "border-emerald-200 bg-emerald-50"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {trademarkScreening.decision === "clear" ? (
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    ) : (
                      <ShieldAlert
                        className={`mt-0.5 h-5 w-5 shrink-0 ${
                          trademarkScreening.decision === "blocked"
                            ? "text-red-600"
                            : "text-amber-600"
                        }`}
                      />
                    )}
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-bold ${
                          trademarkScreening.decision === "blocked"
                            ? "text-red-700"
                            : trademarkScreening.decision === "review"
                              ? "text-amber-700"
                              : "text-emerald-700"
                        }`}
                      >
                        {trademarkScreening.decision === "blocked"
                          ? "상표 위험 · 적용 차단"
                          : trademarkScreening.decision === "review"
                            ? "상표 검토 필요 · 관리자 확인"
                            : "상표 자동 검수 통과"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-gray-700">
                        {trademarkScreening.reason}
                      </p>
                      <div className="mt-2 rounded-lg bg-white/75 p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-gray-500">
                            복합 위험점수
                          </span>
                          <span className="text-sm font-bold text-gray-900">
                            {Math.round(
                              trademarkScreening.composite_risk_score || 0,
                            )}
                            /100
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-4 gap-1.5">
                          {compactScoreLabels.map(([key, label]) => (
                            <div
                              key={key}
                              className="rounded-md border border-black/5 bg-white px-1.5 py-1 text-center"
                            >
                              <p className="text-[9px] font-bold text-gray-400">
                                {label}
                              </p>
                              <p className="text-[11px] font-bold text-gray-700">
                                {Math.round(
                                  trademarkScreening.similarity_scores?.[key] ||
                                    0,
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                      {trademarkScreening.detected_marks.length > 0 && (
                        <p className="mt-1 text-[11px] font-semibold text-gray-600">
                          감지 표지:{" "}
                          {trademarkScreening.detected_marks
                            .map((mark) => mark.displayName)
                            .join(", ")}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] leading-4 text-gray-500">
                        {trademarkScreening.decision === "review"
                          ? "등록 후 관리자가 상표권 보유·사용 허가 여부를 확인하고 승인 또는 거절합니다."
                          : trademarkScreening.disclaimer}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 rounded-xl border border-brand/15 bg-white p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-gray-700">
                  <MapPin className="h-3.5 w-3.5" />
                  3. 이미지 위치와 크기를 문장으로 입력
                </p>
                <Textarea
                  value={artworkPlacementPrompt}
                  onChange={(event) =>
                    setArtworkPlacementPrompt(event.target.value)
                  }
                  placeholder="예: 앞면 왼쪽 가슴에 작게 넣어줘"
                  className="min-h-[82px] resize-none"
                  disabled={isLoading || isApplyingArtwork}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {placementExamples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand"
                      onClick={() => applyPromptToSelection(example)}
                      disabled={isLoading || isApplyingArtwork}
                    >
                      {example.replace(" 넣어줘", "")}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-col gap-2 rounded-lg bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-brand">
                      {placementSource === "drag"
                        ? "현재 배치 · 드래그 미세 조정됨"
                        : "프롬프트로 해석된 배치"}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-gray-700">
                      {placementSummary}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResolvePlacement}
                    disabled={
                      isLoading ||
                      isApplyingArtwork ||
                      !artworkPlacementPrompt.trim()
                    }
                  >
                    <BrandMark className="mr-1.5 h-3.5 w-3.5" />
                    위치 미리보기
                  </Button>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-gray-500">
                  왼쪽·오른쪽 가슴, 앞면·뒷면 중앙, 목 뒤, 양쪽 소매와
                  작게·중간·크게 또는 폭 20% 같은 표현을 이해합니다. 프롬프트
                  적용 뒤에는 드래그로 미세 조절하세요. 최소 폭 0.1%까지 줄일
                  수 있고, 위치를 다시 적용해도 회전·반전은 그대로 유지됩니다.
                </p>
              </div>

              <Button
                type="button"
                className="mt-4 w-full bg-brand hover:bg-brand-dark"
                onClick={() => void handleApplyArtwork()}
                disabled={
                  isLoading ||
                  isPreparingArtwork ||
                  isApplyingArtwork ||
                  !allLayersScreened
                }
              >
                {isLoading || isApplyingArtwork || isPreparingArtwork ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                    {isPreparingArtwork
                      ? "유명 브랜드 로고 검수 중..."
                      : "프롬프트 위치 적용·분석 중..."}
                  </>
                ) : hasBlockedLayer ? (
                  <>
                    <ShieldAlert className="mr-2 h-4 w-4" />
                    상표 위험으로 적용할 수 없습니다
                  </>
                ) : (
                  <>
                    <BrandMark className="mr-2 h-4 w-4" variant="white" />
                    {layers.length > 1
                      ? `이미지 ${layers.length}개 한 번에 적용하고 공임 분석`
                      : "프롬프트대로 옷에 적용하고 공임 분석"}
                  </>
                )}
              </Button>

              {currentArtworkAnalyses.length > 0 && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-bold text-emerald-700">
                    AI 업로드 이미지 분석 완료
                    {currentArtworkAnalyses.length > 1 &&
                      ` · ${currentArtworkAnalyses.length}개 각각 공임 반영`}
                  </p>
                  <ul className="divide-y divide-emerald-200/70">
                    {currentArtworkAnalyses.map((analysis, index) => (
                      <li key={index} className="py-2 first:pt-1 last:pb-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-bold text-gray-950">
                            {currentArtworkAnalyses.length > 1 &&
                              `${analysis.locationLabel} · `}
                            {analysis.artworkTypeLabel} ·{" "}
                            {analysis.priceLabel || "인쇄 방식 상담"}
                          </p>
                          <p className="text-sm font-bold text-brand">
                            장당 {formatArtworkPrice(analysis)}
                          </p>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-gray-600">
                          {analysis.reason}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {selectedImageUrl && (
              <ProductionEstimateCard
                selectedType={selectedType}
                selectedMaterial={selectedMaterial}
                imageUrl={selectedImageUrl}
                designContext={designContext}
                uploadedArtworks={currentArtworkAnalyses}
                quantity={quantity}
                onQuantityChange={onQuantityChange}
                onEstimateChange={onEstimateChange}
                productionCountry={productionCountry}
                onChangeCountry={onChangeCountry}
              />
            )}
            
            <div className="flex w-full flex-wrap items-center gap-2 border border-stone-200 bg-white p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">AI 이미지 수정</p>
                <p className="text-xs text-stone-500">로고·글자 제거, 디자인·컬러 수정. 핏·색상·원단·구도는 그대로 유지해요.</p>
              </div>
              <AiImageEditMenu
                size="md"
                busy={isLoading}
                disabled={!selectedImageUrl}
                onEdit={async (preset, prompt) => {
                  await onModifyImage(buildDesignEditRequest(preset, prompt));
                }}
              />
            </div>

            <form onSubmit={handleSubmit} className="w-full space-y-4">
              <Textarea
                placeholder="이미지를 어떻게 수정할지 설명해주세요. (예: '소매를 짧게 만들어주세요', '색상을 파란색으로 변경해주세요')"
                value={modificationPrompt}
                onChange={(e) => setModificationPrompt(e.target.value)}
                className="min-h-[120px] resize-none"
                disabled={isLoading}
              />
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Button
                  type="submit"
                  className="h-12 rounded-xl bg-brand hover:bg-brand-dark"
                  disabled={isLoading || !modificationPrompt.trim()}
                >
                  {isLoading ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></span>
                      수정 중...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" /> 수정하기
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onResetModifications}
                  disabled={isLoading || modificationHistory.length === 0}
                  className="h-12 rounded-xl"
                >
                  <RefreshCw className="h-4 w-4 mr-2" /> 처음으로
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Card>

      {/* Chat history - occupies 1/3 of the space */}
      <Card className="flex flex-col overflow-hidden rounded-lg p-4 sm:p-6">
        <div className="space-y-4">
          <h3 className="text-[17px] font-semibold sm:text-lg">수정 챗봇</h3>
          
          {modificationHistory.length > 0 ? (
            <div className="overflow-y-auto max-h-[500px] flex flex-col space-y-4 pr-2">
              {modificationHistory.map((entry, index) => (
                <div key={index} className="space-y-2">
                  <div className="bg-gray-100 p-3 rounded-lg rounded-br-none ml-auto max-w-[90%]">
                    <p className="text-sm font-medium">나</p>
                    <p className="text-sm whitespace-pre-wrap">{entry.prompt}</p>
                  </div>
                  <div className="bg-brand/10 p-3 rounded-lg rounded-bl-none mr-auto max-w-[90%] space-y-2">
                    <p className="text-sm font-medium">AI</p>
                    <p className="text-sm whitespace-pre-wrap">{entry.response}</p>
                    {entry.imageUrl && (
                      <div className="mt-2 overflow-hidden rounded-lg border">
                        <img
                          src={entry.imageUrl}
                          alt="수정된 이미지"
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => onSelectHistoryImage(entry.imageUrl, entry.imagePath, index)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2 w-full"
                          onClick={() => onSelectHistoryImage(entry.imageUrl, entry.imagePath, index)}
                          disabled={isLoading}
                        >
                          이 이미지로 계속 수정
                        </Button>
                      </div>
                    )}
                  </div>
                  {index < modificationHistory.length - 1 && (
                    <Separator className="my-2" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              아직 수정 내역이 없습니다. 수정 요청을 입력해보세요.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
