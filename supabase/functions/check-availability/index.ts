
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

    const { type, value } = await req.json();
    console.log(`Checking ${type} availability for: ${value}`);
    
    if (type === 'email') {
      // 이메일 중복 체크
      const { data: profiles, error: profilesError } = await supabaseClient
        .from('profiles')
        .select('username')
        .eq('username', value)
        .maybeSingle();

      if (profilesError) {
        throw profilesError;
      }

      return new Response(
        JSON.stringify({ 
          available: !profiles,
          message: profiles ? "이미 등록된 이메일입니다" : "사용 가능한 이메일입니다"
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );

    } else if (type === 'userId') {
      // 아이디 중복 체크
      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('user_id')
        .eq('user_id', value)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

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
