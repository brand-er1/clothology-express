
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

    // Get request body
    const requestData = await req.json();
    console.log("Received save-generated-image request:", requestData);

    // Extract required data
    const { 
      userId, 
      originalImageUrl, 
      originalImageUrls, // New field to handle multiple original URLs
      storedImageUrl,
      imagePath,
      prompt,
      clothType,
      material,
      detailDescription,
      generationPrompt,  // This should be the optimized prompt from GPT
      isSelected // New field to indicate which image was selected
    } = requestData;

    // Validate inputs
    if (!userId || (!originalImageUrl && !originalImageUrls) || !prompt) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, originalImageUrl/originalImageUrls, or prompt" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Log the generation prompt for debugging
    console.log("Storing generation prompt:", generationPrompt);

    // Use originalImageUrls if provided, otherwise use single originalImageUrl in an array
    const imagesToSave = originalImageUrls || [originalImageUrl];
    
    // Save records for all images
    const savedImages = [];
    
    for (const [index, imgUrl] of imagesToSave.entries()) {
      const isThisImageSelected = isSelected !== undefined ? index === isSelected : index === 0;
      
      // Insert data into generated_images table
      const { data, error } = await supabase
        .from('generated_images')
        .insert({
          user_id: userId,
          original_image_url: imgUrl,
          stored_image_url: isThisImageSelected ? storedImageUrl : null, // Only the selected image has a stored URL
          image_path: isThisImageSelected ? imagePath : null, // Only the selected image has a path
          prompt: prompt,
          cloth_type: clothType,
          material: material,
          detail: detailDescription,
          created_at: new Date().toISOString(),
          generation_prompt: generationPrompt || prompt, // Fallback to original prompt if optimized isn't provided
          is_selected: isThisImageSelected // New field to indicate selection status
        })
        .select();

      if (error) {
        console.error("Error saving generated image data:", error);
        return new Response(
          JSON.stringify({ error: error.message }), 
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      
      savedImages.push(data[0]);
      console.log(`Generated image ${index + 1} data saved successfully:`, data);
    }

    return new Response(
      JSON.stringify({ success: true, data: savedImages }),
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
