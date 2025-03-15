
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.3.0";

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

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    
    try {
      // For image input, we need to fetch the image as a Blob first
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
      }
      
      const imageBlob = await imageResponse.blob();
      const imageArrayBuffer = await imageBlob.arrayBuffer();
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageArrayBuffer)));
      
      // Create the model and prepare for image generation
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      // Create a detailed prompt for the AI
      const fullPrompt = `
      You are a professional fashion designer. Modify this clothing design based on the following instructions:
      
      Original design concept: ${originalPrompt || clothType}
      
      Modification requested: ${modificationPrompt}
      
      Please maintain the general style and type of clothing while applying these specific modifications.
      Generate a photorealistic, high-quality product image of the modified design.
      `;
      
      console.log("Sending prompt to Gemini:", fullPrompt);
      
      // Build the prompt parts with the image
      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: imageResponse.headers.get("content-type") || "image/jpeg"
        }
      };
      
      // Generate the content
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: fullPrompt }, imagePart] }],
        generationConfig: {
          temperature: 0.9,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 4096,
        }
      });
      
      const response = result.response;
      
      // Extract the text response
      const textResponse = response.text();
      console.log("Gemini text response:", textResponse);
      
      // Check if there's an image in the response
      let generatedImageBase64 = null;
      
      // Since @google/generative-ai doesn't directly output images yet in the public API,
      // we would need to set up a different model or approach for image generation
      // For now, we'll return the text response and implement image generation separately
      
      // Store the modified image in storage (would be implemented when image output is available)
      // For now, just return the Gemini response
      return new Response(
        JSON.stringify({ 
          success: true, 
          textResponse,
          // Would include the image URL once image generation is implemented
          // modifiedImageUrl: generatedImageUrl
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
      
    } catch (geminiError) {
      console.error("Gemini API error:", geminiError);
      return new Response(
        JSON.stringify({ error: `Gemini API error: ${geminiError.message}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
