
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const falApiKey = Deno.env.get('FAL_KEY');

const SYSTEM_PROMPT = `Assist in generating precise and optimized prompts for the FLUX AI model to create high-quality fashion image based on user input.

1. Make the prompt detailed with:
- Clothing type (e.g., jacket, dress).
- Colors, patterns, and materials.
- Style or theme (e.g., casual, formal).
- Accessories or design details.
- Target audience (e.g., men's, women's).
2. Use vivid adjectives to guide image generation accurately.
3. Keep the prompt concise but descriptive, and don't omit details in input.
4. If there are not sufficient details, add details based on your knowledge about garment.
5. Add this prompt at the end. : "Showcasing the front view on the left side and the back view on the right side. Show only cloth."
6. Output must be in English, and only return result.`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
          { role: 'system', content: SYSTEM_PROMPT },
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
