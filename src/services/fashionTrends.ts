import { supabase } from "@/lib/supabase";

export type GarmentTrendType =
  | "short_sleeve"
  | "long_sleeve"
  | "hoodie"
  | "sweatshirt"
  | "jacket"
  | "short_pants"
  | "long_pants";

export interface FashionTrendItem {
  keyword: string;
  rank: number;
}

export interface FashionTrendResponse {
  source: string;
  sourceUrl: string;
  trends: Record<GarmentTrendType, FashionTrendItem[]>;
  fetchedAt: string;
  expiresAt: string;
  stale: boolean;
  fallback: boolean;
}

export const FASHION_TREND_REFRESH_MS = 30 * 60 * 1000;

export const fetchFashionTrends =
  async (): Promise<FashionTrendResponse> => {
    const { data, error } = await supabase.functions.invoke(
      "get-fashion-trends",
      { body: {} },
    );

    if (error) {
      throw new Error(error.message || "패션 트렌드를 불러오지 못했습니다.");
    }

    if (!data?.trends) {
      throw new Error(data?.error || "패션 트렌드 데이터가 없습니다.");
    }

    return data as FashionTrendResponse;
  };

