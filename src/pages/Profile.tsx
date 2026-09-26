
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useAddressSearch } from "@/hooks/useAddressSearch";
import { useProfileForm } from "@/hooks/useProfileForm";
import { ReadOnlyFields } from "@/components/profile/ReadOnlyFields";
import { EditableFields } from "@/components/profile/EditableFields";
import { AddressFields } from "@/components/profile/AddressFields";
import { Link, useSearchParams } from "react-router-dom";
import { ExternalLink, ShieldCheck, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandIdentity } from "@/components/brand/BrandIdentity";
import { fetchMyBrand } from "@/services/brand";
import type { BrandWithCreator } from "@/types/brand";

const Profile = () => {
  const [searchParams] = useSearchParams();
  const isFundingReturn = searchParams.get("returnTo")?.startsWith("/fundings/");
  const [brand, setBrand] = useState<BrandWithCreator | null>(null);
  const {
    isLoading,
    email,
    formData,
    handleChange,
    handleGenderChange,
    handleSubmit
  } = useProfileForm();

  useEffect(() => {
    void fetchMyBrand().then(setBrand).catch(() => setBrand(null));
  }, []);

  const handleAddressSearch = useAddressSearch((data) => {
    handleChange({
      target: { name: 'postcode', value: data.zonecode }
    } as React.ChangeEvent<HTMLInputElement>);
    handleChange({
      target: { name: 'address', value: data.address }
    } as React.ChangeEvent<HTMLInputElement>);
  });

  return (
    <div className="min-h-screen bg-[#f6f3ee]">
      <Header />
      <main className="page-shell max-w-[1180px] pb-16 pt-24 sm:pb-24 sm:pt-32">
        <div className="mb-12 sm:mb-16">
          <p className="eyebrow">My page</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">마이페이지</h1>
          <p className="mt-3 text-sm leading-6 text-stone-500">공개 브랜드 정보와 주문·배송용 회원정보를 구분해 관리하세요.</p>
        </div>
        {/* Label column on the left, content on the right: sections are separated by hairlines, not cards. */}
        <section className="grid gap-6 border-t border-black/10 py-10 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-12">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.02em]"><Store className="h-4 w-4 text-brand" />내 브랜드</h2>
            <p className="mt-2 text-xs leading-5 text-stone-500">펀딩 페이지에 공개되는 제작자 정보입니다.</p>
          </div>
          <div className="max-w-xl">
            {brand ? (
              <div className="space-y-5">
                <BrandIdentity brand={brand} linked />
                <p className="text-sm leading-6 text-stone-500">{brand.short_description || "브랜드 한 줄 소개를 등록해주세요."}</p>
                <div className="flex flex-wrap gap-4 text-xs font-semibold text-stone-500">
                  {brand.instagram_url && <a href={brand.instagram_url} target="_blank" rel="noreferrer">SNS <ExternalLink className="ml-1 inline h-3 w-3" /></a>}
                  {brand.website_url && <a href={brand.website_url} target="_blank" rel="noreferrer">웹사이트 <ExternalLink className="ml-1 inline h-3 w-3" /></a>}
                </div>
              </div>
            ) : (
              <p className="text-sm leading-6 text-stone-500">펀딩을 만들려면 먼저 제작자 프로필과 내 브랜드를 등록해야 합니다.</p>
            )}
            <Button asChild variant={brand ? "outline" : "default"} className={`mt-6 w-full sm:w-auto ${brand ? "" : "bg-brand hover:bg-brand-dark"}`}>
              <Link to="/my-brand">{brand ? "브랜드 프로필 수정" : "내 브랜드 등록"}</Link>
            </Button>
          </div>
        </section>
        <section className="grid gap-6 border-t border-black/10 py-10 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-12">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.02em]">회원·배송 정보</h2>
            <p className="mt-2 text-xs leading-5 text-stone-500">주문과 배송에만 사용되며 공개되지 않습니다.</p>
          </div>
          <div className="max-w-xl">
            {isFundingReturn && (
              <p className="mb-6 flex items-start gap-2 border-l-2 border-brand bg-brand/[0.05] p-4 text-sm leading-6 text-brand-dark">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                펀딩 참여에 필요한 전화번호와 배송지를 입력해주세요. 저장하면 펀딩 페이지로 돌아갑니다.
              </p>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              <ReadOnlyFields 
                email={email}
                fullName={formData.fullName || ""}
              />

              <EditableFields 
                username={formData.username || ""}
                phoneNumber={formData.phoneNumber || ""}
                height={formData.height || ""}
                weight={formData.weight || ""}
                gender={formData.gender || "남성"}
                onChange={handleChange}
                onGenderChange={handleGenderChange}
              />

              <AddressFields 
                postcode={formData.postcode || ""}
                address={formData.address || ""}
                addressDetail={formData.addressDetail || ""}
                onAddressSearch={handleAddressSearch}
                onChange={handleChange}
              />

              <Button type="submit" className="h-14 w-full rounded-[2px] bg-brand text-base font-semibold hover:bg-brand-dark" disabled={isLoading}>
                {isLoading ? "저장 중..." : "저장하기"}
              </Button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Profile;
