
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
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>마이페이지</CardTitle>
            {isFundingReturn && (
              <p className="flex items-start gap-2 rounded-xl bg-brand/10 p-4 text-sm leading-6 text-brand-dark">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                펀딩 참여에 필요한 전화번호와 배송지를 입력해주세요. 저장하면 펀딩 페이지로 돌아갑니다.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <Button type="submit" className="w-full" disabled={isLoading}>
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
