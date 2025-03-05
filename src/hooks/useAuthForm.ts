import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { AuthFormData } from "@/types/auth";
import { 
  checkEmailAvailability, 
  checkUsernameAvailability, 
  validateSignUpForm, 
  openSocialLoginPopup,
  SOCIAL_LOGIN_SUCCESS,
  SOCIAL_LOGIN_ERROR
} from "@/utils/authUtils";
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
      
      // 소셜 로그인 팝업 열기
      const popup = openSocialLoginPopup(provider);
      
      if (!popup) {
        // Handle popup blocked case
        toast({
          title: "팝업 차단됨",
          description: "팝업 창이 차단되었습니다. 팝업 차단을 해제하고 다시 시도해주세요.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      // 팝업이 닫히는지 확인하는 인터벌 설정 (차선책)
      const checkPopupInterval = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(checkPopupInterval);
          setIsLoading(false);
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
  
  // 소셜 로그인 메시지 이벤트 리스너
  useEffect(() => {
    const handleSocialLoginMessage = async (event: MessageEvent) => {
      // Same origin 메시지만 처리
      if (event.origin !== window.location.origin) return;
      
      // 소셜 로그인 성공 처리
      if (event.data.type === SOCIAL_LOGIN_SUCCESS) {
        console.log("Social login success message received", event.data);
        setIsLoading(false);
        toast({
          title: "로그인 성공!",
          description: "환영합니다.",
        });
        navigate("/");
      }
      
      // 소셜 로그인 실패 처리
      if (event.data.type === SOCIAL_LOGIN_ERROR) {
        console.log("Social login error message received");
        setIsLoading(false);
        toast({
          title: "로그인 실패",
          description: "로그인 과정에서 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    };
    
    window.addEventListener('message', handleSocialLoginMessage);
    
    return () => {
      window.removeEventListener('message', handleSocialLoginMessage);
    };
  }, [navigate]);

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
