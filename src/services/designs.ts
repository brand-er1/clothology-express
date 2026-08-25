import { supabase } from "@/lib/supabase";
import { getGuestSessionId } from "@/lib/guest-session";

export interface DesignAccessory {
  kind: string;
  count?: number;
}

export interface DesignRecord {
  id: string;
  userId: string | null;
  frontImageUrl: string;
  backImageUrl: string | null;
  imagePath: string | null;
  productType: string | null;
  color: string | null;
  fabric: string | null;
  fit: string | null;
  quantity: number;
  hasPrint: boolean;
  hasEmbroidery: boolean;
  accessories: DesignAccessory[];
  productionCountry: string;
  prompt: string | null;
  detail: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export const getDesignErrorMessage = (error: unknown, fallback = "잠시 후 다시 시도해주세요.") =>
  error instanceof Error && error.message ? error.message : fallback;

export interface SaveDesignInput {
  designId?: string | null;
  frontImageUrl: string;
  backImageUrl?: string | null;
  imagePath?: string | null;
  productType?: string | null;
  color?: string | null;
  fabric?: string | null;
  fit?: string | null;
  quantity?: number | null;
  hasPrint?: boolean | null;
  hasEmbroidery?: boolean | null;
  accessories?: DesignAccessory[] | null;
  productionCountry?: string | null;
  prompt?: string | null;
  detail?: string | null;
  source?: string | null;
}

/**
 * Creates or updates the single `design` record a design generation/edit belongs to. Called right
 * after AI generation and after every edit, so `designId` exists as early as possible and survives
 * a refresh — the design-complete screen's "자동 견적 확인하기" button depends on this id existing.
 */
export const saveDesign = async (input: SaveDesignInput): Promise<string> => {
  const { data: sessionData } = await supabase.auth.getSession();
  const isLoggedIn = Boolean(sessionData.session?.user);

  const { data, error } = await supabase.rpc("save_design", {
    p_front_image_url: input.frontImageUrl,
    p_design_id: input.designId || null,
    p_guest_session_id: isLoggedIn ? null : getGuestSessionId(),
    p_back_image_url: input.backImageUrl ?? null,
    p_product_type: input.productType ?? null,
    p_color: input.color ?? null,
    p_fabric: input.fabric ?? null,
    p_fit: input.fit ?? null,
    p_quantity: input.quantity ?? null,
    p_has_print: input.hasPrint ?? null,
    p_has_embroidery: input.hasEmbroidery ?? null,
    p_accessories: input.accessories ?? null,
    p_production_country: input.productionCountry ?? null,
    p_prompt: input.prompt ?? null,
    p_detail: input.detail ?? null,
    p_image_path: input.imagePath ?? null,
    p_source: input.source ?? null,
  });

  if (error) throw new Error(error.message || "디자인을 저장하지 못했습니다.");
  return data as string;
};

interface RawDesignRow {
  id: string;
  user_id: string | null;
  front_image_url: string;
  back_image_url: string | null;
  image_path: string | null;
  product_type: string | null;
  color: string | null;
  fabric: string | null;
  fit: string | null;
  quantity: number;
  has_print: boolean;
  has_embroidery: boolean;
  accessories: DesignAccessory[] | null;
  production_country: string;
  prompt: string | null;
  detail: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

const toDesignRecord = (row: RawDesignRow): DesignRecord => ({
  id: row.id,
  userId: row.user_id,
  frontImageUrl: row.front_image_url,
  backImageUrl: row.back_image_url,
  imagePath: row.image_path,
  productType: row.product_type,
  color: row.color,
  fabric: row.fabric,
  fit: row.fit,
  quantity: row.quantity,
  hasPrint: row.has_print,
  hasEmbroidery: row.has_embroidery,
  accessories: row.accessories || [],
  productionCountry: row.production_country,
  prompt: row.prompt,
  detail: row.detail,
  source: row.source,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const getDesign = async (designId: string): Promise<DesignRecord | null> => {
  const { data, error } = await supabase.rpc("get_design", { p_design_id: designId });
  if (error) throw new Error(error.message || "디자인을 불러오지 못했습니다.");
  const row = (data as RawDesignRow[])?.[0];
  return row ? toDesignRecord(row) : null;
};

/**
 * Moves every design/outfit created under this browser's guest session onto the now-signed-in
 * account, so logging in never wipes out work made while browsing anonymously.
 */
export const claimGuestSession = async (): Promise<{ designs: number; outfits: number } | null> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user) return null;

  const guestSessionId = getGuestSessionId();
  const { data, error } = await supabase.rpc("claim_guest_session", {
    p_guest_session_id: guestSessionId,
  });
  if (error) {
    console.error("claim_guest_session failed:", error);
    return null;
  }
  return (data as { designs: number; outfits: number }) || { designs: 0, outfits: 0 };
};
