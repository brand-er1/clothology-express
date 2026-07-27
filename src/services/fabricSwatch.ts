import { supabase } from "@/lib/supabase";
import type {
  CreateFabricSwatchRequestInput,
  FabricSwatchRequest,
  FabricSwatchStatus,
} from "@/types/fabricSwatch";

const STORAGE_BUCKET = "fabric-swatch-references";

const normalizeColors = (colors: string[]) =>
  Array.from(
    new Set(
      colors
        .map((color) => color.trim().replace(/\s+/g, " "))
        .filter(Boolean),
    ),
  ).slice(0, 12);

const getFileExtension = (file: File) => {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension && /^[a-z0-9]{2,5}$/.test(extension)) return extension;
  return file.type === "image/png" ? "png" : "jpg";
};

export const createFabricSwatchRequest = async ({
  fabricFeeling,
  colorNames,
  referenceImage,
}: CreateFabricSwatchRequestInput) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    throw new Error("원단 스와치를 신청하려면 로그인이 필요합니다.");
  }

  const normalizedColors = normalizeColors(colorNames);
  if (!normalizedColors.length) {
    throw new Error("원하는 색상을 한 가지 이상 선택해주세요.");
  }

  let referenceImagePath: string | null = null;

  if (referenceImage) {
    const extension = getFileExtension(referenceImage);
    referenceImagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(referenceImagePath, referenceImage, {
        cacheControl: "3600",
        contentType: referenceImage.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error("참고 이미지를 업로드하지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
  }

  const metadata = user.user_metadata;
  const requesterName =
    (typeof metadata.brand_name === "string" && metadata.brand_name.trim()) ||
    (typeof metadata.username === "string" && metadata.username.trim()) ||
    null;

  const { data, error } = await supabase
    .from("fabric_swatch_requests")
    .insert({
      user_id: user.id,
      requester_email: user.email || "",
      requester_name: requesterName,
      fabric_feeling: fabricFeeling,
      color_names: normalizedColors,
      reference_image_path: referenceImagePath,
      requested_minimum_count: 5,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    if (referenceImagePath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([referenceImagePath]);
    }
    throw new Error("신청 내용을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
  }

  return data as FabricSwatchRequest;
};

export const fetchAllFabricSwatchRequests = async () => {
  const { data, error } = await supabase
    .from("fabric_swatch_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as FabricSwatchRequest[];
};

export const updateFabricSwatchRequest = async (
  requestId: string,
  status: FabricSwatchStatus,
  adminNote: string,
) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const reviewerId = sessionData.session?.user.id;

  const { data, error } = await supabase
    .from("fabric_swatch_requests")
    .update({
      status,
      admin_note: adminNote.trim() || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select("*")
    .single();

  if (error) throw error;
  return data as FabricSwatchRequest;
};

export const getFabricSwatchReferenceUrl = async (path: string) => {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, 60 * 30);

  if (error) throw error;
  return data.signedUrl;
};
