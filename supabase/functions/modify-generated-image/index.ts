
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
    // Avoid spreading large Uint8Arrays (can cause call stack errors)
    const bytes = new Uint8Array(imageArrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Image = btoa(binary);
    
    // Create a detailed prompt for the AI
    const fullPrompt = `
    You are a professional fashion designer. Modify this clothing design based on the following instructions:
    
    Original design concept: ${originalPrompt || clothType}
    
    Modification requested: ${modificationPrompt}
    
    Please maintain the general style and type of clothing while applying these specific modifications.
    Generate a photorealistic, high-quality product image of the modified design.
    `;
    
    console.log("Sending prompt to Gemini:", fullPrompt);
    
    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${geminiApiKey}`,
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
    let generatedImageBase64 = "";
    let mimeType = "image/png";
    let responseText = "";

    for (const part of parts) {
      if (part.inlineData?.data && !generatedImageBase64) {
        generatedImageBase64 = part.inlineData.data;
        mimeType = part.inlineData.mimeType || "image/png";
      }
      if (part.text) {
        responseText += part.text;
      }
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
