import type { ProductionEstimateResult } from "@/types/productionEstimate";

export type CharacterGender = "male" | "female";

export type ClosetSlot = "top" | "bottom" | "outer" | "shoes" | "accessory";

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
  };
}

export type ClosetOutfit = Record<ClosetSlot, ClosetGarment | null>;

export interface WardrobeState {
  character: CharacterGender;
  outfit: ClosetOutfit;
  /**
   * The latest AI-generated "character actually wearing the current outfit" preview image. This is a
   * disposable preview only — quote/funding always read `outfit[slot].designRef`, the original design
   * data, and must never analyze or depend on this rendered image.
   */
  renderedCharacterImage: string | null;
}

export interface SavedBrandErLook {
  id: string;
  savedAt: string;
  character: CharacterGender;
  outfit: ClosetOutfit;
  renderedCharacterImage: string | null;
}
