import type { ProductionEstimateResult } from "@/types/productionEstimate";

/** Mannequin gender. Kept as `CharacterGender` for backward compatibility with existing code/DB columns. */
export type CharacterGender = "male" | "female";

export type FemaleMannequinSize = "44" | "55" | "66";
export type MaleMannequinSize = "l" | "xl" | "2xl";
/** Korean clothing-size-system body preset, e.g. "female-66" or "male-xl". */
export type MannequinSize = FemaleMannequinSize | MaleMannequinSize;

export type ClosetSlot = "top" | "bottom" | "outer" | "skirt" | "dress" | "shoes" | "accessory";

/** 의류 기준 핏 (오버핏/세미오버핏/레귤러핏/슬림핏). */
export type FitType = "oversize" | "semi_oversize" | "regular" | "slim";

/** Optional real measurements (cm). Only the fields relevant to a garment's slot are ever shown/used. */
export interface GarmentMeasurements {
  totalLength?: number;
  shoulderWidth?: number;
  chestWidth?: number;
  waistWidth?: number;
  hemWidth?: number;
  sleeveLength?: number;
  bottomWaist?: number;
  bottomHip?: number;
  bottomRise?: number;
  bottomThigh?: number;
  bottomHem?: number;
  bottomLength?: number;
}

export type FabricStretch = "none" | "low" | "medium" | "high";
export type FabricThickness = "thin" | "medium" | "thick";
export type FabricDrape = "stiff" | "medium" | "fluid";

export interface FabricInfo {
  stretch?: FabricStretch;
  thickness?: FabricThickness;
  drape?: FabricDrape;
}

/**
 * Sizing/fit metadata for one garment, entered before AI fitting generation. `hasMeasurements`
 * drives whether the "AI 시뮬레이션" disclaimer is shown — measurements always take priority over
 * baseSize/fitType when present (see virtual-fitting edge function).
 */
export interface GarmentFitInfo {
  baseSize?: string;
  fitType?: FitType;
  measurements?: GarmentMeasurements;
  fabric?: FabricInfo;
  hasMeasurements: boolean;
}

export interface CharacterConfig {
  key: CharacterGender;
  label: string;
  /** Short line shown on the character-select card. */
  tagline: string;
  /** Reference image used both for the plain "undressed" view and as the AI try-on identity anchor. */
  baseImage: string;
}

/**
 * A single garment worn (or wearable) in the closet. `designRef` carries what's needed to hand the
 * garment off to the existing quote/funding systems unchanged — the closet never recomputes pricing
 * or re-implements those flows itself. The AI dressing call also reads `designRef`'s image data (or
 * `imageUrl`) as the garment reference image — the closet never overlays this image on the character.
 */
export interface ClosetGarment {
  id: string;
  slot: ClosetSlot;
  label: string;
  /** Garment artwork thumbnail, and the AI try-on reference image for this garment. */
  imageUrl: string;
  source: "ai_design" | "upload" | "preset";
  designRef?: {
    /** A stored (https) URL when available — required for funding-draft creation. */
    imageUrl?: string | null;
    imagePath?: string | null;
    imageBase64?: string | null;
    imageMimeType?: string | null;
    selectedType?: string;
    selectedMaterial?: string;
    designContext?: string;
    colorLabel?: string;
    fitLabel?: string;
    productionEstimate?: ProductionEstimateResult | null;
    /**
     * Id of the shared `designs` row this garment traces back to (see src/services/designs.ts).
     * Kept stable across "수정하기" edits of the same garment so the AI design → estimate → outfit
     * pipeline can always resolve back to one design, even after a refresh or page change.
     */
    designId?: string | null;
  };
  /** Edit history for this garment ("수정하기" trail). Absent/empty means only the original exists. */
  revisions?: ClosetGarmentRevision[];
  /** Id of the revision currently reflected by this garment's top-level `imageUrl`/`designRef`. */
  activeRevisionId?: string;
  /** Sizing/fit metadata entered before AI fitting generation (base size, fit type, measurements, fabric). */
  fitInfo?: GarmentFitInfo;
  /** Set when this garment reference has a separate back-view image (logo/pocket placement must match). */
  backImageUrl?: string | null;
}

/**
 * One snapshot in a garment's edit history. `revisions[0]` is always the original generation;
 * each later entry is the result of one "수정하기" (edit) pass, with `promptLabel` holding the
 * user's modification instruction (empty for the original). Restoring an older revision only
 * changes which one is "current" — the array itself is never truncated.
 */
export interface ClosetGarmentRevision {
  id: string;
  promptLabel: string;
  imageUrl: string;
  designRef?: ClosetGarment["designRef"];
  createdAt: string;
}

export type ClosetOutfit = Record<ClosetSlot, ClosetGarment | null>;

export interface WardrobeState {
  character: CharacterGender;
  /** Mannequin body-size preset for this gender (e.g. "66" for female, "xl" for male). */
  mannequinSize: MannequinSize;
  outfit: ClosetOutfit;
  /**
   * The latest AI-generated "mannequin actually wearing the current outfit" preview image. This is a
   * disposable preview only — quote/funding always read `outfit[slot].designRef`, the original design
   * data, and must never analyze or depend on this rendered image.
   */
  renderedCharacterImage: string | null;
  /** Id of the last virtual-fitting generation request, for idempotency/dedupe and re-fetching. */
  lastRequestId: string | null;
  /** True when the last render was produced without any real garment measurements (shows AI-sim disclaimer). */
  lastRenderIsSimulated: boolean;
}

export interface SavedBrandErLook {
  id: string;
  savedAt: string;
  character: CharacterGender;
  mannequinSize: MannequinSize;
  outfit: ClosetOutfit;
  renderedCharacterImage: string | null;
}
