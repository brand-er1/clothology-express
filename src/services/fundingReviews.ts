import { supabase } from "@/lib/supabase";

// 펀딩 리뷰 · 문의. 작성 권한(실제 구매·결제 완료·미취소·배송 완료·주문당 1개·모의결제 정책)은
// 서버 RPC 와 DB 트리거가 매번 다시 검증하므로 이 파일은 권한을 판단하지 않는다.

export type ReviewSort = "latest" | "rating_desc" | "rating_asc";
export type SizeFeedback = "small" | "fit" | "large";
export type QualityFeedback = "poor" | "average" | "good";

export type FundingReview = {
  id: string;
  rating: number;
  content: string;
  image_paths: string[];
  nickname: string;
  selected_color: string | null;
  selected_size: string | null;
  quantity: number | null;
  size_feedback: SizeFeedback | null;
  quality_feedback: QualityFeedback | null;
  verified_purchase: boolean;
  purchase_type: "real" | "mock";
  is_mine: boolean;
  reported_by_me: boolean;
  created_at: string;
  edited_at: string | null;
};

export type ReviewSummary = {
  average: number;
  count: number;
  photo_count?: number;
  distribution: Record<string, number>;
  size?: Record<SizeFeedback, number>;
  quality?: Record<QualityFeedback, number>;
};

export type ReviewPhoto = { review_id: string; path: string };

export type FundingReviewsResult = {
  summary: ReviewSummary;
  photos: ReviewPhoto[];
  filtered_count: number;
  rows: FundingReview[];
};

/** 작성자 본인에게만 내려오는 리뷰(수정용) */
export type MyReview = {
  id: string;
  rating: number;
  content: string;
  image_paths: string[];
  size_feedback: SizeFeedback | null;
  quality_feedback: QualityFeedback | null;
  status: "visible" | "hidden" | "removed";
  created_at: string;
  edited_at: string | null;
};

export type ReviewBlockReason =
  | "not_owner" | "cancelled" | "unpaid" | "mock_payment" | "not_delivered" | "already_reviewed" | "login_required";

export type ReviewEligibility = {
  participation_id: string;
  order_number: string | null;
  selected_color: string;
  selected_size: string;
  quantity: number;
  ordered_at: string;
  payment_type: "REAL" | "MOCK";
  shipping_status: string;
  can_review: boolean;
  block_reason: ReviewBlockReason | null;
  review_id: string | null;
  review: MyReview | null;
};

export type MyReviewState = {
  participation_id: string;
  funding_id: string;
  can_review: boolean;
  block_reason: ReviewBlockReason | null;
  review: MyReview | null;
};

/** 리뷰 작성/수정 다이얼로그가 필요로 하는 주문 정보 */
export type ReviewTarget = {
  participationId: string;
  label: string;
  review: MyReview | null;
};

export type CreatorReview = Omit<FundingReview, "is_mine" | "reported_by_me" | "verified_purchase"> & {
  order_number: string | null;
  status: "visible" | "hidden";
  is_public: boolean;
};

export type ReviewReportReason = "spam" | "abusive" | "unrelated" | "privacy" | "false_info" | "other";

export type FundingInquiry = {
  id: string;
  subject: string;
  content: string;
  status: "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
  created_at: string;
  resolved_at: string | null;
};

export const REVIEW_BUCKET = "funding-reviews";
export const MAX_REVIEW_IMAGES = 5;
export const MIN_REVIEW_LENGTH = 10;
export const MAX_REVIEW_LENGTH = 1000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export const SIZE_FEEDBACK_LABEL: Record<SizeFeedback, string> = { small: "작아요", fit: "적당해요", large: "커요" };
export const QUALITY_FEEDBACK_LABEL: Record<QualityFeedback, string> = { poor: "아쉬워요", average: "보통이에요", good: "좋아요" };

