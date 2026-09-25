import { supabase } from "@/lib/supabase";
import type {
  CreateFundingInput,
  Funding,
  KakaoPayReadyResult,
  MyFundingParticipation,
  FundingParticipation,
  FundingParticipationStatus,
  FundingPaymentIntent,
  MyFundingPaymentIntent,
  FundingStatus,
  ShippingDetails,
  ProductionStage,
  ShippingStatus,
  SellerFundingDashboardRow,
  SellerDashboardTotals,
  AdminFundingOverview,
} from "@/types/funding";
import { getAppUrl } from "@/utils/appUrl";
import { getMinimumOrderQuantity } from "@/lib/minimum-order-quantity";

const FUNDING_WITH_BRAND_SELECT = `
  *,
  brand:brands(*, creator_profile:creator_profiles(*))
`;

const requireUser = async () => {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  return user;
};

export const resolveDefaultFabricUnitCost = (
  material: string,
  clothType = "",
) => {
  if (/니트|knit/i.test(clothType)) return 13_000;
  return /데님|denim|레더|leather|가죽/i.test(material)
    ? 15_000
    : 10_000;
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
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id")
    .eq("owner_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (brandError) throw brandError;
  if (!brand) {
    throw new Error("펀딩을 만들기 전에 마이페이지에서 제작자 프로필과 내 브랜드를 등록해주세요.");
  }
  const minimumOrderQuantity = getMinimumOrderQuantity(
    input.clothType,
    input.material,
  );
  const { data, error } = await supabase
    .from("fundings")
    .insert({
      creator_id: user.id,
      brand_id: brand.id,
      product_name: input.productName,
      cloth_type: input.clothType,
      material: input.material,
      color: input.color || null,
      size: input.size,
      color_options: input.color ? [input.color] : ["기본 색상"],
      size_options: input.sizeOptions?.length
        ? input.sizeOptions
        : input.size
          ? [input.size]
          : ["FREE"],
      measurements: input.measurements,
      image_url: input.imageUrl,
      image_path: input.imagePath,
      trademark_screening_id: input.trademarkScreeningId,
      trademark_screening_required: true,
      description: input.description,
      estimate_direct_unit_min: input.estimateDirectUnitMin ?? null,
      estimate_direct_unit_max: input.estimateDirectUnitMax ?? null,
      estimate_development_total: input.estimateDevelopmentTotal ?? null,
      ...(typeof input.price === "number" && input.price >= 0 ? { price: input.price } : {}),
      fabric_unit_cost: resolveDefaultFabricUnitCost(
        input.material,
        input.clothType,
      ),
      moq: minimumOrderQuantity,
      current_orders: 0,
      funding_days: 30,
      status: "draft",
    })
    .select(FUNDING_WITH_BRAND_SELECT)
    .single();

  if (error) throw error;
  return data as Funding;
};

export const fetchFunding = async (id: string): Promise<Funding> => {
  // 승인 전 펀딩은 작성자와 관리자만 조회할 수 있습니다. 새 탭에서 바로
  // 진입해도 Supabase가 저장된 세션을 먼저 복원한 뒤 RLS 조회를 수행하도록
  // 세션 초기화를 명시적으로 기다립니다.
  await supabase.auth.getSession();

  const { data, error } = await supabase
    .from("fundings")
    .select(FUNDING_WITH_BRAND_SELECT)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as Funding;
};

export const fetchApprovedFundings = async (): Promise<Funding[]> => {
  const { data, error } = await supabase
    .from("fundings")
    .select(FUNDING_WITH_BRAND_SELECT)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Funding[];
};

export const fetchMyFundings = async (): Promise<Funding[]> => {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("fundings")
    .select(FUNDING_WITH_BRAND_SELECT)
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Funding[];
};

export const updateFunding = async (
  id: string,
  updates: Pick<
    Funding,
    | "product_name"
    | "description"
    | "cloth_type"
    | "material"
    | "moq"
    | "price"
    | "estimate_direct_unit_min"
    | "estimate_direct_unit_max"
    | "estimate_development_total"
    | "fabric_unit_cost"
    | "funding_days"
    | "color_options"
    | "size_options"
    | "measurements"
  >
): Promise<Funding> => {
  await requireUser();
  const { error } = await supabase.rpc("update_creator_funding", {
    p_funding_id: id,
    p_product_name: updates.product_name,
    p_description: updates.description,
    p_moq: Math.max(
      getMinimumOrderQuantity(updates.cloth_type, updates.material),
      updates.moq,
    ),
    p_price: updates.price,
    p_estimate_direct_unit_min: updates.estimate_direct_unit_min,
    p_estimate_direct_unit_max: updates.estimate_direct_unit_max,
    p_estimate_development_total: updates.estimate_development_total,
    p_fabric_unit_cost: Math.max(0, updates.fabric_unit_cost),
    p_funding_days: updates.funding_days,
    p_color_options: updates.color_options,
    p_size_options: updates.size_options,
    p_measurements: updates.measurements,
  });

  if (error) throw error;
  return fetchFunding(id);
};

export const submitFundingForReview = async (id: string): Promise<Funding> => {
  await requireUser();
  const { error } = await supabase.rpc("submit_funding_for_review", {
    p_funding_id: id,
  });
  if (error) throw error;
  return fetchFunding(id);
};

export const fetchAllFundings = async (): Promise<Funding[]> => {
  const { data, error } = await supabase
    .from("fundings")
    .select(`${FUNDING_WITH_BRAND_SELECT}, trademark_screening:trademark_screenings(*)`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Funding[];
};

export const reviewFunding = async (
  id: string,
  status: Extract<FundingStatus, "approved" | "rejected">,
  adminComment: string,
  reviewValues: Pick<Funding, "moq" | "price">
): Promise<void> => {
  await requireUser();
  const { error } = await supabase.rpc("review_funding_with_trademark", {
    p_funding_id: id,
    p_status: status,
    p_admin_comment: adminComment,
    p_moq: reviewValues.moq,
    p_price: reviewValues.price,
  });

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

const invokeAuthenticatedFunction = async <T>(
  name: string,
  body: Record<string, unknown>,
  fallbackMessage: string,
): Promise<T> => {
  await requireUser();
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const response = typeof context.clone === "function" ? context.clone() : context;
        const payload = await response.json();
        if (typeof payload?.error === "string" && payload.error.trim()) {
          message = payload.error;
        } else if (typeof payload?.message === "string" && payload.message.trim()) {
          message = payload.message;
        }
      } catch {
        // Supabase의 기본 오류 메시지를 사용합니다.
      }
    }

    if (/401|unauthorized|invalid jwt|jwt expired/i.test(message)) {
      throw new Error("로그인 정보가 만료되었습니다. 다시 로그인해주세요.");
    }
    throw new Error(message || fallbackMessage);
  }

  if (data?.error) throw new Error(data.error);
  return data as T;
};

