
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
    // 이메일로 프로필 조회
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('username', email)  // 이메일이 username 필드에 저장됨
      .maybeSingle();

    if (profileError) {
      console.error("Profile check error:", profileError);
      throw profileError;
    }

    if (profile) {
      toast({
        title: "이미 등록된 이메일입니다",
        variant: "destructive",
      });
      return false;
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    if (user?.email === email) {
      toast({
        title: "이미 등록된 이메일입니다",
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "사용 가능한 이메일입니다",
    });
    return true;

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
