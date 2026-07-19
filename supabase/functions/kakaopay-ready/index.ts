import {
  callKakaoPay,
  corsHeaders,
  errorMessage,
  getKakaoPayCid,
  getReturnOrigin,
  getSupabaseClients,
  jsonResponse,
} from "../_shared/kakaopay.ts";

type ReadyRequest = {
  fundingId?: string;
  color?: string;
  size?: string;
  quantity?: number;
  returnUrl?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let participationId: string | null = null;
  let userId: string | null = null;

  try {
    const { user, userClient, serviceClient } = await getSupabaseClients(req);
    userId = user.id;
    const body = (await req.json()) as ReadyRequest;

    if (!body.fundingId || !body.color || !body.size || !body.quantity) {
      return jsonResponse({ error: "펀딩 옵션과 수량을 확인해주세요." }, 400);
    }

    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("phone_number, address")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;
    if (!profile?.phone_number?.trim() || !profile.address?.trim()) {
      return jsonResponse({ error: "결제 전에 마이페이지에서 전화번호와 배송지를 입력해주세요." }, 400);
    }

    const { data, error } = await userClient.rpc("create_funding_payment", {
      p_funding_id: body.fundingId,
      p_color: body.color,
      p_size: body.size,
      p_quantity: body.quantity,
    });
    if (error) throw error;

    const payment = Array.isArray(data) ? data[0] : data;
    if (!payment) throw new Error("결제 참여 내역을 만들지 못했습니다.");
    participationId = payment.participation_id;

    const origin = getReturnOrigin(req, body.returnUrl);
    const query = `participationId=${encodeURIComponent(participationId)}`;
    const kakao = await callKakaoPay("/online/v1/payment/ready", {
      cid: getKakaoPayCid(),
      partner_order_id: payment.partner_order_id,
      partner_user_id: payment.partner_user_id,
      item_name: payment.item_name,
      quantity: body.quantity,
      total_amount: payment.total_amount,
      tax_free_amount: 0,
      approval_url: `${origin}/payments/kakaopay/success?${query}`,
      cancel_url: `${origin}/payments/kakaopay/cancel?${query}`,
      fail_url: `${origin}/payments/kakaopay/fail?${query}`,
    });

    const { error: updateError } = await serviceClient
      .from("funding_participations")
      .update({ payment_tid: kakao.tid, updated_at: new Date().toISOString() })
      .eq("id", participationId)
      .eq("participant_id", user.id);
    if (updateError) throw updateError;

    return jsonResponse({
      participation_id: participationId,
      next_redirect_pc_url: kakao.next_redirect_pc_url,
      next_redirect_mobile_url: kakao.next_redirect_mobile_url,
      next_redirect_app_url: kakao.next_redirect_app_url,
    });
  } catch (error) {
    console.error("kakaopay-ready", error);
    if (participationId && userId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
        const serviceClient = createClient(supabaseUrl, serviceRoleKey);
        await serviceClient.rpc("fail_funding_payment", {
          p_participation_id: participationId,
          p_user_id: userId,
          p_error_payload: { error: errorMessage(error), stage: "ready" },
        });
      } catch (cleanupError) {
        console.error("kakaopay-ready cleanup", cleanupError);
      }
    }
    return jsonResponse({ error: errorMessage(error) }, 400);
  }
});
