
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

    // Admin role 추가할 사용자 ID 목록
    const adminUserIds = [
      '32f7d1f9-f28b-40a3-84a1-cfedda275fa6',
      '6062910b-6943-4e28-a423-ae5d7de66024'
    ];
    
    console.log("Adding admin role to users:", adminUserIds);
    
    const results = [];
    
    // 각 사용자에게 관리자 역할 추가
    for (const userId of adminUserIds) {
      // 먼저 이미 admin 역할이 있는지 확인
      const { data: existingRole, error: checkError } = await supabaseClient
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
        
      if (checkError) {
        console.error(`Error checking existing role for user ${userId}:`, checkError);
        results.push({ userId, success: false, error: checkError.message });
        continue;
      }
      
      // 이미 admin 역할이 있으면 건너뜀
      if (existingRole) {
        console.log(`User ${userId} already has admin role`);
        results.push({ userId, success: true, message: 'Already has admin role' });
        continue;
      }
      
      // 역할 추가
      const { data, error } = await supabaseClient
        .from('user_roles')
        .insert([
          { user_id: userId, role: 'admin' }
        ]);
      
      if (error) {
        console.error(`Error adding admin role to user ${userId}:`, error);
        results.push({ userId, success: false, error: error.message });
      } else {
        console.log(`Successfully added admin role to user ${userId}`);
        results.push({ userId, success: true });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Admin role assignment completed", 
        results 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
