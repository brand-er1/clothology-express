
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const falApiKey = Deno.env.get('FAL_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    
    // system prompt 가져오기
    const { data: systemPrompt } = await supabase
      .from('system_prompts')
      .select('content')
      .single();

    const { prompt } = await req.json();

    // 1단계: OpenAI를 통한 프롬프트 최적화
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: systemPrompt?.content || 'You are a helpful assistant that optimizes image generation prompts.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    const openaiData = await openaiResponse.json();
    const optimizedPrompt = openaiData.choices[0].message.content;

    // 2단계: Fal.ai를 통한 이미지 생성
    const falResponse = await fetch('https://110602490-flux-lora.gateway.alpha.fal.ai/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: optimizedPrompt,
        hf_lora: "ccchhhoi/fashion",
        lora_scale: 0.8,
        num_outputs: 1,
        aspect_ratio: "1:1",
        output_format: "webp",
        guidance_scale: 3.5,
        output_quality: 80,
        prompt_strength: 0.8,
        num_inference_steps: 28
      }),
    });

    const falData = await falResponse.json();

    return new Response(
      JSON.stringify({
        optimizedPrompt,
        imageUrl: falData.images[0].url,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
