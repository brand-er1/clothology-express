import { supabase } from "@/lib/supabase";
import type { CharacterGender, ClosetOutfit } from "@/types/closet";
import { closetSlotOrder } from "@/lib/closet-character-config";
import { getGuestSessionId } from "@/lib/guest-session";
import type { MyOutfitData, OutfitCardData, OutfitDetailData, OutfitItem } from "@/types/outfit";

const requireUser = async () => {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) throw new Error("로그인이 필요합니다.");
  return user;
};

/** Resolves who's calling: a logged-in user id, or a guest_session_id for anonymous visitors. */
const resolveCaller = async () => {
  const { data } = await supabase.auth.getSession();
  const isLoggedIn = Boolean(data.session?.user);
  return { isLoggedIn, guestSessionId: isLoggedIn ? null : getGuestSessionId() };
};

export const getOutfitErrorMessage = (error: unknown, fallback = "잠시 후 다시 시도해주세요.") =>
  error instanceof Error && error.message ? error.message : fallback;

/** Builds the outfit_items payload from the currently-equipped closet outfit, in slot order. */
export const buildOutfitItemsPayload = (outfit: ClosetOutfit) =>
  closetSlotOrder
    .map((slot) => outfit[slot])
    .filter((garment): garment is NonNullable<typeof garment> => Boolean(garment))
    .map((garment) => ({
      slot: garment.slot,
      garment_id: garment.id,
      label: garment.label,
      image_url: garment.designRef?.imageUrl || garment.imageUrl,
      source: garment.source,
      design_id: garment.designRef?.designId || null,
      base_size: garment.fitInfo?.baseSize || null,
      fit_type: garment.fitInfo?.fitType || null,
      measurements: garment.fitInfo?.measurements || null,
      fabric: garment.fitInfo?.fabric || null,
      has_measurements: garment.fitInfo?.hasMeasurements ?? false,
      back_image_url: garment.backImageUrl || null,
    }));

interface SaveOutfitInput {
  title: string;
  description: string;
  imageUrl: string;
  imagePath: string | null;
  characterGender: CharacterGender;
  mannequinSize: string | null;
  isPublic: boolean;
  items: ReturnType<typeof buildOutfitItemsPayload>;
  tags: string[];
}

export const saveOutfit = async (input: SaveOutfitInput): Promise<string> => {
  const { isLoggedIn, guestSessionId } = await resolveCaller();
  if (input.isPublic && !isLoggedIn) {
    throw new Error("공개 코디는 로그인 후 올릴 수 있습니다.");
  }
  const { data, error } = await supabase.rpc("save_outfit", {
    p_title: input.title,
    p_description: input.description,
    p_image_url: input.imageUrl,
    p_image_path: input.imagePath,
    p_character_gender: input.characterGender,
    p_is_public: input.isPublic,
    p_items: input.items,
    p_tags: input.tags,
    p_guest_session_id: guestSessionId,
    p_mannequin_size: input.mannequinSize,
  });
  if (error) throw new Error(error.message || "코디를 저장하지 못했습니다.");
  return data as string;
};

interface UpdateOutfitInput {
  id: string;
  title: string;
  description: string;
  isPublic: boolean;
  tags: string[];
}

export const updateOutfit = async (input: UpdateOutfitInput): Promise<void> => {
  const { isLoggedIn, guestSessionId } = await resolveCaller();
  if (input.isPublic && !isLoggedIn) {
    throw new Error("공개 코디는 로그인 후 올릴 수 있습니다.");
  }
  const { error } = await supabase.rpc("update_outfit", {
    p_outfit_id: input.id,
    p_title: input.title,
    p_description: input.description,
    p_is_public: input.isPublic,
    p_tags: input.tags,
    p_guest_session_id: guestSessionId,
  });
  if (error) throw new Error(error.message || "코디를 수정하지 못했습니다.");
};

export const deleteOutfit = async (id: string): Promise<void> => {
  const { guestSessionId } = await resolveCaller();
  const { error } = await supabase.rpc("delete_outfit", {
    p_outfit_id: id,
    p_guest_session_id: guestSessionId,
  });
  if (error) throw new Error(error.message || "코디를 삭제하지 못했습니다.");
};

export const toggleOutfitLike = async (id: string): Promise<boolean> => {
  await requireUser();
  const { data, error } = await supabase.rpc("toggle_outfit_like", { p_outfit_id: id });
  if (error) throw new Error(error.message || "좋아요를 처리하지 못했습니다.");
  return Boolean(data);
};

interface RawOutfitCardRow {
  id: string;
  title: string;
  image_url: string;
  author_name: string;
  like_count: number;
  liked_by_me: boolean;
  created_at: string;
  character_gender: CharacterGender;
}

const toOutfitCard = (row: RawOutfitCardRow): OutfitCardData => ({
  id: row.id,
  title: row.title,
  imageUrl: row.image_url,
  authorName: row.author_name,
  likeCount: row.like_count,
  likedByMe: row.liked_by_me,
  createdAt: row.created_at,
  characterGender: row.character_gender,
});

export const listPublicOutfits = async (options: { before?: string; tag?: string; limit?: number } = {}) => {
  const { data, error } = await supabase.rpc("list_public_outfits", {
    p_limit: options.limit ?? 24,
    p_before: options.before ?? null,
    p_tag: options.tag ?? null,
  });
  if (error) throw new Error(error.message || "코디 피드를 불러오지 못했습니다.");
  return (data as RawOutfitCardRow[]).map(toOutfitCard);
};

interface RawOutfitDetailRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  image_url: string;
  author_name: string;
  character_gender: CharacterGender;
  mannequin_size: string | null;
  is_public: boolean;
  like_count: number;
  liked_by_me: boolean;
  is_owner: boolean;
  created_at: string;
  items: OutfitItem[];
  tags: string[];
}

export const getOutfitDetail = async (id: string): Promise<OutfitDetailData> => {
  const { data, error } = await supabase.rpc("get_outfit_detail", { p_outfit_id: id });
  if (error) throw new Error(error.message || "코디를 불러오지 못했습니다.");
  const row = (data as RawOutfitDetailRow[])?.[0];
  if (!row) throw new Error("코디를 찾을 수 없습니다.");
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    authorName: row.author_name,
    characterGender: row.character_gender,
    mannequinSize: (row.mannequin_size as OutfitDetailData["mannequinSize"]) || null,
    isPublic: row.is_public,
    likeCount: row.like_count,
    likedByMe: row.liked_by_me,
    isOwner: row.is_owner,
    createdAt: row.created_at,
    items: row.items || [],
    tags: row.tags || [],
  };
};

interface RawMyOutfitRow {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  is_public: boolean;
  like_count: number;
  created_at: string;
  character_gender: CharacterGender;
  mannequin_size: string | null;
  tags: string[];
}

export const listMyOutfits = async (): Promise<MyOutfitData[]> => {
  await requireUser();
  const { data, error } = await supabase.rpc("list_my_outfits");
  if (error) throw new Error(error.message || "내 코디를 불러오지 못했습니다.");
  return (data as RawMyOutfitRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    isPublic: row.is_public,
    likeCount: row.like_count,
    createdAt: row.created_at,
    characterGender: row.character_gender,
    mannequinSize: (row.mannequin_size as MyOutfitData["mannequinSize"]) || null,
    tags: row.tags || [],
  }));
};
