import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, Pencil } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import {
  fetchCommunityPosts,
  fetchCommunityProfile,
  fetchMyDesignsForCommunity,
  getCommunityErrorMessage,
  toggleCommunityFollow,
  updateCommunityProfile,
  uploadCommunityAvatar,
} from "@/services/community";
import { fetchApprovedFundings } from "@/services/funding";
import type { CommunityPostSummary, CommunityProfile as CommunityProfileType, MyDesignSummary } from "@/types/community";
import type { Funding } from "@/types/funding";

const CommunityProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<CommunityProfileType | null>(null);
  const [posts, setPosts] = useState<CommunityPostSummary[]>([]);
  const [myDesigns, setMyDesigns] = useState<MyDesignSummary[]>([]);
  const [fundings, setFundings] = useState<Funding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [isSavingBio, setIsSavingBio] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const [profileData, postData, allFundings] = await Promise.all([
        fetchCommunityProfile(userId),
        fetchCommunityPosts({ userId }),
        fetchApprovedFundings().catch(() => [] as Funding[]),
      ]);
      setProfile(profileData);
      setPosts(postData);
      setFundings(allFundings.filter((funding) => funding.creator_id === userId));
      setBioDraft(profileData.bio || "");
      if (profileData.isMe) {
        setMyDesigns(await fetchMyDesignsForCommunity().catch(() => []));
      }
    } catch (error) {
      toast({ title: "프로필을 불러오지 못했습니다", description: getCommunityErrorMessage(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const handleFollowToggle = async () => {
    if (!profile) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      navigate(`/auth?returnTo=${encodeURIComponent(`/community/profile/${userId}`)}`);
      return;
    }
    try {
      const following = await toggleCommunityFollow(profile.userId);
      setProfile({
        ...profile,
        isFollowingByMe: following,
        followerCount: profile.followerCount + (following ? 1 : -1),
      });
    } catch (error) {
      toast({ title: "팔로우 처리 실패", description: getCommunityErrorMessage(error), variant: "destructive" });
    }
  };

  const handleAvatarUpload = async (file: File) => {
    try {
      const url = await uploadCommunityAvatar(file);
      await updateCommunityProfile({ avatarUrl: url });
      setProfile((prev) => (prev ? { ...prev, avatarUrl: url } : prev));
      toast({ title: "프로필 이미지를 변경했습니다" });
    } catch (error) {
      toast({ title: "업로드 실패", description: getCommunityErrorMessage(error), variant: "destructive" });
    }
  };

  const handleSaveBio = async () => {
    setIsSavingBio(true);
    try {
      await updateCommunityProfile({ bio: bioDraft });
      setProfile((prev) => (prev ? { ...prev, bio: bioDraft } : prev));
      setIsEditingBio(false);
    } catch (error) {
      toast({ title: "소개 저장 실패", description: getCommunityErrorMessage(error), variant: "destructive" });
    } finally {
      setIsSavingBio(false);
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>
      </div>
    );
  }

  const displayName = profile.brandName || profile.username || "BRAND-ER";

  return (
    <div className="min-h-screen bg-[#f7f6f4] pb-16">
      <Header />
      <main className="mx-auto max-w-2xl px-4 pt-20 sm:pt-24">
        <section className="flex items-start gap-4">
          <button
            type="button"
            className="relative shrink-0"
            onClick={() => profile.isMe && avatarInputRef.current?.click()}
          >
            <Avatar className="h-20 w-20 border border-stone-200">
              <AvatarImage src={profile.avatarUrl || undefined} />
              <AvatarFallback className="bg-brand/10 text-2xl font-bold text-brand">{displayName.slice(0, 1)}</AvatarFallback>
            </Avatar>
            {profile.isMe && (
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white shadow">
                <Pencil className="h-3 w-3" />
              </span>
            )}
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleAvatarUpload(file);
              event.target.value = "";
            }}
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="text-lg font-black text-stone-950">{displayName}</h1>
                {profile.username && <p className="text-sm text-stone-500">@{profile.username}</p>}
              </div>
              {!profile.isMe && (
                <Button
                  size="sm"
                  className={`h-8 shrink-0 rounded-full px-4 text-xs font-bold ${profile.isFollowingByMe ? "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50" : "bg-brand text-white hover:bg-brand-dark"}`}
                  onClick={handleFollowToggle}
                >
                  {profile.isFollowingByMe ? "팔로잉" : "팔로우"}
                </Button>
              )}
            </div>

            <div className="mt-3 flex gap-5 text-sm">
              <span><strong className="text-stone-950">{profile.postCount}</strong> <span className="text-stone-500">게시물</span></span>
              <span><strong className="text-stone-950">{profile.followerCount}</strong> <span className="text-stone-500">팔로워</span></span>
              <span><strong className="text-stone-950">{profile.followingCount}</strong> <span className="text-stone-500">팔로잉</span></span>
            </div>
          </div>
        </section>

        <section className="mt-4">
          {isEditingBio ? (
            <div className="space-y-2">
              <Textarea value={bioDraft} onChange={(event) => setBioDraft(event.target.value)} className="min-h-16 rounded-xl text-sm" maxLength={300} />
              <div className="flex gap-2">
                <Button size="sm" className="h-8 rounded-full bg-brand px-4 text-xs hover:bg-brand-dark" disabled={isSavingBio} onClick={handleSaveBio}>저장</Button>
                <Button size="sm" variant="ghost" className="h-8 rounded-full px-4 text-xs" onClick={() => { setIsEditingBio(false); setBioDraft(profile.bio || ""); }}>취소</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-stone-600">{profile.bio || (profile.isMe ? "소개를 작성해보세요." : "")}</p>
              {profile.isMe && (
                <button type="button" onClick={() => setIsEditingBio(true)} className="shrink-0 text-xs font-bold text-brand">수정</button>
              )}
            </div>
          )}
        </section>

        <Tabs defaultValue="posts" className="mt-6">
          <TabsList className="grid w-full grid-cols-3 rounded-full bg-stone-100 p-1">
            <TabsTrigger value="posts" className="rounded-full text-sm">게시물</TabsTrigger>
            <TabsTrigger value="designs" className="rounded-full text-sm">만든 디자인</TabsTrigger>
            <TabsTrigger value="fundings" className="rounded-full text-sm">펀딩</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-4">
            {posts.length === 0 ? (
              <p className="py-16 text-center text-sm text-stone-400">공유한 디자인이 없습니다.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {posts.map((post) => (
                  <Link key={post.id} to={`/community/${post.id}`} className="aspect-square overflow-hidden rounded-lg bg-stone-100">
                    {post.coverImageUrl && <img src={post.coverImageUrl} alt={post.title} className="h-full w-full object-cover" />}
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="designs" className="mt-4">
            {!profile.isMe ? (
              <p className="py-16 text-center text-sm text-stone-400">본인만 확인할 수 있는 디자인입니다.</p>
            ) : myDesigns.length === 0 ? (
              <p className="py-16 text-center text-sm text-stone-400">BRAND-ER STUDIO에서 만든 디자인이 아직 없습니다.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {myDesigns.map((design) => (
                  <div key={design.id} className="aspect-square overflow-hidden rounded-lg bg-stone-100">
                    <img src={design.frontImageUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="fundings" className="mt-4">
            {fundings.length === 0 ? (
              <p className="py-16 text-center text-sm text-stone-400">진행 중인 펀딩이 없습니다.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {fundings.map((funding) => (
                  <Link key={funding.id} to={`/fundings/${funding.id}`} className="overflow-hidden rounded-xl border border-stone-200">
                    <img src={funding.image_url} alt={funding.product_name} className="aspect-square w-full object-cover" />
                    <p className="truncate px-2 py-1.5 text-xs font-bold text-stone-800">{funding.product_name}</p>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CommunityProfile;
