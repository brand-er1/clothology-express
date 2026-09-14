import { supabase } from "@/lib/supabase";
import type {
  AdminCommunityComment,
  AdminCommunityPost,
  AdminCommunityReport,
  AdminCommunityStats,
  AdminCommunityTopPost,
  CommunityComment,
  CommunityFeedFilter,
  CommunityFundingStatus,
  CommunityNotification,
  CommunityPollOption,
  CommunityPostDetail,
  CommunityPostSummary,
  CommunityProfile,
  CreateCommunityPostInput,
  MyDesignSummary,
} from "@/types/community";

const requireUser = async () => {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) throw new Error("로그인이 필요합니다.");
  return user;
};

export const getCommunityErrorMessage = (error: unknown, fallback = "잠시 후 다시 시도해주세요.") => {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
};

const throwCommunityError = (error: unknown, fallback?: string): never => {
  throw new Error(getCommunityErrorMessage(error, fallback));
};

// ---------------------------------------------------------------------------
// 이미지 업로드
// ---------------------------------------------------------------------------

export const uploadCommunityImage = async (file: File): Promise<{ imageUrl: string; imagePath: string }> => {
  const user = await requireUser();
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 업로드할 수 있습니다.");
  if (file.size > 10 * 1024 * 1024) throw new Error("이미지는 10MB 이하만 업로드할 수 있습니다.");

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const imagePath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("community-posts").upload(imagePath, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) throwCommunityError(uploadError, "이미지를 업로드하지 못했습니다.");

  const { data } = supabase.storage.from("community-posts").getPublicUrl(imagePath);
  return { imageUrl: data.publicUrl, imagePath };
};

