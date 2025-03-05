
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

    const { user, provider } = await req.json();
    
    if (!user || !user.id) {
      throw new Error("사용자 정보가 없습니다");
    }

    // 기본값 설정
    const userMeta = user.user_metadata || {};
    let username = '';
    let userId = user.email || '';
    
    // 로그인 제공자에 따른 처리
    if (provider === 'kakao') {
      username = userMeta.preferred_username || userMeta.name || userMeta.nickname || '';
      // 카카오 로그인에서는 이메일을 user_id로 사용
      userId = user.email || '';
    }
    
    // 필수 필드 검증
    if (!userId) {
      throw new Error("사용자 ID를 생성할 수 없습니다");
    }
    
    // 프로필 업데이트
    const { data, error } = await supabaseClient
      .from('profiles')
      .upsert({
        id: user.id,
        user_id: userId,
        username: username,
        full_name: userMeta.full_name || null,
        phone_number: userMeta.phone_number || null,
        height: 170, // 기본값
        weight: 70,  // 기본값
        gender: '남성', // 기본값
      });

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, message: "Profile created successfully" }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

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
