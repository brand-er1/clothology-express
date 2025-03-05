
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

export type AuthMessageType = 'SOCIAL_LOGIN_SUCCESS' | 'SOCIAL_LOGIN_ERROR' | 'PROFILE_INCOMPLETE';

export interface AuthMessage {
  type: AuthMessageType;
  data?: any;
}

// Get social login URL for popup window
export const getSocialLoginUrl = async (provider: 'google' | 'kakao'): Promise<string> => {
  try {
    // Use the proper Supabase URL format for social authentication
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: true, // This is the key change to prevent automatic redirection
        queryParams: provider === 'google' ? {
          access_type: 'offline',
          prompt: 'consent',
        } : undefined
      }
    });
    
    if (error) throw error;
    
    if (!data.url) {
      throw new Error("소셜 로그인 URL을 가져오는데 실패했습니다.");
    }
    
    return data.url;
  } catch (error) {
    console.error("Error getting social login URL:", error);
    throw error;
  }
};

// Helper function to open a social login popup
export const openSocialLoginPopup = async (provider: 'google' | 'kakao'): Promise<Window | null> => {
  try {
    const url = await getSocialLoginUrl(provider);
    console.log("Opening social login popup with URL:", url);
    
    const width = 600;
    const height = 600;
    const left = window.innerWidth / 2 - width / 2;
    const top = window.innerHeight / 2 - height / 2;
    
    return window.open(
      url,
      `${provider}Auth`,
      `width=${width},height=${height},left=${left},top=${top}`
    );
  } catch (error) {
    console.error("Error opening social login popup:", error);
    toast({
      title: "소셜 로그인 오류",
      description: "로그인 창을 열 수 없습니다. 잠시 후 다시 시도해주세요.",
      variant: "destructive",
    });
    return null;
  }
};

// Post a message to the parent window
export const sendMessageToParentWindow = (message: AuthMessage) => {
  if (window.opener) {
    window.opener.postMessage(message, window.location.origin);
    console.log("Sent message to parent window:", message);
  } else {
    console.warn("No parent window found for message:", message);
  }
};

// Check if user profile is complete
export const isProfileComplete = (profile: any): boolean => {
  return !(!profile || 
    !profile.phone_number || 
    profile.height === null || 
    profile.weight === null);
};

// Refresh the session in the main window after the popup login
export const refreshSessionAfterSocialLogin = async (sessionData?: any): Promise<void> => {
  try {
    console.log("Refreshing session after social login");
    
    // If we received session data from the popup, use it to set the session
    if (sessionData && sessionData.access_token && sessionData.refresh_token) {
      console.log("Setting session from received session data");
      const { error } = await supabase.auth.setSession({
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token
      });
      
      if (error) {
        console.error("Error setting session from popup data:", error);
        return;
      }
      
      console.log("Session set successfully from popup data");
      return;
    }
    
    // Fallback: Get the current session and force refresh
    console.log("No session data received, getting current session");
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error("Error refreshing session:", error);
      return;
    }
    
    if (data.session) {
      console.log("Session refreshed successfully after social login");
    } else {
      console.warn("No session found after social login refresh attempt");
    }
  } catch (error) {
    console.error("Error in refreshSessionAfterSocialLogin:", error);
  }
};
