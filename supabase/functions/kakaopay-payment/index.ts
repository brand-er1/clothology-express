import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const KAKAOPAY_API_BASE = "https://open-api.kakaopay.com/online/v1/payment";

const getKakaoConfig = () => {
  const secretKey = Deno.env.get("KAKAOPAY_SECRET_KEY") || "";
  if (!secretKey) {
    throw new HttpError(503, "카카오페이 결제 키가 아직 설정되지 않았습니다.");
  }

  const authorizationScheme = Deno.env.get("KAKAOPAY_AUTH_SCHEME")
    || (secretKey.startsWith("DEV") ? "DEV_SECRET_KEY" : "SECRET_KEY");

  return {
    secretKey,
    authorizationScheme,
    cid: Deno.env.get("KAKAOPAY_CID") || "TC0ONETIME",
    siteUrl: (Deno.env.get("PUBLIC_SITE_URL") || "https://clothology-express.lovable.app").replace(/\/$/, ""),
  };
};

const requestKakaoPay = async (path: "ready" | "approve" | "cancel", payload: Record<string, unknown>) => {
  const config = getKakaoConfig();
  const response = await fetch(`${KAKAOPAY_API_BASE}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `${config.authorizationScheme} ${config.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let data: Record<string, unknown>;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { error_message: raw || "카카오페이에서 올바르지 않은 응답을 받았습니다." };
  }

  if (!response.ok) {
    const message = String(data.error_message || data.message || "카카오페이 요청에 실패했습니다.");
    throw new HttpError(502, message);
  }

  return data;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authorization = req.headers.get("Authorization") || "";

    if (!authorization) {
      throw new HttpError(401, "로그인이 필요합니다.");
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData.user;

    if (userError || !user) {
      throw new HttpError(401, "로그인이 필요합니다.");
    }

    const body = await req.json();
    const action = String(body.action || "");

    if (action === "ready") {
      const fundingId = String(body.fundingId || "");
      const selectedColor = String(body.color || "").trim();
      const selectedSize = String(body.size || "").trim();
      const quantity = Number(body.quantity);

      if (!fundingId || !selectedColor || !selectedSize) {
        throw new HttpError(400, "펀딩과 옵션을 모두 선택해주세요.");
      }

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        throw new HttpError(400, "수량은 1장부터 99장까지 선택할 수 있습니다.");
      }

      const config = getKakaoConfig();

      const { data: funding, error: fundingError } = await adminClient
        .from("fundings")
        .select("id, product_name, status, price, color_options, size_options")
        .eq("id", fundingId)
        .single();

      if (fundingError || !funding) {
        throw new HttpError(404, "펀딩을 찾을 수 없습니다.");
      }

      if (funding.status !== "approved") {
        throw new HttpError(409, "현재 참여할 수 없는 펀딩입니다.");
      }

      if (!funding.price || funding.price <= 0) {
        throw new HttpError(409, "판매가가 설정되지 않았습니다.");
      }

      if (!funding.color_options?.includes(selectedColor) || !funding.size_options?.includes(selectedSize)) {
        throw new HttpError(400, "선택할 수 없는 컬러 또는 사이즈입니다.");
      }

      const partnerOrderId = `fund_${crypto.randomUUID().replaceAll("-", "")}`;
      const totalAmount = funding.price * quantity;
      const { data: participation, error: insertError } = await adminClient
        .from("funding_participations")
        .insert({
          funding_id: funding.id,
          participant_id: user.id,
          selected_color: selectedColor,
          selected_size: selectedSize,
          quantity,
          unit_price: funding.price,
          status: "pledged",
          payment_provider: "kakaopay",
          payment_status: "ready",
          partner_order_id: partnerOrderId,
          payment_ready_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError || !participation) {
        throw new HttpError(500, "결제 참여 내역을 만들지 못했습니다.");
      }

      const successUrl = new URL(`${config.siteUrl}/payment/success`);
      const cancelUrl = new URL(`${config.siteUrl}/payment/cancel`);
      const failUrl = new URL(`${config.siteUrl}/payment/fail`);
      [successUrl, cancelUrl, failUrl].forEach((url) => {
        url.searchParams.set("participation_id", participation.id);
      });

      try {
        const ready = await requestKakaoPay("ready", {
          cid: config.cid,
          partner_order_id: partnerOrderId,
          partner_user_id: user.id,
          item_name: funding.product_name.slice(0, 100),
          quantity,
          total_amount: totalAmount,
          tax_free_amount: 0,
          approval_url: successUrl.toString(),
          cancel_url: cancelUrl.toString(),
          fail_url: failUrl.toString(),
        });

        await adminClient
          .from("funding_participations")
          .update({
            payment_tid: ready.tid,
            payment_payload: ready,
            updated_at: new Date().toISOString(),
          })
          .eq("id", participation.id);

        return jsonResponse({
          participationId: participation.id,
          nextRedirectPcUrl: ready.next_redirect_pc_url,
          nextRedirectMobileUrl: ready.next_redirect_mobile_url,
          nextRedirectAppUrl: ready.next_redirect_app_url,
        });
      } catch (error) {
        await adminClient
          .from("funding_participations")
          .update({ payment_status: "failed", updated_at: new Date().toISOString() })
          .eq("id", participation.id);
        throw error;
      }
    }

    if (action === "approve") {
      const participationId = String(body.participationId || "");
      const pgToken = String(body.pgToken || "");
      if (!participationId || !pgToken) {
        throw new HttpError(400, "결제 승인 정보가 없습니다.");
      }

      const { data: participation, error: participationError } = await adminClient
        .from("funding_participations")
        .select("*")
        .eq("id", participationId)
        .eq("participant_id", user.id)
        .single();

      if (participationError || !participation) {
        throw new HttpError(404, "결제 참여 내역을 찾을 수 없습니다.");
      }

      if (participation.payment_status === "paid") {
        return jsonResponse({ success: true, participationId });
      }

      if (participation.payment_status !== "ready" || !participation.payment_tid) {
        throw new HttpError(409, "결제 승인 대기 상태가 아닙니다.");
      }

      const config = getKakaoConfig();
      const approved = await requestKakaoPay("approve", {
        cid: config.cid,
        tid: participation.payment_tid,
        partner_order_id: participation.partner_order_id,
        partner_user_id: user.id,
        pg_token: pgToken,
      });

      const { error: finalizeError } = await adminClient.rpc("finalize_kakaopay_funding_payment", {
        p_participation_id: participation.id,
        p_payment_method_type: approved.payment_method_type || null,
        p_approved_at: approved.approved_at || new Date().toISOString(),
        p_payment_payload: approved,
      });

      if (finalizeError) {
        throw new HttpError(500, "결제는 승인됐지만 참여 내역 반영에 실패했습니다. 고객센터에 문의해주세요.");
      }

      return jsonResponse({ success: true, participationId });
    }

    if (action === "cancel") {
      const participationId = String(body.participationId || "");
      if (!participationId) {
        throw new HttpError(400, "취소할 참여 내역을 선택해주세요.");
      }

      const { data: participation, error: participationError } = await adminClient
        .from("funding_participations")
        .select("*")
        .eq("id", participationId)
        .single();

      if (participationError || !participation) {
        throw new HttpError(404, "참여 내역을 찾을 수 없습니다.");
      }

      const { data: funding } = await adminClient
        .from("fundings")
        .select("creator_id")
        .eq("id", participation.funding_id)
        .single();
      const { data: isAdmin } = await adminClient.rpc("is_admin", { user_id: user.id });
      const canCancel = participation.participant_id === user.id || funding?.creator_id === user.id || Boolean(isAdmin);

      if (!canCancel) {
        throw new HttpError(403, "이 참여 내역을 취소할 권한이 없습니다.");
      }

      if (participation.status === "fulfilled") {
        throw new HttpError(409, "처리 완료된 참여 내역은 취소할 수 없습니다.");
      }

      if (participation.payment_status === "cancelled") {
        return jsonResponse({ success: true, participationId });
      }

      let cancellation: Record<string, unknown> | null = null;
      if (participation.payment_status === "paid") {
        if (!participation.payment_tid) {
          throw new HttpError(409, "카카오페이 거래번호가 없어 자동 환불할 수 없습니다.");
        }

        const config = getKakaoConfig();
        cancellation = await requestKakaoPay("cancel", {
          cid: config.cid,
          tid: participation.payment_tid,
          cancel_amount: participation.total_amount,
          cancel_tax_free_amount: 0,
        });
      }

      const { error: cancelError } = await adminClient.rpc("cancel_funding_payment_record", {
        p_participation_id: participation.id,
        p_payment_payload: cancellation,
      });

      if (cancelError) {
        throw new HttpError(500, "취소 내역을 반영하지 못했습니다. 고객센터에 문의해주세요.");
      }

      return jsonResponse({ success: true, refunded: Boolean(cancellation), participationId });
    }

    throw new HttpError(400, "지원하지 않는 결제 요청입니다.");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "결제 처리 중 오류가 발생했습니다.";
    console.error("KakaoPay payment error:", message);
    return jsonResponse({ error: message }, status);
  }
});
