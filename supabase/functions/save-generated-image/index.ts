
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
      storedImageUrl,
      imagePath,
      prompt,
      clothType,
      material,
      detailDescription
    } = requestData;

    // Validate inputs
    if (!userId || !originalImageUrl || !prompt) {
      console.error("Missing required fields:", { userId, originalImageUrl, prompt });
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, originalImageUrl, or prompt" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Saving image data to database:", {
      user_id: userId,
      original_image_url: originalImageUrl,
      stored_image_url: storedImageUrl,
      image_path: imagePath,
      prompt,
      cloth_type: clothType,
      material,
      detail: detailDescription
    });

    // Check if the generated_images table exists, if not create it
    try {
      const { data: tableExists, error: tableCheckError } = await supabase.rpc(
        'check_table_exists',
        { table_name: 'generated_images' }
      );
      
      if (tableCheckError) {
        console.log("Error checking if table exists, assuming it doesn't:", tableCheckError);
        
        // Create the table if it doesn't exist
        const createTableQuery = `
          CREATE TABLE IF NOT EXISTS public.generated_images (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL,
            original_image_url TEXT NOT NULL,
            stored_image_url TEXT,
            image_path TEXT,
            prompt TEXT NOT NULL,
            cloth_type TEXT,
            material TEXT,
            detail TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          -- Add RLS policies
          ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;
          
          -- Allow users to see their own images
          CREATE POLICY "Users can view their own images" 
            ON public.generated_images FOR SELECT
            USING (auth.uid() = user_id);
            
          -- Allow users to insert their own images
          CREATE POLICY "Users can insert their own images" 
            ON public.generated_images FOR INSERT
            WITH CHECK (auth.uid() = user_id);
        `;
        
        const { error: createTableError } = await supabase.rpc('run_sql', { sql: createTableQuery });
        if (createTableError) {
          console.error("Error creating generated_images table:", createTableError);
          // Continue anyway, as table might exist already
        }
      }
    } catch (error) {
      console.log("Error in table check/creation, continuing anyway:", error);
      // Continue with insert attempt
    }

    // Insert data into generated_images table, prioritizing storage URL
    const { data, error } = await supabase
      .from('generated_images')
      .insert({
        user_id: userId,
        original_image_url: originalImageUrl,
        stored_image_url: storedImageUrl, // Use the storage URL
        image_path: imagePath,
        prompt: prompt,
        cloth_type: clothType,
        material: material,
        detail: detailDescription
      })
      .select();

    if (error) {
      console.error("Error saving generated image data:", error);
      return new Response(
        JSON.stringify({ error: error.message }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log("Generated image data saved successfully:", data);

    return new Response(
      JSON.stringify({ success: true, data }),
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
