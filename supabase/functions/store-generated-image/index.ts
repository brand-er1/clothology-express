
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get API secrets
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get request data
    const { imageUrl, userId, clothType } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'No image URL provided' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
      );
    }

    console.log(`Trying to store image from URL: ${imageUrl}`);

    // Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }
    
    const imageBlob = await imageResponse.blob();
    
    // New file naming pattern: userId_timestamp_uuid.jpg
    // Avoid using clothType since it might contain Korean characters
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${userId ? userId.slice(0, 8) + '_' : ''}${timestamp}_${crypto.randomUUID()}.jpg`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('generated_images')
      .upload(fileName, imageBlob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      throw error;
    }

    // Generate a public URL for the stored image
    const { data: publicUrlData } = supabase.storage
      .from('generated_images')
      .getPublicUrl(fileName);

    const storedImageUrl = publicUrlData?.publicUrl;

    return new Response(
      JSON.stringify({ 
        success: true, 
        imagePath: fileName,
        storedImageUrl: storedImageUrl,
        message: 'Image stored successfully'
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error storing generated image:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to store image',
        details: error.message 
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 }
    );
  }
});
