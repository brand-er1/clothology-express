
import { supabase } from "@/lib/supabase";

export const handleLogin = async (loginIdentifier: string, password: string) => {
  let email = loginIdentifier;
  let identifierType = 'email';

  // If the loginIdentifier doesn't contain @, treat it as a user_id
  if (!loginIdentifier.includes('@')) {
    identifierType = 'user_id';
    
    // Admin user has a special case
    if (loginIdentifier === 'admin') {
      email = 'admin@example.com';
    } else {
      try {
        // Look up the email in the profiles table based on user_id
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('email')
          .eq('user_id', loginIdentifier)
          .single();
        
        if (userError) {
          console.error("User ID lookup failed:", userError);
          throw new Error("입력하신 아이디를 찾을 수 없습니다.");
        }
        
        if (!userData || !userData.email) {
          console.error("No email found for user ID:", loginIdentifier);
          throw new Error("해당 아이디에 연결된 이메일을 찾을 수 없습니다.");
        }
        
        email = userData.email;
        console.log(`Found email ${email} for user_id ${loginIdentifier}`);
      } catch (error: any) {
        if (error.message.includes("single row")) {
          throw new Error("입력하신 아이디를 찾을 수 없습니다.");
        }
        throw error;
      }
    }
  }

  console.log(`Attempting to log in with email: ${email} (from identifier: ${loginIdentifier})`);
  
  try {
    // Try to sign in with the email
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      console.error("Login error:", error);
      
      if (error.message === 'Invalid login credentials') {
        throw new Error(identifierType === 'email' ? 
          "이메일 또는 비밀번호가 올바르지 않습니다." : 
          "아이디 또는 비밀번호가 올바르지 않습니다."
        );
      }
      throw error;
    }
    
    return data;
  } catch (error: any) {
    console.error("Login process error:", error);
    throw error;
  }
};
