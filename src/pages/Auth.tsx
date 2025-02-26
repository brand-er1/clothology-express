import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/Header";

declare global {
  interface Window {
    daum: any;
  }
}

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [passwordMatch, setPasswordMatch] = useState(true);
  const [isCheckingId, setIsCheckingId] = useState(false);
  const [isIdAvailable, setIsIdAvailable] = useState<boolean | null>(null);
  const [formData, setFormData] = useState({
    userId: "",
    email: "",
    password: "",
    confirmPassword: "",
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
  const navigate = useNavigate();

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (formData.password || formData.confirmPassword) {
      setPasswordMatch(formData.password === formData.confirmPassword);
    }
  }, [formData.password, formData.confirmPassword]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'userId') {
      setIsIdAvailable(null);
    }
  };

  const checkUserId = async () => {
    if (!formData.userId) {
      toast({
        title: "아이디를 입력해주세요",
        variant: "destructive",
      });
      return;
    }

    setIsCheckingId(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', formData.userId)
        .single();

      if (data) {
        setIsIdAvailable(false);
        toast({
          title: "이미 사용 중인 아이디입니다",
          variant: "destructive",
        });
      } else {
        setIsIdAvailable(true);
        toast({
          title: "사용 가능한 아이디입니다",
        });
      }
    } catch (error) {
      setIsIdAvailable(true);
      toast({
        title: "사용 가능한 아이디입니다",
      });
    } finally {
      setIsCheckingId(false);
    }
  };

  const sendVerificationEmail = async () => {
    if (!formData.email) {
      toast({
        title: "이메일을 입력해주세요",
        variant: "destructive",
      });
      return;
    }

    try {
      // 이메일로 6자리 인증 코드 생성
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // 이메일 전송을 위한 Edge Function 호출
      const { error } = await supabase.functions.invoke('send-verification-email', {
        body: { 
          email: formData.email,
          code: verificationCode,
        }
      });

      if (error) throw error;

      // 인증 코드를 임시로 localStorage에 저장 (실제 프로덕션에서는 서버에서 관리해야 함)
      localStorage.setItem(`verification_${formData.email}`, verificationCode);
      
      setEmailVerificationSent(true);
      toast({
        title: "인증 코드가 이메일로 전송되었습니다",
        description: "이메일을 확인해주세요",
      });
    } catch (error: any) {
      toast({
        title: "이메일 전송 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const verifyEmail = () => {
    const savedCode = localStorage.getItem(`verification_${formData.email}`);
    if (verificationCode === savedCode) {
      setIsVerifying(false);
      localStorage.removeItem(`verification_${formData.email}`);
      toast({
        title: "이메일 인증 완료",
      });
    } else {
      toast({
        title: "인증 코드가 일치하지 않습니다",
        variant: "destructive",
      });
    }
  };

  const handleAddressSearch = () => {
    if (window.daum) {
      new window.daum.Postcode({
        oncomplete: (data: any) => {
          setFormData(prev => ({
            ...prev,
            postcode: data.zonecode,
            address: data.address,
          }));
        },
      }).open();
    } else {
      toast({
        title: "오류 발생",
        description: "주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    }
  };

  const validateSignUpForm = async () => {
    if (!passwordMatch) {
      throw new Error("비밀번호가 일치하지 않습니다.");
    }

    if (formData.password.length < 6) {
      throw new Error("비밀번호는 최소 6자 이상이어야 합니다.");
    }

    if (!isIdAvailable) {
      throw new Error("아이디 중복 확인이 필요합니다.");
    }

    // 이메일 인증 확인
    const savedCode = localStorage.getItem(`verification_${formData.email}`);
    if (savedCode) {
      throw new Error("이메일 인증이 필요합니다.");
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
        
        const fullAddress = formData.addressDetail 
          ? `${formData.address} ${formData.addressDetail} (${formData.postcode})`
          : `${formData.address} (${formData.postcode})`;

        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              user_id: formData.userId,
              username: formData.username,
              full_name: formData.fullName,
              phone_number: formData.phoneNumber,
              address: fullAddress,
              height: formData.height || null,
              weight: formData.weight || null,
              usual_size: formData.usualSize || null,
            },
          },
        });
        if (error) throw error;
        toast({
          title: "회원가입 성공!",
          description: "로그인 해주세요.",
        });
        setIsSignUp(false);
      } else {
        // 로그인: 이메일 또는 아이디로 로그인 가능
        let loginIdentifier = formData.email;
        if (!loginIdentifier.includes('@')) {
          // 아이디로 로그인 시도
          const { data: userData } = await supabase
            .from('profiles')
            .select('email')
            .eq('user_id', formData.email)
            .single();
          
          if (!userData) {
            throw new Error("존재하지 않는 아이디입니다.");
          }
          loginIdentifier = userData.email;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: loginIdentifier,
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
              {isSignUp ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="userId">아이디</Label>
                    <div className="flex gap-2">
                      <Input
                        id="userId"
                        name="userId"
                        type="text"
                        value={formData.userId}
                        onChange={handleChange}
                        required
                      />
                      <Button
                        type="button"
                        onClick={checkUserId}
                        disabled={isCheckingId}
                        className="whitespace-nowrap"
                      >
                        {isCheckingId ? "확인 중..." : "중복 확인"}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">이메일</Label>
                    <div className="flex gap-2">
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                      <Button
                        type="button"
                        onClick={sendVerificationEmail}
                        disabled={emailVerificationSent}
                        className="whitespace-nowrap"
                      >
                        {emailVerificationSent ? "재전송" : "인증하기"}
                      </Button>
                    </div>
                  </div>
                  {emailVerificationSent && (
                    <div className="space-y-2">
                      <Label htmlFor="verificationCode">인증 코드</Label>
                      <div className="flex gap-2">
                        <Input
                          id="verificationCode"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          placeholder="인증 코드 6자리"
                          maxLength={6}
                        />
                        <Button
                          type="button"
                          onClick={verifyEmail}
                          disabled={verificationCode.length !== 6}
                          className="whitespace-nowrap"
                        >
                          확인
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="email">아이디 또는 이메일</Label>
                  <Input
                    id="email"
                    name="email"
                    type="text"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              )}
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
                      className={!passwordMatch && formData.confirmPassword ? "border-red-500" : ""}
                    />
                    {!passwordMatch && formData.confirmPassword && (
                      <p className="text-sm text-red-500">비밀번호가 일치하지 않습니다.</p>
                    )}
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
                    <div className="flex gap-2">
                      <Input
                        id="postcode"
                        name="postcode"
                        type="text"
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
                      type="text"
                      value={formData.address}
                      placeholder="기본주소"
                      readOnly
                      required
                    />
                    <Input
                      id="addressDetail"
                      name="addressDetail"
                      type="text"
                      value={formData.addressDetail}
                      onChange={handleChange}
                      placeholder="상세주소를 입력해주세요"
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
                    userId: "",
                    email: "",
                    password: "",
                    confirmPassword: "",
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
                  setPasswordMatch(true);
                  setIsIdAvailable(null);
                  setEmailVerificationSent(false);
                  setVerificationCode("");
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
