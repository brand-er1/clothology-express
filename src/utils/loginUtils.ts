
import { supabase } from "@/lib/supabase";

export const handleLogin = async (loginIdentifier: string, password: string) => {
  let email = loginIdentifier;
  let identifierType = 'email';

  if (!loginIdentifier.includes('@')) {
    identifierType = 'user_id';
    if (loginIdentifier === 'admin') {
      email = 'admin@example.com';
    } else {
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', loginIdentifier)
        .maybeSingle();
      
      if (userError || !userData) {
        throw new Error("존재하지 않는 아이디입니다.");
      }
      email = userData.email;
    }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) {
    if (error.message === 'Invalid login credentials') {
      throw new Error(identifierType === 'email' ? 
        "이메일 또는 비밀번호가 올바르지 않습니다." : 
        "아이디 또는 비밀번호가 올바르지 않습니다."
      );
    }
    throw error;
  }
};
