
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
      
      // Use the experimental image generation model
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp-image-generation" });
      
      // Generate the content with specific configuration - fix the parameters
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: fullPrompt }, imagePart] }],
        generationConfig: {
          temperature: 1.0,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192,
        }
      });
      
      const response = result.response;
      console.log("Gemini response:", response);
      
      // Process response to extract text and any generated images
      const responseText = response.text();
      let generatedImageBase64 = null;
      let generatedImageUrl = null;
      
      // Check if there's a generated image in the response
      const parts = response.candidates?.[0]?.content?.parts;
      if (parts && parts.length > 0) {
        // Look for inline data (image) in the response
        for (const part of parts) {
          if (part.inlineData) {
            generatedImageBase64 = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/jpeg';
            
            // Store the image in Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('modified_images')
              .upload(
                `${userId}/${new Date().getTime()}.jpg`,
                Buffer.from(generatedImageBase64, 'base64'),
                {
                  contentType: mimeType,
                  upsert: false
                }
              );
            
            if (uploadError) {
              console.error("Error uploading generated image:", uploadError);
            } else if (uploadData) {
              // Get public URL for the uploaded image
              const { data: publicUrlData } = await supabase.storage
                .from('modified_images')
                .getPublicUrl(uploadData.path);
              
              generatedImageUrl = publicUrlData.publicUrl;
            }
          }
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          textResponse: responseText,
          modifiedImageUrl: generatedImageUrl,
          hasImage: !!generatedImageUrl
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
      
    } catch (geminiError) {
      console.error("Gemini API error:", geminiError);
      
      // Check if the error is related to the experimental model not being available
      if (geminiError.message && geminiError.message.includes("not found")) {
        // Fall back to gemini-1.5-flash
        try {
          console.log("Falling back to gemini-1.5-flash model...");
          
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          
          // Build the prompt parts with the image
          const imagePart = {
            inlineData: {
              data: base64Image,
              mimeType: imageResponse.headers.get("content-type") || "image/jpeg"
            }
          };
          
          // Generate the content with the fallback model
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
          const textResponse = response.text();
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              textResponse,
              fallbackMode: true
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (fallbackError) {
          console.error("Fallback model error:", fallbackError);
          return new Response(
            JSON.stringify({ 
              error: `Failed with both models: ${geminiError.message}, Fallback: ${fallbackError.message}` 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
          );
        }
      }
      
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
