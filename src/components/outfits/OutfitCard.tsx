import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import type { OutfitCardData } from "@/types/outfit";

interface OutfitCardProps {
  outfit: OutfitCardData;
  onToggleLike?: (id: string) => void;
}

/** Feed card — image / author / title / ❤️ like count only, per the "코디 피드" spec. */
export const OutfitCard = ({ outfit, onToggleLike }: OutfitCardProps) => {
  return (
    <div className="group overflow-hidden rounded-[1.25rem] border border-stone-200 bg-white shadow-sm transition hover:shadow-md">
      <Link to={`/outfits/${outfit.id}`} className="block">
        <div className="flex aspect-[3/4] items-center justify-center overflow-hidden bg-[#f4f0ea]">
          <img
            src={outfit.imageUrl}
            alt={outfit.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
          />
        </div>
      </Link>
      <div className="space-y-1.5 p-3">
        <Link to={`/outfits/${outfit.id}`} className="block truncate text-sm font-black text-stone-950">
          {outfit.title}
        </Link>
        <div className="flex items-center justify-between">
          <p className="truncate text-xs font-bold text-stone-500">{outfit.authorName}</p>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              onToggleLike?.(outfit.id);
            }}
            className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-bold transition ${
              outfit.likedByMe ? "bg-rose-50 text-rose-500" : "text-stone-400 hover:text-rose-500"
            }`}
            aria-label="좋아요"
          >
            <Heart className={`h-3.5 w-3.5 ${outfit.likedByMe ? "fill-rose-500" : ""}`} />
            {outfit.likeCount}
          </button>
        </div>
      </div>
    </div>
  );
};
