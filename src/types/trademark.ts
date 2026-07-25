export type TrademarkScreeningSource = "upload" | "final_design";
export type TrademarkScreeningDecision = "clear" | "review" | "blocked";
export type TrademarkRiskLevel = "low" | "medium" | "high";

export type DetectedTrademarkMark = {
  displayName: string;
  normalizedName: string;
  confidence: number;
  evidence: string;
  matchType: "wordmark" | "symbol" | "combined" | "trade_dress" | "unknown";
  isGloballyRecognized: boolean;
  likelyThirdPartyBrand: boolean;
};

export type KiprisTrademarkMatch = {
  query: string;
  trademarkName: string | null;
  applicationNumber: string | null;
  registrationNumber: string | null;
  applicationStatus: string | null;
  applicantName: string | null;
  classification: string | null;
  imageUrl: string | null;
  exactNameMatch: boolean;
  apparelClassMatch: boolean;
};

export type TrademarkScreening = {
  id: string;
  user_id?: string;
  image_sha256?: string;
  source: TrademarkScreeningSource;
  decision: TrademarkScreeningDecision;
  risk_level: TrademarkRiskLevel;
  detected_marks: DetectedTrademarkMark[];
  recognized_text: string[];
  kipris_checked: boolean;
  kipris_matches: KiprisTrademarkMatch[];
  reason: string;
  created_at: string;
};

export type TrademarkScreeningResult = TrademarkScreening & {
  disclaimer: string;
};
