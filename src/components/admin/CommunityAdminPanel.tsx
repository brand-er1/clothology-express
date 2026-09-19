import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import {
  adminDeleteCommunityComment,
  fetchAdminCommunityComments,
  fetchAdminCommunityPosts,
  fetchAdminCommunityReports,
  fetchAdminCommunityStats,
  fetchAdminCommunityTopPosts,
  getCommunityErrorMessage,
  moderateCommunityPost,
  resolveCommunityReport,
} from "@/services/community";
import type {
  AdminCommunityComment,
  AdminCommunityPost,
  AdminCommunityReport,
  AdminCommunityStats,
  AdminCommunityTopPost,
} from "@/types/community";
import { COMMUNITY_FUNDING_STATUS_LABEL } from "@/types/community";
import { Eye, EyeOff, Flame, Heart, MessageCircle, Trash2 } from "lucide-react";

const moderationBadge = (status: AdminCommunityPost["moderationStatus"]) => {
  if (status === "hidden") return <Badge className="bg-amber-500">숨김</Badge>;
  if (status === "removed") return <Badge variant="destructive">삭제됨</Badge>;
  return <Badge className="bg-emerald-600">공개</Badge>;
};

export const CommunityAdminPanel = () => {
  const [stats, setStats] = useState<AdminCommunityStats | null>(null);
  const [popularPosts, setPopularPosts] = useState<AdminCommunityTopPost[]>([]);
  const [demandPosts, setDemandPosts] = useState<AdminCommunityTopPost[]>([]);
  const [posts, setPosts] = useState<AdminCommunityPost[]>([]);
  const [comments, setComments] = useState<AdminCommunityComment[]>([]);
  const [reports, setReports] = useState<AdminCommunityReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [statsData, popular, demand, postData, commentData, reportData] = await Promise.all([
        fetchAdminCommunityStats(),
        fetchAdminCommunityTopPosts("like_count"),
        fetchAdminCommunityTopPosts("purchase_intent_count"),
        fetchAdminCommunityPosts(),
        fetchAdminCommunityComments(),
        fetchAdminCommunityReports(),
      ]);
      setStats(statsData);
      setPopularPosts(popular);
      setDemandPosts(demand);
      setPosts(postData);
      setComments(commentData);
      setReports(reportData);
    } catch (error) {
      toast({ title: "커뮤니티 데이터를 불러오지 못했습니다", description: getCommunityErrorMessage(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadAll(); }, []);

  const handleModerate = async (post: AdminCommunityPost, status: "visible" | "hidden" | "removed") => {
    try {
      await moderateCommunityPost(post.id, status);
      toast({ title: "게시물 상태를 변경했습니다" });
      setPosts((prev) => prev.map((item) => (item.id === post.id ? { ...item, moderationStatus: status } : item)));
    } catch (error) {
      toast({ title: "처리 실패", description: getCommunityErrorMessage(error), variant: "destructive" });
    }
  };

  const handleDeleteComment = async (comment: AdminCommunityComment) => {
    if (!window.confirm("이 댓글을 삭제할까요?")) return;
    try {
      await adminDeleteCommunityComment(comment.id);
      setComments((prev) => prev.map((item) => (item.id === comment.id ? { ...item, isDeleted: true } : item)));
    } catch (error) {
      toast({ title: "삭제 실패", description: getCommunityErrorMessage(error), variant: "destructive" });
    }
  };

  const handleResolveReport = async (report: AdminCommunityReport, status: "reviewed" | "dismissed") => {
    try {
      await resolveCommunityReport(report.id, status);
      setReports((prev) => prev.map((item) => (item.id === report.id ? { ...item, status } : item)));
    } catch (error) {
      toast({ title: "처리 실패", description: getCommunityErrorMessage(error), variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-gray-500">커뮤니티 데이터를 불러오는 중입니다...</div>;
  }

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "전체 게시물", value: stats.totalPosts },
            { label: "전체 댓글", value: stats.totalComments },
            { label: "구매의향 등록", value: stats.totalPurchaseIntents },
            { label: "펀딩 전환", value: stats.totalFundingConversions },
            { label: "펀딩 전환율", value: `${stats.fundingConversionRate}%` },
            { label: "미처리 신고", value: stats.pendingReports },
          ].map((item) => (
            <Card key={item.label} className="rounded-2xl">
              <CardContent className="p-4">
                <p className="text-xs font-bold text-gray-500">{item.label}</p>
                <p className="mt-2 text-2xl font-black text-stone-950">{item.value.toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="posts">
        <TabsList className="rounded-full">
          <TabsTrigger value="posts" className="rounded-full">게시물 관리</TabsTrigger>
          <TabsTrigger value="comments" className="rounded-full">댓글 관리</TabsTrigger>
          <TabsTrigger value="reports" className="rounded-full">신고 관리</TabsTrigger>
          <TabsTrigger value="ranking" className="rounded-full">인기/구매의향 순위</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-4">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle>전체 게시물</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>디자인</TableHead>
                      <TableHead>제목</TableHead>
                      <TableHead>작성자</TableHead>
                      <TableHead>반응</TableHead>
                      <TableHead>신고</TableHead>
                      <TableHead>펀딩</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posts.map((post) => (
                      <TableRow key={post.id}>
                        <TableCell>
                          <div className="h-12 w-12 overflow-hidden rounded-lg bg-gray-100">
                            {post.coverImageUrl && <img src={post.coverImageUrl} alt="" className="h-full w-full object-cover" />}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-48 truncate font-medium">{post.title}</TableCell>
                        <TableCell className="text-sm text-gray-500">{post.brandName || post.authorName}</TableCell>
                        <TableCell className="text-xs text-gray-500">
                          <span className="mr-2 inline-flex items-center gap-1"><Heart className="h-3 w-3" />{post.likeCount}</span>
                          <span className="mr-2 inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{post.commentCount}</span>
                          <span className="inline-flex items-center gap-1"><Flame className="h-3 w-3" />{post.purchaseIntentCount}</span>
                        </TableCell>
                        <TableCell>{post.reportCount > 0 ? <Badge variant="destructive">{post.reportCount}</Badge> : "-"}</TableCell>
                        <TableCell className="text-xs">
                          {post.fundingId ? COMMUNITY_FUNDING_STATUS_LABEL[post.fundingStatus] : "-"}
                        </TableCell>
                        <TableCell>{moderationBadge(post.moderationStatus)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {post.moderationStatus !== "visible" && (
                              <Button variant="outline" size="sm" onClick={() => handleModerate(post, "visible")}><Eye className="mr-1 h-3.5 w-3.5" />공개</Button>
                            )}
                            {post.moderationStatus !== "hidden" && (
                              <Button variant="outline" size="sm" onClick={() => handleModerate(post, "hidden")}><EyeOff className="mr-1 h-3.5 w-3.5" />숨김</Button>
                            )}
                            {post.moderationStatus !== "removed" && (
                              <Button variant="destructive" size="sm" onClick={() => handleModerate(post, "removed")}><Trash2 className="mr-1 h-3.5 w-3.5" />삭제</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comments" className="mt-4">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle>최근 댓글</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>게시물</TableHead>
                      <TableHead>작성자</TableHead>
                      <TableHead>내용</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comments.map((comment) => (
                      <TableRow key={comment.id}>
                        <TableCell className="max-w-40 truncate text-sm">{comment.postTitle}</TableCell>
                        <TableCell className="text-sm text-gray-500">{comment.authorName}</TableCell>
                        <TableCell className="max-w-72 truncate text-sm">{comment.content}</TableCell>
                        <TableCell>{comment.isDeleted ? <Badge variant="destructive">삭제됨</Badge> : <Badge className="bg-emerald-600">공개</Badge>}</TableCell>
                        <TableCell className="text-right">
                          {!comment.isDeleted && (
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteComment(comment)}><Trash2 className="mr-1 h-3.5 w-3.5" />삭제</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle>신고 내역</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>유형</TableHead>
                      <TableHead>대상</TableHead>
                      <TableHead>신고자</TableHead>
                      <TableHead>사유</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="text-right">처리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-gray-500">신고 내역이 없습니다.</TableCell></TableRow>
                    ) : reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="text-sm">{{ post: "게시물", comment: "댓글", user: "사용자" }[report.targetType]}</TableCell>
                        <TableCell className="max-w-48 truncate text-sm">{report.targetSummary || "-"}</TableCell>
                        <TableCell className="text-sm text-gray-500">{report.reporterName}</TableCell>
                        <TableCell className="max-w-48 truncate text-sm">{report.reason || "-"}</TableCell>
                        <TableCell>
                          {report.status === "pending" && <Badge className="bg-amber-500">대기</Badge>}
                          {report.status === "reviewed" && <Badge className="bg-emerald-600">처리됨</Badge>}
                          {report.status === "dismissed" && <Badge variant="secondary">기각</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          {report.status === "pending" && (
                            <div className="flex justify-end gap-1.5">
                              <Button variant="outline" size="sm" onClick={() => handleResolveReport(report, "reviewed")}>처리</Button>
                              <Button variant="ghost" size="sm" onClick={() => handleResolveReport(report, "dismissed")}>기각</Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ranking" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl">
              <CardHeader><CardTitle>인기 게시물 (좋아요 순)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {popularPosts.map((post, index) => (
                  <div key={post.id} className="flex items-center gap-3">
                    <span className="w-5 text-sm font-bold text-gray-400">{index + 1}</span>
                    <div className="h-10 w-10 overflow-hidden rounded-lg bg-gray-100">
                      {post.coverImageUrl && <img src={post.coverImageUrl} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{post.title}</p>
                      <p className="text-xs text-gray-500">{post.authorName} · ♡ {post.likeCount}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardHeader><CardTitle>구매의향 상위 디자인</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {demandPosts.map((post, index) => (
                  <div key={post.id} className="flex items-center gap-3">
                    <span className="w-5 text-sm font-bold text-gray-400">{index + 1}</span>
                    <div className="h-10 w-10 overflow-hidden rounded-lg bg-gray-100">
                      {post.coverImageUrl && <img src={post.coverImageUrl} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{post.title}</p>
                      <p className="text-xs text-gray-500">{post.authorName} · 🔥 {post.purchaseIntentCount}명{post.fundingId ? " · 펀딩 전환됨" : ""}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
