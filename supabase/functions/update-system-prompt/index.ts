
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { systemPrompt } = await req.json();

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
      JSON.stringify({ error: error.message }), 
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
