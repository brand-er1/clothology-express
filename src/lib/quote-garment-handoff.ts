import { urlToImageRef } from "@/lib/closet-image-ref";
import { closetSlotLabel } from "@/lib/closet-character-config";
import type { CharacterGender, ClosetGarment, ClosetSlot, GarmentFitInfo, MannequinSize } from "@/types/closet";
import type { DesignRecord } from "@/services/designs";
import type { ProductionEstimateImageInput } from "@/types/productionEstimate";

/**
 * AI 가상 피팅 → 자동견적 handoff. Never carries the AI-rendered mannequin image (renderedCharacterImage,
 * size-comparison images, or the merged multi-garment outfit shot) — only the user's own original
 * Garment Reference for exactly one selected slot, plus its construction metadata. See
 * resolveGarmentQuoteImage for the priority order used to find that original image.
 */
export interface QuoteGarmentHandoff {
  character: CharacterGender;
  mannequinSize: MannequinSize;
  slot: ClosetSlot;
  garmentLabel: string;
  source: ClosetGarment["source"];
  imageUrl: string | null;
  imageBase64: string | null;
  imageMimeType: string | null;
  imagePath: string | null;
  selectedType: string | null;
  selectedMaterial: string | null;
  fitLabel: string | null;
  designId: string | null;
  fitInfo: GarmentFitInfo | null;
}

export class QuoteImageResolutionError extends Error {
  reason: "no_source_image" | "image_conversion_failed";
  constructor(reason: "no_source_image" | "image_conversion_failed", message: string) {
    super(message);
    this.reason = reason;
  }
}

const isBlobOrDataUrl = (value: string | null | undefined) =>
  Boolean(value && (value.startsWith("blob:") || value.startsWith("data:")));

/**
 * Resolves ONE original Garment Reference image for a worn garment, in the required priority
 * order: (1) designRef.imageUrl (2) designRef.imageBase64 (3) garment.imageUrl (4) a forced
 * Base64 conversion when the only image we have is a temporary blob/data URL the estimate server
 * cannot fetch on its own. Never touches renderedCharacterImage or any other mannequin-wearing shot.
 */
export const resolveGarmentQuoteImage = async (
  garment: ClosetGarment,
): Promise<{ url: string | null; base64: string | null; mimeType: string }> => {
  const designRef = garment.designRef;

  if (designRef?.imageUrl && !isBlobOrDataUrl(designRef.imageUrl)) {
    return { url: designRef.imageUrl, base64: null, mimeType: designRef.imageMimeType || "image/png" };
  }
  if (designRef?.imageBase64) {
    return { url: null, base64: designRef.imageBase64, mimeType: designRef.imageMimeType || "image/png" };
  }
  if (garment.imageUrl && !isBlobOrDataUrl(garment.imageUrl)) {
    return { url: garment.imageUrl, base64: null, mimeType: "image/png" };
  }

  // Only reachable when every candidate above was a temporary blob:/data: URL (or missing) — force
  // a same-origin fetch + Base64 conversion so the estimate server always receives readable bytes.
  const blobOrDataSource = designRef?.imageUrl || garment.imageUrl;
  if (blobOrDataSource) {
    try {
      const ref = await urlToImageRef(blobOrDataSource);
      return { url: null, base64: ref.base64, mimeType: ref.mimeType };
    } catch {
      throw new QuoteImageResolutionError(
        "image_conversion_failed",
        "이미지를 변환하지 못했습니다. 다시 시도하거나 이미지를 다시 업로드해주세요.",
      );
    }
  }

  throw new QuoteImageResolutionError(
    "no_source_image",
    "이 의류의 원본 이미지를 찾을 수 없습니다. 옷을 다시 선택하거나 업로드해주세요.",
  );
};

const fitTypeLabel: Record<string, string> = {
  oversize: "오버핏",
  semi_oversize: "세미오버핏",
  regular: "레귤러핏",
  slim: "슬림핏",
};

