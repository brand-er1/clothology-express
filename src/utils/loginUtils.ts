
import { supabase } from "@/lib/supabase";

export const handleLogin = async (loginIdentifier: string, password: string) => {
  let email = loginIdentifier;
  let identifierType = 'email';

  // If the loginIdentifier doesn't contain @, try it as a user_id first
  if (!loginIdentifier.includes('@')) {
    identifierType = 'user_id';
    
    // Admin user has a special case
    if (loginIdentifier === 'admin') {
      email = 'admin@example.com';
    } else {
      // Look up the email in the profiles table based on user_id
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', loginIdentifier)
        .single();
      
      // If user_id lookup fails, check if the identifier might be an email without @ symbol
      if (userError || !userData || !userData.email) {
        console.log("User ID lookup failed, trying as email:", loginIdentifier);
        // Try direct login with the identifier in case it's an email without @ symbol
        email = loginIdentifier;
        identifierType = 'email';
      } else {
        email = userData.email;
      }
    }
  }

  console.log(`Attempting to log in with email: ${email} (from identifier: ${loginIdentifier})`);
  
  // Try to sign in with the email (or the original loginIdentifier if it's an email)
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) {
    console.error("Login error:", error);
    
    // If this failed and we tried with user_id, try one more time with the identifier directly as email
    if (identifierType === 'user_id' && error.message === 'Invalid login credentials') {
      console.log("Trying again with identifier as direct email");
      const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
        email: loginIdentifier,
        password: password,
      });
      
      if (retryError) {
        console.error("Retry login error:", retryError);
        throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
      }
      
      return retryData;
    }
    
    if (error.message === 'Invalid login credentials') {
      throw new Error(identifierType === 'email' ? 
        "이메일 또는 비밀번호가 올바르지 않습니다." : 
        "아이디 또는 비밀번호가 올바르지 않습니다."
      );
    }
    throw error;
  }
  
  return data;
};
