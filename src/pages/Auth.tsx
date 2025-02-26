
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/Header";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
    fullName: "",
    phoneNumber: "",
    address: "",
    height: "",
    weight: "",
    usualSize: "",
  });
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const validateSignUpForm = async () => {
    if (formData.password !== formData.confirmPassword) {
      throw new Error("비밀번호가 일치하지 않습니다.");
    }

    if (formData.password.length < 6) {
      throw new Error("비밀번호는 최소 6자 이상이어야 합니다.");
    }

    // 이메일 중복 확인
    const { data: emailExists } = await supabase.rpc('get_user_by_email', { email: formData.email });
    if (emailExists) {
      throw new Error("이미 사용 중인 이메일입니다.");
    }

    // 닉네임 중복 확인
    const { data: usernameExists } = await supabase
      .from('profiles')
      .select()
      .eq('username', formData.username)
      .single();

    if (usernameExists) {
      throw new Error("이미 사용 중인 닉네임입니다.");
    }

    // 전화번호 중복 확인
    const { data: phoneExists } = await supabase
      .from('profiles')
      .select()
      .eq('phone_number', formData.phoneNumber)
      .single();

    if (phoneExists) {
      throw new Error("이미 등록된 전화번호입니다.");
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        await validateSignUpForm();
        
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              username: formData.username,
              full_name: formData.fullName,
              phone_number: formData.phoneNumber,
              address: formData.address,
              height: formData.height || null,
              weight: formData.weight || null,
              usual_size: formData.usualSize || null,
            },
          },
        });
        if (error) throw error;
        toast({
          title: "회원가입 성공!",
          description: "이메일을 확인하여 가입을 완료해주세요.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (error) throw error;
        navigate("/");
        toast({
          title: "로그인 성공!",
          description: "환영합니다.",
        });
      }
    } catch (error: any) {
      toast({
        title: "오류 발생",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>{isSignUp ? "회원가입" : "로그인"}</CardTitle>
            <CardDescription>
              {isSignUp
                ? "새로운 계정을 만들어주세요"
                : "기존 계정으로 로그인하세요"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
              {isSignUp && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">닉네임</Label>
                    <Input
                      id="username"
                      name="username"
                      type="text"
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
                      type="text"
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
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">주소</Label>
                    <Input
                      id="address"
                      name="address"
                      type="text"
                      value={formData.address}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">키 (cm, 선택사항)</Label>
                    <Input
                      id="height"
                      name="height"
                      type="number"
                      value={formData.height}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">몸무게 (kg, 선택사항)</Label>
                    <Input
                      id="weight"
                      name="weight"
                      type="number"
                      value={formData.weight}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="usualSize">평소 사이즈 (선택사항)</Label>
                    <Input
                      id="usualSize"
                      name="usualSize"
                      type="text"
                      value={formData.usualSize}
                      onChange={handleChange}
                      placeholder="예: M, 95 등"
                    />
                  </div>
                </>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading
                  ? "처리 중..."
                  : isSignUp
                  ? "회원가입"
                  : "로그인"}
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-full"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setFormData({
                    email: "",
                    password: "",
                    confirmPassword: "",
                    username: "",
                    fullName: "",
                    phoneNumber: "",
                    address: "",
                    height: "",
                    weight: "",
                    usualSize: "",
                  });
                }}
              >
                {isSignUp
                  ? "이미 계정이 있으신가요? 로그인하기"
                  : "계정이 없으신가요? 회원가입하기"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Auth;
