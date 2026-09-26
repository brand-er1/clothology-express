import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ExternalLink, Instagram, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { SafeBrandImage } from "@/components/brand/SafeBrandImage";
import { Badge } from "@/components/ui/badge";
import { FundingProductCard } from "@/components/funding/FundingProductCard";
import { fetchBrand, fetchBrandFundings } from "@/services/brand";
import type { BrandWithCreator } from "@/types/brand";
import type { Funding } from "@/types/funding";

const FundingGrid = ({ title, brandName, items }: { title: string; brandName: string; items: Funding[] }) => (
  <section className="mt-20 sm:mt-28">
    <div className="flex items-baseline justify-between gap-4 border-t border-black/10 pt-8">
      <h2 className="display-section">{title}</h2>
      <span className="font-display text-sm text-stone-500">{String(items.length).padStart(2, "0")}</span>
    </div>
    {items.length ? (
      <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-12 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 lg:gap-x-8">
        {items.map((funding) => (
          <FundingProductCard key={funding.id} item={funding} to={`/fundings/${funding.id}`} brandName={brandName} />
        ))}
      </div>
    ) : <p className="py-12 text-sm text-stone-500">표시할 펀딩이 없습니다.</p>}
  </section>
);

const BrandProfile = () => {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const [brand, setBrand] = useState<BrandWithCreator | null>(null);
  const [fundings, setFundings] = useState<Funding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brandId) return;
    Promise.all([fetchBrand(brandId), fetchBrandFundings(brandId)])
      .then(([brandData, fundingData]) => { setBrand(brandData); setFundings(fundingData); })
      .catch(() => navigate("/fundings", { replace: true }))
      .finally(() => setLoading(false));
  }, [brandId, navigate]);

  if (loading || !brand) return <div className="min-h-screen bg-[#f6f3ee]"><Header /><div className="flex min-h-screen items-center justify-center text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />브랜드를 불러오는 중입니다</div></div>;

  const active = fundings.filter((item) => item.status === "approved");
  const closed = fundings.filter((item) => item.status === "closed");

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f6f3ee] text-[#211b1c]">
      <Header />
      <main className="page-shell pb-24 pt-24 sm:pt-32">
        <section className="grid min-w-0 gap-7 pb-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-end sm:gap-10">
          <SafeBrandImage src={brand.brand_logo_url} alt={brand.brand_name} kind="logo" className="h-32 w-32 sm:h-40 sm:w-40" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h1 className="display-hero break-words">{brand.brand_name}</h1>{brand.status !== "active" && <Badge variant="secondary">운영 중지</Badge>}</div>
            <p className="mt-4 text-base leading-7 text-stone-600">{brand.short_description || "브랜드의 새로운 컬렉션을 만나보세요."}</p>
            <div className="mt-5 flex items-center gap-3">
              <SafeBrandImage src={brand.creator_profile?.profile_image_url} alt={brand.creator_profile?.display_name || "제작자"} kind="profile" className="h-10 w-10" />
              <div><p className="text-xs text-stone-400">제작자</p><p className="text-sm font-bold">{brand.creator_profile?.display_name || "제작자"}</p></div>
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
              {brand.instagram_url && <a href={brand.instagram_url} target="_blank" rel="noreferrer" className="inline-flex items-center hover:text-brand"><Instagram className="mr-1.5 h-4 w-4" />Instagram</a>}
              {brand.website_url && <a href={brand.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center hover:text-brand"><ExternalLink className="mr-1.5 h-4 w-4" />Website</a>}
            </div>
          </div>
        </section>

        {(brand.description || brand.creator_profile?.bio) && (
          <section className="mt-16 grid gap-10 border-t border-black/10 pt-8 sm:grid-cols-2 sm:gap-12">
            <div><p className="eyebrow">About brand</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-600">{brand.description || "브랜드 소개를 준비 중입니다."}</p></div>
            <div><p className="eyebrow">About creator</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-600">{brand.creator_profile?.bio || "제작자 소개를 준비 중입니다."}</p></div>
          </section>
        )}
        <FundingGrid title="진행 중인 펀딩" brandName={brand.brand_name} items={active} />
        <FundingGrid title="종료된 펀딩" brandName={brand.brand_name} items={closed} />
      </main>
    </div>
  );
};

export default BrandProfile;
