
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0'

// Set up CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Handle CORS preflight requests
export const corsResponse = () => {
  return new Response(null, {
    headers: corsHeaders,
    status: 204,
  })
}

export const handler = async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return corsResponse()
  }

  try {
    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Create a Supabase client using the service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse the request body
    const { 
      userId, 
      originalImageUrl, 
      storedImageUrl, 
      imagePath, 
      prompt, 
      clothType, 
      material, 
      style, 
      pocket, 
      color, 
      fit, 
      detail 
    } = await req.json()

    console.log('Saving generated image data:', {
      user_id: userId,
      prompt,
      cloth_type: clothType,
      material,
      style,
      pocket,
      color,
      fit,
      detail
    })

    // Insert the record into the generated_images table
    const { data, error } = await supabase
      .from('generated_images')
      .insert({
        user_id: userId,
        original_image_url: originalImageUrl,
        stored_image_url: storedImageUrl,
        image_path: imagePath,
        prompt: prompt,
        cloth_type: clothType,
        material: material,
        style: style,
        pocket: pocket,
        color: color,
        fit: fit,
        detail: detail
      })
      .select()

    if (error) {
      console.error('Error saving image data:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}

// Use Deno's serve function to handle incoming requests
Deno.serve(handler)
