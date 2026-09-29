import { corsHeaders, errorMessage, getSupabaseClients, jsonResponse } from "../_shared/kakaopay.ts";
import { buildKspayForm, getKsnetMid, KSNET_MIN_AMOUNT } from "../_shared/ksnet.ts";

type ShippingInput = {
  ordererName?: string;
  ordererPhone?: string;
  ordererEmail?: string;
  recipientName?: string;
  recipientPhone?: string;
  postalCode?: string;
  address?: string;
  addressDetail?: string;
  deliveryMessage?: string;
  agreePrivacy?: boolean;
};

type ReadyRequest = {
  fundingId?: string;
  color?: string;
  size?: string;
  quantity?: number;
  shipping?: ShippingInput;
};

/**
 * KSNET 결제 준비: 결제 대기(ready) 참여를 만들고 KSPay 결제창 form 을 내려준다.
 * 금액은 create_ksnet_funding_order 가 펀딩 판매가로 계산한다 — 요청 본문에 금액은 없다.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let participationId: string | null = null;
  let userId: string | null = null;
  let serviceClient: Awaited<ReturnType<typeof getSupabaseClients>>["serviceClient"] | null = null;

  try {
    const clients = await getSupabaseClients(req);
    const { user, userClient } = clients;
    userId = user.id;
    serviceClient = clients.serviceClient;
    // 설정이 빠졌으면 참여를 만들기 전에 멈춘다.
    getKsnetMid();

    const body = (await req.json()) as ReadyRequest;
    const shipping = body.shipping;
    if (!body.fundingId || !body.color || !body.size || !body.quantity || !shipping) {
      return jsonResponse({ error: "펀딩 옵션과 배송 정보를 확인해주세요." }, 400);
    }

    const { data, error } = await userClient.rpc("create_ksnet_funding_order", {
      p_funding_id: body.fundingId,
      p_color: body.color,
      p_size: body.size,
      p_quantity: body.quantity,
      p_orderer_name: shipping.ordererName,
      p_orderer_phone: shipping.ordererPhone,
      p_orderer_email: shipping.ordererEmail,
      p_recipient_name: shipping.recipientName,
      p_recipient_phone: shipping.recipientPhone,
      p_postal_code: shipping.postalCode,
      p_address: shipping.address,
      p_address_detail: shipping.addressDetail ?? "",
      p_delivery_message: shipping.deliveryMessage ?? "",
      p_agree_privacy: shipping.agreePrivacy,
    });
    // RPC 가 던진 사유("현재 참여할 수 없는 펀딩입니다." 등)를 그대로 보여준다.
    if (error) throw new Error(error.message);

    const order = Array.isArray(data) ? data[0] : data;
    if (!order) throw new Error("결제 참여 내역을 만들지 못했습니다.");
    participationId = order.participation_id as string;

    if (order.total_amount < KSNET_MIN_AMOUNT) {
      throw new Error(`결제 금액은 ${KSNET_MIN_AMOUNT.toLocaleString("ko-KR")}원 이상이어야 합니다.`);
    }

    const kspayForm = buildKspayForm({
      participationId,
      itemName: order.item_name,
      amount: order.total_amount,
      buyerName: shipping.ordererName ?? "",
      buyerEmail: shipping.ordererEmail ?? "",
      buyerPhone: shipping.ordererPhone ?? "",
    });

    return jsonResponse({
      participation_id: participationId,
      partner_order_id: order.partner_order_id,
      total_amount: order.total_amount,
      kspay_form: kspayForm,
    });
  } catch (error) {
    console.error("ksnet-ready", error);
    if (participationId && userId && serviceClient) {
      try {
        await serviceClient.rpc("fail_funding_payment", {
          p_participation_id: participationId,
          p_user_id: userId,
          p_error_payload: { error: errorMessage(error), stage: "ready" },
        });
      } catch (cleanupError) {
        console.error("ksnet-ready cleanup", cleanupError);
      }
    }
    return jsonResponse({ error: errorMessage(error) }, 400);
  }
});
