
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { tryRemoveGarmentBackground } from "../_shared/removeGarmentBackground.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_SYSTEM_PROMPT = `Produce one concise, production-ready prompt that captures garment type, material, color, fit, key design details, seasonality, and styling cues from the user request. Keep it ecommerce-focused, photorealistic, and avoid adding models, text overlays, or props. Keep language consistent with the user input.`;

function classifyGeminiError(status: number) {
  if (status === 429) return 'quota_or_credit';
  if (status === 401) return 'invalid_api_key';
  if (status === 403) return 'billing_permission_or_api_restriction';
  if (status === 404) return 'model_not_found_or_unavailable';
  if (status >= 500) return 'gemini_server_error';
  return 'gemini_api_error';
}

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

    const { data: systemPromptData, error: systemPromptError } = await supabase
      .from('system_prompts')
      .select('prompt')
      .order('created_at', { ascending: false })
      .limit(1);

    if (systemPromptError) throw systemPromptError;

    const systemPrompt = systemPromptData?.[0]?.prompt || DEFAULT_SYSTEM_PROMPT;
    console.log("Using system prompt:", systemPrompt);

    const stylePrimer = `White background, premium photorealistic 3D garment visualization like a high-end fashion ecommerce product render. The garment must have convincing three-dimensional volume, realistic fabric thickness, natural drape and folds, precise seams, hems, stitching, collars, cuffs, and material texture. Use soft studio lighting and subtle contact shadows to reveal depth without hiding design details. No models or mannequins. Show two large views in one frame: left = garment front, right = garment back. Make both garments fill most of the canvas with minimal empty margins while keeping every edge visible. No props, text overlays, or flat illustration styling. High resolution, production-ready and ecommerce ready.`;
    const optimizedPrompt = `${stylePrimer}\n\nSystem guidance:\n${systemPrompt}\n\nUser request:\n${prompt}`;

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || "";
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const modelCandidates = ["gemini-3-pro-image", "gemini-3-pro-image-preview"];
    let geminiData: any = null;
    let selectedModel = "";
    let lastGeminiError = "";

    for (const model of modelCandidates) {
      const geminiResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: optimizedPrompt }] }],
            generationConfig: {
              responseModalities: ["IMAGE", "TEXT"],
              imageConfig: {
                aspectRatio: "4:3",
                imageSize: "2K",
              },
            },
          }),
        },
      );

      if (geminiResp.ok) {
        geminiData = await geminiResp.json();
        selectedModel = model;
        console.log(`Gemini image generation succeeded with model: ${model}`);
        break;
      }

      const bodyText = await geminiResp.text();
      const category = classifyGeminiError(geminiResp.status);
      lastGeminiError = `Gemini API error [${category}] ${geminiResp.status} ${geminiResp.statusText} model=${model} - ${bodyText}`;
      console.error(lastGeminiError);

      const retryWithFallback = geminiResp.status === 404 || geminiResp.status >= 500;
      if (!retryWithFallback) {
        throw new Error(lastGeminiError);
      }
    }

    if (!geminiData) {
      throw new Error(lastGeminiError || "Gemini image generation failed for all configured models");
    }

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

    const binaryString = atob(base64Image);
    const rawBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      rawBytes[i] = binaryString.charCodeAt(i);
    }

    const { bytes, mimeType: uploadMimeType } = await tryRemoveGarmentBackground(rawBytes, mimeType);

    const fileExtension = uploadMimeType === "image/png" ? "png" : "jpg";
    const fileName = `${crypto.randomUUID()}.${fileExtension}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("generated_images")
      .upload(fileName, bytes, {
        contentType: uploadMimeType,
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
        model: selectedModel,
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
