
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrderData {
  userId: string;
  clothType: string; 
  material: string;
  detailDescription?: string;
  size?: string | null;
  measurements?: Record<string, any> | null;
  generatedImageUrl?: string | null;
  imagePath?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'draft';
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const orderData: OrderData = await req.json();
    console.log('Received order data:', orderData);

    // Validate required fields
    if (!orderData.userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!orderData.clothType) {
      return new Response(JSON.stringify({ error: 'Cloth type is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!orderData.material) {
      return new Response(JSON.stringify({ error: 'Material is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If this is a finalized order (pending), look for a draft to update
    let existingOrder = null;
    
    if (orderData.status === 'pending') {
      // Look for a draft with matching basic information
      const { data: drafts, error: draftError } = await supabase
        .from('orders')
        .select('id, status')
        .eq('user_id', orderData.userId)
        .eq('cloth_type', orderData.clothType)
        .eq('material', orderData.material)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (draftError) {
        console.error('Error fetching drafts:', draftError);
      } else if (drafts && drafts.length > 0) {
        existingOrder = drafts[0];
        console.log('Found existing draft to update:', existingOrder.id);
      }
    } 
    // If this is a draft, check for an existing draft to update
    else if (orderData.status === 'draft') {
      // Look for an existing draft with matching image path (if available) or basic info
      let query = supabase
        .from('orders')
        .select('id, status')
        .eq('user_id', orderData.userId)
        .eq('cloth_type', orderData.clothType)
        .eq('material', orderData.material)
        .eq('status', 'draft');
      
      // If we have an image path, use that for more precise matching
      if (orderData.imagePath) {
        query = query.eq('image_path', orderData.imagePath);
      }
      
      const { data: drafts, error: draftError } = await query
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (draftError) {
        console.error('Error fetching drafts:', draftError);
      } else if (drafts && drafts.length > 0) {
        existingOrder = drafts[0];
        console.log('Found existing draft to update:', existingOrder.id);
      }
    }

    // Create the order object with extracted data
    const orderObject = {
      user_id: orderData.userId,
      cloth_type: orderData.clothType,
      material: orderData.material,
      detail_description: orderData.detailDescription || null,
      size: orderData.size || null,
      measurements: orderData.measurements || null,
      generated_image_url: orderData.generatedImageUrl || null,
      image_path: orderData.imagePath || null,
      status: orderData.status
    };

    let result;
    
    if (existingOrder) {
      // Update existing draft
      const { data, error } = await supabase
        .from('orders')
        .update(orderObject)
        .eq('id', existingOrder.id)
        .select();
      
      if (error) {
        throw error;
      }
      
      result = { id: existingOrder.id, updated: true, data };
      console.log('Updated existing order:', existingOrder.id);
    } else {
      // Insert new order
      const { data, error } = await supabase
        .from('orders')
        .insert(orderObject)
        .select();
      
      if (error) {
        throw error;
      }
      
      result = { id: data?.[0]?.id, created: true, data };
      console.log('Created new order:', data?.[0]?.id);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error processing order:', error);
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
