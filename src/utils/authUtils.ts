
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";

export const checkEmailAvailability = async (email: string) => {
  const trimmedEmail = email.trim().replace(/\n/g, '');
  
  if (!trimmedEmail) {
    toast({
      title: "이메일을 입력해주세요",
      variant: "destructive",
    });
    return null;
  }

  try {
    const { data, error } = await supabase.functions.invoke('check-availability', {
      body: { type: 'email', value: trimmedEmail }
    });

    if (error) throw error;

    toast({
      title: data.message,
      variant: data.available ? "default" : "destructive",
    });
    
    return data.available;
  } catch (error) {
    console.error("Email check error:", error);
    toast({
      title: "이메일 확인 중 오류가 발생했습니다",
      variant: "destructive",
    });
    return null;
  }
};

export const checkUsernameAvailability = async (username: string) => {
  const trimmedUsername = username.trim().replace(/\n/g, '');
  
  if (!trimmedUsername) {
    toast({
      title: "닉네임을 입력해주세요",
      variant: "destructive",
    });
    return null;
  }

  try {
    const { data, error } = await supabase.functions.invoke('check-availability', {
      body: { type: 'username', value: trimmedUsername }
    });

    if (error) throw error;

    toast({
      title: data.message,
      variant: data.available ? "default" : "destructive",
    });
    
    return data.available;
  } catch (error) {
    console.error("Username check error:", error);
    toast({
      title: "닉네임 확인 중 오류가 발생했습니다",
      variant: "destructive",
    });
    return null;
  }
};

export const validateSignUpForm = async (
  passwordMatch: boolean, 
  password: string, 
  isIdAvailable: boolean | null,
  isEmailAvailable: boolean | null,
  isUsernameAvailable: boolean | null,
  height: string,
  weight: string
) => {
  if (!passwordMatch) {
    throw new Error("비밀번호가 일치하지 않습니다.");
  }

  if (password.length < 6) {
    throw new Error("비밀번호는 최소 6자 이상이어야 합니다.");
  }

  if (!isEmailAvailable) {
    throw new Error("이메일 중복 확인이 필요합니다.");
  }
  
  if (!isUsernameAvailable) {
    throw new Error("닉네임 중복 확인이 필요합니다.");
  }

  if (!height) {
    throw new Error("키를 입력해주세요.");
  }

  if (!weight) {
    throw new Error("몸무게를 입력해주세요.");
  }
};
