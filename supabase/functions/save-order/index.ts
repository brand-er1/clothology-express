import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReferenceImageInput {
  base64: string;
  mimeType: string;
}

interface OrderData {
  userId: string | null;
  clothType: string;
  material: string;
  detailDescription?: string;
  size?: string | null;
  measurements?: Record<string, unknown> | null;
  generatedImageUrl?: string | null;
  imagePath?: string | null;
  imageBase64?: string | null;
  imageMimeType?: string | null;
  /** Full set of reference images uploaded for a multi-image design-quote request (up to 10). */
  images?: ReferenceImageInput[] | null;
  requestSource?: 'ai_design' | 'design_upload' | 'ready_made_group_wear' | 'virtual_fitting_3d';
  requestTitle?: string | null;
  requestedQuantity?: number | null;
  estimateSnapshot?: Record<string, unknown> | null;
  /** Gender/size/per-slot garment summary from the 3D virtual-fitting flow (see
   * src/lib/fitting-preview.ts#serializeFittingStateForHandoff on the client). Opaque here. */
  fittingState?: Record<string, unknown> | null;
  /** Hosted URL of the 3D mannequin screenshot or AI 피팅 photoreal render, already uploaded
   * client-side — this function never uploads it, only stores the URL. */
  fittingPreviewUrl?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'draft' | 'deleted';
  /** Contact info for a guest (not logged in) submission — only used/required when
   * requestSource is 'ready_made_group_wear' and no authenticated user was found. */
  guestName?: string | null;
  guestPhone?: string | null;
  /** WYSIWYG capture of the ready-made group wear editor canvas at submission time — a clean
   * (no UI chrome) PNG of the garment + placed design exactly as the customer configured it.
   * Only present for requestSource 'ready_made_group_wear', and only per side actually used. */
  frontPreviewBase64?: string | null;
  frontPreviewMimeType?: string | null;
  backPreviewBase64?: string | null;
  backPreviewMimeType?: string | null;
  /** Structured design snapshot behind the preview images (product, color, sizes, per-job
   * normalized placement) — see ready_made_design_data column comment. */
  readyMadeDesignData?: Record<string, unknown> | null;
}

