
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
      detail, // 디테일을 우선시
      style,
      pocket,
      color,
      fit
    } = requestData;

    // Validate inputs
    if (!userId || !originalImageUrl || !prompt) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, originalImageUrl, or prompt" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 디테일 텍스트 우선시, 디테일이 없는 경우에만 개별 옵션으로 설명 구성
    let detailDescription = detail;
    if (!detailDescription || detailDescription.trim() === '') {
      let optionDetails = [];
      if (style) optionDetails.push(`스타일: ${style}`);
      if (pocket) optionDetails.push(`포켓: ${pocket}`);
      if (color) optionDetails.push(`색상: ${color}`);
      if (fit) optionDetails.push(`핏: ${fit}`);
      
      detailDescription = optionDetails.join(', ');
    }

    // Insert data into generated_images table
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
        detail: detailDescription, // 통합된 설명 사용
        created_at: new Date().toISOString() // 생성 타임스탬프 명시적 설정
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
