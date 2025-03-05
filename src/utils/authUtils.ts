<lov-codelov-code>
import { supabase, redirectUrl } from "@/lib/supabase";

export const validateSignUpForm = async (
  passwordMatch: boolean,
  password: string,
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

  if (isEmailAvailable === false) {
    throw new Error("이미 사용 중인 이메일입니다.");
  }

  if (isUsernameAvailable === false) {
    throw new Error("이미 사용 중인 닉네임입니다.");
  }
  
  // 키와 몸무게가 입력된 경우에만 유효성 검증
  if (height && isNaN(parseFloat(height))) {
    throw new Error("키는 유효한 숫자여야 합니다.");
  }
  
  if (weight && isNaN(parseFloat(weight))) {
    throw new Error("몸무게는 유효한 숫자여야 합니다.");
  }
};

export const checkEmailAvailability = async (email: string): Promise<boolean> => {
  if (!email) return false;
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
      
    if (error) throw error;
    
    // 데이터가 없으면 (null) 사용 가능
    return data === null;
  } catch (error) {
    console.error("Email availability check error:", error);
    return false;
  }
};

export const checkUsernameAvailability = async (username: string): Promise<boolean> => {
  if (!username) return false;
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();
      
    if (error) throw error;
    
    // 데이터가 없으면 (null) 사용 가능
    return data === null;
  } catch (error) {
    console.error("Username availability check error:", error);
    return false;
  }
};

// 소셜 로그인 창이 이미 열려있는지 추적하는 변수
let socialLoginPopup: Window | null = null;

// 소셜 로그인 팝업 열기 함수
export const openSocialLoginPopup = (url: string, provider: string): Window | null => {
  // 이미 열린 팝업이 있으면 닫기
  if (socialLoginPopup && !socialLoginPopup.closed) {
    socialLoginPopup.close();
  }
  
  // 팝업 창 크기 및 위치 설정
  const width = 600;
  const height = 700;
  const left = window.innerWidth / 2 - width / 2;
  const top = window.innerHeight / 2 - height / 2;
  
  // 팝업 창 열기
  socialLoginPopup = window.open(
    url,
    `${provider}Login`,
    `width=${width},height=${height},left=${left},top=${top},popup=1,toolbar=0,location=0,menubar=0`
  );
  
  return socialLoginPopup;
};

export const getSocialLoginUrl = (provider: string): string => {
  // Use the imported redirectUrl instead of recalculating it
  return `${supabaseUrl}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectUrl)}`;
};

// Add the supabaseUrl constant at the top level
const supabaseUrl = 'https://jwmzjszdjlrqrhadbggr.supabase.co';
</lov-code>
