
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAddressSearch } from "@/hooks/useAddressSearch";
import { useProfileForm } from "@/hooks/useProfileForm";
import { ReadOnlyFields } from "@/components/profile/ReadOnlyFields";
import { EditableFields } from "@/components/profile/EditableFields";
import { AddressFields } from "@/components/profile/AddressFields";
import { useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

const Profile = () => {
  const [searchParams] = useSearchParams();
  const isFundingReturn = searchParams.get("returnTo")?.startsWith("/fundings/");
  const {
    isLoading,
    email,
    formData,
    handleChange,
    handleGenderChange,
    handleSubmit
  } = useProfileForm();

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
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-28 sm:px-6">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">My brand profile</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">브랜드 프로필</h1>
          <p className="mt-3 text-sm leading-6 text-stone-500">고객에게 보이는 브랜드명과 닉네임, 제작·배송 정보를 관리하세요.</p>
        </div>
        <Card className="mx-auto rounded-[2rem] border-stone-200 bg-white shadow-[0_24px_80px_rgba(36,26,24,0.06)]">
          <CardHeader className="px-6 pt-8 sm:px-10">
            <CardTitle className="text-2xl">기본 정보</CardTitle>
            {isFundingReturn && (
              <p className="flex items-start gap-2 rounded-xl bg-brand/10 p-4 text-sm leading-6 text-brand-dark">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                펀딩 참여에 필요한 전화번호와 배송지를 입력해주세요. 저장하면 펀딩 페이지로 돌아갑니다.
              </p>
            )}
          </CardHeader>
          <CardContent className="px-6 pb-8 sm:px-10 sm:pb-10">
            <form onSubmit={handleSubmit} className="space-y-5">
              <ReadOnlyFields 
                email={email}
                fullName={formData.fullName || ""}
              />

              <EditableFields 
                username={formData.username || ""}
                brandName={formData.brandName || ""}
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
