
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS 프리플라이트 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { userId } = await req.json();
    
    if (!userId) {
      throw new Error("User ID is required");
    }

    console.log('Fetching profile for user ID:', userId);
    
    // profiles 테이블에서 사용자 ID로 프로필 조회
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId);
      
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.log('No profile found for user ID:', userId);
      return new Response(
        JSON.stringify({ data: null, error: 'Profile not found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      );
    }

    console.log('Profile found:', data[0]);
    
    return new Response(
      JSON.stringify({ data: data[0], error: null }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in get-user-profile function:', error);
    return new Response(
      JSON.stringify({ data: null, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
