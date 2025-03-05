
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
    if (!userId || !userInfo.username) {
      throw new Error("Required fields are missing");
    }

    // 높이와 무게 기본값 설정
    const height = parseFloat(userInfo.height || "170");
    const weight = parseFloat(userInfo.weight || "70");
    
    if (isNaN(height) || isNaN(weight)) {
      throw new Error("키와 몸무게는 유효한 숫자여야 합니다.");
    }

    // 사용자 이메일 조회 (userId를 이메일로 사용하기 위함)
    const { data: userData, error: userError } = await supabaseClient
      .auth
      .admin
      .getUserById(userId);

    if (userError) throw userError;
    if (!userData.user) throw new Error("사용자 정보를 찾을 수 없습니다.");

    // userId를 이메일로 설정 (카카오 로그인 등의 경우)
    const userEmail = userData.user.email || "";
    if (!userEmail) throw new Error("사용자 이메일을 찾을 수 없습니다.");
    
    // userId를 이메일로 설정하되, 사용자가 입력한 값이 있으면 그 값을 우선함
    const finalUserId = userInfo.userId || userEmail;

    // userId 중복 확인 (본인 제외)
    const { data: userIdCheck, error: userIdError } = await supabaseClient
      .from('profiles')
      .select('user_id')
      .eq('user_id', finalUserId)
      .not('id', 'eq', userId)
      .maybeSingle();
      
    if (userIdError) throw userIdError;
    if (userIdCheck) throw new Error("이미 사용 중인 아이디입니다.");
    
    // username 중복 확인 (본인 제외)
    const { data: usernameCheck, error: usernameError } = await supabaseClient
      .from('profiles')
      .select('username')
      .eq('username', userInfo.username)
      .not('id', 'eq', userId)
      .maybeSingle();
      
    if (usernameError) throw usernameError;
    if (usernameCheck) throw new Error("이미 사용 중인 닉네임입니다.");

    // 주소 처리 (비어있을 수 있음)
    let fullAddress = null;
    if (userInfo.address) {
      fullAddress = userInfo.addressDetail 
        ? `${userInfo.address} ${userInfo.addressDetail} (${userInfo.postcode})`
        : `${userInfo.address} (${userInfo.postcode})`;
    }
    
    // 프로필 업데이트
    const { data, error } = await supabaseClient
      .from('profiles')
      .update({
        user_id: finalUserId,
        username: userInfo.username,
        full_name: userInfo.fullName || null,
        phone_number: userInfo.phoneNumber || null,
        address: fullAddress,
        height: height,
        weight: weight,
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
