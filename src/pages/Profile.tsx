
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAddressSearch } from "@/hooks/useAddressSearch";
import { useProfileForm } from "@/hooks/useProfileForm";
import { ReadOnlyFields } from "@/components/profile/ReadOnlyFields";
import { EditableFields } from "@/components/profile/EditableFields";
import { AddressFields } from "@/components/profile/AddressFields";

const Profile = () => {
  const {
    isLoading,
    email,
    userId,
    formData,
    handleChange,
    handleSubmit
  } = useProfileForm();

  const handleAddressSearch = useAddressSearch((data) => {
    // 주소 검색 결과 처리 로직은 useProfileForm 내부로 이동할 수 있지만,
    // useAddressSearch hook의 재사용성을 위해 여기서 처리
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
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <ReadOnlyFields 
                userId={userId}
                email={email}
                fullName={formData.fullName || ""}
                phoneNumber={formData.phoneNumber || ""}
              />

              <EditableFields 
                username={formData.username || ""}
                height={formData.height || ""}
                weight={formData.weight || ""}
                usualSize={formData.usualSize || ""}
                onChange={handleChange}
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
