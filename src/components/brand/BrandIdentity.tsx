import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SafeBrandImage } from "@/components/brand/SafeBrandImage";
import type { BrandWithCreator } from "@/types/brand";

export const BrandIdentity = ({
  brand,
  compact = false,
  linked = true,
}: {
  brand: BrandWithCreator | null | undefined;
  compact?: boolean;
  linked?: boolean;
}) => {
  if (!brand) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <SafeBrandImage alt="제작자" kind="profile" className={compact ? "h-8 w-8" : "h-12 w-12"} />
        <div className="min-w-0">
          <p className="text-xs text-stone-400">제작자</p>
          <p className="truncate text-sm font-semibold text-stone-600">제작자 정보 확인 중</p>
        </div>
      </div>
    );
  }

  const content = (
    <div className="flex min-w-0 items-center gap-3">
      <SafeBrandImage
        src={brand.brand_logo_url || brand.creator_profile?.profile_image_url}
        alt={brand.brand_name}
        kind={brand.brand_logo_url ? "logo" : "profile"}
        className={compact ? "h-8 w-8" : "h-12 w-12"}
      />
      <div className="min-w-0 flex-1">
        {!compact && <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">제작자</p>}
        <p className="truncate text-sm font-bold text-[#211b1c]">{brand.brand_name}</p>
        {!compact && (
          <p className="truncate text-xs text-stone-500">by {brand.creator_profile?.display_name || "제작자"}</p>
        )}
      </div>
      {!compact && <ArrowRight className="h-4 w-4 shrink-0 text-stone-400" />}
    </div>
  );

  return linked ? (
    <Link to={`/brands/${brand.id}`} className="block transition hover:opacity-75">
      {content}
    </Link>
  ) : content;
};
