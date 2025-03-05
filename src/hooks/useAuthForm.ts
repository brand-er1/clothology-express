
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { AuthFormData } from "@/types/auth";
import { checkEmailAvailability, checkUsernameAvailability, validateSignUpForm } from "@/utils/authUtils";
import { handleLogin } from "@/utils/loginUtils";

export const useAuthForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [passwordMatch, setPasswordMatch] = useState(true);
  const [isEmailAvailable, setIsEmailAvailable] = useState<boolean | null>(null);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [formData, setFormData] = useState<AuthFormData>({
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
    gender: "남성",
  });
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'email') {
      setIsEmailAvailable(null);
    }
    if (name === 'username') {
      setIsUsernameAvailable(null);
    }
  };

  const handleGenderChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      gender: value
    }));
  };

  const checkEmail = async () => {
    const result = await checkEmailAvailability(formData.email);
    setIsEmailAvailable(result);
  };

  const checkUsername = async () => {
    const result = await checkUsernameAvailability(formData.username);
    setIsUsernameAvailable(result);
  };

  // Social login with popup window
  const handleSocialLogin = async (provider: 'kakao' | 'google') => {
    try {
      setIsLoading(true);
      
      // 현재 호스트 기반 리다이렉트 URL 생성
      const redirectTo = `${window.location.origin}/auth/callback`;
      console.log(`Using redirect URL: ${redirectTo}`);
      
      // 소셜 로그인 URL 가져오기
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectTo,
          scopes: provider === 'kakao' ? 'account_email profile_nickname' : 'email profile',
          skipBrowserRedirect: true, // 브라우저 자동 리다이렉트 방지
        },
      });
      
      if (error) throw error;
      
      if (data?.url) {
        // 팝업 창 열기
        const width = 600;
        const height = 600;
        const left = window.innerWidth / 2 - width / 2;
        const top = window.innerHeight / 2 - height / 2;
        
        const popup = window.open(
          data.url,
          `${provider}Login`,
          `width=${width},height=${height},left=${left},top=${top},popup=1`
        );
        
        // 팝업 창이 닫히면 세션 확인
        const checkPopup = setInterval(async () => {
          try {
            if (!popup || popup.closed) {
              clearInterval(checkPopup);
              
              // 세션 새로고침
              const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
              
              if (sessionError) throw sessionError;
              
              if (sessionData?.session) {
                console.log("Social login successful, session established");
                toast({
                  title: "로그인 성공!",
                  description: "환영합니다.",
                });
                navigate("/");
              } else {
                // 로그인이 취소되었거나 실패한 경우
                console.log("Social login cancelled or failed");
                setIsLoading(false);
              }
            }
          } catch (checkError) {
            clearInterval(checkPopup);
            console.error("Error checking popup:", checkError);
            setIsLoading(false);
          }
        }, 1000); // 1초마다 확인
      }
    } catch (error: any) {
      console.error("Social login error:", error);
      toast({
        title: "로그인 오류",
        description: error.message,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        await validateSignUpForm(
          passwordMatch, 
          formData.password,
          isEmailAvailable,
          isUsernameAvailable,
          formData.height,
          formData.weight
        );
        
        // Height와 Weight 값이 유효한 숫자인지 확인
        const height = parseFloat(formData.height);
        const weight = parseFloat(formData.weight);
        
        if (formData.height && isNaN(height)) {
          throw new Error("키는 유효한 숫자여야 합니다.");
        }
        
        if (formData.weight && isNaN(weight)) {
          throw new Error("몸무게는 유효한 숫자여야 합니다.");
        }

        const fullAddress = formData.addressDetail 
          ? `${formData.address} ${formData.addressDetail} (${formData.postcode})`
          : `${formData.address} (${formData.postcode})`;

        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              username: formData.username,
              full_name: formData.fullName,
              phone_number: formData.phoneNumber,
              address: fullAddress,
              height: formData.height ? height : null,
              weight: formData.weight ? weight : null,
              gender: formData.gender,
            },
            // emailRedirectTo 사용 (redirectTo 대신)
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        toast({
          title: "회원가입 성공!",
          description: "로그인 해주세요.",
        });
        setIsSignUp(false);
      } else {
        await handleLogin(formData.email, formData.password);
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
      gender: "남성",
    });
    setPasswordMatch(true);
    setIsEmailAvailable(null);
    setIsUsernameAvailable(null);
  };

  return {
    isLoading,
    isSignUp,
    passwordMatch,
    isEmailAvailable,
    isUsernameAvailable,
    formData,
    handleChange,
    handleGenderChange,
    checkEmail,
    checkUsername,
    handleAuth,
    resetForm,
    setPasswordMatch,
    handleSocialLogin
  };
};
