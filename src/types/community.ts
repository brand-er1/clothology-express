export type CommunityFeedFilter = "latest" | "popular" | "feedback" | "funding_soon" | "in_production";

export type CommunityFundingStatus =
  | "none"
  | "funding_active"
  | "funded"
  | "fabric_ready"
  | "sample_production"
  | "mass_production"
  | "inspection"
  | "shipping";

export const COMMUNITY_FUNDING_STATUS_ORDER: CommunityFundingStatus[] = [
  "funded",
  "fabric_ready",
  "sample_production",
  "mass_production",
  "inspection",
  "shipping",
];

export const COMMUNITY_FUNDING_STATUS_LABEL: Record<CommunityFundingStatus, string> = {
  none: "진행 전",
  funding_active: "펀딩 진행 중",
  funded: "펀딩 성공",
  fabric_ready: "원단 준비",
  sample_production: "샘플 제작",
  mass_production: "본생산",
  inspection: "검수",
  shipping: "배송",
};

export type CommunityImageSide = "front" | "back" | "extra";

export interface CommunityPostImage {
  id: string;
  imageUrl: string;
  imagePath: string | null;
  side: CommunityImageSide;
  position: number;
}

export interface CommunityPostSummary {
  id: string;
  userId: string;
  authorName: string;
  brandName: string | null;
  avatarUrl: string | null;
  title: string;
  description: string | null;
  category: string;
  hashtags: string[];
  coverImageUrl: string | null;
  backImageUrl: string | null;
  likeCount: number;
  commentCount: number;
  purchaseIntentCount: number;
  targetPurchaseIntentCount: number | null;
  likedByMe: boolean;
  purchaseIntentByMe: boolean;
  fundingId: string | null;
  fundingStatus: CommunityFundingStatus;
  hasPoll: boolean;
  createdAt: string;
}

export interface CommunityPollOption {
  id: string;
  label: string;
  votes: number;
}

export interface CommunityPoll {
  id: string;
  question: string;
  totalVotes: number;
  myOptionId: string | null;
  options: CommunityPollOption[];
}

export interface CommunityPostDetail {
  id: string;
  userId: string;
  authorName: string;
  brandName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  title: string;
  description: string | null;
  category: string;
  hashtags: string[];
  images: CommunityPostImage[];
  allowFeedback: boolean;
  purchaseIntentEnabled: boolean;
  targetPurchaseIntentCount: number | null;
  likeCount: number;
  commentCount: number;
  purchaseIntentCount: number;
  likedByMe: boolean;
  purchaseIntentByMe: boolean;
  isOwner: boolean;
  isFollowingAuthor: boolean;
  designId: string | null;
  fundingId: string | null;
  fundingStatus: CommunityFundingStatus;
  fundingStatusLabel: string;
  poll: CommunityPoll | null;
  createdAt: string;
  moderationStatus: "visible" | "hidden" | "removed";
}

export interface CommunityComment {
  id: string;
  parentCommentId: string | null;
  userId: string;
  authorName: string;
  avatarUrl: string | null;
  content: string;
  likeCount: number;
  likedByMe: boolean;
  isDeleted: boolean;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
  replies: CommunityComment[];
}

export interface CommunityProfile {
  userId: string;
  username: string | null;
  brandName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isFollowingByMe: boolean;
  isMe: boolean;
}

export type CommunityNotificationType =
  | "like"
  | "comment"
  | "reply"
  | "purchase_intent"
  | "poll_vote"
  | "follow"
  | "purchase_intent_goal"
  | "funding_started"
  | "funding_status_changed"
  | "participation_cancelled"
  | "funding_cancelled";

export interface CommunityNotification {
  id: string;
  actorId: string | null;
  actorName: string;
  actorAvatarUrl: string | null;
  type: CommunityNotificationType;
  message: string;
  postId: string | null;
  commentId: string | null;
  fundingId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface MyDesignSummary {
  id: string;
  frontImageUrl: string;
  backImageUrl: string | null;
  productType: string | null;
  color: string | null;
  createdAt: string;
}

export interface CreateCommunityPostInput {
  title: string;
  description: string;
  category: string;
  hashtags: string[];
  images: { imageUrl: string; imagePath?: string | null; side: CommunityImageSide }[];
  designId?: string | null;
  allowFeedback: boolean;
  purchaseIntentEnabled: boolean;
  targetPurchaseIntentCount?: number | null;
  pollQuestion?: string | null;
  pollOptions?: string[] | null;
}

export interface AdminCommunityPost {
  id: string;
  userId: string;
  authorName: string;
  brandName: string | null;
  title: string;
  category: string;
  coverImageUrl: string | null;
  likeCount: number;
  commentCount: number;
  purchaseIntentCount: number;
  reportCount: number;
  moderationStatus: "visible" | "hidden" | "removed";
  adminNote: string | null;
  fundingId: string | null;
  fundingStatus: CommunityFundingStatus;
  createdAt: string;
}

export interface AdminCommunityComment {
  id: string;
  postId: string;
  postTitle: string;
  userId: string;
  authorName: string;
  content: string;
  isDeleted: boolean;
  likeCount: number;
  createdAt: string;
}

export interface AdminCommunityReport {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: "post" | "comment" | "user";
  targetId: string;
  targetSummary: string | null;
  reason: string | null;
  status: "pending" | "reviewed" | "dismissed";
  createdAt: string;
}

export interface AdminCommunityStats {
  totalPosts: number;
  totalComments: number;
  totalPurchaseIntents: number;
  totalFundingConversions: number;
  fundingConversionRate: number;
  pendingReports: number;
}

export interface AdminCommunityTopPost {
  id: string;
  title: string;
  authorName: string;
  coverImageUrl: string | null;
  likeCount: number;
  purchaseIntentCount: number;
  commentCount: number;
  fundingId: string | null;
  createdAt: string;
}

export const COMMUNITY_CATEGORIES = ["후드티", "티셔츠", "아우터", "니트", "바지", "액세서리", "기타"];

export const POPULAR_HASHTAGS = ["후드티", "스트릿", "빈티지", "오버핏", "그래픽티"];
