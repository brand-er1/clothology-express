
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

    const { userId, userInfo } = await req.json();
    
    // 필수 필드 검증
    if (!userId || !userInfo.username || !userInfo.height || !userInfo.weight) {
      throw new Error("Required fields are missing");
    }

    // userId 중복 확인
    const { data: userIdCheck, error: userIdError } = await supabaseClient
      .from('profiles')
      .select('user_id')
      .eq('user_id', userInfo.userId)
      .not('id', 'eq', userId)
      .maybeSingle();
      
    if (userIdError) throw userIdError;
    if (userIdCheck) throw new Error("이미 사용 중인 아이디입니다.");
    
    // username 중복 확인
    const { data: usernameCheck, error: usernameError } = await supabaseClient
      .from('profiles')
      .select('username')
      .eq('username', userInfo.username)
      .not('id', 'eq', userId)
      .maybeSingle();
      
    if (usernameError) throw usernameError;
    if (usernameCheck) throw new Error("이미 사용 중인 닉네임입니다.");

    const fullAddress = userInfo.addressDetail 
      ? `${userInfo.address} ${userInfo.addressDetail} (${userInfo.postcode})`
      : `${userInfo.address} (${userInfo.postcode})`;
    
    // 프로필 업데이트
    const { data, error } = await supabaseClient
      .from('profiles')
      .update({
        user_id: userInfo.userId,
        username: userInfo.username,
        full_name: userInfo.fullName || null,
        phone_number: userInfo.phoneNumber || null,
        address: fullAddress,
        height: parseFloat(userInfo.height),
        weight: parseFloat(userInfo.weight),
        gender: userInfo.gender || '남성',
      })
      .eq('id', userId);

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, message: "Profile updated successfully" }),
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
