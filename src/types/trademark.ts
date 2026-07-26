export type TrademarkScreeningSource = "upload" | "final_design";
export type TrademarkScreeningDecision = "clear" | "review" | "blocked";
export type TrademarkRiskLevel = "low" | "medium" | "high";
export type TrademarkAnalysisStatus = "completed" | "unavailable";
export type TrademarkMarkSource = "visual" | "upload";

export type TrademarkBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TrademarkCandidateRegion = {
  id: string;
  label: string;
  candidateType: "text" | "symbol" | "pattern" | "combined" | "unknown";
  boundingBox: TrademarkBoundingBox;
  confidence: number;
  evidence: string;
};

export type TrademarkNormalizationResult = {
  method:
    | "original"
    | "rotation"
    | "mirror"
    | "perspective"
    | "wrinkle"
    | "low_resolution";
  similarity: number;
  evidence: string;
};

export type TrademarkSimilarityScores = {
  text: number;
  shape: number;
  color: number;
  placement: number;
  productClass: number;
  transformation: number;
  composite: number;
};

export type DetectedTrademarkMark = {
  displayName: string;
  normalizedName: string;
  confidence: number;
  evidence: string;
  matchType: "wordmark" | "symbol" | "combined" | "trade_dress" | "unknown";
  isGloballyRecognized: boolean;
  likelyThirdPartyBrand: boolean;
  candidateRegionId: string | null;
  source: TrademarkMarkSource;
  normalizationResults: TrademarkNormalizationResult[];
  similarityScores: TrademarkSimilarityScores;
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
  analysis_status: TrademarkAnalysisStatus;
  analysis_summary: string;
  candidate_regions: TrademarkCandidateRegion[];
  similarity_scores: TrademarkSimilarityScores;
  composite_risk_score: number;
  decision_factors: string[];
  source_priority_applied: boolean;
  parent_screening_id: string | null;
  supersedes_screening_id: string | null;
  screening_version: number;
  automated_decision: TrademarkScreeningDecision;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  reason: string;
  created_at: string;
};

export type TrademarkScreeningResult = TrademarkScreening & {
  disclaimer: string;
};
