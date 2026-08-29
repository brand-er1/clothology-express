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
 * Primary Source of Truth for garment category → closet slot. Keyed by the exact clothType id the
 * user selected at generation time (see clothTypes in customize-constants.tsx) or the categoryKey
 * from the production quote catalog (see quote_garment_prices) — never re-derived from an AI image
 * analysis result. Every id a user can actually select must be listed here explicitly: a loose
 * substring/regex match is what previously misclassified "short_sleeve" (반팔티, a TOP) as BOTTOM
 * just because its id contains "short", and let "jumper"/"padding" (OUTER) fall through to TOP.
 */
export const garmentCategoryMap: Record<string, ClosetSlot> = {
  // Tops
  short_sleeve: "top",
  long_sleeve: "top",
  tights_short_sleeve: "top",
  tights_long_sleeve: "top",
  sweatshirt: "top",
  hoodie: "top",
  knit: "top",
  shirt: "top",
  vest: "top",
  // Bottoms
  pants: "bottom",
  long_pants: "bottom",
  short_pants: "bottom",
  jogger_pants: "bottom",
  denim_pants: "bottom",
  leggings: "bottom",
  tights_bottom: "bottom",
  // Outer
  jacket: "outer",
  jacket_lined: "outer",
  jumper: "outer",
  jumper_lined: "outer",
  padding: "outer",
  coat: "outer",
  // Dress
  dress: "dress",
  onepiece: "dress",
  one_piece: "dress",
  // Skirt
  skirt: "skirt",
};

/**
 * Maps a clothType/analysis category id to a closet slot. Looks up `garmentCategoryMap` first
 * (the user's selected category always wins); only an id that isn't in that map at all — e.g. a
 * free-form AI analysis category never offered as a selectable type — falls back to a
 * whole-word keyword match, so a TOP id like "short_sleeve" can never be caught by a BOTTOM
 * keyword the way a bare substring test ("short" inside "short_sleeve") did before.
 */
export const inferClosetSlotFromCategory = (categoryKey: string): ClosetSlot => {
  const key = categoryKey.trim().toLowerCase();
  const mapped = garmentCategoryMap[key];
  if (mapped) return mapped;

  const words = key.split(/[^a-z0-9가-힣]+/).filter(Boolean);
  const hasWord = (...candidates: string[]) => candidates.some((candidate) => words.includes(candidate));

  if (hasWord("dress", "onepiece", "원피스", "드레스")) return "dress";
  if (hasWord("skirt", "스커트", "치마")) return "skirt";
  if (hasWord("jacket", "coat", "outer", "jumper", "padding", "자켓", "재킷", "코트", "점퍼", "패딩", "아우터", "블루종"))
    return "outer";
  if (hasWord("pants", "legging", "leggings", "bottom", "shorts", "denim", "jogger", "trousers", "팬츠", "데님", "청바지", "조거", "반바지", "슬랙스", "레깅스"))
    return "bottom";
  return "top";
};

/** Whether a slot's fit-info form should show top-style measurements (length/shoulder/chest/waist/hem/sleeve). */
export const isTopLikeSlot = (slot: ClosetSlot) => slot === "top" || slot === "outer" || slot === "dress";

/** Whether a slot's fit-info form should show bottom-style measurements (waist/hip/rise/thigh/hem/length). */
export const isBottomLikeSlot = (slot: ClosetSlot) => slot === "bottom" || slot === "skirt" || slot === "dress";
