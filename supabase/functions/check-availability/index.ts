
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS 프리플라이트 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { type, value: rawValue } = await req.json();
    const value = rawValue.trim().replace(/\n/g, '');
    console.log(`Checking ${type} availability for: ${value}`);
    
    if (type === 'email') {
      // 이메일 중복 체크 - auth.users 테이블에서 확인
      const { data, error } = await supabaseClient
        .auth
        .admin
        .listUsers();

      if (error) {
        throw error;
      }

      const emailExists = data.users.some(user => user.email === value);

      return new Response(
        JSON.stringify({ 
          available: !emailExists,
          message: emailExists ? "이미 등록된 이메일입니다" : "사용 가능한 이메일입니다"
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );

    } else if (type === 'userId') {
      // 아이디 중복 체크
      console.log("Checking userId availability in profiles table");
      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('user_id')
        .eq('user_id', value)
        .maybeSingle();

      if (profileError) {
        console.error("Error checking userId:", profileError);
        throw profileError;
      }

      console.log("Profile check result:", profile);
      
      return new Response(
        JSON.stringify({ 
          available: !profile,
          message: profile ? "이미 사용 중인 아이디입니다" : "사용 가능한 아이디입니다"
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    } else if (type === 'username') {
      // 닉네임 중복 체크
      console.log("Checking username availability in profiles table");
      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('username')
        .eq('username', value)
        .maybeSingle();

      if (profileError) {
        console.error("Error checking username:", profileError);
        throw profileError;
      }

      console.log("Username check result:", profile);

      return new Response(
        JSON.stringify({ 
          available: !profile,
          message: profile ? "이미 사용 중인 닉네임입니다" : "사용 가능한 닉네임입니다"
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    throw new Error('Invalid check type');

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
