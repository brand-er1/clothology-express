import { supabase } from "@/lib/supabase";
import type {
  AdminBrandSummary,
  BrandProfileInput,
  BrandWithCreator,
} from "@/types/brand";
import type { Funding } from "@/types/funding";

const BRAND_WITH_CREATOR_SELECT = `
  *,
  creator_profile:creator_profiles(*)
`;

const requireUser = async () => {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) throw new Error("로그인이 필요합니다.");
  return data.session.user;
};

export const normalizeBrandName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");

export const getBrandErrorMessage = (error: unknown) => {
  const candidate = error as { code?: string; message?: string } | null;
  if (candidate?.code === "23505" || /normalized_brand_name|duplicate key/i.test(candidate?.message || "")) {
    return "이미 사용 중인 브랜드명입니다.";
  }
  return candidate?.message || (error instanceof Error ? error.message : "브랜드 정보를 저장하지 못했습니다.");
};

export const fetchMyBrand = async (): Promise<BrandWithCreator | null> => {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("brands")
    .select(BRAND_WITH_CREATOR_SELECT)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as BrandWithCreator | null;
};

export const fetchLegacyBrandDefaults = async () => {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("profiles")
    .select("username, brand_name, avatar_url, bio")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return {
    displayName: data?.username || user.user_metadata?.username || "",
    brandName: data?.brand_name || user.user_metadata?.brand_name || "",
    profileImageUrl: data?.avatar_url || null,
    creatorBio: data?.bio || "",
  };
};

export const isBrandNameAvailable = async (
  brandName: string,
  currentBrandId?: string,
) => {
  const normalized = normalizeBrandName(brandName);
  if (!normalized) return false;

  const { data, error } = await supabase
    .from("brands")
    .select("id")
    .eq("normalized_brand_name", normalized)
    .limit(1);
  if (error) throw error;
  return !data?.length || data[0].id === currentBrandId;
};

const normalizeOptionalUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const parsed = new URL(trimmed);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("SNS와 웹사이트 주소는 http 또는 https 주소로 입력해주세요.");
  return parsed.toString();
};

export const saveMyBrand = async (input: BrandProfileInput): Promise<BrandWithCreator> => {
  await requireUser();
  const instagramUrl = normalizeOptionalUrl(input.instagramUrl);
  const websiteUrl = normalizeOptionalUrl(input.websiteUrl);
  const { error } = await supabase.rpc("save_my_brand_profile", {
    p_display_name: input.displayName.trim(),
    p_profile_image_url: input.profileImageUrl,
    p_creator_bio: input.creatorBio.trim(),
    p_brand_name: input.brandName.trim().replace(/\s+/g, " "),
    p_brand_logo_url: input.brandLogoUrl,
    p_short_description: input.shortDescription.trim(),
    p_description: input.description.trim(),
    p_instagram_url: instagramUrl,
    p_website_url: websiteUrl,
  });
  if (error) throw new Error(getBrandErrorMessage(error));
  const saved = await fetchMyBrand();
  if (!saved) throw new Error("저장된 브랜드 정보를 불러오지 못했습니다.");
  return saved;
};

export const compressImage = async (file: File): Promise<Blob> => {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("JPG, JPEG, PNG, WEBP 이미지만 업로드할 수 있습니다.");
  }

  const source = await createImageBitmap(file);
  const maxSide = 1600;
  const ratio = Math.min(1, maxSide / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * ratio));
  canvas.height = Math.max(1, Math.round(source.height * ratio));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이미지를 처리하지 못했습니다.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close();

  const toBlob = (quality: number) =>
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("이미지를 압축하지 못했습니다."))),
        "image/webp",
        quality,
      );
    });

  let blob = await toBlob(0.86);
  if (blob.size > 5 * 1024 * 1024) blob = await toBlob(0.7);
  if (blob.size > 5 * 1024 * 1024) throw new Error("압축 후 이미지가 5MB를 초과합니다. 더 작은 이미지를 선택해주세요.");
  return blob;
};

export const uploadBrandAsset = async (
  file: File,
  kind: "profile" | "logo",
) => {
  const user = await requireUser();
  const blob = await compressImage(file);
  const path = `${user.id}/${kind}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from("creator-assets")
    .upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
  if (error) throw error;
  return supabase.storage.from("creator-assets").getPublicUrl(path).data.publicUrl;
};

export const fetchBrand = async (brandId: string): Promise<BrandWithCreator> => {
  const { data, error } = await supabase
    .from("brands")
    .select(BRAND_WITH_CREATOR_SELECT)
    .eq("id", brandId)
    .single();
  if (error) throw error;
  return data as BrandWithCreator;
};

export const fetchBrandFundings = async (brandId: string): Promise<Funding[]> => {
  const { data, error } = await supabase
    .from("fundings")
    .select(`*, brand:brands(${BRAND_WITH_CREATOR_SELECT})`)
    .eq("brand_id", brandId)
    .in("status", ["approved", "closed"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Funding[];
};

export const fetchAdminBrands = async (): Promise<AdminBrandSummary[]> => {
  await requireUser();
  const { data, error } = await supabase
    .from("brands")
    .select(`*, creator_profile:creator_profiles(*), fundings(id, status)`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as AdminBrandSummary[];
};

export const assignFundingBrand = async (
  fundingId: string,
  brandId: string,
): Promise<void> => {
  await requireUser();
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id, owner_user_id")
    .eq("id", brandId)
    .single();
  if (brandError) throw brandError;

  const { error } = await supabase
    .from("fundings")
    .update({ brand_id: brand.id, creator_id: brand.owner_user_id })
    .eq("id", fundingId);
  if (error) throw error;
};