export const REPORT_REASON_LABEL: Record<ReviewReportReason, string> = {
  spam: "광고·홍보성",
  abusive: "욕설·비방",
  unrelated: "상품과 무관한 내용",
  privacy: "개인정보 노출",
  false_info: "허위 사실",
  other: "기타",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args: Record<string, unknown> = {}) => (supabase.rpc as any)(name, args);

const fail = (error: { message?: string } | null, fallback: string): never => {
  throw new Error(error?.message || fallback);
};

export const formatRating = (value: number) => (Number.isFinite(value) ? value.toFixed(1) : "0.0");

export const formatReviewDate = (value: string) => new Date(value).toLocaleDateString("ko-KR");

export const reviewImageUrl = (path: string) => supabase.storage.from(REVIEW_BUCKET).getPublicUrl(path).data.publicUrl;

export const fetchFundingReviews = async (
  fundingId: string,
  sort: ReviewSort = "latest",
  limit = 10,
  offset = 0,
  photoOnly = false,
): Promise<FundingReviewsResult> => {
  const { data, error } = await rpc("get_funding_reviews", {
    p_funding_id: fundingId, p_sort: sort, p_limit: limit, p_offset: offset, p_photo_only: photoOnly,
  });
  if (error) fail(error, "리뷰를 불러오지 못했습니다.");
  return data as FundingReviewsResult;
};

export const fetchMyReviewEligibility = async (fundingId: string): Promise<ReviewEligibility[]> => {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return [];
  const { data, error } = await rpc("get_my_funding_review_eligibility", { p_funding_id: fundingId });
  if (error) fail(error, "리뷰 작성 가능 여부를 확인하지 못했습니다.");
  return (data ?? []) as ReviewEligibility[];
};

/** 마이페이지 '참여한 펀딩'의 주문별 리뷰 상태 */
export const fetchMyReviewStates = async (): Promise<Map<string, MyReviewState>> => {
  const { data, error } = await rpc("get_my_funding_review_states");
  if (error) fail(error, "리뷰 상태를 불러오지 못했습니다.");
  return new Map(((data ?? []) as MyReviewState[]).map((row) => [row.participation_id, row]));
};

export const validateReviewImage = (file: File) => {
  if (!IMAGE_TYPES[file.type]) return "JPG, PNG, WEBP 이미지만 첨부할 수 있습니다.";
  if (file.size > MAX_IMAGE_BYTES) return "사진은 한 장당 5MB 이하만 첨부할 수 있습니다.";
  return null;
};

const removeReviewImages = async (paths: string[]) => {
  if (paths.length) await supabase.storage.from(REVIEW_BUCKET).remove(paths).catch(() => undefined);
};

/** 사진은 본인 폴더(funding-reviews/<uid>/...)에만 올라간다(Storage 정책). */
const uploadReviewImages = async (files: File[]) => {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error("로그인이 필요합니다.");
  const paths: string[] = [];
  for (const file of files) {
    const invalid = validateReviewImage(file);
    if (invalid) {
      await removeReviewImages(paths);
      throw new Error(invalid);
    }
    const path = `${userId}/${crypto.randomUUID()}.${IMAGE_TYPES[file.type]}`;
    const { error } = await supabase.storage.from(REVIEW_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      await removeReviewImages(paths);
      throw new Error("사진을 업로드하지 못했습니다.");
    }
    paths.push(path);
  }
  return paths;
};

export type ReviewInput = {
  rating: number;
  content: string;
  /** 이미 업로드되어 유지할 사진 경로(수정 시) */
  keptPaths: string[];
  /** 새로 첨부한 사진 */
  newImages: File[];
  sizeFeedback: SizeFeedback | null;
  qualityFeedback: QualityFeedback | null;
};

const reviewArgs = (input: ReviewInput, paths: string[]) => ({
  p_rating: input.rating,
  p_content: input.content,
  p_image_paths: paths,
  p_size_feedback: input.sizeFeedback,
  p_quality_feedback: input.qualityFeedback,
});

