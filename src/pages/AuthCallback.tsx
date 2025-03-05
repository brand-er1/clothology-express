import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAddressSearch } from "@/hooks/useAddressSearch";

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    userId: "",
    username: "",
    fullName: "",
    phoneNumber: "",
    address: "",
    addressDetail: "",
    postcode: "",
    height: "",
    weight: "",
    gender: "남성",
  });

  const handleAddressSearch = useAddressSearch((data) => {
    setFormData(prev => ({
      ...prev,
      postcode: data.zonecode,
      address: data.address
    }));
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleGenderChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      gender: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // 필수 필드 검증
      if (!formData.userId || !formData.username || !formData.height || !formData.weight) {
        throw new Error("필수 정보를 모두 입력해주세요.");
      }
      
      // 수치 데이터 유효성 검증
      const height = parseFloat(formData.height);
      const weight = parseFloat(formData.weight);
      
      if (isNaN(height) || isNaN(weight)) {
        throw new Error("키와 몸무게는 유효한 숫자여야 합니다.");
      }

      // userId 중복 확인
      const { data: userIdCheck, error: userIdError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', formData.userId)
        .maybeSingle();
        
      if (userIdError) throw userIdError;
      if (userIdCheck) throw new Error("이미 사용 중인 아이디입니다.");
      
      // username 중복 확인
      const { data: usernameCheck, error: usernameError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', formData.username)
        .maybeSingle();
        
      if (usernameError) throw usernameError;
      if (usernameCheck) throw new Error("이미 사용 중인 닉네임입니다.");

      const fullAddress = formData.addressDetail 
        ? `${formData.address} ${formData.addressDetail} (${formData.postcode})`
        : `${formData.address} (${formData.postcode})`;

      // 프로필 업데이트
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          user_id: formData.userId,
          username: formData.username,
          full_name: formData.fullName,
          phone_number: formData.phoneNumber,
          address: fullAddress,
          height: height,
          weight: weight,
          gender: formData.gender,
        })
        .eq('id', user.id);
        
      if (updateError) throw updateError;
      
      toast({
        title: "프로필 정보 저장 완료",
        description: "필요한 모든 정보가 저장되었습니다.",
      });
      
      navigate("/");
    } catch (error: any) {
      console.error("Profile update error:", error);
      toast({
        title: "오류 발생",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      try {
        // URL에서 해시 파라미터 처리
        if (location.hash && location.hash.includes('access_token')) {
          // 이미 세션을 가지고 있는지 확인
          const { data: existingSession } = await supabase.auth.getSession();
          
          if (!existingSession.session) {
            // 해시에서 액세스 토큰 추출
            const hashParams = new URLSearchParams(location.hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            
            if (accessToken && refreshToken) {
              // Supabase 세션 설정
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              
              if (error) throw error;
            }
          }
        }
        
        const { data, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (!data.session) {
          navigate("/auth");
          return;
        }
        
        setUser(data.session.user);
        
        // 사용자 프로필 정보 확인
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single();
        
        if (profileError && profileError.code !== 'PGRST116') throw profileError;
        
        // 필수 정보가 없으면 프로필 작성 요청
        if (!profile || !profile.height || !profile.weight || !profile.address) {
          setNeedsProfile(true);
          
          // 카카오 소셜 로그인 정보에서 닉네임 추출
          let initialUsername = "";
          
          if (data.session.user.app_metadata.provider === 'kakao') {
            // Kakao 사용자 메타데이터에서 닉네임 추출
            const userMeta = data.session.user.user_metadata || {};
            initialUsername = userMeta.preferred_username || userMeta.name || userMeta.nickname || "";
          }
          
          // 일부 기존 정보가 있으면 폼에 미리 채우기
          if (profile) {
            const addressMatch = profile.address?.match(/^(.*?)\s*(?:\((.*?)\))?$/);
            const mainAddress = addressMatch?.[1] || "";
            const postcode = addressMatch?.[2] || "";
            
            const addressParts = mainAddress.trim().split(/\s+/);
            const addressDetail = addressParts.length > 1 ? addressParts.pop() : "";
            const baseAddress = addressParts.join(" ");
            
            setFormData(prev => ({
              ...prev,
              userId: profile.user_id || "",
              username: profile.username || initialUsername,
              fullName: profile.full_name || "",
              phoneNumber: profile.phone_number || "",
              address: baseAddress || "",
              addressDetail: addressDetail || "",
              postcode: postcode || "",
              height: profile.height?.toString() || "",
              weight: profile.weight?.toString() || "",
              gender: profile.gender || "남성",
            }));
          } else {
            // 프로필이 없는 경우 카카오 닉네임만 설정
            setFormData(prev => ({
              ...prev,
              username: initialUsername
            }));
          }
        } else {
          // 필요한 정보가 모두 있으면 홈으로 이동
          navigate("/");
        }
      } catch (error) {
        console.error("Auth callback error:", error);
        toast({
          title: "인증 오류",
          description: "로그인 과정에서 오류가 발생했습니다. 다시 시도해주세요.",
          variant: "destructive",
        });
        navigate("/auth");
      } finally {
        setIsLoading(false);
      }
    };
    
    checkUser();
  }, [navigate, location]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg animate-pulse">로그인 처리 중...</p>
      </div>
    );
  }

  if (needsProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>프로필 완성하기</CardTitle>
            <CardDescription>
              맞춤 의류 제작을 위해 추가 정보를 입력해주세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userId">아이디 (필수)</Label>
                <Input
                  id="userId"
                  name="userId"
                  value={formData.userId}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="username">닉네임 (필수)</Label>
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
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">전화번호</Label>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={handleChange}
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
                <Label htmlFor="gender">성별</Label>
                <Select value={formData.gender} onValueChange={handleGenderChange}>
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="성별을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="남성">남성</SelectItem>
                    <SelectItem value="여성">여성</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="height">키 (cm) (필수)</Label>
                <Input
                  id="height"
                  name="height"
                  type="number"
                  value={formData.height}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="weight">몸무게 (kg) (필수)</Label>
                <Input
                  id="weight"
                  name="weight"
                  type="number"
                  value={formData.weight}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "저장 중..." : "정보 저장하고 시작하기"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-lg">로그인 처리 중...</p>
    </div>
  );
};

export default AuthCallback;
