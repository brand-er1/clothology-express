
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get request body
    const requestData = await req.json()
    const {
      userId,
      clothType,
      material,
      style,
      pocketType,
      color,
      detailDescription,
      size,
      measurements,
      generatedImageUrl,
      imagePath,
      status = 'pending' // Default status
    } = requestData

    if (!userId) {
      return new Response(
        JSON.stringify({ 
          error: 'User ID is required' 
        }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    // Validate user exists
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      console.error('User validation error:', userError)
      return new Response(
        JSON.stringify({ 
          error: 'Invalid user ID' 
        }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    console.log('Saving order for user:', userId)
    console.log('Order data:', {
      clothType,
      material,
      style,
      pocketType,
      color,
      detailDescription,
      size,
      measurements,
      generatedImageUrl,
      imagePath
    })

    // Insert order into database
    const { data, error } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        cloth_type: clothType,
        material: material,
        style: style,
        pocket_type: pocketType,
        color: color,
        detail_description: detailDescription,
        size: size,
        measurements: measurements,
        generated_image_url: generatedImageUrl,
        image_path: imagePath,
        status: status
      })
      .select()

    if (error) {
      console.error('Order creation error:', error)
      return new Response(
        JSON.stringify({
          error: `Failed to save order: ${error.message}`,
          details: error
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Order saved successfully',
        data: data
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({
        error: `Unexpected error: ${error.message}`,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})
