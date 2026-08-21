import { getAppPath } from "@/utils/appUrl";
import type { CharacterConfig, CharacterGender } from "@/types/closet";

/**
 * Per-character anchor points for BRAND-ER CLOSET's clothing overlay. Every slot gets its own
 * position/scale — resizing the whole outfit uniformly per character is explicitly NOT how this
 * works, since a female-proportioned base needs its own top/bottom/outer/shoes placement, not a
 * scaled-down copy of the male one.
 *
 * These are starting values tuned by eye against the current mascot artwork; nudge them once real
 * base-character renders are in place.
 */
export const characterConfig: Record<CharacterGender, CharacterConfig> = {
  male: {
    key: "male",
    label: "남자 브랜더",
    tagline: "브랜더 오리지널 캐릭터",
    baseImage: getAppPath("/mascot/idle.png"),
    anchors: {
      top: { xPercent: 50, yPercent: 42, widthPercent: 46, zIndex: 20 },
      bottom: { xPercent: 50, yPercent: 68, widthPercent: 42, zIndex: 10 },
      outer: { xPercent: 50, yPercent: 44, widthPercent: 54, zIndex: 30 },
      shoes: { xPercent: 50, yPercent: 92, widthPercent: 30, zIndex: 15 },
      accessory: { xPercent: 50, yPercent: 26, widthPercent: 26, zIndex: 40 },
    },
  },
  female: {
    key: "female",
    label: "여자 브랜더",
    tagline: "속눈썹이 포인트인 브랜더",
    baseImage: getAppPath("/mascot/character-female-placeholder.png"),
    anchors: {
      top: { xPercent: 50, yPercent: 40, widthPercent: 42, zIndex: 20 },
      bottom: { xPercent: 50, yPercent: 66, widthPercent: 38, zIndex: 10 },
      outer: { xPercent: 50, yPercent: 42, widthPercent: 50, zIndex: 30 },
      shoes: { xPercent: 50, yPercent: 91, widthPercent: 26, zIndex: 15 },
      accessory: { xPercent: 50, yPercent: 24, widthPercent: 24, zIndex: 40 },
    },
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
