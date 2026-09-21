import { startKakaoPayFunding } from "@/services/funding";
import type { FundingPaymentRequest, FundingPaymentResult, PaymentProvider } from "./types";

/**
 * 실제 PG(카카오페이) 제공자입니다. 현재 UI에서는 사용하지 않지만, 계약과 운영
 * 준비가 끝나면 checkout 흐름에서 mockPaymentProvider 대신 이 provider로 바로
 * 교체할 수 있도록 동일한 PaymentProvider 인터페이스로 유지합니다.
 */
export const kakaoPayProvider: PaymentProvider = {
  type: "kakaopay",
  async createFundingOrder(request: FundingPaymentRequest): Promise<FundingPaymentResult> {
    const ready = await startKakaoPayFunding(
      request.fundingId,
      request.color,
      request.size,
      request.quantity
    );

    const redirectUrl =
      ready.next_redirect_pc_url || ready.next_redirect_mobile_url || ready.next_redirect_app_url || undefined;

    return {
      participationId: ready.participation_id,
      orderNumber: ready.participation_id,
      totalAmount: 0,
      redirectUrl,
      immediate: false,
    };
  },
};
