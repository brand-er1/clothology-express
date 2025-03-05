
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

    console.log("Handle new user function triggered:", { 
      userId: user.id, 
      email: user.email,
      provider: provider,
      metadata: user.user_metadata 
    });

    // 기본값 설정
    const userMeta = user.user_metadata || {};
    let username = '';
    
    // Fallback user_id - 항상 값이 있도록 보장
    // 이메일이 없는 경우 UUID를 사용
    let userId = user.email || `user_${user.id.replace(/-/g, '')}`;
    
    // 로그인 제공자에 따른 처리
    if (provider === 'kakao') {
      username = userMeta.preferred_username || userMeta.name || userMeta.nickname || '사용자';
    } else {
      username = userMeta.username || userMeta.name || userMeta.preferred_username || '사용자';
    }
    
    console.log("Creating profile with:", { 
      userId: user.id, 
      username, 
      user_id: userId 
    });
    
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

    if (error) {
      console.error("Profile creation error:", error);
      throw error;
    }

    console.log("Profile created successfully");

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
