import { supabase } from "@/lib/supabase";
import type {
  CreateFundingInput,
  Funding,
  KakaoPayReadyResult,
  MyFundingParticipation,
  FundingParticipation,
  FundingParticipationStatus,
  FundingStatus,
} from "@/types/funding";
import { getAppUrl } from "@/utils/appUrl";

const requireUser = async () => {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  return user;
};

export const getFundingErrorMessage = (
  error: unknown,
  fallback = "잠시 후 다시 시도해주세요."
) => {
  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  return fallback;
};

const throwFundingError = (error: unknown, fallback?: string): never => {
  throw new Error(getFundingErrorMessage(error, fallback));
};

export const createFundingDraft = async (input: CreateFundingInput): Promise<Funding> => {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("fundings")
    .insert({
      creator_id: user.id,
      product_name: input.productName,
      cloth_type: input.clothType,
      material: input.material,
      color: input.color || null,
      size: input.size,
      color_options: input.color ? [input.color] : ["기본 색상"],
      size_options: input.size ? [input.size] : ["FREE"],
      measurements: input.measurements,
      image_url: input.imageUrl,
      image_path: input.imagePath,
      description: input.description,
      moq: 20,
      current_orders: 0,
      funding_days: 30,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Funding;
};

export const fetchFunding = async (id: string): Promise<Funding> => {
  const { data, error } = await supabase
    .from("fundings")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as Funding;
};

export const fetchApprovedFundings = async (): Promise<Funding[]> => {
  const { data, error } = await supabase
    .from("fundings")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Funding[];
};

export const fetchMyFundings = async (): Promise<Funding[]> => {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("fundings")
    .select("*")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Funding[];
};

export const updateFunding = async (
  id: string,
  updates: Pick<
    Funding,
    "product_name" | "description" | "moq" | "price" | "funding_days" | "color_options" | "size_options"
  >
): Promise<Funding> => {
  await requireUser();
  const { data, error } = await supabase.rpc("update_creator_funding", {
    p_funding_id: id,
    p_product_name: updates.product_name,
    p_description: updates.description,
    p_moq: Math.max(20, updates.moq),
    p_price: updates.price,
    p_funding_days: updates.funding_days,
    p_color_options: updates.color_options,
    p_size_options: updates.size_options,
  });

  if (error) throw error;
  return data as Funding;
};

export const fetchAllFundings = async (): Promise<Funding[]> => {
  const { data, error } = await supabase
    .from("fundings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Funding[];
};

export const reviewFunding = async (
  id: string,
  status: Extract<FundingStatus, "approved" | "rejected">,
  adminComment: string
): Promise<void> => {
  const user = await requireUser();
  const { error } = await supabase
    .from("fundings")
    .update({
      status,
      admin_comment: adminComment || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
};

export const participateInFunding = async (
  fundingId: string,
  color: string,
  size: string,
  quantity: number
): Promise<string> => {
  const user = await requireUser();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("phone_number, address")
    .eq("id", user.id)
    .single();

  if (profileError) throwFundingError(profileError, "회원 정보를 확인하지 못했습니다.");

  if (!profile?.phone_number?.trim() || !profile.address?.trim()) {
    throw new Error("펀딩 참여 전에 마이페이지에서 전화번호와 배송지를 입력해주세요.");
  }

  const { data, error } = await supabase.rpc("participate_in_funding", {
    p_funding_id: fundingId,
    p_color: color,
    p_size: size,
    p_quantity: quantity,
  });

  if (error) throwFundingError(error, "펀딩 참여를 처리하지 못했습니다.");
  return data as string;
};

const invokePaymentFunction = async <T>(name: string, body: Record<string, unknown>): Promise<T> => {
  await requireUser();
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const payload = await context.json();
        message = payload?.error || message;
      } catch {
        // Supabase의 기본 오류 메시지를 사용합니다.
      }
    }
    throw new Error(message || "결제 처리 중 오류가 발생했습니다.");
  }

  if (data?.error) throw new Error(data.error);
  return data as T;
};

export const startKakaoPayFunding = async (
  fundingId: string,
  color: string,
  size: string,
  quantity: number
): Promise<KakaoPayReadyResult> => {
  const user = await requireUser();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("phone_number, address")
    .eq("id", user.id)
    .single();

  if (profileError) throwFundingError(profileError, "회원 정보를 확인하지 못했습니다.");
  if (!profile?.phone_number?.trim() || !profile.address?.trim()) {
    throw new Error("결제 전에 마이페이지에서 전화번호와 배송지를 입력해주세요.");
  }

  return invokePaymentFunction<KakaoPayReadyResult>("kakaopay-ready", {
    fundingId,
    color,
    size,
    quantity,
    returnUrl: getAppUrl(),
  });
};

export const approveKakaoPayFunding = async (
  participationId: string,
  pgToken: string
): Promise<{ success: boolean; funding_id: string }> =>
  invokePaymentFunction("kakaopay-approve", { participationId, pgToken });

export const cancelFundingParticipation = async (
  participationId: string,
  reason = "사용자 펀딩 참여 취소"
): Promise<{ success: boolean; refunded: boolean; funding_id?: string }> =>
  invokePaymentFunction("kakaopay-cancel", { participationId, reason });

export const fetchMyFundingParticipations = async (): Promise<MyFundingParticipation[]> => {
  await requireUser();
  const { data, error } = await supabase.rpc("get_my_funding_participations");

  if (error) throwFundingError(error, "펀딩 참여 내역을 불러오지 못했습니다.");
  return (data || []) as MyFundingParticipation[];
};

export const fetchFundingParticipants = async (fundingId: string): Promise<FundingParticipation[]> => {
  await requireUser();
  const { data, error } = await supabase.rpc("get_funding_participants", {
    p_funding_id: fundingId,
  });

  if (error) throwFundingError(error, "참여자 목록을 불러오지 못했습니다.");
  return (data || []) as FundingParticipation[];
};

export const updateFundingParticipationStatus = async (
  participationId: string,
  status: FundingParticipationStatus
): Promise<void> => {
  await requireUser();
  const { error } = await supabase.rpc("update_funding_participation_status", {
    p_participation_id: participationId,
    p_status: status,
  });

  if (error) throwFundingError(error, "참여 상태를 변경하지 못했습니다.");
};
