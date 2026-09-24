
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="min-h-screen bg-[#f4f0ea]">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-24 sm:px-6 sm:pb-20 sm:pt-28">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">My page</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.03em]">마이페이지</h1>
          <p className="mt-3 text-sm leading-6 text-stone-500">공개 브랜드 정보와 주문·배송용 회원정보를 구분해 관리하세요.</p>
        </div>
        <Card className="mb-6 rounded-[2rem] border-stone-200 bg-white shadow-[0_24px_80px_rgba(36,26,24,0.06)]">
          <CardHeader className="px-6 pt-7 sm:px-10">
            <CardTitle className="flex items-center gap-2 text-2xl"><Store className="h-5 w-5 text-brand" />내 브랜드</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-7 sm:px-10">
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
            <Button asChild variant={brand ? "outline" : "default"} className={`mt-6 w-full rounded-full ${brand ? "" : "bg-brand hover:bg-brand-dark"}`}>
              <Link to="/my-brand">{brand ? "브랜드 프로필 수정" : "내 브랜드 등록"}</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="mx-auto rounded-[2rem] border-stone-200 bg-white shadow-[0_24px_80px_rgba(36,26,24,0.06)]">
          <CardHeader className="px-5 pt-7 sm:px-10 sm:pt-8">
            <CardTitle className="text-2xl">회원·배송 정보</CardTitle>
            {isFundingReturn && (
              <p className="flex items-start gap-2 rounded-xl bg-brand/10 p-4 text-sm leading-6 text-brand-dark">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                펀딩 참여에 필요한 전화번호와 배송지를 입력해주세요. 저장하면 펀딩 페이지로 돌아갑니다.
              </p>
            )}
          </CardHeader>
          <CardContent className="px-5 pb-7 sm:px-10 sm:pb-10">
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

              <Button type="submit" className="h-14 w-full rounded-full bg-brand text-base font-bold hover:bg-brand-dark" disabled={isLoading}>
                {isLoading ? "저장 중..." : "저장하기"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Profile;
