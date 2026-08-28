import { mannequinSizesForGender } from "@/lib/mannequin-presets";
import { runVirtualFitting, type VirtualFittingResult } from "@/services/virtualFitting";
import type { CharacterGender, ClosetGarment, ClosetSlot } from "@/types/closet";

export interface SizeComparisonEntry {
  size: string;
  result: VirtualFittingResult | null;
}

/**
 * Generates the same outfit across every mannequin size for one gender, holding face, pose, camera,
 * background, lighting and the garments themselves fixed — only body size (and therefore fit/drape)
 * differs between entries. Runs all sizes in parallel; each gets its own idempotency key so a retry
 * of the whole comparison never re-runs a size that already finished.
 */
export const compareMannequinSizes = async (
  gender: CharacterGender,
  garments: ClosetGarment[],
  options: { changedSlots?: ClosetSlot[]; requestIdPrefix?: string } = {},
): Promise<SizeComparisonEntry[]> => {
  const sizes = mannequinSizesForGender(gender);
  const requestIdPrefix = options.requestIdPrefix || crypto.randomUUID();

  const entries = await Promise.all(
    sizes.map(async (size) => {
      const result = await runVirtualFitting(gender, size, garments, {
        changedSlots: options.changedSlots,
        requestId: `${requestIdPrefix}-${size}`,
        silent: true,
      });
      return { size, result };
    }),
  );

  return entries;
};
