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

const requireUser = async () => {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  return user;
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

const invokeKakaoPay = async <T>(body: Record<string, unknown>): Promise<T> => {
  await requireUser();
  const { data, error } = await supabase.functions.invoke("kakaopay-payment", { body });

  if (error) {
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = await context.clone().json();
        message = payload.error || message;
      } catch {
        // Supabase's default error message is used when the body is not JSON.
      }
    }
    throw new Error(message);
  }

  return data as T;
};

export const startKakaoPayFunding = async (
  fundingId: string,
  color: string,
  size: string,
  quantity: number
): Promise<KakaoPayReadyResult> => invokeKakaoPay<KakaoPayReadyResult>({
  action: "ready",
  fundingId,
  color,
  size,
  quantity,
});

export const approveKakaoPayFunding = async (
  participationId: string,
  pgToken: string
): Promise<void> => {
  await invokeKakaoPay({
    action: "approve",
    participationId,
    pgToken,
  });
};

export const cancelFundingParticipation = async (participationId: string): Promise<void> => {
  await invokeKakaoPay({ action: "cancel", participationId });
};

export const fetchMyFundingParticipations = async (): Promise<MyFundingParticipation[]> => {
  await requireUser();
  const { data, error } = await supabase.rpc("get_my_funding_participations");

  if (error) throw error;
  return (data || []) as MyFundingParticipation[];
};

export const fetchFundingParticipants = async (fundingId: string): Promise<FundingParticipation[]> => {
  await requireUser();
  const { data, error } = await supabase.rpc("get_funding_participants", {
    p_funding_id: fundingId,
  });

  if (error) throw error;
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

  if (error) throw error;
};
