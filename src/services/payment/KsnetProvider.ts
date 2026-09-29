import { startKsnetFunding } from "@/services/funding";
import type { FundingPaymentRequest, FundingPaymentResult, PaymentProvider } from "./types";

/**
 * KSNET(KSPay) 실결제 제공자입니다. 서버가 결제 대기 참여와 결제창 form 을 만들어 주고,
 * 승인은 결제창이 돌아온 뒤 ksnet-return 이 DB 금액으로 겁니다.
 */
export const ksnetProvider: PaymentProvider = {
  type: "ksnet",
  async createFundingOrder(request: FundingPaymentRequest): Promise<FundingPaymentResult> {
    const ready = await startKsnetFunding(
      request.fundingId,
      request.color,
      request.size,
      request.quantity,
      request.shipping
    );

    return {
      participationId: ready.participation_id,
      orderNumber: ready.partner_order_id,
      totalAmount: ready.total_amount,
      kspayForm: ready.kspay_form,
      immediate: false,
    };
  },
};
