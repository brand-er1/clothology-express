import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      user_id,
      selectedType,
      selectedMaterial,
      selectedStyle,
      selectedPocket,
      selectedColor,
      selectedDetail,
      selectedSize,
      customMeasurements,
      generatedImageUrl,
      imagePath,
      sizeTableData,
      step
    } = await req.json();

    // Validate required fields
    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'User ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Prepare measurements data
    let measurementsData = null;
    
    // If we have size table measurements, use those
    if (sizeTableData && sizeTableData.length > 0) {
      measurementsData = {};
      sizeTableData.forEach(item => {
        measurementsData[item.key] = item.value;
      });
    } 
    // Otherwise, use custom measurements if provided
    else if (selectedSize === 'custom' && Object.keys(customMeasurements || {}).length > 0) {
      measurementsData = customMeasurements;
    }

    // Find material name if ID is provided
    let materialName = selectedMaterial;
    
    console.log(`Processing order progress save: Step ${step}, Material: ${selectedMaterial}, Type: ${selectedType}`);

    // Check if this user already has a pending order
    const { data: existingOrders, error: fetchError } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', user_id)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error("Error fetching existing draft orders:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to check existing orders: ${fetchError.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    let result;
    const orderData = {
      user_id,
      cloth_type: selectedType,
      material: selectedMaterial,
      style: selectedStyle,
      pocket_type: selectedPocket,
      color: selectedColor,
      detail_description: selectedDetail,
      size: selectedSize,
      measurements: measurementsData,
      generated_image_url: generatedImageUrl,
      image_path: imagePath,
      status: 'draft'
    };

    // If we found an existing draft order, update it
    if (existingOrders && existingOrders.length > 0) {
      const orderId = existingOrders[0].id;
      console.log(`Updating existing draft order ${orderId}`);
      
      const { data, error } = await supabase
        .from('orders')
        .update(orderData)
        .eq('id', orderId)
        .select();
      
      result = { data, error, updated: true, id: orderId };
    } 
    // Otherwise create a new draft order
    else {
      console.log('Creating new draft order');
      const { data, error } = await supabase
        .from('orders')
        .insert(orderData)
        .select();
      
      result = { data, error, updated: false };
    }

    if (result.error) {
      console.error("Error saving order progress:", result.error);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to save progress: ${result.error.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Return success and the order data
    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: result.updated,
        orderId: result.data?.[0]?.id || result.id,
        message: 'Progress saved successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Unexpected error in save-customize-progress:", error);
    return new Response(
      JSON.stringify({ success: false, error: `An unexpected error occurred: ${error.message}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
