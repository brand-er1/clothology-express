
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
  refreshSessionAfterSocialLogin,
  AuthMessage,
  isInIframe
} from "@/utils/authUtils";
import { handleLogin } from "@/utils/loginUtils";

export const useAuthForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [passwordMatch, setPasswordMatch] = useState(true);
  const [isEmailAvailable, setIsEmailAvailable] = useState<boolean | null>(null);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [isInIframeContext, setIsInIframeContext] = useState(false);
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

  useEffect(() => {
    // Check if we're in an iframe
    setIsInIframeContext(isInIframe());
  }, []);

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

  const handleSocialLogin = async (provider: 'kakao' | 'google') => {
    try {
      setIsLoading(true);
      
      // Open popup window for social login
      const popup = await openSocialLoginPopup(provider);
      
      if (!popup) {
        throw new Error("팝업 창을 열 수 없습니다. 팝업 차단을 확인해주세요.");
      }
      
      toast({
        title: `${provider === 'kakao' ? '카카오' : 'Google'} 로그인`,
        description: "로그인 창이 열렸습니다. 진행해주세요.",
      });
      
      // If we're in an iframe context, we need to periodically check localStorage for auth data
      if (isInIframeContext) {
        const checkInterval = setInterval(async () => {
          const tempSessionData = localStorage.getItem('tempSessionData');
          if (tempSessionData) {
            clearInterval(checkInterval);
            
            try {
              const sessionData = JSON.parse(tempSessionData);
              
              const { error } = await supabase.auth.setSession({
                access_token: sessionData.access_token,
                refresh_token: sessionData.refresh_token
              });
              
              localStorage.removeItem('tempSessionData');
              
              if (error) {
                console.error("Error setting session from poll:", error);
                toast({
                  title: "로그인 오류",
                  description: "세션 설정 중 오류가 발생했습니다.",
                  variant: "destructive",
                });
                return;
              }
              
              console.log("Successfully set session from poll");
              navigate("/");
              toast({
                title: "로그인 성공!",
                description: "환영합니다.",
              });
            } catch (e) {
              console.error("Error processing polled session data:", e);
            }
          }
          
          // Check if popup is closed
          if (popup.closed) {
            clearInterval(checkInterval);
            setIsLoading(false);
          }
        }, 1000); // Check every second
        
        // Clear interval after 5 minutes to prevent infinite checking
        setTimeout(() => {
          clearInterval(checkInterval);
          setIsLoading(false);
        }, 5 * 60 * 1000);
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
        
        if (isNaN(height) || isNaN(weight)) {
          throw new Error("키와 몸무게는 유효한 숫자여야 합니다.");
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
              height: height,
              weight: weight,
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

  // Listen for messages from the popup window
  useEffect(() => {
    const handleAuthMessage = async (event: MessageEvent) => {
      // In iframe context, accept messages from any origin
      if (isInIframeContext || event.origin === window.location.origin) {
        const message = event.data as AuthMessage;
        
        if (message && typeof message === 'object') {
          if (message.type === 'SESSION_DATA') {
            console.log("Received session data from popup", message.data);
            
            try {
              const { error } = await supabase.auth.setSession({
                access_token: message.data.access_token,
                refresh_token: message.data.refresh_token
              });
              
              if (error) {
                console.error("Error setting session from popup data:", error);
                toast({
                  title: "로그인 오류",
                  description: "세션 설정 중 오류가 발생했습니다.",
                  variant: "destructive",
                });
                return;
              }
              
              console.log("Successfully set session from popup data");
              
              // Check if session refresh was successful
              const success = await refreshSessionAfterSocialLogin();
              if (success) {
                navigate("/");
                toast({
                  title: "로그인 성공!",
                  description: "환영합니다.",
                });
              }
            } catch (error) {
              console.error("Error processing session data:", error);
            } finally {
              setIsLoading(false);
            }
          } else if (message.type === 'SOCIAL_LOGIN_SUCCESS') {
            // Check if we need to refresh the session
            const success = await refreshSessionAfterSocialLogin();
            
            if (success) {
              toast({
                title: "로그인 성공!",
                description: "환영합니다.",
              });
              navigate("/");
            } else {
              toast({
                title: "로그인 오류",
                description: "세션을 갱신할 수 없습니다. 다시 시도해주세요.",
                variant: "destructive",
              });
            }
            setIsLoading(false);
          } else if (message.type === 'SOCIAL_LOGIN_ERROR') {
            toast({
              title: "로그인 오류",
              description: message.data?.message || "로그인 중 오류가 발생했습니다.",
              variant: "destructive",
            });
            setIsLoading(false);
          } else if (message.type === 'PROFILE_INCOMPLETE') {
            // Check if we need to refresh the session first
            const success = await refreshSessionAfterSocialLogin();
            
            if (success) {
              toast({
                title: "프로필 정보가 필요합니다",
                description: "서비스 이용을 위해 추가 정보를 입력해주세요.",
                variant: "destructive",
              });
              navigate("/profile");
            } else {
              toast({
                title: "로그인 오류",
                description: "세션을 갱신할 수 없습니다. 다시 시도해주세요.",
                variant: "destructive",
              });
            }
            setIsLoading(false);
          }
        }
      }
    };
    
    window.addEventListener('message', handleAuthMessage);
    
    return () => {
      window.removeEventListener('message', handleAuthMessage);
    };
  }, [navigate, isInIframeContext]);

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
    handleSocialLogin,
    isInIframeContext
  };
};
