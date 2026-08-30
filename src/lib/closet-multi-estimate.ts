import type { ClosetGarment, ClosetOutfit } from "@/types/closet";
import { closetSlotOrder } from "@/lib/closet-character-config";

/** Default per-item production quantity shown when a visitor first opens the whole-outfit estimate. */
export const DEFAULT_MULTI_ESTIMATE_QUANTITY = 20;

export interface ActiveGarmentEntry {
  /** Stable React/lookup key — always the garment id, which is unique per worn item. */
  key: string;
  garment: ClosetGarment;
  quantity: number;
}

/**
 * Identity keys for duplicate detection, in priority order: garment id, then the shared `designs`
 * row id (closest equivalent this codebase has to a separate "generated_clothing_id" — AI-designed
 * garments never get a second, different id for the same generation), then the garment's own
 * resolved image + category. Any single match on ANY key means "same physical garment" — see
 * `deduplicateGarmentEntries`.
 */
const dedupeKeysForGarment = (garment: ClosetGarment): string[] => {
  const keys: string[] = [`id:${garment.id}`];
  const designId = garment.designRef?.designId;
  if (designId) keys.push(`design:${designId}`);
  const imageIdentity = garment.designRef?.imageUrl || garment.imageUrl || garment.designRef?.imageBase64;
  const category = garment.designRef?.selectedType || garment.slot;
  if (imageIdentity) keys.push(`img:${imageIdentity}:${category}`);
  return keys;
};

/**
 * Removes duplicate garments — same garment id, same source design, or same image+category —
 * keeping only the first occurrence. Outer+top (different slots, different garments) are never
 * touched by this: only a genuinely repeated garment (e.g. re-equipped in two slots, or stale
 * data pointing at the same design twice) collapses to one entry.
 */
export const deduplicateGarmentEntries = (
  entries: ActiveGarmentEntry[],
): { deduped: ActiveGarmentEntry[]; removedCount: number } => {
  const seen = new Set<string>();
  const deduped: ActiveGarmentEntry[] = [];
  let removedCount = 0;

  for (const entry of entries) {
    const keys = dedupeKeysForGarment(entry.garment);
    const isDuplicate = keys.some((key) => seen.has(key));
    if (isDuplicate) {
      removedCount += 1;
      continue;
    }
    keys.forEach((key) => seen.add(key));
    deduped.push(entry);
  }

  return { deduped, removedCount };
};

/**
 * The currently worn, quotable garments — always read straight from the live virtual-fitting
 * outfit state (never from wardrobe/DB history), so a stale duplicate can never leak in: a slot
 * only ever holds the garment actually shown on the mannequin right now. Presets (no design data)
 * are excluded, matching the existing single-item quote flow.
 */
export const buildActiveGarmentEntries = (
  outfit: ClosetOutfit,
  defaultQuantity: number = DEFAULT_MULTI_ESTIMATE_QUANTITY,
): { entries: ActiveGarmentEntry[]; removedCount: number } => {
  const raw: ActiveGarmentEntry[] = closetSlotOrder
    .map((slot) => outfit[slot])
    .filter((garment): garment is ClosetGarment => Boolean(garment && garment.source !== "preset"))
    .map((garment) => ({ key: garment.id, garment, quantity: defaultQuantity }));

  const { deduped, removedCount } = deduplicateGarmentEntries(raw);
  return { entries: deduped, removedCount };
};
