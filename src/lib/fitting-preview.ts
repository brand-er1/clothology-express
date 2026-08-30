import { supabase } from "@/lib/supabase";
import { closetSlotOrder } from "@/lib/closet-character-config";
import type { CharacterGender, ClosetOutfit, MannequinSize } from "@/types/closet";
import type { FittingStateSnapshot } from "@/types/fitting";

const isHttpUrl = (value: string) => value.startsWith("http://") || value.startsWith("https://");

/**
 * Turns a 3D-canvas screenshot (a `data:image/png;base64,...` URL from
 * `Mannequin3DViewerHandle.captureScreenshot()`) into a stable, hosted URL so it can be attached to
 * a 제작의뢰/펀딩 row (spec §14/§15 "3D mannequin preview 또는 screenshot"). An already-hosted URL
 * (e.g. the AI 피팅 photoreal render, `renderedCharacterImage`) is returned unchanged — never
 * re-uploaded. Best-effort: returns null (never throws) so a preview-upload hiccup never blocks the
 * order/funding submission itself.
 */
export const uploadFittingPreview = async (
  source: string | null | undefined,
  userId: string | null,
): Promise<string | null> => {
  if (!source) return null;
  if (isHttpUrl(source)) return source;
  if (!source.startsWith("data:image/")) return null;

  try {
    const [, base64] = source.split(",");
    if (!base64) return null;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

    const path = `${userId || "guest"}/fitting-previews/${Date.now()}-${crypto.randomUUID()}.png`;
    const { error } = await supabase.storage
      .from("generated_images")
      .upload(path, bytes, { contentType: "image/png", cacheControl: "3600", upsert: false });
    if (error) throw error;

    const { data } = supabase.storage.from("generated_images").getPublicUrl(path);
    return data.publicUrl;
  } catch (error) {
    console.error("Failed to upload fitting preview screenshot:", error);
    return null;
  }
};

/**
 * A compact, storage-safe snapshot of `FittingState` for `orders.fitting_state` /
 * `fundings.fitting_state` (jsonb) — every garment reduced to id/slot/label/imageUrl instead of the
 * full `ClosetGarment` (which can carry large base64 blobs in `designRef`), so the admin views can
 * show "which mannequin outfit was this" without bloating the row.
 */
export const serializeFittingStateForHandoff = (
  gender: CharacterGender,
  size: MannequinSize,
  outfit: ClosetOutfit,
): FittingStateSnapshot => ({
  gender,
  size,
  slots: closetSlotOrder
    .filter((slot) => outfit[slot])
    .map((slot) => {
      const garment = outfit[slot]!;
      return { slot, id: garment.id, label: garment.label, imageUrl: garment.imageUrl, source: garment.source };
    }),
});
