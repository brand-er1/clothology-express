
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { AuthFormData } from "@/types/auth";
import { checkUserIdAvailability, checkEmailAvailability, validateSignUpForm } from "@/utils/authUtils";
import { handleLogin } from "@/utils/loginUtils";

export const useAuthForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [passwordMatch, setPasswordMatch] = useState(true);
  const [isCheckingId, setIsCheckingId] = useState(false);
  const [isIdAvailable, setIsIdAvailable] = useState<boolean | null>(null);
  const [isEmailAvailable, setIsEmailAvailable] = useState<boolean | null>(null);
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
    gender: "남성",
  });
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'userId') {
      setIsIdAvailable(null);
    }
    if (name === 'email') {
      setIsEmailAvailable(null);
    }
  };

  const handleGenderChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      gender: value
    }));
  };

  const checkUserId = async () => {
    setIsCheckingId(true);
    const result = await checkUserIdAvailability(formData.userId);
    setIsIdAvailable(result);
    setIsCheckingId(false);
  };

  const checkEmail = async () => {
    const result = await checkEmailAvailability(formData.email);
    setIsEmailAvailable(result);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        await validateSignUpForm(
          passwordMatch, 
          formData.password, 
          isIdAvailable, 
          isEmailAvailable,
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
              user_id: formData.userId,
              username: formData.username,
              full_name: formData.fullName,
              phone_number: formData.phoneNumber,
              address: fullAddress,
              height: height,
              weight: weight,
              gender: formData.gender,
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
        await handleLogin(formData.email || formData.userId, formData.password);
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
      gender: "남성",
    });
    setPasswordMatch(true);
    setIsIdAvailable(null);
    setIsEmailAvailable(null);
  };

  return {
    isLoading,
    isSignUp,
    passwordMatch,
    isCheckingId,
    isIdAvailable,
    isEmailAvailable,
    formData,
    handleChange,
    handleGenderChange,
    checkUserId,
    checkEmail,
    handleAuth,
    resetForm,
    setPasswordMatch
  };
};
