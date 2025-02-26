
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { useAddressSearch } from "@/hooks/useAddressSearch";
import { AuthFormData } from "@/types/auth";

const Profile = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<AuthFormData>>({
    username: "",
    fullName: "",
    phoneNumber: "",
    address: "",
    addressDetail: "",
    postcode: "",
    height: "",
    weight: "",
    usualSize: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddressSearch = useAddressSearch((data) => {
    setFormData(prev => ({
      ...prev,
      postcode: data.zonecode,
      address: data.address,
    }));
  });

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (profile) {
        // 주소 정보 파싱
        const addressMatch = profile.address?.match(/^(.*?)\s*(?:\((.*?)\))?$/);
        const mainAddress = addressMatch?.[1] || "";
        const postcode = addressMatch?.[2] || "";
        
        // 상세주소 분리 (마지막 공백을 기준으로)
        const addressParts = mainAddress.trim().split(/\s+/);
        const addressDetail = addressParts.length > 1 ? addressParts.pop() : "";
        const baseAddress = addressParts.join(" ");

        setFormData({
          username: profile.username || "",
          fullName: profile.full_name || "",
          phoneNumber: profile.phone_number || "",
          address: baseAddress || "",
          addressDetail: addressDetail || "",
          postcode: postcode || "",
          height: profile.height?.toString() || "",
          weight: profile.weight?.toString() || "",
          usualSize: profile.usual_size || "",
        });
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      toast({
        title: "프로필 로드 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다.");

      const fullAddress = formData.addressDetail 
        ? `${formData.address} ${formData.addressDetail} (${formData.postcode})`
        : `${formData.address} (${formData.postcode})`;

      const { error } = await supabase
        .from('profiles')
        .update({
          username: formData.username,
          full_name: formData.fullName,
          phone_number: formData.phoneNumber,
          address: fullAddress,
          height: formData.height ? Number(formData.height) : null,
          weight: formData.weight ? Number(formData.weight) : null,
          usual_size: formData.usualSize,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "프로필 업데이트 성공",
        description: "프로필 정보가 성공적으로 수정되었습니다.",
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "프로필 업데이트 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUserProfile();
  }, []);

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
              <div className="space-y-2">
                <Label htmlFor="username">닉네임</Label>
                <Input
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">이름</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">전화번호</Label>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">주소</Label>
                <div className="flex gap-2">
                  <Input
                    id="postcode"
                    name="postcode"
                    value={formData.postcode}
                    placeholder="우편번호"
                    readOnly
                    required
                  />
                  <Button
                    type="button"
                    onClick={handleAddressSearch}
                    className="whitespace-nowrap"
                  >
                    주소 검색
                  </Button>
                </div>
                <Input
                  id="address"
                  name="address"
                  value={formData.address}
                  placeholder="기본주소"
                  readOnly
                  required
                />
                <Input
                  id="addressDetail"
                  name="addressDetail"
                  value={formData.addressDetail}
                  onChange={handleChange}
                  placeholder="상세주소를 입력해주세요"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="height">키 (cm)</Label>
                <Input
                  id="height"
                  name="height"
                  type="number"
                  value={formData.height}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">몸무게 (kg)</Label>
                <Input
                  id="weight"
                  name="weight"
                  type="number"
                  value={formData.weight}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="usualSize">평소 사이즈</Label>
                <Input
                  id="usualSize"
                  name="usualSize"
                  value={formData.usualSize}
                  onChange={handleChange}
                  placeholder="예: M, 95 등"
                />
              </div>

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
