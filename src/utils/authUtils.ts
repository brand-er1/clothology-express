
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";

export const checkUserIdAvailability = async (userId: string) => {
  if (!userId) {
    toast({
      title: "아이디를 입력해주세요",
      variant: "destructive",
    });
    return null;
  }

  try {
    const { data, error } = await supabase.functions.invoke('check-availability', {
      body: { type: 'userId', value: userId }
    });

    if (error) throw error;

    toast({
      title: data.message,
      variant: data.available ? "default" : "destructive",
    });
    
    return data.available;
  } catch (error) {
    console.error("UserId check error:", error);
    toast({
      title: "아이디 확인 중 오류가 발생했습니다",
      variant: "destructive",
    });
    return null;
  }
};

export const checkEmailAvailability = async (email: string) => {
  if (!email) {
    toast({
      title: "이메일을 입력해주세요",
      variant: "destructive",
    });
    return null;
  }

  try {
    const { data, error } = await supabase.functions.invoke('check-availability', {
      body: { type: 'email', value: email }
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

export const validateSignUpForm = async (
  passwordMatch: boolean, 
  password: string, 
  isIdAvailable: boolean | null,
  isEmailAvailable: boolean | null
) => {
  if (!passwordMatch) {
    throw new Error("비밀번호가 일치하지 않습니다.");
  }

  if (password.length < 6) {
    throw new Error("비밀번호는 최소 6자 이상이어야 합니다.");
  }

  if (!isIdAvailable) {
    throw new Error("아이디 중복 확인이 필요합니다.");
  }

  if (!isEmailAvailable) {
    throw new Error("이메일 중복 확인이 필요합니다.");
  }
};
