
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/Header";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { AuthFormData } from "@/types/auth";

declare global {
  interface Window {
    daum: any;
  }
}

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [passwordMatch, setPasswordMatch] = useState(true);
  const [isCheckingId, setIsCheckingId] = useState(false);
  const [isIdAvailable, setIsIdAvailable] = useState<boolean | null>(null);
  const [formData, setFormData] = useState<AuthFormData>({
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

  const resetForm = () => {
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
                <SignUpForm
                  formData={formData}
                  handleChange={handleChange}
                  isLoading={isLoading}
                  isIdAvailable={isIdAvailable}
                  isCheckingId={isCheckingId}
                  passwordMatch={passwordMatch}
                  handleAddressSearch={handleAddressSearch}
                  checkUserId={checkUserId}
                />
              ) : (
                <LoginForm
                  formData={formData}
                  handleChange={handleChange}
                  isLoading={isLoading}
                />
              )}
              <Button
                type="button"
                variant="link"
                className="w-full"
                onClick={resetForm}
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