export const createFundingReview = async (participationId: string, input: ReviewInput) => {
  if (input.keptPaths.length + input.newImages.length > MAX_REVIEW_IMAGES) {
    throw new Error(`사진은 최대 ${MAX_REVIEW_IMAGES}장까지 첨부할 수 있습니다.`);
  }
  const uploaded = await uploadReviewImages(input.newImages);
  const { data, error } = await rpc("create_funding_review", {
    p_participation_id: participationId,
    ...reviewArgs(input, [...input.keptPaths, ...uploaded]),
  });
  if (error) {
    await removeReviewImages(uploaded);
    fail(error, "리뷰를 등록하지 못했습니다.");
  }
  return data as string;
};

export const updateMyFundingReview = async (reviewId: string, input: ReviewInput) => {
  if (input.keptPaths.length + input.newImages.length > MAX_REVIEW_IMAGES) {
    throw new Error(`사진은 최대 ${MAX_REVIEW_IMAGES}장까지 첨부할 수 있습니다.`);
  }
  const uploaded = await uploadReviewImages(input.newImages);
  const { data, error } = await rpc("update_my_funding_review", {
    p_review_id: reviewId,
    ...reviewArgs(input, [...input.keptPaths, ...uploaded]),
  });
  if (error) {
    await removeReviewImages(uploaded);
    fail(error, "리뷰를 수정하지 못했습니다.");
  }
  // 수정으로 빠진 사진은 서버가 알려준 경로만 정리한다.
  await removeReviewImages(((data as { removed_paths?: string[] } | null)?.removed_paths) ?? []);
};

export const deleteMyFundingReview = async (reviewId: string) => {
  const { data, error } = await rpc("delete_my_funding_review", { p_review_id: reviewId });
  if (error) fail(error, "리뷰를 삭제하지 못했습니다.");
  await removeReviewImages((data ?? []) as string[]);
};

export const reportFundingReview = async (reviewId: string, reason: ReviewReportReason, detail: string) => {
  const { error } = await rpc("report_funding_review", { p_review_id: reviewId, p_reason: reason, p_detail: detail || null });
  if (error) fail(error, "리뷰를 신고하지 못했습니다.");
};

export class ReviewAccessError extends Error {}

export type CreatorReviewsResult = {
  funding: { id: string; product_name: string; status: string };
  summary: ReviewSummary;
  rows: CreatorReview[];
};

/** 제작자(또는 관리자) 조회 전용. 권한이 없으면 서버가 42501 로 거부한다. */
export const fetchCreatorFundingReviews = async (fundingId: string): Promise<CreatorReviewsResult> => {
  const { data, error } = await rpc("get_creator_funding_reviews", { p_funding_id: fundingId });
  if (error) {
    if (error.code === "42501") throw new ReviewAccessError(error.message);
    fail(error, "리뷰를 불러오지 못했습니다.");
  }
  return data as CreatorReviewsResult;
};

export const createFundingInquiry = async (fundingId: string, subject: string, content: string) => {
  const { error } = await rpc("create_funding_inquiry", { p_funding_id: fundingId, p_subject: subject, p_content: content });
  if (error) fail(error, "문의를 등록하지 못했습니다.");
};

export const fetchMyFundingInquiries = async (fundingId: string): Promise<FundingInquiry[]> => {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return [];
  const { data, error } = await rpc("list_my_funding_inquiries", { p_funding_id: fundingId });
  if (error) fail(error, "문의 내역을 불러오지 못했습니다.");
  return (data ?? []) as FundingInquiry[];
};

export const REVIEW_BLOCK_LABEL: Record<ReviewBlockReason, string> = {
  not_owner: "본인 주문이 아닙니다",
  cancelled: "취소·환불된 주문",
  unpaid: "결제 완료 후 작성 가능",
  mock_payment: "모의결제 주문은 리뷰 작성 대상이 아닙니다",
  not_delivered: "배송 완료 후 작성 가능",
  already_reviewed: "리뷰 작성 완료",
  login_required: "로그인이 필요합니다",
};
