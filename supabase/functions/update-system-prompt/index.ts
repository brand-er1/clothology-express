
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 호출자 JWT 로 관리자 권한(legacy.settings = Super Admin)을 서버에서 검증한다.
    // anon 키도 유효한 JWT 이므로 verify_jwt 만으로는 관리자 여부를 보장하지 못한다.
    const authorization = req.headers.get('Authorization') ?? '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } }
    );
    const { data: userData, error: userError } = await userClient.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: '로그인이 필요합니다.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: allowed, error: permissionError } = await userClient.rpc('has_admin_permission', {
      p_permission: 'legacy.settings',
    });
    if (permissionError || allowed !== true) {
      return new Response(JSON.stringify({ error: 'AI 시스템 프롬프트는 Super Admin 만 변경할 수 있습니다.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { systemPrompt } = await req.json();
    if (typeof systemPrompt !== 'string' || systemPrompt.trim().length === 0 || systemPrompt.length > 20000) {
      return new Response(JSON.stringify({ error: '시스템 프롬프트 내용을 확인해주세요.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 가장 최근의 시스템 프롬프트 레코드를 가져옵니다
    const { data: existingPrompts, error: fetchError } = await supabase
      .from('system_prompts')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      throw fetchError;
    }

    let result;
    if (existingPrompts && existingPrompts.length > 0) {
      // 기존 레코드가 있다면 업데이트
      const { error: updateError } = await supabase
        .from('system_prompts')
        .update({ prompt: systemPrompt })
        .eq('id', existingPrompts[0].id);

      if (updateError) throw updateError;
      result = { message: 'System prompt updated successfully' };
    } else {
      // 레코드가 없다면 새로 생성
      const { error: insertError } = await supabase
        .from('system_prompts')
        .insert([{ prompt: systemPrompt }]);

      if (insertError) throw insertError;
      result = { message: 'System prompt created successfully' };
    }

    console.log('Success:', result);
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), 
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
