import { supabase } from "@/lib/supabase";
import type { BuyerRow } from "@/lib/buyer-management";

// 구매자 명단은 SECURITY DEFINER RPC 로만 조회한다.
// 서버가 매 호출마다 로그인 · 펀딩 소유자(creator_id) · 관리자 orders.pii 권한을 다시 확인하므로
// 이 파일은 권한을 판단하지 않는다.

export type FundingBuyerMeta = {
  id: string;
  product_name: string;
  brand_name: string | null;
  creator_name: string | null;
  size_options: string[];
  color_options: string[];
};

export type FundingBuyersResult = {
  access: "creator" | "admin";
  funding: FundingBuyerMeta;
  rows: BuyerRow[];
};

export type BuyerExportScope = "all" | "filtered" | "selected";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args: Record<string, unknown>) => (supabase.rpc as any)(name, args);

export class BuyerAccessError extends Error {}

const toError = (error: { code?: string; message?: string } | null, fallback: string) => {
  if (error?.code === "42501") return new BuyerAccessError(error.message || "구매자 정보를 볼 권한이 없습니다.");
  return new Error(error?.message || fallback);
};

const requireSession = async () => {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new BuyerAccessError("로그인이 필요합니다.");
};

export const fetchFundingBuyers = async (fundingId: string): Promise<FundingBuyersResult> => {
  await requireSession();
  const { data, error } = await rpc("get_funding_buyers", { p_funding_id: fundingId });
  if (error) throw toError(error, "구매자 목록을 불러오지 못했습니다.");
  return data as FundingBuyersResult;
};

/** 다운로드 직전 서버에서 권한과 데이터를 다시 받아온다. ids 가 없으면 펀딩 전체. */
export const exportFundingBuyers = async (
  fundingId: string,
  ids: string[] | null,
  scope: BuyerExportScope,
): Promise<{ funding: FundingBuyerMeta; rows: BuyerRow[]; count: number }> => {
  await requireSession();
  const { data, error } = await rpc("export_funding_buyers", { p_funding_id: fundingId, p_ids: ids, p_scope: scope });
  if (error) throw toError(error, "엑셀 데이터를 만들지 못했습니다.");
  return data as { funding: FundingBuyerMeta; rows: BuyerRow[]; count: number };
};
