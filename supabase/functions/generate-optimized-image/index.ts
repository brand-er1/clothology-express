
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SYSTEM_PROMPT = `You are a fashion design expert. Convert the given clothing description into a clear, detailed prompt for image generation.
Guidelines:
1. Describe the garment type, style, and material in detail
2. Include color information and any specific design elements
3. Specify the view (front/back/etc)
4. Keep the description professional and fashion-focused
5. Add keywords that enhance image quality
Format: "Professional fashion photograph of a [garment] in [style and material details]. [Design specifics]. [View angle]. Studio lighting, high resolution, fashion photography.`;

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
    console.log("Original prompt:", prompt);

    // Step 1: Optimize the prompt using OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
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
    console.log("Optimized prompt:", optimizedPrompt);

    // Step 2: Generate image using the optimized prompt
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${Deno.env.get('REPLICATE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: "091495765fa5ef2725a175a57b276ec30dc9d39c22d30410f2ede68a3eab66b3",
        input: {
          prompt: optimizedPrompt,
          hf_lora: "ccchhhoi/fashion",
          lora_scale: 0.8,
          num_outputs: 1,
          aspect_ratio: "1:1",
          output_format: "webp",
          output_quality: 80,
          prompt_strength: 0.8,
          num_inference_steps: 28
        }
      }),
    });

    let prediction = await response.json();
    console.log("Initial prediction:", prediction);

    // Step 3: Poll for results
    while (prediction.status === "starting" || prediction.status === "processing") {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const pollResponse = await fetch(prediction.urls.get, {
        headers: {
          'Authorization': `Token ${Deno.env.get('REPLICATE_API_KEY')}`,
        },
      });
      prediction = await pollResponse.json();
      console.log("Polling prediction status:", prediction.status);
    }

    if (prediction.status === "succeeded") {
      console.log("Image generation succeeded:", prediction.output);
      return new Response(
        JSON.stringify({
          optimizedPrompt,
          imageUrl: prediction.output[0],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    } else {
      throw new Error("Image generation failed");
    }

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
