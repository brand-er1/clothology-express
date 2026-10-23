import { supabase } from "@/lib/supabase";

// 펀딩 리뷰. 작성 권한(실제 구매·결제 완료·미취소·배송 완료·주문당 1개)은
// 서버 RPC 와 DB 트리거가 매번 다시 검증하므로 이 파일은 권한을 판단하지 않는다.

export type ReviewSort = "latest" | "rating_desc" | "rating_asc";

export type FitRating = "small" | "true_to_size" | "large";

export const FIT_LABEL: Record<FitRating, string> = {
  small: "작아요",
  true_to_size: "정사이즈",
  large: "커요",
};

export type FundingReview = {
  id: string;
  rating: number;
  content: string;
  image_paths: string[];
  nickname: string;
  selected_color: string | null;
  selected_size: string | null;
  quantity: number | null;
  fit_rating?: FitRating | null;
  quality_rating?: number | null;
  delivery_rating?: number | null;
  /** 실결제 구매 리뷰면 true. 모의결제(테스트·체험) 주문 리뷰는 false 로 구분한다. */
  verified_purchase: boolean;
  purchase_type?: "paid" | "mock";
  is_mine: boolean;
  created_at: string;
  edited_at?: string | null;
  seller_reply?: { content: string; replied_at: string; updated_at: string | null } | null;
};

export type ReviewSummary = {
  average: number;
  count: number;
  distribution: Record<string, number>;
  verified_count?: number;
  photo_count?: number;
  fit?: Record<FitRating, number>;
  quality_average?: number | null;
  delivery_average?: number | null;
  photos?: { review_id: string; path: string }[];
};

export type ReviewDetails = {
  fitRating: FitRating | null;
  qualityRating: number | null;
  deliveryRating: number | null;
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
  photoOnly = false,
): Promise<{ summary: ReviewSummary; rows: FundingReview[]; total?: number }> => {
  const { data, error } = await rpc("get_funding_reviews", {
    p_funding_id: fundingId, p_sort: sort, p_limit: limit, p_offset: offset, p_photo_only: photoOnly,
  });
  if (error) fail(error, "리뷰를 불러오지 못했습니다.");
  return data as { summary: ReviewSummary; rows: FundingReview[]; total?: number };
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

export const createFundingReview = async (input: {
  participationId: string; rating: number; content: string; images: File[]; details?: ReviewDetails;
}) => {
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
    p_fit_rating: input.details?.fitRating ?? null,
    p_quality_rating: input.details?.qualityRating ?? null,
    p_delivery_rating: input.details?.deliveryRating ?? null,
  });
  if (error) {
    if (paths.length) await supabase.storage.from(REVIEW_BUCKET).remove(paths);
    fail(error, "리뷰를 등록하지 못했습니다.");
  }
  return data as string;
};

/** 작성자 본인 수정. 남길 기존 사진 경로 + 새로 올릴 사진(합쳐서 최대 5장). */
export const updateMyFundingReview = async (input: {
  reviewId: string; rating: number; content: string; keepPaths: string[]; images: File[]; details?: ReviewDetails;
}) => {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error("로그인이 필요합니다.");
  if (input.keepPaths.length + input.images.length > MAX_REVIEW_IMAGES) {
    throw new Error(`사진은 최대 ${MAX_REVIEW_IMAGES}장까지 첨부할 수 있습니다.`);
  }

  const added = await uploadReviewImages(userId, input.images);
  const { data, error } = await rpc("update_my_funding_review", {
    p_review_id: input.reviewId,
    p_rating: input.rating,
    p_content: input.content,
    p_image_paths: [...input.keepPaths, ...added],
    p_fit_rating: input.details?.fitRating ?? null,
    p_quality_rating: input.details?.qualityRating ?? null,
    p_delivery_rating: input.details?.deliveryRating ?? null,
  });
  if (error) {
    if (added.length) await supabase.storage.from(REVIEW_BUCKET).remove(added);
    fail(error, "리뷰를 수정하지 못했습니다.");
  }
  // 빠진 사진은 저장소에서도 지운다(본인 폴더 파일만 삭제 가능 — Storage 정책). 실패해도 리뷰 수정은 유지된다.
  const removed = ((data as { removed_image_paths?: string[] } | null)?.removed_image_paths ?? []).filter((path) => path.startsWith(`${userId}/`));
  if (removed.length) await supabase.storage.from(REVIEW_BUCKET).remove(removed).catch(() => undefined);
};

export const deleteMyFundingReview = async (reviewId: string) => {
  const { error } = await rpc("delete_my_funding_review", { p_review_id: reviewId });
  if (error) fail(error, "리뷰를 삭제하지 못했습니다.");
};



export const REVIEW_BLOCK_LABEL: Record<NonNullable<ReviewEligibility["block_reason"]>, string> = {
  not_owner: "본인 주문이 아닙니다",
  cancelled: "취소·환불된 주문",
  unpaid: "결제 완료 후 작성 가능",
  not_delivered: "배송 완료 후 작성 가능",
  already_reviewed: "리뷰 작성 완료",
  login_required: "로그인이 필요합니다",
};
