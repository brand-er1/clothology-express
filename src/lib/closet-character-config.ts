import { getAppPath } from "@/utils/appUrl";
import type { CharacterConfig, CharacterGender } from "@/types/closet";

/**
 * Base BRAND-ER mascot references. These images are never redesigned — they're passed to the
 * dress-character AI call as the character-identity reference image (Reference Image 1), and shown
 * as-is whenever nothing has been AI-dressed yet.
 */
export const characterConfig: Record<CharacterGender, CharacterConfig> = {
  male: {
    key: "male",
    label: "남자 브랜더",
    tagline: "브랜더 오리지널 캐릭터",
    baseImage: getAppPath("/mascot/idle.png"),
  },
  female: {
    key: "female",
    label: "여자 브랜더",
    tagline: "속눈썹이 포인트인 브랜더",
    baseImage: getAppPath("/mascot/character-female.png"),
  },
};

export const closetSlotOrder = ["top", "bottom", "outer", "shoes", "accessory"] as const;

export const closetSlotLabel: Record<(typeof closetSlotOrder)[number], string> = {
  top: "상의",
  bottom: "하의",
  outer: "아우터",
  shoes: "신발",
  accessory: "액세서리",
};

/** Maps a clothType/analysis category id (e.g. "hoodie", "long_pants", "jacket") to a closet slot. */
export const inferClosetSlotFromCategory = (categoryKey: string): (typeof closetSlotOrder)[number] => {
  const key = categoryKey.toLowerCase();
  if (/jacket/.test(key)) return "outer";
  if (/pants|legging|bottom/.test(key)) return "bottom";
  return "top";
};
