
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Get request body
    const requestData = await req.json();
    console.log("Received modify-generated-image request:", requestData);

    // Extract required data
    const { 
      imageUrl, 
      modificationPrompt,
      userId,
      clothType,
      originalPrompt
    } = requestData;

    // Validate inputs
    if (!imageUrl || !modificationPrompt) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: imageUrl or modificationPrompt" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Fetch base image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
    }
    
    const imageBlob = await imageResponse.blob();
    const imageArrayBuffer = await imageBlob.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageArrayBuffer)));
    
    // Create a detailed prompt for the AI
    const fullPrompt = `
    You are a professional fashion designer. Modify this clothing design based on the following instructions:
    
    Original design concept: ${originalPrompt || clothType}
    
    Modification requested: ${modificationPrompt}
    
    Please maintain the general style and type of clothing while applying these specific modifications.
    Generate a photorealistic, high-quality product image of the modified design.
    `;
    
    console.log("Sending prompt to Gemini:", fullPrompt);
    
    // Call Gemini 3 image preview via REST streaming endpoint with image + text
    const streamResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:streamGenerateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: fullPrompt },
                {
                  inlineData: {
                    data: base64Image,
                    mimeType: imageResponse.headers.get("content-type") || "image/jpeg",
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
            responseMimeType: "image/png",
            imageConfig: { imageSize: "1K" },
          },
        }),
      },
    );

    if (!streamResp.body) {
      throw new Error("No response body from Gemini");
    }

    const reader = streamResp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let generatedImageBase64 = "";
    let mimeType = "image/png";
    let responseText = "";

    const processLines = (lines: string[]) => {
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr) continue;
        try {
          const chunk = JSON.parse(jsonStr);
          const parts = chunk.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.inlineData?.data && !generatedImageBase64) {
              generatedImageBase64 = part.inlineData.data;
              mimeType = part.inlineData.mimeType || "image/png";
            }
            if (part.text) {
              responseText += part.text;
            }
          }
        } catch (_e) {
          // ignore malformed lines
        }
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      processLines(lines);
    }

    if (buffer.trim()) {
      processLines([buffer]);
    }

    if (!generatedImageBase64) {
      const reason = responseText ? `Gemini did not return an image. Text response: ${responseText}` : "Gemini did not return an image";
      throw new Error(reason);
    }

    // Store the image in Supabase Storage
    const binaryString = atob(generatedImageBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const fileName = `${userId || "anon"}/${Date.now()}_${crypto.randomUUID()}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('modified_images')
      .upload(fileName, bytes, {
        contentType: mimeType,
        upsert: false
      });
    
    if (uploadError) {
      console.error("Error uploading generated image:", uploadError);
      throw uploadError;
    }

    const { data: publicUrlData } = await supabase.storage
      .from('modified_images')
      .getPublicUrl(uploadData?.path || fileName);
    
    const generatedImageUrl = publicUrlData?.publicUrl;
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        textResponse: responseText,
        modifiedImageUrl: generatedImageUrl,
        modifiedImagePath: uploadData?.path || fileName,
        hasImage: !!generatedImageUrl
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
