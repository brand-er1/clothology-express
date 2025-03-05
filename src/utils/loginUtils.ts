
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
        // The profiles table doesn't have an email column
        // Instead, we need to get the user's email from auth.users through their user_id
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', loginIdentifier)
          .single();
        
        if (userError) {
          console.error("User ID lookup failed:", userError);
          throw new Error("입력하신 아이디를 찾을 수 없습니다.");
        }
        
        if (!userData) {
          console.error("No user found for user ID:", loginIdentifier);
          throw new Error("해당 아이디에 연결된 사용자를 찾을 수 없습니다.");
        }
        
        // Now we have the UUID (id) that maps to the auth.users table
        // We'll use this UUID directly with signInWithPassword using the user_id option
        // Supabase will handle the lookup from the UUID to the email for us
        const { data: authUser, error: authError } = await supabase.auth.getUser(userData.id);
        
        if (authError || !authUser?.user?.email) {
          console.error("Auth user lookup failed:", authError);
          throw new Error("해당 아이디의 인증 정보를 찾을 수 없습니다.");
        }
        
        email = authUser.user.email;
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
