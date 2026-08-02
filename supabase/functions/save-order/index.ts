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
  measurements?: Record<string, unknown> | null;
  generatedImageUrl?: string | null;
  imagePath?: string | null;
  imageBase64?: string | null;
  imageMimeType?: string | null;
  requestSource?: 'ai_design' | 'design_upload';
  requestTitle?: string | null;
  requestedQuantity?: number | null;
  estimateSnapshot?: Record<string, unknown> | null;
  status: 'pending' | 'approved' | 'rejected' | 'draft' | 'deleted';
}

const allowedImageMimeTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const getMinimumOrderQuantity = (clothType: string, material: string) => {
  const isKnit = /(?:니트|knit)/i.test(clothType);
  const isLeatherJacket =
    /(?:자켓|재킷|jacket)/i.test(clothType) &&
    (/(?:레더|가죽|leather)/i.test(clothType) ||
      /(?:레더|가죽|leather)/i.test(material));

  return isKnit || isLeatherJacket ? 100 : 20;
};

const decodeBase64Image = (value: string) => {
  const normalized = value.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

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

    const authorization = req.headers.get('Authorization') || '';
    const accessToken = authorization.replace(/^Bearer\s+/i, '');
    const { data: userData, error: userError } = await supabase.auth.getUser(
      accessToken,
    );
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const orderData: OrderData = await req.json();
    orderData.userId = userData.user.id;
    console.log('Received order data:', {
      userId: orderData.userId,
      clothType: orderData.clothType,
      requestSource: orderData.requestSource,
      requestedQuantity: orderData.requestedQuantity,
      hasUploadedImage: Boolean(orderData.imageBase64),
      status: orderData.status,
    });

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

    if (
      orderData.status === 'pending' &&
      orderData.requestedQuantity != null
    ) {
      const minimumOrderQuantity = getMinimumOrderQuantity(
        orderData.clothType,
        orderData.material,
      );
      const requestedQuantity = Number(orderData.requestedQuantity);
      if (
        !Number.isFinite(requestedQuantity) ||
        requestedQuantity < minimumOrderQuantity
      ) {
        return new Response(
          JSON.stringify({
            error: `선택한 품목은 MOQ ${minimumOrderQuantity}장부터 제작을 의뢰할 수 있습니다.`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          },
        );
      }
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

    let storedImagePath = orderData.imagePath || null;
    let storedImageUrl = orderData.generatedImageUrl || null;
    let uploadedNewImage = false;

    if (orderData.imageBase64) {
      const imageMimeType = String(orderData.imageMimeType || '').toLowerCase();
      if (!allowedImageMimeTypes.has(imageMimeType)) {
        return new Response(
          JSON.stringify({ error: 'PNG, JPG, JPEG, WEBP 이미지만 업로드할 수 있습니다.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          },
        );
      }

      const imageBytes = decodeBase64Image(orderData.imageBase64);
      if (imageBytes.byteLength > 10 * 1024 * 1024) {
        return new Response(
          JSON.stringify({ error: '10MB 이하 이미지만 업로드할 수 있습니다.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          },
        );
      }

      const extension =
        imageMimeType === 'image/png'
          ? 'png'
          : imageMimeType === 'image/webp'
          ? 'webp'
          : 'jpg';
      storedImagePath =
        `design-quotes/${orderData.userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('generated_images')
        .upload(storedImagePath, imageBytes, {
          contentType: imageMimeType,
          cacheControl: '3600',
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('generated_images')
        .getPublicUrl(storedImagePath);
      storedImageUrl = publicUrlData.publicUrl;
      uploadedNewImage = true;
    }

    const requestedQuantity = Number(orderData.requestedQuantity);
    const normalizedRequestedQuantity =
      Number.isFinite(requestedQuantity) && requestedQuantity > 0
        ? Math.round(requestedQuantity)
        : null;

    // Create the order object with extracted data
    const orderObject = {
      user_id: orderData.userId,
      cloth_type: orderData.clothType,
      material: orderData.material,
      detail_description: orderData.detailDescription || null,
      size: orderData.size || null,
      measurements: orderData.measurements || null,
      generated_image_url: storedImageUrl,
      image_path: storedImagePath,
      request_source: orderData.requestSource || 'ai_design',
      request_title: orderData.requestTitle || null,
      requested_quantity: normalizedRequestedQuantity,
      estimate_snapshot: orderData.estimateSnapshot || null,
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
        if (uploadedNewImage && storedImagePath) {
          await supabase.storage.from('generated_images').remove([storedImagePath]);
        }
        throw error;
      }
      
      result = { id: existingOrder.id, updated: true, data, success: true };
      console.log('Updated existing order:', existingOrder.id);
    } else {
      // Insert new order
      const { data, error } = await supabase
        .from('orders')
        .insert(orderObject)
        .select();
      
      if (error) {
        if (uploadedNewImage && storedImagePath) {
          await supabase.storage.from('generated_images').remove([storedImagePath]);
        }
        throw error;
      }
      
      result = { id: data?.[0]?.id, created: true, data, success: true };
      console.log('Created new order:', data?.[0]?.id);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error processing order:', error);
    
    return new Response(JSON.stringify({ error: error.message, success: false }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
