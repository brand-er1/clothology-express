
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { AuthFormData } from "@/types/auth";

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
    usualSize: "",
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

  const checkEmail = async () => {
    if (!formData.email) {
      toast({
        title: "이메일을 입력해주세요",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email: formData.email,
        options: {
          shouldCreateUser: false,
        }
      });

      setIsEmailAvailable(false);
      toast({
        title: "이미 등록된 이메일입니다",
        variant: "destructive",
      });
    } catch (error) {
      setIsEmailAvailable(true);
      toast({
        title: "사용 가능한 이메일입니다",
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

    if (!isEmailAvailable) {
      throw new Error("이메일 중복 확인이 필요합니다.");
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
        let loginIdentifier = formData.email;
        if (!loginIdentifier.includes('@')) {
          const { data: userData } = await supabase
            .from('profiles')
            .select('email')
            .eq('user_id', formData.email)
            .maybeSingle();
          
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
    checkUserId,
    checkEmail,
    handleAuth,
    resetForm,
    setPasswordMatch
  };
};
