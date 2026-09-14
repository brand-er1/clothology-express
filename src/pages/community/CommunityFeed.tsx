import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Heart, MessageCircle, Flame, Loader2, Plus, Search, X, Bell } from "lucide-react";
import { Header } from "@/components/Header";
import CommunityInsights from "@/components/community/CommunityInsights";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCommunityTime } from "@/lib/communityTime";
import { fetchCommunityPosts, getCommunityErrorMessage } from "@/services/community";
import { toast } from "@/components/ui/use-toast";
import type { CommunityFeedFilter, CommunityPostSummary } from "@/types/community";
import { COMMUNITY_FUNDING_STATUS_LABEL, POPULAR_HASHTAGS } from "@/types/community";

const filterTabs: { value: CommunityFeedFilter; label: string }[] = [
  { value: "popular", label: "인기" },
  { value: "latest", label: "최신" },
  { value: "feedback", label: "피드백 요청" },
  { value: "funding_soon", label: "펀딩 예정" },
  { value: "in_production", label: "제작 중" },
];

const PostCard = ({ post }: { post: CommunityPostSummary }) => (
  <Link to={`/community/${post.id}`} className="group block min-w-0">
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-stone-100">
      {post.coverImageUrl ? (
        <img src={post.coverImageUrl} alt={post.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-stone-300">No image</div>
      )}
      {post.fundingStatus !== "none" && (
        <span className="absolute left-2 top-2 rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold text-white shadow">🔥 {COMMUNITY_FUNDING_STATUS_LABEL[post.fundingStatus]}</span>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent px-3 pb-2.5 pt-8">
        <div className="flex items-center gap-3 text-[11px] font-semibold text-white/95">
          <span className="flex items-center gap-1"><Heart className={`h-3.5 w-3.5 ${post.likedByMe ? "fill-white" : ""}`} /> {post.likeCount}</span>
          <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {post.commentCount}</span>
          <span className="flex items-center gap-1"><Flame className={`h-3.5 w-3.5 ${post.purchaseIntentByMe ? "fill-white" : ""}`} /> {post.purchaseIntentCount}명</span>
        </div>
      </div>
    </div>
    <div className="mt-2 px-0.5">
      <h3 className="truncate text-sm font-bold text-stone-900">{post.title}</h3>
      <p className="truncate text-xs font-semibold text-stone-500">@{post.brandName || post.authorName}</p>
      {post.description && <p className="mt-0.5 line-clamp-1 text-xs text-stone-400">{post.description}</p>}
      <p className="mt-0.5 text-[11px] text-stone-400">{formatCommunityTime(post.createdAt)}</p>
    </div>
  </Link>
);

const CommunityFeed = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = (searchParams.get("filter") as CommunityFeedFilter) || "latest";
  const [filter, setFilter] = useState<CommunityFeedFilter>(initialFilter);
  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");
  const [activeSearch, setActiveSearch] = useState(searchParams.get("q") || "");
  const [posts, setPosts] = useState<CommunityPostSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  const load = useCallback(async (reset: boolean) => {
    if (reset) setIsLoading(true); else setIsLoadingMore(true);
    try {
      const offset = reset ? 0 : posts.length;
      const data = await fetchCommunityPosts({ filter, search: activeSearch || null, limit: PAGE_SIZE, offset });
      setPosts((prev) => (reset ? data : [...prev, ...data]));
      setHasMore(data.length === PAGE_SIZE);
    } catch (error) {
      toast({ title: "게시물을 불러오지 못했습니다", description: getCommunityErrorMessage(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, activeSearch]);

  useEffect(() => { void load(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter, activeSearch]);

  const handleSearchSubmit = (value: string) => {
    setActiveSearch(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set("q", value); else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  const handleFilterChange = (value: CommunityFeedFilter) => {
    setFilter(value);
    const next = new URLSearchParams(searchParams);
    next.set("filter", value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f7f6f4]">
      <Header />
      <main className="mx-auto max-w-[1100px] px-4 pb-24 pt-20 sm:px-6 sm:pt-24">
        <section className="relative pt-4 text-center sm:pt-6">
          <Link to="/community/notifications" className="absolute right-0 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white text-stone-500 shadow-sm hover:text-brand sm:top-6" aria-label="알림"><Bell className="h-4.5 w-4.5" /></Link>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand">COMMUNITY</p>
          <h1 className="mt-2 text-2xl font-black tracking-[-0.03em] text-stone-950 sm:text-3xl">디자인을 나누고, 패션을 더 깊게 읽어보세요.</h1>
        </section>

        <CommunityInsights />

        <section className="mx-auto mt-7 max-w-xl">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") handleSearchSubmit(searchInput.trim()); }} placeholder="디자인, 브랜드, 사용자, 해시태그 검색" className="h-12 rounded-full border-stone-200 bg-white pl-10 pr-10 shadow-sm" />
            {searchInput && <button type="button" onClick={() => { setSearchInput(""); handleSearchSubmit(""); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"><X className="h-4 w-4" /></button>}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {POPULAR_HASHTAGS.map((tag) => <button key={tag} type="button" onClick={() => { setSearchInput(`#${tag}`); handleSearchSubmit(tag); }} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 shadow-sm transition hover:bg-brand/10 hover:text-brand">#{tag}</button>)}
          </div>
        </section>

        <section className="sticky top-16 z-10 -mx-4 mt-6 bg-[#f7f6f4]/95 px-4 py-3 backdrop-blur sm:top-[72px] sm:mx-0 sm:rounded-2xl sm:px-3">
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filterTabs.map((tab) => <button key={tab.value} type="button" onClick={() => handleFilterChange(tab.value)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${filter === tab.value ? "bg-brand text-white" : "bg-white text-stone-500 hover:text-stone-900"}`}>{tab.label}</button>)}
          </div>
        </section>

        {activeSearch && <p className="mt-4 text-sm text-stone-500">"<span className="font-semibold text-stone-800">{activeSearch}</span>" 검색 결과 {posts.length}건</p>}

        <section className="mt-4">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin text-brand" /> 게시물을 불러오는 중입니다</div>
          ) : posts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-stone-300 bg-white/60 py-24 text-center">
              <p className="text-lg font-bold text-stone-700">아직 게시물이 없습니다.</p><p className="mt-2 text-sm text-stone-500">가장 먼저 당신의 디자인을 공유해보세요.</p>
              <Button asChild className="mt-6 rounded-full bg-brand hover:bg-brand-dark"><Link to="/community/new">새 디자인 공유하기</Link></Button>
            </div>
          ) : (
            <><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">{posts.map((post) => <PostCard key={post.id} post={post} />)}</div>
            {hasMore && <div className="mt-8 flex justify-center"><Button variant="outline" className="rounded-full border-stone-300" onClick={() => void load(false)} disabled={isLoadingMore}>{isLoadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}더 불러오기</Button></div>}</>
          )}
        </section>
      </main>

      <Link to="/community/new" className="fixed bottom-20 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-xl transition hover:bg-brand-dark sm:bottom-8" aria-label="새 디자인 공유하기"><Plus className="h-6 w-6" /></Link>
    </div>
  );
};

export default CommunityFeed;