export const deleteFunding = async (
  fundingId: string,
  reason: string,
): Promise<{ success: boolean; warnings?: string[] }> =>
  invokeAuthenticatedFunction("delete-funding", { fundingId, reason }, "펀딩을 삭제하지 못했습니다.");

export const cancelFundingParticipantByCreator = async (
  participationId: string,
  reason: string,
): Promise<{
  success: boolean;
  refunded: boolean;
  payment_provider?: string;
  funding_id?: string;
}> =>
  invokeAuthenticatedFunction(
    "creator-cancel-participation",
    { participationId, reason },
    "참여 취소를 처리하지 못했습니다.",
  );

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

  return invokeAuthenticatedFunction<KakaoPayReadyResult>("kakaopay-ready", {
    fundingId,
    color,
    size,
    quantity,
    returnUrl: getAppUrl(),
  }, "결제 처리 중 오류가 발생했습니다.");
};

export const approveKakaoPayFunding = async (
  participationId: string,
  pgToken: string
): Promise<{ success: boolean; funding_id: string }> =>
  invokeAuthenticatedFunction(
    "kakaopay-approve",
    { participationId, pgToken },
    "결제 승인 중 오류가 발생했습니다.",
  );

export const cancelFundingParticipation = async (
  participationId: string,
  reason = "사용자 펀딩 참여 취소"
): Promise<{ success: boolean; refunded: boolean; funding_id?: string }> =>
  invokeAuthenticatedFunction(
    "kakaopay-cancel",
    { participationId, reason },
    "결제 취소 중 오류가 발생했습니다.",
  );

export const fetchMyFundingParticipations = async (): Promise<MyFundingParticipation[]> => {
  await requireUser();
  const { data, error } = await supabase.rpc("get_my_funding_participations");

  if (error) throwFundingError(error, "펀딩 참여 내역을 불러오지 못했습니다.");
  return (data || []) as MyFundingParticipation[];
};

