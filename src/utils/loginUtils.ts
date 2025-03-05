
import { supabase } from "@/lib/supabase";

export const handleLogin = async (email: string, password: string) => {
  try {
    console.log(`Attempting to log in with email: ${email}`);
    
    // Sign in with email and password
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      console.error("Login error:", error);
      
      if (error.message === 'Invalid login credentials') {
        throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
      }
      throw error;
    }
    
    return data;
  } catch (error: any) {
    console.error("Login process error:", error);
    throw error;
  }
};
