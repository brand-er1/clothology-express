import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Heart,
  MessageCircle,
  Flame,
  Share2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
  Flag,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { formatCommunityTime } from "@/lib/communityTime";
import { useMobileStickyCtaOffset } from "@/hooks/useMobileStickyCtaOffset";
import {
  createCommunityComment,
  deleteCommunityComment,
  deleteCommunityPost,
  fetchCommunityComments,
  fetchCommunityPost,
  getCommunityErrorMessage,
  reportCommunityPost,
  startFundingFromCommunityPost,
  toggleCommunityCommentLike,
  toggleCommunityFollow,
  toggleCommunityPostLike,
  toggleCommunityPurchaseIntent,
  updateCommunityComment,
  voteCommunityPoll,
} from "@/services/community";
import type { CommunityComment, CommunityPostDetail as CommunityPostDetailType } from "@/types/community";
import { COMMUNITY_FUNDING_STATUS_ORDER, COMMUNITY_FUNDING_STATUS_LABEL } from "@/types/community";

const CommentItem = ({
  comment,
  depth,
  currentUserId,
  onReply,
  onToggleLike,
  onUpdate,
  onDelete,
}: {
  comment: CommunityComment;
  depth: number;
  currentUserId: string | null;
  onReply: (commentId: string, authorName: string) => void;
  onToggleLike: (commentId: string) => void;
  onUpdate: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);

  return (
    <div className={depth > 0 ? "ml-8 mt-3 border-l-2 border-stone-100 pl-4" : "mt-4"}>
      <div className="flex gap-2.5">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={comment.avatarUrl || undefined} />
          <AvatarFallback className="bg-brand/10 text-xs font-bold text-brand">
            {comment.authorName.slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-stone-900">{comment.authorName}</p>
          {isEditing ? (
            <div className="mt-1 space-y-2">
              <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="min-h-16 rounded-lg text-sm" />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 rounded-full bg-brand px-3 text-xs hover:bg-brand-dark" onClick={async () => { await onUpdate(comment.id, draft); setIsEditing(false); }}>저장</Button>
                <Button size="sm" variant="ghost" className="h-7 rounded-full px-3 text-xs" onClick={() => setIsEditing(false)}>취소</Button>
              </div>
            </div>
          ) : (
            <p className={`mt-0.5 text-sm ${comment.isDeleted ? "italic text-stone-400" : "text-stone-700"}`}>{comment.content}</p>
          )}
          {!comment.isDeleted && (
            <div className="mt-1.5 flex items-center gap-3 text-xs font-semibold text-stone-400">
              <span>{formatCommunityTime(comment.createdAt)}</span>
              <button type="button" onClick={() => onToggleLike(comment.id)} className={`flex items-center gap-1 ${comment.likedByMe ? "text-brand" : "hover:text-stone-700"}`}>
                <Heart className={`h-3.5 w-3.5 ${comment.likedByMe ? "fill-brand" : ""}`} /> {comment.likeCount || ""}
              </button>
              {currentUserId && (
                <button type="button" onClick={() => onReply(comment.id, comment.authorName)} className="hover:text-stone-700">답글</button>
              )}
              {comment.isOwner && !isEditing && (
                <>
                  <button type="button" onClick={() => setIsEditing(true)} className="flex items-center gap-1 hover:text-stone-700"><Pencil className="h-3 w-3" /> 수정</button>
                  <button type="button" onClick={() => onDelete(comment.id)} className="flex items-center gap-1 hover:text-red-500"><Trash2 className="h-3 w-3" /> 삭제</button>
                </>
              )}
            </div>
          )}
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              currentUserId={currentUserId}
              onReply={onReply}
              onToggleLike={onToggleLike}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const CommunityPostDetail = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const commentBarRef = useMobileStickyCtaOffset();
  const [post, setPost] = useState<CommunityPostDetailType | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [imageIndex, setImageIndex] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<{ id: string; name: string } | null>(null);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [isStartingFunding, setIsStartingFunding] = useState(false);

  const load = useCallback(async () => {
    if (!postId) return;
    setIsLoading(true);
    try {
      const [postData, commentData, session] = await Promise.all([
        fetchCommunityPost(postId),
        fetchCommunityComments(postId),
        supabase.auth.getSession(),
      ]);
      setPost(postData);
      setComments(commentData);
      setCurrentUserId(session.data.session?.user.id ?? null);
    } catch (error) {
      toast({ title: "게시물을 불러오지 못했습니다", description: getCommunityErrorMessage(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => { void load(); }, [load]);

  const requireLogin = () => {
    if (currentUserId) return true;
    navigate(`/auth?returnTo=${encodeURIComponent(`/community/${postId}`)}`);
    return false;
  };

  const handleToggleLike = async () => {
    if (!post || !requireLogin()) return;
    try {
      const liked = await toggleCommunityPostLike(post.id);
      setPost({ ...post, likedByMe: liked, likeCount: post.likeCount + (liked ? 1 : -1) });
    } catch (error) {
      toast({ title: "좋아요 처리 실패", description: getCommunityErrorMessage(error), variant: "destructive" });
    }
  };

  const handleTogglePurchaseIntent = async () => {
    if (!post || !requireLogin()) return;
    try {
      const result = await toggleCommunityPurchaseIntent(post.id);
      setPost({ ...post, purchaseIntentByMe: result.joined, purchaseIntentCount: result.intentCount });
      if (result.goalReached) {
        toast({ title: "🔥 구매의향 목표를 달성했습니다!", description: `${result.intentCount}명이 이 디자인을 구매하고 싶어합니다.` });
        void load();
      }
    } catch (error) {
      toast({ title: "구매의향 등록 실패", description: getCommunityErrorMessage(error), variant: "destructive" });
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: post?.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "링크를 복사했습니다" });
      }
    } catch {
      // 사용자가 공유를 취소한 경우 등은 조용히 무시합니다.
    }
  };

  const handleFollowToggle = async () => {
    if (!post || !requireLogin()) return;
    try {
      const following = await toggleCommunityFollow(post.userId);
      setPost({ ...post, isFollowingAuthor: following });
    } catch (error) {
      toast({ title: "팔로우 처리 실패", description: getCommunityErrorMessage(error), variant: "destructive" });
    }
  };

  const handleVote = async (optionId: string) => {
    if (!post?.poll || !requireLogin()) return;
    try {
      await voteCommunityPoll(post.poll.id, optionId);
      await load();
    } catch (error) {
      toast({ title: "투표 실패", description: getCommunityErrorMessage(error), variant: "destructive" });
    }
  };

  const handleSubmitComment = async () => {
    if (!post || !requireLogin() || !commentDraft.trim()) return;
    setIsSendingComment(true);
    try {
      await createCommunityComment(post.id, commentDraft.trim(), replyTarget?.id ?? null);
      setCommentDraft("");
      setReplyTarget(null);
      const commentData = await fetchCommunityComments(post.id);
      setComments(commentData);
      setPost({ ...post, commentCount: post.commentCount + 1 });
    } catch (error) {
      toast({ title: "댓글 등록 실패", description: getCommunityErrorMessage(error), variant: "destructive" });
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleToggleCommentLike = async (commentId: string) => {
    if (!requireLogin() || !post) return;
    try {
      await toggleCommunityCommentLike(commentId);
      setComments(await fetchCommunityComments(post.id));
    } catch (error) {
      toast({ title: "처리 실패", description: getCommunityErrorMessage(error), variant: "destructive" });
    }
  };

  const handleUpdateComment = async (commentId: string, content: string) => {
    if (!post) return;
    try {
      await updateCommunityComment(commentId, content);
      setComments(await fetchCommunityComments(post.id));
    } catch (error) {
      toast({ title: "댓글 수정 실패", description: getCommunityErrorMessage(error), variant: "destructive" });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!post || !window.confirm("댓글을 삭제할까요?")) return;
    try {
      await deleteCommunityComment(commentId);
      setComments(await fetchCommunityComments(post.id));
      setPost({ ...post, commentCount: Math.max(0, post.commentCount - 1) });
    } catch (error) {
      toast({ title: "댓글 삭제 실패", description: getCommunityErrorMessage(error), variant: "destructive" });
    }
  };

  const handleDeletePost = async () => {
    if (!post || !window.confirm("게시물을 삭제할까요? 되돌릴 수 없습니다.")) return;
    try {
      await deleteCommunityPost(post.id);
      toast({ title: "게시물을 삭제했습니다" });
      navigate("/community");
    } catch (error) {
      toast({ title: "삭제 실패", description: getCommunityErrorMessage(error), variant: "destructive" });
    }
  };

  const handleReport = async () => {
    if (!post || !requireLogin()) return;
    const reason = window.prompt("신고 사유를 입력해주세요.");
    if (reason === null) return;
    try {
      await reportCommunityPost(post.id, reason);
      toast({ title: "신고가 접수되었습니다" });
    } catch (error) {
      toast({ title: "신고 실패", description: getCommunityErrorMessage(error), variant: "destructive" });
    }
  };

  const handleStartFunding = async () => {
    if (!post) return;
    setIsStartingFunding(true);
    try {
      const fundingId = await startFundingFromCommunityPost(post.id);
      toast({ title: "펀딩 등록 페이지로 이동합니다" });
      navigate(`/fundings/${fundingId}/edit`);
    } catch (error) {
      toast({ title: "펀딩 시작 실패", description: getCommunityErrorMessage(error), variant: "destructive" });
    } finally {
      setIsStartingFunding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="flex h-96 flex-col items-center justify-center gap-3 text-stone-500">
          <p>게시물을 찾을 수 없습니다.</p>
          <Button asChild variant="outline" className="rounded-full"><Link to="/community">매거진으로 돌아가기</Link></Button>
        </div>
      </div>
    );
  }

  const goalReached = Boolean(post.targetPurchaseIntentCount && post.purchaseIntentCount >= post.targetPurchaseIntentCount);

  return (
    <div className="min-h-screen bg-white pb-28">
      <Header />
      <main className="mx-auto max-w-lg pt-16 sm:pt-[72px]">
        <section className="relative aspect-[4/5] w-full overflow-hidden bg-stone-100">
          {post.images.length > 0 && (
            <img src={post.images[imageIndex]?.imageUrl} alt={post.title} className="h-full w-full object-cover" />
          )}
          {post.fundingId && (
            <Link
              to={`/fundings/${post.fundingId}`}
              className="absolute left-3 top-3 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white shadow-lg"
            >
              🔥 현재 {post.fundingStatusLabel}
            </Link>
          )}
          {post.images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setImageIndex((index) => (index === 0 ? post.images.length - 1 : index - 1))}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setImageIndex((index) => (index === post.images.length - 1 ? 0 : index + 1))}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                {post.images.map((image, index) => (
                  <span key={image.id} className={`h-1.5 w-1.5 rounded-full ${index === imageIndex ? "bg-white" : "bg-white/40"}`} />
                ))}
              </div>
            </>
          )}
        </section>

        <section className="px-4 pt-4">
          <div className="flex items-center justify-between">
            <Link to={`/community/profile/${post.userId}`} className="flex items-center gap-2.5">
              <Avatar className="h-10 w-10">
                <AvatarImage src={post.avatarUrl || undefined} />
                <AvatarFallback className="bg-brand/10 font-bold text-brand">{(post.brandName || post.authorName).slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-bold text-stone-900">{post.brandName || post.authorName}</p>
                <p className="text-xs text-stone-500">@{post.authorName}</p>
              </div>
            </Link>
            {!post.isOwner && (
              <Button
                size="sm"
                variant={post.isFollowingAuthor ? "outline" : "default"}
                className={`h-8 rounded-full px-4 text-xs font-bold ${post.isFollowingAuthor ? "border-stone-300" : "bg-brand hover:bg-brand-dark"}`}
                onClick={handleFollowToggle}
              >
                {post.isFollowingAuthor ? "팔로잉" : "팔로우"}
              </Button>
            )}
          </div>

          <div className="mt-4 flex items-center gap-5">
            <button type="button" onClick={handleToggleLike} className={`flex items-center gap-1.5 text-sm font-bold ${post.likedByMe ? "text-brand" : "text-stone-700"}`}>
              <Heart className={`h-6 w-6 ${post.likedByMe ? "fill-brand" : ""}`} /> {post.likeCount}
            </button>
            <span className="flex items-center gap-1.5 text-sm font-bold text-stone-700">
              <MessageCircle className="h-6 w-6" /> {post.commentCount}
            </span>
            {post.purchaseIntentEnabled && (
              <button
                type="button"
                onClick={handleTogglePurchaseIntent}
                className={`flex items-center gap-1.5 text-sm font-bold ${post.purchaseIntentByMe ? "text-brand" : "text-stone-700"}`}
              >
                <Flame className={`h-6 w-6 ${post.purchaseIntentByMe ? "fill-brand" : ""}`} /> {post.purchaseIntentCount}
              </button>
            )}
            <button type="button" onClick={handleShare} className="ml-auto text-stone-500"><Share2 className="h-5 w-5" /></button>
          </div>

          {post.purchaseIntentEnabled && (
            <p className="mt-2 text-sm font-semibold text-stone-800">
              🔥 {post.purchaseIntentCount}명이 이 옷을 구매하고 싶어합니다.
              {post.targetPurchaseIntentCount && (
                <span className="text-stone-400"> (목표 {post.targetPurchaseIntentCount}명)</span>
              )}
            </p>
          )}

          <h1 className="mt-3 text-lg font-bold tracking-[-0.03em] text-stone-950">{post.title}</h1>
          {post.description && <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-stone-700">{post.description}</p>}
          {post.hashtags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {post.hashtags.map((tag) => (
                <Link key={tag} to={`/community?filter=latest&q=${encodeURIComponent(tag)}`} className="text-xs font-semibold text-brand">#{tag}</Link>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-stone-400">{formatCommunityTime(post.createdAt)}</p>

          {post.poll && (
            <div className="mt-5 rounded-lg border border-stone-200 p-4">
              <p className="text-sm font-bold text-stone-900">{post.poll.question}</p>
              <div className="mt-3 space-y-2">
                {post.poll.options.map((option) => {
                  const percent = post.poll!.totalVotes > 0 ? Math.round((option.votes / post.poll!.totalVotes) * 100) : 0;
                  const isMine = post.poll!.myOptionId === option.id;
                  const hasVoted = Boolean(post.poll!.myOptionId);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={hasVoted}
                      onClick={() => handleVote(option.id)}
                      className="relative w-full overflow-hidden rounded-xl border border-stone-200 px-3 py-2.5 text-left text-sm disabled:cursor-default"
                    >
                      {hasVoted && (
                        <span
                          className={`absolute inset-y-0 left-0 ${isMine ? "bg-brand/20" : "bg-stone-100"}`}
                          style={{ width: `${percent}%` }}
                        />
                      )}
                      <span className="relative flex items-center justify-between">
                        <span className={`font-semibold ${isMine ? "text-brand" : "text-stone-800"}`}>{option.label}</span>
                        {hasVoted && <span className="text-xs font-bold text-stone-500">{percent}% ({option.votes})</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-stone-400">{post.poll.totalVotes}명 참여</p>
            </div>
          )}

          {post.isOwner && goalReached && !post.fundingId && (
            <div className="mt-5 rounded-lg bg-brand p-5 text-center text-white">
              <p className="text-base font-bold">🔥 구매의향 목표를 달성했습니다!</p>
              <p className="mt-1 text-sm text-white/90">"{post.purchaseIntentCount}명이 이 디자인을 구매하고 싶어합니다."</p>
              <Button
                onClick={handleStartFunding}
                disabled={isStartingFunding}
                className="mt-4 h-11 w-full rounded-[3px] bg-white font-bold text-brand hover:bg-white/90"
              >
                {isStartingFunding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                이 디자인으로 펀딩 시작하기
              </Button>
            </div>
          )}

          {post.fundingId && (
            <div className="mt-5 rounded-lg border border-stone-200 p-4">
              <p className="text-sm font-bold text-stone-900">🔥 현재 {post.fundingStatusLabel}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {COMMUNITY_FUNDING_STATUS_ORDER.map((status) => {
                  const currentIndex = COMMUNITY_FUNDING_STATUS_ORDER.indexOf(post.fundingStatus);
                  const stepIndex = COMMUNITY_FUNDING_STATUS_ORDER.indexOf(status);
                  const reached = currentIndex >= 0 && stepIndex <= currentIndex;
                  return (
                    <span key={status} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${reached ? "bg-brand text-white" : "bg-stone-100 text-stone-400"}`}>
                      {COMMUNITY_FUNDING_STATUS_LABEL[status]}
                    </span>
                  );
                })}
              </div>
              <Button asChild className="mt-4 h-10 w-full rounded-[3px] bg-brand hover:bg-brand-dark">
                <Link to={`/fundings/${post.fundingId}`}>펀딩 참여하기</Link>
              </Button>
            </div>
          )}

          <div className="mt-4 flex items-center gap-4 text-xs font-semibold text-stone-400">
            {post.isOwner ? (
              <button type="button" onClick={handleDeletePost} className="flex items-center gap-1 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /> 게시물 삭제</button>
            ) : (
              <button type="button" onClick={handleReport} className="flex items-center gap-1 hover:text-stone-700"><Flag className="h-3.5 w-3.5" /> 신고하기</button>
            )}
          </div>

          <div className="mt-6 border-t border-stone-100 pt-4">
            <p className="text-sm font-bold text-stone-900">댓글 {post.commentCount}</p>
            {comments.length === 0 ? (
              <p className="mt-4 text-sm text-stone-400">가장 먼저 피드백을 남겨보세요.</p>
            ) : (
              comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  depth={0}
                  currentUserId={currentUserId}
                  onReply={(id, name) => setReplyTarget({ id, name })}
                  onToggleLike={handleToggleCommentLike}
                  onUpdate={handleUpdateComment}
                  onDelete={handleDeleteComment}
                />
              ))
            )}
          </div>
        </section>
      </main>

      {/* Phones: sits above the bottom tab bar (which owns the safe-area inset) instead of under it. */}
      <div
        ref={commentBarRef}
        className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-40 border-t border-stone-200 bg-white px-4 py-3 md:bottom-0 md:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        {replyTarget && (
          <div className="mb-1.5 flex items-center justify-between text-xs text-stone-500">
            <span>@{replyTarget.name}님에게 답글 남기는 중</span>
            <button type="button" onClick={() => setReplyTarget(null)} className="font-bold">취소</button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Textarea
            value={commentDraft}
            onChange={(event) => setCommentDraft(event.target.value)}
            placeholder={currentUserId ? "따뜻한 피드백을 남겨주세요." : "댓글을 남기려면 로그인해주세요."}
            className="h-10 min-h-10 flex-1 resize-none rounded-[3px] border-stone-200 px-4 py-2.5 text-sm"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSubmitComment();
              }
            }}
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full bg-brand hover:bg-brand-dark"
            disabled={isSendingComment || !commentDraft.trim()}
            onClick={handleSubmitComment}
          >
            {isSendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CommunityPostDetail;