const fabricStretchLabel: Record<string, string> = {
  none: "신축성 없음",
  low: "약간 신축",
  medium: "보통 신축",
  high: "높은 신축",
};
const fabricThicknessLabel: Record<string, string> = {
  thin: "얇음",
  medium: "보통 두께",
  thick: "두꺼움",
};
const fabricDrapeLabel: Record<string, string> = {
  stiff: "빳빳한 드레이프",
  medium: "보통 드레이프",
  fluid: "부드럽게 흐르는 드레이프",
};

/**
 * Builds the free-text context handed to the AI estimate analysis. Prefers the shared `design`
 * record (product type/color/fabric/print/embroidery/accessories/washing/production country —
 * loaded once via designId and never re-asked of the user) and falls back to whatever fit/fabric
 * info was captured on the garment itself during virtual fitting.
 */
export const buildQuoteDesignContext = (
  garment: { slot: ClosetSlot; label: string; fitInfo?: GarmentFitInfo | null } | null,
  design: DesignRecord | null,
  fallbackContext?: string | null,
): string => {
  const lines: string[] = [];

  if (design?.prompt) lines.push(design.prompt);
  if (design?.detail) lines.push(design.detail);
  if (!design && fallbackContext) lines.push(fallbackContext);

  if (garment) lines.push(`부위: ${closetSlotLabel[garment.slot]} (${garment.label})`);

  if (design) {
    if (design.color) lines.push(`컬러: ${design.color}`);
    if (design.fit) lines.push(`핏: ${design.fit}`);
    lines.push(`프린팅: ${design.hasPrint ? "있음" : "없음"}`);
    lines.push(`자수: ${design.hasEmbroidery ? "있음" : "없음"}`);
    if (design.accessories?.length) {
      lines.push(`부자재: ${design.accessories.map((item) => `${item.kind}${item.count ? ` ${item.count}개` : ""}`).join(", ")}`);
    }
    lines.push(`생산 국가: ${design.productionCountry}`);
  }

  const fitInfo = garment?.fitInfo;
  if (fitInfo?.baseSize) lines.push(`기준 사이즈: ${fitInfo.baseSize}`);
  if (fitInfo?.fitType) lines.push(`핏 유형: ${fitTypeLabel[fitInfo.fitType] || fitInfo.fitType}`);
  if (fitInfo?.fabric?.stretch) lines.push(`원단 신축성: ${fabricStretchLabel[fitInfo.fabric.stretch]}`);
  if (fitInfo?.fabric?.thickness) lines.push(`원단 두께: ${fabricThicknessLabel[fitInfo.fabric.thickness]}`);
  if (fitInfo?.fabric?.drape) lines.push(`원단 드레이프: ${fabricDrapeLabel[fitInfo.fabric.drape]}`);

  return lines.filter(Boolean).join("\n") || "사용자가 AI 가상 피팅에서 착용한 원본 의류 이미지";
};

// --- Refresh-survival: a short-lived sessionStorage snapshot, independent of location.state and
// of designId (which only exists for AI-generated garments). Cleared once the quote is submitted
// or the visitor explicitly cancels/starts over. ---

const PENDING_QUOTE_KEY = "brander-pending-quote-v1";

export interface PendingQuoteSnapshot {
  handoff: QuoteGarmentHandoff;
  presetImages: ProductionEstimateImageInput[];
  savedAt: string;
}

export const savePendingQuoteSnapshot = (snapshot: PendingQuoteSnapshot) => {
  try {
    sessionStorage.setItem(PENDING_QUOTE_KEY, JSON.stringify(snapshot));
  } catch {
    // Best-effort only — the just-navigated location.state still covers the current page load.
  }
};

export const loadPendingQuoteSnapshot = (): PendingQuoteSnapshot | null => {
  try {
    const raw = sessionStorage.getItem(PENDING_QUOTE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingQuoteSnapshot;
  } catch {
    return null;
  }
};

export const clearPendingQuoteSnapshot = () => {
  try {
    sessionStorage.removeItem(PENDING_QUOTE_KEY);
  } catch {
    // Best-effort only.
  }
};
