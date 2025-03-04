
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
      console.error('No image URL provided');
      return new Response(
        JSON.stringify({ error: 'No image URL provided' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
      );
    }

    console.log(`Trying to store image from URL: ${imageUrl}`);

    // Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      const errorMsg = `Failed to download image: ${imageResponse.statusText}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    const imageBlob = await imageResponse.blob();
    
    // Generate a sanitized filename using date, time and user id
    // DO NOT use any user-provided strings in the filename directly
    const now = new Date();
    const dateStr = now.toISOString().replace(/[^\w]/g, '').slice(0, 14); // YYYYMMDDHHMMSS format
    const userIdPart = userId ? userId.slice(0, 8) : 'anonymous';
    const fileId = crypto.randomUUID().split('-')[0]; // First part of a UUID for uniqueness
    
    // Create a completely ASCII-only filename
    const fileName = `image_${userIdPart}_${dateStr}_${fileId}.jpg`;

    console.log(`Uploading image with fully sanitized filename: ${fileName}`);

    // Check if bucket exists, create if it doesn't
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === 'generated_images');
      
      if (!bucketExists) {
        console.log('Bucket does not exist, creating...');
        const { data: bucketData, error: bucketError } = await supabase.storage
          .createBucket('generated_images', {
            public: true,
            fileSizeLimit: 10485760 // 10MB
          });
        
        if (bucketError) {
          console.error('Bucket creation error:', bucketError);
          throw bucketError;
        }
        console.log('Bucket created successfully:', bucketData);
      }
    } catch (bucketError) {
      console.error('Error checking/creating bucket:', bucketError);
      // Continue anyway, in case the bucket already exists
    }

    // Upload to Supabase Storage with fully sanitized filename
    const { data, error } = await supabase.storage
      .from('generated_images')
      .upload(fileName, imageBlob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Storage upload error:', error);
      throw error;
    }

    console.log('Image uploaded successfully to storage, generating public URL');

    // Generate a public URL for the stored image
    const { data: publicUrlData } = supabase.storage
      .from('generated_images')
      .getPublicUrl(fileName);

    const storedImageUrl = publicUrlData?.publicUrl;
    console.log('Generated public URL:', storedImageUrl);

    // Store the original cloth type name for reference, but don't use it in the filename
    const originalClothName = clothType || 'unknown';

    // Return success response with image information
    return new Response(
      JSON.stringify({ 
        success: true, 
        imagePath: fileName,
        storedImageUrl: storedImageUrl,
        message: 'Image stored successfully',
        originalName: originalClothName
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
