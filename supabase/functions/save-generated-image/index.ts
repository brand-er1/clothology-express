
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
      originalImageUrls, 
      storedImageUrls,
      imagePaths,
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
    if (!userId || !originalImageUrls || !prompt) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, originalImageUrls, or prompt" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Log the generation prompt for debugging
    console.log("Storing generation prompt:", generationPrompt);
    
    // Delete any existing records for this user with the same prompt and material before inserting new ones
    try {
      const { error: deleteError } = await supabase
        .from('generated_images')
        .delete()
        .eq('user_id', userId)
        .eq('prompt', prompt)
        .eq('material', material);
      
      if (deleteError) {
        console.log("Warning: Failed to delete existing records:", deleteError);
        // Continue with insertion anyway
      } else {
        console.log("Successfully deleted existing records for this generation");
      }
    } catch (deleteErr) {
      console.log("Error during deletion of existing records:", deleteErr);
      // Continue with insertion anyway
    }
    
    // Save records for all images
    const savedImages = [];
    
    for (const [index, imgUrl] of originalImageUrls.entries()) {
      const isThisImageSelected = isSelected !== undefined ? index === isSelected : index === 0;
      console.log(`Processing image ${index + 1}/${originalImageUrls.length}, selected: ${isThisImageSelected}`);
      
      // Get the stored URL and path for this image if available
      const thisStoredImageUrl = storedImageUrls && storedImageUrls[index] ? 
        storedImageUrls[index] : 
        (isThisImageSelected ? storedImageUrl : null);
        
      const thisImagePath = imagePaths && imagePaths[index] ? 
        imagePaths[index] : 
        (isThisImageSelected ? imagePath : null);
      
      // Insert data into generated_images table
      const { data, error } = await supabase
        .from('generated_images')
        .insert({
          user_id: userId,
          original_image_url: imgUrl,
          stored_image_url: thisStoredImageUrl,
          image_path: thisImagePath,
          prompt: prompt,
          cloth_type: clothType,
          material: material,
          detail: detailDescription,
          created_at: new Date().toISOString(),
          generation_prompt: generationPrompt || prompt, // Fallback to original prompt if optimized isn't provided
          is_selected: isThisImageSelected // Store selection status - new field needed in the database
        })
        .select();

      if (error) {
        console.error(`Error saving image ${index + 1}:`, error);
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
