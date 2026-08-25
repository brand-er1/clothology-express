import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Heart, Loader2, Sparkles } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { closetSlotLabel, closetSlotOrder } from "@/lib/closet-character-config";
import { supabase } from "@/lib/supabase";
import { getOutfitErrorMessage, getOutfitDetail, toggleOutfitLike } from "@/services/outfits";
import type { OutfitDetailData } from "@/types/outfit";

const OutfitDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [outfit, setOutfit] = useState<OutfitDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiking, setIsLiking] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; label: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setIsLoading(true);
    getOutfitDetail(id)
      .then((data) => {
        if (active) setOutfit(data);
      })
      .catch((error) => {
        if (active) {
          toast({ title: "코디를 불러오지 못했어요", description: getOutfitErrorMessage(error), variant: "destructive" });
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const handleToggleLike = async () => {
    if (!outfit || isLiking) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      toast({ title: "로그인이 필요해요", description: "좋아요를 누르려면 먼저 로그인해주세요." });
      return;
    }
    setIsLiking(true);
    const previous = outfit;
    setOutfit({
      ...outfit,
      likedByMe: !outfit.likedByMe,
      likeCount: outfit.likeCount + (outfit.likedByMe ? -1 : 1),
    });
    try {
      const liked = await toggleOutfitLike(outfit.id);
      setOutfit((current) => (current ? { ...current, likedByMe: liked } : current));
    } catch (error) {
      setOutfit(previous);
      toast({ title: "좋아요를 처리하지 못했어요", description: getOutfitErrorMessage(error), variant: "destructive" });
    } finally {
      setIsLiking(false);
    }
  };

  // "이 코디 참고하기" — loads this outfit's item images as Garment References into the closet
  // studio so the visitor can freely remix them. Never edits the original outfit or its author data.
  const handleReferenceOutfit = () => {
    if (!outfit) return;
    navigate("/closet", {
      state: {
        referenceOutfit: {
          characterGender: outfit.characterGender,
          items: outfit.items,
        },
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f0ea]">
        <Header />
        <main className="flex min-h-[60vh] items-center justify-center pt-24">
          <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
        </main>
      </div>
    );
  }

  if (!outfit) {
    return (
      <div className="min-h-screen bg-[#f4f0ea]">
        <Header />
        <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 pt-24 text-center">
          <p className="text-stone-500">코디를 찾을 수 없어요.</p>
          <Button asChild variant="outline" className="rounded-full border-stone-300 font-bold">
            <Link to="/outfits">코디 피드로 돌아가기</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0ea]">
      <Header />
      <main className="mx-auto max-w-[1000px] px-4 pb-24 pt-24 sm:px-6 sm:pt-28">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white">
            <img
              src={outfit.imageUrl}
              alt={outfit.title}
              className="h-full w-full object-contain"
            />
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Outfit</p>
              <h1 className="mt-2 text-2xl font-black tracking-[-0.03em] text-stone-950 sm:text-3xl">
                {outfit.title}
              </h1>
              <p className="mt-1.5 text-sm font-bold text-stone-500">{outfit.authorName}</p>
              {outfit.description && (
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-stone-600">{outfit.description}</p>
              )}
            </div>

            {outfit.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {outfit.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-500">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleToggleLike()}
              disabled={isLiking}
              className={`flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-bold transition ${
                outfit.likedByMe
                  ? "border-rose-200 bg-rose-50 text-rose-500"
                  : "border-stone-300 bg-white text-stone-600 hover:border-rose-200 hover:text-rose-500"
              }`}
            >
              <Heart className={`h-4 w-4 ${outfit.likedByMe ? "fill-rose-500" : ""}`} />
              좋아요 {outfit.likeCount}
            </button>

            <div className="rounded-[1.5rem] border border-stone-200 bg-white p-5">
              <p className="mb-3 text-sm font-black text-stone-950">이 코디에 사용된 아이템</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {closetSlotOrder
                  .map((slot) => outfit.items.find((item) => item.slot === slot))
                  .filter((item): item is NonNullable<typeof item> => Boolean(item))
                  .map((item) => (
                    <button
                      key={item.slot}
                      type="button"
                      onClick={() => setZoomedImage({ url: item.imageUrl, label: item.label || closetSlotLabel[item.slot] })}
                      className="overflow-hidden rounded-xl border border-stone-200 bg-[#f4f0ea] text-left transition hover:border-brand/40"
                    >
                      <div className="flex aspect-square items-center justify-center p-2">
                        <img src={item.imageUrl} alt={item.label || item.slot} className="h-full w-full object-contain" />
                      </div>
                      <p className="truncate px-2 pb-2 text-[10px] font-bold text-stone-500">
                        {closetSlotLabel[item.slot]}
                      </p>
                    </button>
                  ))}
              </div>
            </div>

            <Button
              type="button"
              className="h-12 w-full rounded-full bg-brand text-base font-bold hover:bg-brand-dark"
              onClick={handleReferenceOutfit}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              이 코디 참고하기
            </Button>
          </div>
        </div>
      </main>

      <Dialog open={Boolean(zoomedImage)} onOpenChange={(open) => !open && setZoomedImage(null)}>
        <DialogContent className="max-w-lg rounded-[1.5rem]">
          <DialogTitle className="sr-only">{zoomedImage?.label || "아이템 이미지"}</DialogTitle>
          {zoomedImage && (
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-[#f4f0ea] p-4">
              <img src={zoomedImage.url} alt={zoomedImage.label} className="h-full w-full object-contain" />
            </div>
          )}
          {zoomedImage && <p className="text-center text-sm font-bold text-stone-700">{zoomedImage.label}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OutfitDetail;
