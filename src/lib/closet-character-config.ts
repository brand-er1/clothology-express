import { getAppPath } from "@/utils/appUrl";
import { defaultMannequinSize, getMannequinPreset } from "@/lib/mannequin-presets";
import type { CharacterConfig, CharacterGender, ClosetOutfit, ClosetSlot } from "@/types/closet";

/**
 * Base BRAND-ER mannequin references, kept for legacy call sites (CharacterCard, saved-look
 * fallbacks). `baseImage` resolves to that gender's default-size photoreal mannequin preset — see
 * mannequin-presets.ts for the full per-size registry used by the virtual fitting flow itself.
 */
export const characterConfig: Record<CharacterGender, CharacterConfig> = {
  male: {
    key: "male",
    label: "남자 마네킹",
    tagline: "AI Virtual Fitting · 남성",
    baseImage: getMannequinPreset("male", defaultMannequinSize("male")).previewImage,
  },
  female: {
    key: "female",
    label: "여자 마네킹",
    tagline: "AI Virtual Fitting · 여성",
    baseImage: getMannequinPreset("female", defaultMannequinSize("female")).previewImage,
  },
};

/** Retained for anything still reading a static file path (e.g. og-image-style previews). */
export const legacyMascotImage = getAppPath("/mascot/idle.png");

export const closetSlotOrder: ClosetSlot[] = ["top", "outer", "bottom", "skirt", "dress", "shoes", "accessory"];

export const closetSlotLabel: Record<ClosetSlot, string> = {
  top: "상의",
  outer: "아우터",
  bottom: "하의",
  skirt: "스커트",
  dress: "원피스",
  shoes: "신발",
  accessory: "기타 착용 의류",
};

/** Slots whose garment covers the same body region as a 원피스(dress) — mutually exclusive with it. */
export const dressConflictSlots: ClosetSlot[] = ["top", "bottom", "skirt"];

/**
 * Slots that would be made redundant by equipping `slot`, following the 코디 슬롯 규칙: a 원피스
 * conflicts with 상의/하의/스커트 (and vice versa) since they cover the same region; every other
 * slot (아우터/신발/기타) layers independently and never conflicts.
 */
export const slotsConflictingWith = (outfit: ClosetOutfit, slot: ClosetSlot): ClosetSlot[] => {
  if (slot === "dress") {
    return dressConflictSlots.filter((candidate) => Boolean(outfit[candidate]));
  }
  if (dressConflictSlots.includes(slot) && outfit.dress) {
    return ["dress"];
  }
  return [];
};

/**
 * Maps a clothType/analysis category id (e.g. "hoodie", "long_pants", "jacket") to a closet slot.
 *
 * The bare `/short/` check below used to match top-only ids like "short_sleeve" and
 * "tights_short_sleeve" (both `category: "tops"` in customize-constants.tsx) and mis-route them to
 * "bottom" — "short" only means a bottom when it's paired with "pants"/"shorts", never with
 * "sleeve". Check for a sleeve-length id first so it can never fall through to the bottom branch.
 */
export const inferClosetSlotFromCategory = (categoryKey: string): ClosetSlot => {
  const key = categoryKey.toLowerCase();
  if (/dress|onepiece|one_piece/.test(key)) return "dress";
  if (/skirt/.test(key)) return "skirt";
  if (/jacket|coat|outer/.test(key)) return "outer";
  if (/sleeve/.test(key)) return "top";
  if (/pants|legging|bottom|shorts?(?:_|$)/.test(key)) return "bottom";
  return "top";
};

/** Whether a slot's fit-info form should show top-style measurements (length/shoulder/chest/waist/hem/sleeve). */
export const isTopLikeSlot = (slot: ClosetSlot) => slot === "top" || slot === "outer" || slot === "dress";

/** Whether a slot's fit-info form should show bottom-style measurements (waist/hip/rise/thigh/hem/length). */
export const isBottomLikeSlot = (slot: ClosetSlot) => slot === "bottom" || slot === "skirt" || slot === "dress";
