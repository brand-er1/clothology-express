
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_SYSTEM_PROMPT = `Produce one concise, production-ready prompt that captures garment type, material, color, fit, key design details, seasonality, and styling cues from the user request. Keep it ecommerce-focused, photorealistic, and avoid adding models, text overlays, or props. Keep language consistent with the user input.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { prompt } = await req.json();
    console.log("Original prompt:", prompt);

    // 시스템 프롬프트 불러오기
    const { data: systemPromptData, error: systemPromptError } = await supabase
      .from('system_prompts')
      .select('prompt')
      .order('created_at', { ascending: false })
      .limit(1);

    if (systemPromptError) throw systemPromptError;

    const systemPrompt = systemPromptData?.[0]?.prompt || DEFAULT_SYSTEM_PROMPT;

    console.log("Using system prompt:", systemPrompt);

    // Step 1: 시스템 프롬프트 + 스타일 가이드 + 사용자 입력 결합
    const stylePrimer = `White background, photorealistic product photo like a real shopping mall listing. No models or mannequins. Show two views in one frame: left = garment front, right = garment back. Clean lighting, no props, no shadows that obscure details. High resolution, ecommerce ready.`;
    const optimizedPrompt = `${stylePrimer}\n\nSystem guidance:\n${systemPrompt}\n\nUser request:\n${prompt}`;

    // Step 2: Gemini 3 pro image preview로 단일 이미지 생성
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || "";
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: optimizedPrompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
            imageConfig: { imageSize: "1K" },
          },
        }),
      },
    );

    if (!geminiResp.ok) {
      const bodyText = await geminiResp.text();
      throw new Error(`Gemini API error: ${geminiResp.status} ${geminiResp.statusText} - ${bodyText}`);
    }

    const geminiData = await geminiResp.json();
    const parts = geminiData?.candidates?.[0]?.content?.parts || [];
    let base64Image = "";
    let mimeType = "image/png";
    let textResponse = "";

    for (const part of parts) {
      if (part.inlineData?.data && !base64Image) {
        base64Image = part.inlineData.data;
        mimeType = part.inlineData.mimeType || "image/png";
      }
      if (part.text) {
        textResponse += part.text;
      }
    }

    if (!base64Image) {
      const reason = textResponse ? `Gemini did not return an image. Text response: ${textResponse}` : "Gemini did not return an image";
      throw new Error(reason);
    }

    // Base64 -> Uint8Array
    const binaryString = atob(base64Image);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // 업로드
    const fileName = `${crypto.randomUUID()}.png`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("generated_images")
      .upload(fileName, bytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from("generated_images")
      .getPublicUrl(uploadData?.path || fileName);

    const publicUrl = publicUrlData?.publicUrl;

    if (!publicUrl) {
      throw new Error("Failed to generate public URL for generated image");
    }

    return new Response(
      JSON.stringify({
        optimizedPrompt,
        imageUrls: [publicUrl],
        imagePaths: [uploadData?.path || fileName],
        storedImageUrls: [publicUrl],
        alreadyStored: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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
