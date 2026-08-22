import { supabase } from "@/lib/supabase";
import type { ClosetActivityEventType } from "@/types/closetActivity";

interface LogClosetActivityInput {
  eventType: ClosetActivityEventType;
  characterGender?: string | null;
  slot?: string | null;
  garmentId?: string | null;
  label?: string | null;
  prompt?: string | null;
  imageUrl?: string | null;
  imagePath?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Best-effort admin-visibility log for Brand-er Closet activity (garment created/edited/
 * regenerated, character dressed, look saved). Purely for admin oversight — never awaited by a
 * caller for correctness, never surfaces an error to the shopper, and silently no-ops for guests
 * (the closet already works fully without an account; only logged-in activity is tracked here,
 * matching how the rest of the app only keeps DB history for signed-in users).
 */
export const logClosetActivity = async (input: LogClosetActivityInput): Promise<void> => {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) return;

    const { error } = await supabase.rpc("track_closet_activity", {
      p_event_type: input.eventType,
      p_character_gender: input.characterGender ?? null,
      p_slot: input.slot ?? null,
      p_garment_id: input.garmentId ?? null,
      p_label: input.label ?? null,
      p_prompt: input.prompt ?? null,
      p_image_url: input.imageUrl ?? null,
      p_image_path: input.imagePath ?? null,
      p_metadata: input.metadata ?? {},
    });
    if (error) console.warn("logClosetActivity failed:", error);
  } catch (error) {
    console.warn("logClosetActivity failed:", error);
  }
};
