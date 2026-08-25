import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Shirt } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { OutfitCard } from "@/components/outfits/OutfitCard";
import { supabase } from "@/lib/supabase";
import { getOutfitErrorMessage, listPublicOutfits, toggleOutfitLike } from "@/services/outfits";
import type { OutfitCardData } from "@/types/outfit";

const PAGE_SIZE = 24;

const Outfits = () => {
  const [outfits, setOutfits] = useState<OutfitCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await listPublicOutfits({ limit: PAGE_SIZE });
        if (!active) return;
        setOutfits(rows);
        setHasMore(rows.length === PAGE_SIZE);
      } catch (error) {
        if (!active) return;
        toast({ title: "코디 피드를 불러오지 못했어요", description: getOutfitErrorMessage(error), variant: "destructive" });
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const loadMore = async () => {
    const last = outfits[outfits.length - 1];
    if (!last || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const rows = await listPublicOutfits({ limit: PAGE_SIZE, before: last.createdAt });
      setOutfits((prev) => [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (error) {
      toast({ title: "더 불러오지 못했어요", description: getOutfitErrorMessage(error), variant: "destructive" });
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleToggleLike = async (id: string) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      toast({ title: "로그인이 필요해요", description: "좋아요를 누르려면 먼저 로그인해주세요." });
      return;
    }
    setOutfits((prev) =>
      prev.map((outfit) =>
        outfit.id === id
          ? { ...outfit, likedByMe: !outfit.likedByMe, likeCount: outfit.likeCount + (outfit.likedByMe ? -1 : 1) }
          : outfit,
      ),
    );
    try {
      const liked = await toggleOutfitLike(id);
      setOutfits((prev) =>
        prev.map((outfit) => (outfit.id === id ? { ...outfit, likedByMe: liked } : outfit)),
      );
    } catch (error) {
      // Roll back the optimistic update on failure.
      setOutfits((prev) =>
        prev.map((outfit) =>
          outfit.id === id
            ? { ...outfit, likedByMe: !outfit.likedByMe, likeCount: outfit.likeCount + (outfit.likedByMe ? -1 : 1) }
            : outfit,
        ),
      );
      toast({ title: "좋아요를 처리하지 못했어요", description: getOutfitErrorMessage(error), variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f0ea]">
      <Header />
      <main className="mx-auto max-w-[1100px] px-4 pb-24 pt-24 sm:px-6 sm:pt-28">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Outfit feed</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-stone-950 sm:text-4xl">
              코디 피드
            </h1>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              다른 사용자들이 브랜더에게 입힌 코디를 구경하고 마음에 들면 ❤️를 눌러보세요.
            </p>
          </div>
          <Button asChild variant="outline" className="h-10 rounded-full border-stone-300 font-bold">
            <Link to="/closet">
              <Shirt className="mr-2 h-4 w-4" />
              내 코디 만들기
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center text-stone-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : outfits.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-[1.5rem] border border-dashed border-stone-300 bg-white/60 text-center">
            <p className="text-stone-500">아직 공개된 코디가 없어요.</p>
            <Button asChild className="rounded-full bg-brand font-bold hover:bg-brand-dark">
              <Link to="/closet">가장 먼저 코디 올리기</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {outfits.map((outfit) => (
                <OutfitCard key={outfit.id} outfit={outfit} onToggleLike={handleToggleLike} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-full border-stone-300 px-8 font-bold"
                  onClick={() => void loadMore()}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : "더 보기"}
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Outfits;
