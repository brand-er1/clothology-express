import { closetSlotOrder } from "@/lib/closet-character-config";
import { useWardrobeState } from "@/lib/closet-store";
import type { CharacterGender, ClosetGarment, ClosetOutfit, MannequinSize } from "@/types/closet";

/**
 * Spec-shaped read view of the wardrobe state (§11):
 * `{ gender, size, garments: { top, bottom, outer, dress, accessories } }`.
 *
 * This is deliberately *not* a second store — `WardrobeState` (closet-store.ts) already is the
 * single source of truth for gender/size/outfit (see types/closet.ts's `WardrobeState`, which is
 * exactly this shape under different field names for historical/DB-compat reasons: `character` =
 * gender, `mannequinSize` = size, `outfit` = garments). Every fitting-adjacent feature (AI fitting,
 * combined quote, 제작의뢰/펀딩 handoff) reads through `getFittingState`/`useFittingState` below
 * instead of re-deriving gender/size/garments from the UI, so none of them can silently drift from
 * what the mannequin is actually wearing.
 */
export interface FittingGarments {
  top: ClosetGarment | null;
  bottom: ClosetGarment | null;
  outer: ClosetGarment | null;
  dress: ClosetGarment | null;
  skirt: ClosetGarment | null;
  shoes: ClosetGarment | null;
  accessories: ClosetGarment[];
}

export interface FittingState {
  gender: CharacterGender;
  size: MannequinSize;
  garments: FittingGarments;
}

export const toFittingGarments = (outfit: ClosetOutfit): FittingGarments => ({
  top: outfit.top,
  bottom: outfit.bottom,
  outer: outfit.outer,
  dress: outfit.dress,
  skirt: outfit.skirt,
  shoes: outfit.shoes,
  accessories: outfit.accessory ? [outfit.accessory] : [],
});

export const buildFittingState = (
  gender: CharacterGender,
  size: MannequinSize,
  outfit: ClosetOutfit,
): FittingState => ({
  gender,
  size,
  garments: toFittingGarments(outfit),
});

/** React hook: the live fitting state, reactive to the same store every closet UI reads/writes. */
export const useFittingState = (): FittingState => {
  const { character, mannequinSize, outfit } = useWardrobeState();
  return buildFittingState(character, mannequinSize, outfit);
};

/**
 * Every currently-worn garment the visitor actually authored (AI design or upload — never a
 * `preset`), deduplicated by `garmentId`. This is the one function every "act on everything the
 * mannequin is wearing" feature (AI 피팅, combined quote, 제작의뢰/펀딩 handoff) should call —
 * never re-read `outfit` slots directly — so a garment referenced from two slots (which the UI
 * itself never allows, but a stale/duplicated state object could) is still only counted once.
 */
export const getDedupedWornGarments = (outfit: ClosetOutfit): ClosetGarment[] => {
  const seen = new Set<string>();
  const result: ClosetGarment[] = [];
  for (const slot of closetSlotOrder) {
    const garment = outfit[slot];
    if (!garment || garment.source === "preset" || seen.has(garment.id)) continue;
    seen.add(garment.id);
    result.push(garment);
  }
  return result;
};