const maxReferenceImages = 10;

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
    const { data: userData } = await supabase.auth.getUser(accessToken);
    const authenticatedUser = userData?.user ?? null;

    const orderData: OrderData = await req.json();

    // Every other request source still requires a logged-in user. Only the ready-made
    // group wear ("빠른 단체복 제작") service is meant to work for visitors who never
    // signed up — for that one source a guest may submit with name/phone instead of
    // an account, since there's no `user_id` to notify or look up.
    const isGuestReadyMadeRequest =
      !authenticatedUser && orderData.requestSource === 'ready_made_group_wear';

    if (!authenticatedUser && !isGuestReadyMadeRequest) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    orderData.userId = authenticatedUser?.id ?? null;

    const guestName = String(orderData.guestName || '').trim();
    const guestPhone = String(orderData.guestPhone || '').trim();

    console.log('Received order data:', {
      userId: orderData.userId,
      isGuest: isGuestReadyMadeRequest,
      clothType: orderData.clothType,
      requestSource: orderData.requestSource,
      requestedQuantity: orderData.requestedQuantity,
      hasUploadedImage: Boolean(orderData.imageBase64),
      status: orderData.status,
    });

    // Validate required fields
    if (!orderData.userId && !isGuestReadyMadeRequest) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (isGuestReadyMadeRequest && (!guestName || !guestPhone)) {
      return new Response(
        JSON.stringify({ error: '이름과 연락처를 입력해주세요.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        },
      );
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

    // The ready-made group wear service ("기성품 단체복 빠른 제작") has its own,
    // much lower minimum (it supports 1-piece samples) and is priced by a
    // completely separate module client-side — the custom-clothing MOQ table
    // below does not apply to it.
    if (
      orderData.status === 'pending' &&
      orderData.requestedQuantity != null &&
      orderData.requestSource !== 'ready_made_group_wear'
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

    // A guest has no user_id to match a prior draft against — and the ready-made
    // group wear flow never creates drafts in the first place — so skip straight
    // to inserting a new order.
    if (orderData.status === 'pending' && orderData.userId) {
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
    else if (orderData.status === 'draft' && orderData.userId) {
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
        `design-quotes/${orderData.userId || 'guest'}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
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

    // Full reference-image set for a multi-image design-quote request (front/back/detail/etc,
    // up to 10). Stored independently of the single `image_path` above, which stays the
    // "cover"/representative image every other flow (ai_design, ready_made) still relies on.
    // Uploads are best-effort per image — one invalid/oversized image is skipped rather than
    // failing the whole submission, since the estimate itself already succeeded by this point.
    const uploadedReferencePaths: string[] = [];
    let referenceImagePaths: string[] | null = null;
    if (Array.isArray(orderData.images) && orderData.images.length > 0) {
      for (const image of orderData.images.slice(0, maxReferenceImages)) {
        const mimeType = String(image?.mimeType || '').toLowerCase();
        if (!allowedImageMimeTypes.has(mimeType)) continue;

        let bytes: Uint8Array;
        try {
          bytes = decodeBase64Image(String(image?.base64 || ''));
        } catch {
          continue;
        }
        if (bytes.byteLength === 0 || bytes.byteLength > 10 * 1024 * 1024) continue;

        const extension =
          mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
        const path =
          `design-quotes/${orderData.userId || 'guest'}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('generated_images')
          .upload(path, bytes, {
            contentType: mimeType,
            cacheControl: '3600',
            upsert: false,
          });
        if (uploadError) {
          if (uploadedReferencePaths.length) {
            await supabase.storage.from('generated_images').remove(uploadedReferencePaths);
          }
          throw uploadError;
        }
        uploadedReferencePaths.push(path);
      }
      if (uploadedReferencePaths.length > 0) {
        referenceImagePaths = uploadedReferencePaths;
      }
    }

    // WYSIWYG final-design preview(s) for the ready-made group wear editor — captured
    // client-side from the actual editor canvas, so this is a straight upload, never
    // regenerated/composited here. The folder is named after the order's own id (generated
    // up front so it's known before the row exists) so front.png/back.png stay traceable
    // back to the order that produced them.
    let frontPreviewUrl: string | null = null;
    let backPreviewUrl: string | null = null;
    const uploadedPreviewPaths: string[] = [];
    const previewOrderId =
      orderData.frontPreviewBase64 || orderData.backPreviewBase64 ? crypto.randomUUID() : null;

    if (previewOrderId) {
      const uploadPreview = async (base64: string, mimeTypeInput: string | null, side: 'front' | 'back') => {
        const mimeType = allowedImageMimeTypes.has(String(mimeTypeInput || '').toLowerCase())
          ? String(mimeTypeInput).toLowerCase()
          : 'image/png';
        const bytes = decodeBase64Image(base64);
        if (bytes.byteLength === 0 || bytes.byteLength > 10 * 1024 * 1024) {
          throw new Error('제작 시안 이미지 용량이 올바르지 않습니다.');
        }
        const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
        const path = `order-previews/${previewOrderId}/${side}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('generated_images')
          .upload(path, bytes, {
            contentType: mimeType,
            cacheControl: '3600',
            upsert: false,
          });
        if (uploadError) throw uploadError;
        uploadedPreviewPaths.push(path);
        const { data: publicUrlData } = supabase.storage.from('generated_images').getPublicUrl(path);
        return publicUrlData.publicUrl;
      };

      try {
        if (orderData.frontPreviewBase64) {
          frontPreviewUrl = await uploadPreview(orderData.frontPreviewBase64, orderData.frontPreviewMimeType, 'front');
        }
        if (orderData.backPreviewBase64) {
          backPreviewUrl = await uploadPreview(orderData.backPreviewBase64, orderData.backPreviewMimeType, 'back');
        }
      } catch (previewError) {
        if (uploadedPreviewPaths.length) {
          await supabase.storage.from('generated_images').remove(uploadedPreviewPaths);
        }
        throw previewError;
      }
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
      reference_image_paths: referenceImagePaths,
      request_source: orderData.requestSource || 'ai_design',
      request_title: orderData.requestTitle || null,
      requested_quantity: normalizedRequestedQuantity,
      estimate_snapshot: orderData.estimateSnapshot || null,
      guest_name: isGuestReadyMadeRequest ? guestName : null,
      guest_phone: isGuestReadyMadeRequest ? guestPhone : null,
      front_preview_url: frontPreviewUrl,
      back_preview_url: backPreviewUrl,
      ready_made_design_data: orderData.readyMadeDesignData || null,
      fitting_state: orderData.fittingState || null,
      fitting_preview_url: orderData.fittingPreviewUrl || null,
      status: orderData.status
    };

    let result;

    const cleanupUploads = async () => {
      if (uploadedNewImage && storedImagePath) {
        await supabase.storage.from('generated_images').remove([storedImagePath]);
      }
      if (uploadedReferencePaths.length) {
        await supabase.storage.from('generated_images').remove(uploadedReferencePaths);
      }
      if (uploadedPreviewPaths.length) {
        await supabase.storage.from('generated_images').remove(uploadedPreviewPaths);
      }
    };

    if (existingOrder) {
      // Update existing draft
      const { data, error } = await supabase
        .from('orders')
        .update(orderObject)
        .eq('id', existingOrder.id)
        .select();

      if (error) {
        await cleanupUploads();
        throw error;
      }

      result = { id: existingOrder.id, updated: true, data, success: true };
      console.log('Updated existing order:', existingOrder.id);
    } else {
      // Insert new order — reuse the id already used for the preview storage path (if any)
      // so front_preview_url/back_preview_url stay traceable to this exact row.
      const { data, error } = await supabase
        .from('orders')
        .insert(previewOrderId ? { ...orderObject, id: previewOrderId } : orderObject)
        .select();

      if (error) {
        await cleanupUploads();
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
