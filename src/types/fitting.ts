import type { CharacterGender, ClosetGarment, ClosetSlot, MannequinSize } from "@/types/closet";

/**
 * Storage-safe snapshot of which mannequin (gender/size) and which garments (per slot) a
 * 제작의뢰/펀딩 row was created from via the 3D 가상피팅 flow — see
 * src/lib/fitting-preview.ts#serializeFittingStateForHandoff. Deliberately slimmer than
 * `ClosetGarment` (id/slot/label/imageUrl/source only) so it stays small in `orders`/`fundings`
 * jsonb columns.
 */
export interface FittingStateSnapshotSlot {
  slot: ClosetSlot;
  id: string;
  label: string;
  imageUrl: string;
  source: ClosetGarment["source"];
}

export interface FittingStateSnapshot {
  gender: CharacterGender;
  size: MannequinSize;
  slots: FittingStateSnapshotSlot[];
}
