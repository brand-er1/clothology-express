
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
      isSelected, // This will be undefined during initial generation, set only when ordering
      saveOnlySelected = false, // Flag to indicate if we're saving during generation or order
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
    
    // If we're marking a selected image (during ordering)
    if (isSelected !== undefined && saveOnlySelected) {
      console.log(`Updating selection status for image ${isSelected + 1}`);
      
      // Update the selected image
      const { error: updateError } = await supabase
        .from('generated_images')
        .update({ 
          is_selected: true
        })
        .eq('user_id', userId)
        .eq('prompt', prompt)
        .eq('material', material)
        .eq('original_image_url', originalImageUrls[isSelected]);
      
      if (updateError) {
        console.error("Failed to update selected image:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }), 
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      
      // Reset all other images for this generation to not selected
      // For now skip resetting others (single image flow)
      
      return new Response(
        JSON.stringify({ success: true, message: "Selected image updated successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // For initial generation, we save all images but don't mark any as selected yet
    const savedImages = [];
    
    for (const [index, imgUrl] of originalImageUrls.entries()) {
      console.log(`Processing image ${index + 1}/${originalImageUrls.length}`);
      
      // Get the stored URL and path for this image if available
      const thisStoredImageUrl = storedImageUrls && storedImageUrls[index] ? 
        storedImageUrls[index] : 
        (index === 0 ? storedImageUrl : null);
        
      const thisImagePath = imagePaths && imagePaths[index] ? 
        imagePaths[index] : 
        (index === 0 ? imagePath : null);
      
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
          is_selected: index === 0 // single image flow: first is selected
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