export const uploadCommunityAvatar = async (file: File): Promise<string> => {
  const user = await requireUser();
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 업로드할 수 있습니다.");
  if (file.size > 5 * 1024 * 1024) throw new Error("프로필 이미지는 5MB 이하만 업로드할 수 있습니다.");

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const imagePath = `${user.id}/avatar-${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("community-avatars").upload(imagePath, file, {
    cacheControl: "3600",
    upsert: true,
  });
  if (uploadError) throwCommunityError(uploadError, "프로필 이미지를 업로드하지 못했습니다.");

  const { data } = supabase.storage.from("community-avatars").getPublicUrl(imagePath);
  return data.publicUrl;
};

// ---------------------------------------------------------------------------
// 내 디자인 불러오기
// ---------------------------------------------------------------------------

interface RawMyDesignRow {
  id: string;
  front_image_url: string;
  back_image_url: string | null;
  product_type: string | null;
  color: string | null;
  created_at: string;
}

export const fetchMyDesignsForCommunity = async (): Promise<MyDesignSummary[]> => {
  await requireUser();
  const { data, error } = await supabase.rpc("list_my_designs");
  if (error) throwCommunityError(error, "내 디자인 목록을 불러오지 못했습니다.");
  return ((data || []) as RawMyDesignRow[]).map((row) => ({
    id: row.id,
    frontImageUrl: row.front_image_url,
    backImageUrl: row.back_image_url,
    productType: row.product_type,
    color: row.color,
    createdAt: row.created_at,
  }));
};

// ---------------------------------------------------------------------------
// 게시물
// ---------------------------------------------------------------------------

interface RawPostSummaryRow {
  id: string;
  user_id: string;
  author_name: string;
  brand_name: string | null;
  avatar_url: string | null;
  title: string;
  description: string | null;
  category: string;
  hashtags: string[] | null;
  cover_image_url: string | null;
  back_image_url: string | null;
  like_count: number;
  comment_count: number;
  purchase_intent_count: number;
  target_purchase_intent_count: number | null;
  liked_by_me: boolean;
  purchase_intent_by_me: boolean;
  funding_id: string | null;
  funding_status: CommunityFundingStatus;
  has_poll: boolean;
  created_at: string;
}

const toPostSummary = (row: RawPostSummaryRow): CommunityPostSummary => ({
  id: row.id,
  userId: row.user_id,
  authorName: row.author_name,
  brandName: row.brand_name,
  avatarUrl: row.avatar_url,
  title: row.title,
  description: row.description,
  category: row.category,
  hashtags: row.hashtags || [],
  coverImageUrl: row.cover_image_url,
  backImageUrl: row.back_image_url,
  likeCount: row.like_count,
  commentCount: row.comment_count,
  purchaseIntentCount: row.purchase_intent_count,
  targetPurchaseIntentCount: row.target_purchase_intent_count,
  likedByMe: row.liked_by_me,
  purchaseIntentByMe: row.purchase_intent_by_me,
  fundingId: row.funding_id,
  fundingStatus: row.funding_status,
  hasPoll: row.has_poll,
  createdAt: row.created_at,
});

export const fetchCommunityPosts = async (options: {
  filter?: CommunityFeedFilter;
  category?: string | null;
  search?: string | null;
  hashtag?: string | null;
  userId?: string | null;
  limit?: number;
  offset?: number;
} = {}): Promise<CommunityPostSummary[]> => {
  const { data, error } = await supabase.rpc("list_community_posts", {
    p_filter: options.filter ?? "latest",
    p_category: options.category ?? null,
    p_search: options.search?.trim() || null,
    p_hashtag: options.hashtag ?? null,
    p_user_id: options.userId ?? null,
    p_limit: options.limit ?? 20,
    p_offset: options.offset ?? 0,
  });
  if (error) throwCommunityError(error, "게시물 목록을 불러오지 못했습니다.");
  return ((data || []) as RawPostSummaryRow[]).map(toPostSummary);
};

interface RawPostDetailRow {
  id: string;
  user_id: string;
  author_name: string;
  brand_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  title: string;
  description: string | null;
  category: string;
  hashtags: string[] | null;
  images: { id: string; imageUrl: string; imagePath: string | null; side: string; position: number }[] | null;
  allow_feedback: boolean;
  purchase_intent_enabled: boolean;
  target_purchase_intent_count: number | null;
  like_count: number;
  comment_count: number;
  purchase_intent_count: number;
  liked_by_me: boolean;
  purchase_intent_by_me: boolean;
  is_owner: boolean;
  is_following_author: boolean;
  design_id: string | null;
  funding_id: string | null;
  funding_status: CommunityFundingStatus;
  funding_status_label: string;
  poll: {
    id: string;
    question: string;
    totalVotes: number;
    myOptionId: string | null;
    options: CommunityPollOption[];
  } | null;
  created_at: string;
  moderation_status: "visible" | "hidden" | "removed";
}

export const fetchCommunityPost = async (postId: string): Promise<CommunityPostDetail> => {
  const { data, error } = await supabase.rpc("get_community_post", { p_post_id: postId });
  if (error) throwCommunityError(error, "게시물을 불러오지 못했습니다.");
  const row = (data as RawPostDetailRow[])?.[0];
  if (!row) throw new Error("게시물을 찾을 수 없습니다.");

  return {
    id: row.id,
    userId: row.user_id,
    authorName: row.author_name,
    brandName: row.brand_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    title: row.title,
    description: row.description,
    category: row.category,
    hashtags: row.hashtags || [],
    images: (row.images || []).map((image) => ({
      id: image.id,
      imageUrl: image.imageUrl,
      imagePath: image.imagePath,
      side: image.side as "front" | "back" | "extra",
      position: image.position,
    })),
    allowFeedback: row.allow_feedback,
    purchaseIntentEnabled: row.purchase_intent_enabled,
    targetPurchaseIntentCount: row.target_purchase_intent_count,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    purchaseIntentCount: row.purchase_intent_count,
    likedByMe: row.liked_by_me,
    purchaseIntentByMe: row.purchase_intent_by_me,
    isOwner: row.is_owner,
    isFollowingAuthor: row.is_following_author,
    designId: row.design_id,
    fundingId: row.funding_id,
    fundingStatus: row.funding_status,
    fundingStatusLabel: row.funding_status_label,
    poll: row.poll,
    createdAt: row.created_at,
    moderationStatus: row.moderation_status,
  };
};

export const createCommunityPost = async (input: CreateCommunityPostInput): Promise<string> => {
  await requireUser();
  const { data, error } = await supabase.rpc("create_community_post", {
    p_title: input.title,
    p_description: input.description,
    p_category: input.category,
    p_hashtags: input.hashtags,
    p_images: input.images.map((image, index) => ({
      imageUrl: image.imageUrl,
      imagePath: image.imagePath ?? null,
      side: image.side,
      position: index,
    })),
    p_design_id: input.designId ?? null,
    p_allow_feedback: input.allowFeedback,
    p_purchase_intent_enabled: input.purchaseIntentEnabled,
    p_target_purchase_intent_count: input.targetPurchaseIntentCount ?? null,
    p_poll_question: input.pollQuestion ?? null,
    p_poll_options: input.pollOptions ?? null,
  });
  if (error) throwCommunityError(error, "게시물을 등록하지 못했습니다.");
  return data as string;
};

export const deleteCommunityPost = async (postId: string): Promise<void> => {
  await requireUser();
  const { error } = await supabase.rpc("delete_community_post", { p_post_id: postId });
  if (error) throwCommunityError(error, "게시물을 삭제하지 못했습니다.");
};

// ---------------------------------------------------------------------------
// 좋아요 / 구매의향
// ---------------------------------------------------------------------------

export const toggleCommunityPostLike = async (postId: string): Promise<boolean> => {
  await requireUser();
  const { data, error } = await supabase.rpc("toggle_community_post_like", { p_post_id: postId });
  if (error) throwCommunityError(error, "좋아요를 처리하지 못했습니다.");
  return data as boolean;
};

export const toggleCommunityPurchaseIntent = async (
  postId: string,
): Promise<{ joined: boolean; intentCount: number; goalReached: boolean }> => {
  await requireUser();
  const { data, error } = await supabase.rpc("toggle_community_purchase_intent", { p_post_id: postId });
  if (error) throwCommunityError(error, "구매의향 등록을 처리하지 못했습니다.");
  const row = (data as { joined: boolean; intent_count: number; goal_reached: boolean }[])?.[0];
  return {
    joined: Boolean(row?.joined),
    intentCount: row?.intent_count ?? 0,
    goalReached: Boolean(row?.goal_reached),
  };
};

// ---------------------------------------------------------------------------
// 댓글
// ---------------------------------------------------------------------------

interface RawCommentRow {
  id: string;
  parent_comment_id: string | null;
  user_id: string;
  author_name: string;
  avatar_url: string | null;
  content: string;
  like_count: number;
  liked_by_me: boolean;
  is_deleted: boolean;
  is_owner: boolean;
  created_at: string;
  updated_at: string;
}

const buildCommentTree = (rows: RawCommentRow[]): CommunityComment[] => {
  const byId = new Map<string, CommunityComment>();
  const roots: CommunityComment[] = [];

  rows.forEach((row) => {
    byId.set(row.id, {
      id: row.id,
      parentCommentId: row.parent_comment_id,
      userId: row.user_id,
      authorName: row.author_name,
      avatarUrl: row.avatar_url,
      content: row.content,
      likeCount: row.like_count,
      likedByMe: row.liked_by_me,
      isDeleted: row.is_deleted,
      isOwner: row.is_owner,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      replies: [],
    });
  });

  rows.forEach((row) => {
    const node = byId.get(row.id)!;
    if (row.parent_comment_id && byId.has(row.parent_comment_id)) {
      byId.get(row.parent_comment_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

export const fetchCommunityComments = async (postId: string): Promise<CommunityComment[]> => {
  const { data, error } = await supabase.rpc("list_community_comments", { p_post_id: postId });
  if (error) throwCommunityError(error, "댓글을 불러오지 못했습니다.");
  return buildCommentTree((data || []) as RawCommentRow[]);
};

export const createCommunityComment = async (
  postId: string,
  content: string,
  parentCommentId?: string | null,
): Promise<string> => {
  await requireUser();
  const { data, error } = await supabase.rpc("create_community_comment", {
    p_post_id: postId,
    p_content: content,
    p_parent_comment_id: parentCommentId ?? null,
  });
  if (error) throwCommunityError(error, "댓글을 등록하지 못했습니다.");
  return data as string;
};

export const updateCommunityComment = async (commentId: string, content: string): Promise<void> => {
  await requireUser();
  const { error } = await supabase.rpc("update_community_comment", { p_comment_id: commentId, p_content: content });
  if (error) throwCommunityError(error, "댓글을 수정하지 못했습니다.");
};

export const deleteCommunityComment = async (commentId: string): Promise<void> => {
  await requireUser();
  const { error } = await supabase.rpc("delete_community_comment", { p_comment_id: commentId });
  if (error) throwCommunityError(error, "댓글을 삭제하지 못했습니다.");
};

export const toggleCommunityCommentLike = async (commentId: string): Promise<boolean> => {
  await requireUser();
  const { data, error } = await supabase.rpc("toggle_community_comment_like", { p_comment_id: commentId });
  if (error) throwCommunityError(error, "댓글 좋아요를 처리하지 못했습니다.");
  return data as boolean;
};

// ---------------------------------------------------------------------------
// 투표
// ---------------------------------------------------------------------------

export const voteCommunityPoll = async (pollId: string, optionId: string): Promise<void> => {
  await requireUser();
  const { error } = await supabase.rpc("vote_community_poll", { p_poll_id: pollId, p_option_id: optionId });
  if (error) throwCommunityError(error, "투표를 처리하지 못했습니다.");
};

// ---------------------------------------------------------------------------
// 팔로우 / 프로필
// ---------------------------------------------------------------------------

export const toggleCommunityFollow = async (targetUserId: string): Promise<boolean> => {
  await requireUser();
  const { data, error } = await supabase.rpc("toggle_community_follow", { p_target_user_id: targetUserId });
  if (error) throwCommunityError(error, "팔로우를 처리하지 못했습니다.");
  return data as boolean;
};

interface RawProfileRow {
  user_id: string;
  username: string | null;
  brand_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  follower_count: number;
  following_count: number;
  post_count: number;
  is_following_by_me: boolean;
  is_me: boolean;
}

export const fetchCommunityProfile = async (userId: string): Promise<CommunityProfile> => {
  const { data, error } = await supabase.rpc("get_community_profile", { p_user_id: userId });
  if (error) throwCommunityError(error, "프로필을 불러오지 못했습니다.");
  const row = (data as RawProfileRow[])?.[0];
  if (!row) throw new Error("프로필을 찾을 수 없습니다.");
  return {
    userId: row.user_id,
    username: row.username,
    brandName: row.brand_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    followerCount: row.follower_count,
    followingCount: row.following_count,
    postCount: row.post_count,
    isFollowingByMe: row.is_following_by_me,
    isMe: row.is_me,
  };
};

export const updateCommunityProfile = async (input: { bio?: string; avatarUrl?: string }): Promise<void> => {
  await requireUser();
  const { error } = await supabase.rpc("update_community_profile", {
    p_bio: input.bio ?? null,
    p_avatar_url: input.avatarUrl ?? null,
  });
  if (error) throwCommunityError(error, "프로필을 저장하지 못했습니다.");
};

// ---------------------------------------------------------------------------
// 알림
// ---------------------------------------------------------------------------

interface RawNotificationRow {
  id: string;
  actor_id: string | null;
  actor_name: string;
  actor_avatar_url: string | null;
  type: CommunityNotification["type"];
  message: string;
  post_id: string | null;
  comment_id: string | null;
  funding_id: string | null;
  is_read: boolean;
  created_at: string;
}

export const fetchCommunityNotifications = async (limit = 50): Promise<CommunityNotification[]> => {
  await requireUser();
  const { data, error } = await supabase.rpc("list_my_community_notifications", { p_limit: limit });
  if (error) throwCommunityError(error, "알림을 불러오지 못했습니다.");
  return ((data || []) as RawNotificationRow[]).map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorAvatarUrl: row.actor_avatar_url,
    type: row.type,
    message: row.message,
    postId: row.post_id,
    commentId: row.comment_id,
    fundingId: row.funding_id,
    isRead: row.is_read,
    createdAt: row.created_at,
  }));
};

export const markCommunityNotificationRead = async (notificationId: string): Promise<void> => {
  await requireUser();
  const { error } = await supabase.rpc("mark_community_notification_read", { p_notification_id: notificationId });
  if (error) throwCommunityError(error);
};

export const markAllCommunityNotificationsRead = async (): Promise<void> => {
  await requireUser();
  const { error } = await supabase.rpc("mark_all_community_notifications_read");
  if (error) throwCommunityError(error);
};

export const fetchUnreadCommunityNotificationCount = async (): Promise<number> => {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return 0;
  const { data: count, error } = await supabase.rpc("get_unread_community_notification_count");
  if (error) return 0;
  return (count as number) || 0;
};

// ---------------------------------------------------------------------------
// 신고
// ---------------------------------------------------------------------------

export const reportCommunityPost = async (postId: string, reason?: string): Promise<void> => {
  await requireUser();
  const { error } = await supabase.rpc("report_community_post", { p_post_id: postId, p_reason: reason ?? null });
  if (error) throwCommunityError(error, "신고를 접수하지 못했습니다.");
};

export const reportCommunityComment = async (commentId: string, reason?: string): Promise<void> => {
  await requireUser();
  const { error } = await supabase.rpc("report_community_comment", { p_comment_id: commentId, p_reason: reason ?? null });
  if (error) throwCommunityError(error, "신고를 접수하지 못했습니다.");
};

export const reportCommunityUser = async (userId: string, reason?: string): Promise<void> => {
  await requireUser();
  const { error } = await supabase.rpc("report_community_user", { p_user_id: userId, p_reason: reason ?? null });
  if (error) throwCommunityError(error, "신고를 접수하지 못했습니다.");
};

// ---------------------------------------------------------------------------
// 구매의향 -> 펀딩 전환
// ---------------------------------------------------------------------------

export const startFundingFromCommunityPost = async (postId: string): Promise<string> => {
  await requireUser();
  const { data, error } = await supabase.rpc("start_funding_from_community_post", { p_post_id: postId });
  if (error) throwCommunityError(error, "펀딩을 시작하지 못했습니다.");
  return data as string;
};

export const updateCommunityFundingStatus = async (
  postId: string,
  status: CommunityFundingStatus,
): Promise<void> => {
  await requireUser();
  const { error } = await supabase.rpc("update_community_funding_status", { p_post_id: postId, p_status: status });
  if (error) throwCommunityError(error, "진행 상태를 변경하지 못했습니다.");
};

// ---------------------------------------------------------------------------
// 관리자
// ---------------------------------------------------------------------------

interface RawAdminPostRow {
  id: string;
  user_id: string;
  author_name: string;
  brand_name: string | null;
  title: string;
  category: string;
  cover_image_url: string | null;
  like_count: number;
  comment_count: number;
  purchase_intent_count: number;
  report_count: number;
  moderation_status: "visible" | "hidden" | "removed";
  admin_note: string | null;
  funding_id: string | null;
  funding_status: CommunityFundingStatus;
  created_at: string;
}

export const fetchAdminCommunityPosts = async (): Promise<AdminCommunityPost[]> => {
  const { data, error } = await supabase.rpc("get_admin_community_posts");
  if (error) throwCommunityError(error, "게시물 목록을 불러오지 못했습니다.");
  return ((data || []) as RawAdminPostRow[]).map((row) => ({
    id: row.id,
    userId: row.user_id,
    authorName: row.author_name,
    brandName: row.brand_name,
    title: row.title,
    category: row.category,
    coverImageUrl: row.cover_image_url,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    purchaseIntentCount: row.purchase_intent_count,
    reportCount: row.report_count,
    moderationStatus: row.moderation_status,
    adminNote: row.admin_note,
    fundingId: row.funding_id,
    fundingStatus: row.funding_status,
    createdAt: row.created_at,
  }));
};

export const moderateCommunityPost = async (
  postId: string,
  status: "visible" | "hidden" | "removed",
  adminNote?: string,
): Promise<void> => {
  const { error } = await supabase.rpc("moderate_community_post", {
    p_post_id: postId,
    p_status: status,
    p_admin_note: adminNote ?? null,
  });
  if (error) throwCommunityError(error, "게시물 상태를 변경하지 못했습니다.");
};

interface RawAdminCommentRow {
  id: string;
  post_id: string;
  post_title: string;
  user_id: string;
  author_name: string;
  content: string;
  is_deleted: boolean;
  like_count: number;
  created_at: string;
}

export const fetchAdminCommunityComments = async (): Promise<AdminCommunityComment[]> => {
  const { data, error } = await supabase.rpc("get_admin_community_comments");
  if (error) throwCommunityError(error, "댓글 목록을 불러오지 못했습니다.");
  return ((data || []) as RawAdminCommentRow[]).map((row) => ({
    id: row.id,
    postId: row.post_id,
    postTitle: row.post_title,
    userId: row.user_id,
    authorName: row.author_name,
    content: row.content,
    isDeleted: row.is_deleted,
    likeCount: row.like_count,
    createdAt: row.created_at,
  }));
};

export const adminDeleteCommunityComment = async (commentId: string): Promise<void> => {
  const { error } = await supabase.rpc("admin_delete_community_comment", { p_comment_id: commentId });
  if (error) throwCommunityError(error, "댓글을 삭제하지 못했습니다.");
};

interface RawAdminReportRow {
  id: string;
  reporter_id: string;
  reporter_name: string;
  target_type: "post" | "comment" | "user";
  target_id: string;
  target_summary: string | null;
  reason: string | null;
  status: "pending" | "reviewed" | "dismissed";
  created_at: string;
}

export const fetchAdminCommunityReports = async (): Promise<AdminCommunityReport[]> => {
  const { data, error } = await supabase.rpc("get_admin_community_reports");
  if (error) throwCommunityError(error, "신고 목록을 불러오지 못했습니다.");
  return ((data || []) as RawAdminReportRow[]).map((row) => ({
    id: row.id,
    reporterId: row.reporter_id,
    reporterName: row.reporter_name,
    targetType: row.target_type,
    targetId: row.target_id,
    targetSummary: row.target_summary,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
  }));
};

export const resolveCommunityReport = async (
  reportId: string,
  status: "reviewed" | "dismissed",
): Promise<void> => {
  const { error } = await supabase.rpc("resolve_community_report", { p_report_id: reportId, p_status: status });
  if (error) throwCommunityError(error, "신고 처리에 실패했습니다.");
};

interface RawAdminStatsRow {
  total_posts: number;
  total_comments: number;
  total_purchase_intents: number;
  total_funding_conversions: number;
  funding_conversion_rate: number;
  pending_reports: number;
}

export const fetchAdminCommunityStats = async (): Promise<AdminCommunityStats> => {
  const { data, error } = await supabase.rpc("get_admin_community_stats");
  if (error) throwCommunityError(error, "통계를 불러오지 못했습니다.");
  const row = (data as RawAdminStatsRow[])?.[0];
  return {
    totalPosts: row?.total_posts ?? 0,
    totalComments: row?.total_comments ?? 0,
    totalPurchaseIntents: row?.total_purchase_intents ?? 0,
    totalFundingConversions: row?.total_funding_conversions ?? 0,
    fundingConversionRate: row?.funding_conversion_rate ?? 0,
    pendingReports: row?.pending_reports ?? 0,
  };
};

interface RawAdminTopPostRow {
  id: string;
  title: string;
  author_name: string;
  cover_image_url: string | null;
  like_count: number;
  purchase_intent_count: number;
  comment_count: number;
  funding_id: string | null;
  created_at: string;
}

export const fetchAdminCommunityTopPosts = async (
  metric: "like_count" | "purchase_intent_count",
): Promise<AdminCommunityTopPost[]> => {
  const { data, error } = await supabase.rpc("get_admin_community_top_posts", { p_metric: metric, p_limit: 10 });
  if (error) throwCommunityError(error, "인기 게시물을 불러오지 못했습니다.");
  return ((data || []) as RawAdminTopPostRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    authorName: row.author_name,
    coverImageUrl: row.cover_image_url,
    likeCount: row.like_count,
    purchaseIntentCount: row.purchase_intent_count,
    commentCount: row.comment_count,
    fundingId: row.funding_id,
    createdAt: row.created_at,
  }));
};