export const fetchMyFundingPaymentIntents = async (): Promise<MyFundingPaymentIntent[]> => {
  await requireUser();
  const { data, error } = await supabase.rpc("get_my_funding_payment_intents");
  if (error) throwFundingError(error, "결제 예정 내역을 불러오지 못했습니다.");
  return (data || []) as MyFundingPaymentIntent[];
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

export const registerFundingPaymentIntent = async (
  fundingId: string,
  color: string,
  size: string,
  quantity: number
): Promise<string> => {
  await requireUser();
  const { data, error } = await supabase.rpc("register_funding_payment_intent", {
    p_funding_id: fundingId,
    p_color: color,
    p_size: size,
    p_quantity: quantity,
  });
  if (error) throwFundingError(error, "결제 예정 등록을 처리하지 못했습니다.");
  return data as string;
};

export const fetchFundingPaymentIntents = async (fundingId: string): Promise<FundingPaymentIntent[]> => {
  await requireUser();
  const { data, error } = await supabase.rpc("get_funding_payment_intents", { p_funding_id: fundingId });
  if (error) throwFundingError(error, "결제 예정자 목록을 불러오지 못했습니다.");
  return (data || []) as FundingPaymentIntent[];
};

export const createMockFundingOrder = async (
  fundingId: string,
  color: string,
  size: string,
  quantity: number,
  shipping: ShippingDetails
): Promise<{ participationId: string; orderNumber: string; totalAmount: number }> => {
  await requireUser();
  const { data, error } = await supabase.rpc("create_mock_funding_order", {
    p_funding_id: fundingId,
    p_color: color,
    p_size: size,
    p_quantity: quantity,
    p_orderer_name: shipping.ordererName,
    p_orderer_phone: shipping.ordererPhone,
    p_orderer_email: shipping.ordererEmail,
    p_recipient_name: shipping.recipientName,
    p_recipient_phone: shipping.recipientPhone,
    p_postal_code: shipping.postalCode,
    p_address: shipping.address,
    p_address_detail: shipping.addressDetail,
    p_delivery_message: shipping.deliveryMessage,
    p_agree_privacy: shipping.agreePrivacy,
  });

  if (error) throwFundingError(error, "모의결제 참여를 처리하지 못했습니다.");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("모의결제 참여 내역을 만들지 못했습니다.");
  return {
    participationId: row.participation_id as string,
    orderNumber: row.partner_order_id as string,
    totalAmount: row.total_amount as number,
  };
};

export const updateFundingOrderFulfillment = async (
  participationId: string,
  updates: {
    productionStage?: ProductionStage;
    shippingStatus?: ShippingStatus;
    trackingNumber?: string;
  }
): Promise<void> => {
  await requireUser();
  const { error } = await supabase.rpc("update_funding_order_fulfillment", {
    p_participation_id: participationId,
    p_production_stage: updates.productionStage ?? null,
    p_shipping_status: updates.shippingStatus ?? null,
    p_tracking_number: updates.trackingNumber ?? null,
  });
  if (error) throwFundingError(error, "주문 진행 상태를 변경하지 못했습니다.");
};

export const fetchSellerFundingDashboard = async (): Promise<SellerFundingDashboardRow[]> => {
  await requireUser();
  const { data, error } = await supabase.rpc("get_seller_funding_dashboard");
  if (error) throwFundingError(error, "판매자 대시보드를 불러오지 못했습니다.");
  return (data || []) as SellerFundingDashboardRow[];
};

export const fetchSellerDashboardTotals = async (): Promise<SellerDashboardTotals> => {
  await requireUser();
  const { data, error } = await supabase.rpc("get_seller_dashboard_totals");
  if (error) throwFundingError(error, "판매자 대시보드 요약을 불러오지 못했습니다.");
  const row = Array.isArray(data) ? data[0] : data;
  return (row || {
    total_expected_revenue: 0,
    total_participants: 0,
    total_quantity: 0,
    avg_funding_rate: 0,
  }) as SellerDashboardTotals;
};

export const fetchAdminFundingOverview = async (): Promise<AdminFundingOverview> => {
  await requireUser();
  const { data, error } = await supabase.rpc("get_admin_funding_overview");
  if (error) throwFundingError(error, "관리자 펀딩 현황을 불러오지 못했습니다.");
  const row = Array.isArray(data) ? data[0] : data;
  return (row || {
    total_fundings: 0,
    active_fundings: 0,
    total_participants: 0,
    total_quantity: 0,
    total_mock_amount: 0,
    total_real_amount: 0,
    avg_funding_rate: 0,
  }) as AdminFundingOverview;
};

export const uploadAndShareFundingSample = async (
  fundingId: string,
  file: File,
  note: string
): Promise<{ imageUrl: string; imagePath: string }> => {
  const user = await requireUser();
  if (!file.type.startsWith("image/")) throw new Error("샘플 이미지만 업로드할 수 있습니다.");
  if (file.size > 10 * 1024 * 1024) throw new Error("샘플 이미지는 10MB 이하만 업로드할 수 있습니다.");

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const imagePath = `${user.id}/${fundingId}/${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("funding-samples").upload(imagePath, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) throwFundingError(uploadError, "샘플 이미지를 업로드하지 못했습니다.");

  const { data: publicData } = supabase.storage.from("funding-samples").getPublicUrl(imagePath);
  const { error } = await supabase.rpc("share_funding_sample", {
    p_funding_id: fundingId,
    p_image_url: publicData.publicUrl,
    p_image_path: imagePath,
    p_note: note,
  });
  if (error) throwFundingError(error, "샘플 공유 정보를 저장하지 못했습니다.");
  return { imageUrl: publicData.publicUrl, imagePath };
};
