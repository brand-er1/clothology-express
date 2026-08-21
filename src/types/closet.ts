import type { ProductionEstimateResult } from "@/types/productionEstimate";

export type CharacterGender = "male" | "female";

export type ClosetSlot = "top" | "bottom" | "outer" | "shoes" | "accessory";

export interface ClosetAnchor {
  /** Center position of the garment overlay, as a percentage of the character canvas. */
  xPercent: number;
  yPercent: number;
  /** Garment width as a percentage of the canvas width; height follows the source image's aspect ratio. */
  widthPercent: number;
  rotationDeg?: number;
  zIndex: number;
}

export interface CharacterConfig {
  key: CharacterGender;
  label: string;
  /** Short line shown on the character-select card. */
  tagline: string;
  baseImage: string;
  anchors: Record<ClosetSlot, ClosetAnchor>;
}

/**
 * A single garment worn (or wearable) in the closet. `designRef` carries what's needed to hand the
 * garment off to the existing quote/funding systems unchanged — the closet never recomputes pricing
 * or re-implements those flows itself.
 */
export interface ClosetGarment {
  id: string;
  slot: ClosetSlot;
  label: string;
  /** Garment artwork used for the dressing-room overlay. */
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
  };
}

export type ClosetOutfit = Record<ClosetSlot, ClosetGarment | null>;

export interface WardrobeState {
  character: CharacterGender;
  outfit: ClosetOutfit;
}

export interface SavedBrandErLook {
  id: string;
  savedAt: string;
  character: CharacterGender;
  outfit: ClosetOutfit;
}
