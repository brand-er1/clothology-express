
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
    const { data } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (data) {
      toast({
        title: "이미 사용 중인 아이디입니다",
        variant: "destructive",
      });
      return false;
    } else {
      toast({
        title: "사용 가능한 아이디입니다",
      });
      return true;
    }
  } catch (error) {
    toast({
      title: "사용 가능한 아이디입니다",
    });
    return true;
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
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: "check-email-exists",
    });

    // 로그인 시도 시 "Invalid login credentials" 에러가 나면 해당 이메일이 존재한다는 의미
    if (error?.message.includes("Invalid login credentials")) {
      toast({
        title: "이미 등록된 이메일입니다",
        variant: "destructive",
      });
      return false;
    }

    // 'Invalid login credentials' 이외의 에러는 이메일이 없다는 의미
    toast({
      title: "사용 가능한 이메일입니다",
    });
    return true;
  } catch (error) {
    // 다른 에러가 발생한 경우도 이메일이 없다고 가정
    toast({
      title: "사용 가능한 이메일입니다",
    });
    return true;
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
