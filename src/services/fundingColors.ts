import { supabase } from "@/lib/supabase";
import type { ColorImageStatus, ColorView, FundingColor, FundingColorImage } from "@/lib/funding-colors";
import { uploadDetailPageImage } from "@/services/detailPage";

// 컬러 옵션 데이터는 funding_colors / funding_color_images 가 기준이다.
// 조회는 RLS(공개: 활성 컬러·승인 이미지 / 제작자·관리자: 전체), 변경은 모두 서버 RPC 로만 한다.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type ColorRow = { id: string; funding_id: string; name: string; hex: string | null; sort_order: number; is_base: boolean; status: string };
type ImageRow = {
  id: string; color_id: string; view: ColorView; status: ColorImageStatus; source: FundingColorImage["source"];
  image_url: string | null; error_message: string | null; created_at: string;
};

const mapImage = (row: ImageRow): FundingColorImage => ({
  id: row.id,
  colorId: row.color_id,
  view: row.view,
  status: row.status,
  source: row.source,
  url: row.image_url,
  errorMessage: row.error_message,
  createdAt: row.created_at,
});

export const fetchFundingColors = async (fundingId: string): Promise<FundingColor[]> => {
  const [{ data: colors, error }, { data: images, error: imageError }] = await Promise.all([
    db.from("funding_colors").select("id, funding_id, name, hex, sort_order, is_base, status")
      .eq("funding_id", fundingId).eq("status", "active").order("sort_order", { ascending: true }),
    db.from("funding_color_images").select("id, color_id, view, status, source, image_url, error_message, created_at")
      .eq("funding_id", fundingId).order("created_at", { ascending: false }).limit(200),
  ]);
  if (error) throw error;
  if (imageError) throw imageError;
  const byColor = new Map<string, FundingColorImage[]>();
  for (const row of (images ?? []) as ImageRow[]) {
    const list = byColor.get(row.color_id) ?? [];
    list.push(mapImage(row));
    byColor.set(row.color_id, list);
  }
  return ((colors ?? []) as ColorRow[]).map((row) => {
    const list = byColor.get(row.id) ?? [];
    return {
      id: row.id,
      fundingId: row.funding_id,
      name: row.name,
      hex: row.hex,
      sortOrder: row.sort_order,
      isBase: row.is_base,
      approved: {
        front: list.find((image) => image.view === "front" && image.status === "approved"),
        back: list.find((image) => image.view === "back" && image.status === "approved"),
      },
      candidates: list.filter((image) => ["generating", "preview", "failed"].includes(image.status)),
    };
  });
};

export const canManageFunding = async (fundingId: string) => {
  const { data } = await db.rpc("can_manage_funding", { p_funding_id: fundingId });
  return data === true;
};

export const saveFundingColor = async (fundingId: string, input: { colorId?: string | null; name: string; hex?: string | null }) => {
  const { error } = await db.rpc("save_funding_color", {
    p_funding_id: fundingId, p_color_id: input.colorId ?? null, p_name: input.name, p_hex: input.hex || null,
  });
  if (error) throw error;
};

export const deleteFundingColor = async (colorId: string): Promise<{ existingOrders: number }> => {
  const { data, error } = await db.rpc("delete_funding_color", { p_color_id: colorId });
  if (error) throw error;
  return { existingOrders: Number(data?.existing_orders ?? 0) };
};

export const reorderFundingColors = async (fundingId: string, colorIds: string[]) => {
  const { error } = await db.rpc("reorder_funding_colors", { p_funding_id: fundingId, p_color_ids: colorIds });
  if (error) throw error;
};

export const setBaseFundingColor = async (colorId: string) => {
  const { error } = await db.rpc("set_funding_base_color", { p_color_id: colorId });
  if (error) throw error;
};

export const reviewFundingColorImage = async (imageId: string, action: "approve" | "reject") => {
  const { error } = await db.rpc("review_funding_color_image", { p_image_id: imageId, p_action: action });
  if (error) throw error;
};

/** 이미지 교체: 직접 올린 사진을 해당 컬러·면의 노출 이미지로 등록 */
export const replaceFundingColorImage = async (colorId: string, view: ColorView, file: File) => {
  const url = await uploadDetailPageImage(file);
  const { error } = await db.rpc("register_funding_color_image_upload", { p_color_id: colorId, p_view: view, p_image_url: url });
  if (error) throw error;
};

/** AI 컬러 이미지 생성(결과는 승인 대기 preview) */
export const generateFundingColorImage = async (colorId: string, view: ColorView): Promise<{ imageId: string; url: string }> => {
  const { data, error } = await supabase.functions.invoke("generate-color-image", { body: { colorId, view } });
  if (error) {
    let message = error.message;
    try {
      const context = (error as { context?: Response }).context;
      const body = context ? await context.json() : null;
      if (body?.error) message = body.error;
    } catch {
      // 응답 본문을 읽지 못하면 기본 메시지 사용
    }
    throw new Error(message || "AI 컬러 이미지를 만들지 못했습니다.");
  }
  if (!data?.url) throw new Error(data?.error || "AI 컬러 이미지를 만들지 못했습니다.");
  return { imageId: data.imageId, url: data.url };
};

export type ColorOrderSummary = {
  colorId: string | null;
  colorName: string;
  hex: string | null;
  status: "active" | "deleted" | "unlinked";
  paidQuantity: number;
  paidOrders: number;
  pendingQuantity: number;
};

export const fetchFundingColorSummary = async (fundingId: string): Promise<ColorOrderSummary[]> => {
  const { data, error } = await db.rpc("get_funding_color_summary", { p_funding_id: fundingId });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    colorId: (row.color_id as string) ?? null,
    colorName: row.color_name as string,
    hex: (row.hex as string) ?? null,
    status: row.color_status as ColorOrderSummary["status"],
    paidQuantity: Number(row.paid_quantity ?? 0),
    paidOrders: Number(row.paid_orders ?? 0),
    pendingQuantity: Number(row.pending_quantity ?? 0),
  }));
};

export const colorErrorMessage = (error: unknown, fallback = "처리하지 못했습니다.") =>
  (error as { message?: string } | null)?.message || fallback;
