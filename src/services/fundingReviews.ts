import { supabase } from "@/lib/supabase";

// 펀딩 리뷰 · 문의. 작성 권한(실제 구매·결제 완료·미취소·배송 완료·주문당 1개)은
// 서버 RPC 와 DB 트리거가 매번 다시 검증하므로 이 파일은 권한을 판단하지 않는다.

export type ReviewSort = "latest" | "rating_desc" | "rating_asc";

export type FundingReview = {
  id: string;
  rating: number;
  content: string;
  image_paths: string[];
  nickname: string;
  selected_color: string | null;
  selected_size: string | null;
  quantity: number | null;
  verified_purchase: boolean;
  is_mine: boolean;
  created_at: string;
};

export type ReviewSummary = {
  average: number;
  count: number;
  distribution: Record<string, number>;
};

export type ReviewEligibility = {
  participation_id: string;
  order_number: string | null;
  selected_color: string;
  selected_size: string;
  quantity: number;
  ordered_at: string;
  can_review: boolean;
  block_reason: "not_owner" | "cancelled" | "unpaid" | "not_delivered" | "already_reviewed" | "login_required" | null;
  review_id: string | null;
};

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
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args: Record<string, unknown>) => (supabase.rpc as any)(name, args);

const fail = (error: { message?: string } | null, fallback: string): never => {
  throw new Error(error?.message || fallback);
};

export const reviewImageUrl = (path: string) => supabase.storage.from(REVIEW_BUCKET).getPublicUrl(path).data.publicUrl;

export const fetchFundingReviews = async (
  fundingId: string,
  sort: ReviewSort = "latest",
  limit = 10,
  offset = 0,
): Promise<{ summary: ReviewSummary; rows: FundingReview[] }> => {
  const { data, error } = await rpc("get_funding_reviews", { p_funding_id: fundingId, p_sort: sort, p_limit: limit, p_offset: offset });
  if (error) fail(error, "리뷰를 불러오지 못했습니다.");
  return data as { summary: ReviewSummary; rows: FundingReview[] };
};

export const fetchMyReviewEligibility = async (fundingId: string): Promise<ReviewEligibility[]> => {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return [];
  const { data, error } = await rpc("get_my_funding_review_eligibility", { p_funding_id: fundingId });
  if (error) fail(error, "리뷰 작성 가능 여부를 확인하지 못했습니다.");
  return (data ?? []) as ReviewEligibility[];
};

export const validateReviewImage = (file: File) => {
  if (!IMAGE_TYPES[file.type]) return "JPG, PNG, WEBP 이미지만 첨부할 수 있습니다.";
  if (file.size > MAX_IMAGE_BYTES) return "사진은 한 장당 5MB 이하만 첨부할 수 있습니다.";
  return null;
};

/** 사진은 본인 폴더(funding-reviews/<uid>/...)에만 올라간다(Storage 정책). */
const uploadReviewImages = async (userId: string, files: File[]) => {
  const paths: string[] = [];
  for (const file of files) {
    const invalid = validateReviewImage(file);
    if (invalid) throw new Error(invalid);
    const path = `${userId}/${crypto.randomUUID()}.${IMAGE_TYPES[file.type]}`;
    const { error } = await supabase.storage.from(REVIEW_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      if (paths.length) await supabase.storage.from(REVIEW_BUCKET).remove(paths);
      throw new Error("사진을 업로드하지 못했습니다.");
    }
    paths.push(path);
  }
  return paths;
};

export const createFundingReview = async (input: { participationId: string; rating: number; content: string; images: File[] }) => {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error("로그인이 필요합니다.");
  if (input.images.length > MAX_REVIEW_IMAGES) throw new Error(`사진은 최대 ${MAX_REVIEW_IMAGES}장까지 첨부할 수 있습니다.`);

  const paths = await uploadReviewImages(userId, input.images);
  const { data, error } = await rpc("create_funding_review", {
    p_participation_id: input.participationId,
    p_rating: input.rating,
    p_content: input.content,
    p_image_paths: paths,
  });
  if (error) {
    if (paths.length) await supabase.storage.from(REVIEW_BUCKET).remove(paths);
    fail(error, "리뷰를 등록하지 못했습니다.");
  }
  return data as string;
};

export const deleteMyFundingReview = async (reviewId: string) => {
  const { error } = await rpc("delete_my_funding_review", { p_review_id: reviewId });
  if (error) fail(error, "리뷰를 삭제하지 못했습니다.");
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

export const REVIEW_BLOCK_LABEL: Record<NonNullable<ReviewEligibility["block_reason"]>, string> = {
  not_owner: "본인 주문이 아닙니다",
  cancelled: "취소·환불된 주문",
  unpaid: "결제 완료 후 작성 가능",
  not_delivered: "배송 완료 후 작성 가능",
  already_reviewed: "리뷰 작성 완료",
  login_required: "로그인이 필요합니다",
};
