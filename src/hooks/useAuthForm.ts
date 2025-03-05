import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { AuthFormData } from "@/types/auth";
import { checkEmailAvailability, checkUsernameAvailability, validateSignUpForm, getSocialLoginUrl, openSocialLoginPopup } from "@/utils/authUtils";
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

  // Social login with popup window - improved implementation
  const handleSocialLogin = async (provider: 'kakao' | 'google') => {
    try {
      setIsLoading(true);
      
      // 소셜 로그인 URL 가져오기
      const authUrl = getSocialLoginUrl(provider);
      
      // 팝업 열기
      const popup = openSocialLoginPopup(authUrl, provider);
      
      if (!popup) {
        // 팝업 차단된 경우
        toast({
          title: "팝업 차단됨",
          description: "팝업 창이 차단되었습니다. 팝업 차단을 해제하고 다시 시도해주세요.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      // 메시지 이벤트 리스너 설정
      const handleAuthComplete = async (event: MessageEvent) => {
        // 동일 출처(origin)에서 온 메시지만 처리
        if (event.origin !== window.location.origin) return;
        
        // AUTH_COMPLETE 메시지 처리
        if (event.data && event.data.type === 'AUTH_COMPLETE') {
          window.removeEventListener('message', handleAuthComplete);
          
          if (event.data.success) {
            // 로그인 성공 처리
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              toast({
                title: "로그인 성공!",
                description: "환영합니다.",
              });
              navigate("/");
            }
          } else if (event.data.error) {
            // 오류 발생 처리
            toast({
              title: "로그인 오류",
              description: event.data.error,
              variant: "destructive",
            });
          }
          
          setIsLoading(false);
        }
      };
      
      // 메시지 이벤트 리스너 등록
      window.addEventListener('message', handleAuthComplete);
      
      // SOCIAL_AUTH_SUCCESS 이벤트 리스너 설정 (authUtils.ts의 openSocialLoginPopup 함수에서 발생)
      const handleAuthSuccess = async (event: CustomEvent) => {
        window.removeEventListener('SOCIAL_AUTH_SUCCESS', handleAuthSuccess as EventListener);
        
        // 로그인 성공 처리
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          toast({
            title: "로그인 성공!",
            description: "환영합니다.",
          });
          navigate("/");
        }
        
        setIsLoading(false);
      };
      
      // 커스텀 이벤트 리스너 등록
      window.addEventListener('SOCIAL_AUTH_SUCCESS', handleAuthSuccess as EventListener);
      
      // 팝업 창 상태 확인 (팝업이 닫힌 경우 리스너 제거)
      const checkPopupClosed = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(checkPopupClosed);
          setTimeout(() => {
            window.removeEventListener('message', handleAuthComplete);
            window.removeEventListener('SOCIAL_AUTH_SUCCESS', handleAuthSuccess as EventListener);
            setIsLoading(false);
          }, 1000);
        }
      }, 1000);
      
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

  // 컴포넌트 언마운트시 이벤트 리스너 정리
  useEffect(() => {
    return () => {
      // 모든 관련 이벤트 리스너 제거
      window.removeEventListener('SOCIAL_AUTH_SUCCESS', () => {});
      window.removeEventListener('message', () => {});
    };
  }, []);

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
