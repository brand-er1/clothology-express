import { createMockFundingOrder } from "@/services/funding";
import type { FundingPaymentRequest, FundingPaymentResult, PaymentProvider } from "./types";

/**
 * PG 연동 전 단계의 모의결제 제공자입니다. 실제 카드 승인이나 PG API 호출을
 * 절대 발생시키지 않고, 내부 DB에 결제 완료(MOCK_PAID) 상태의 주문을 즉시 생성합니다.
 */
export const mockPaymentProvider: PaymentProvider = {
  type: "mock",
  async createFundingOrder(request: FundingPaymentRequest): Promise<FundingPaymentResult> {
    const result = await createMockFundingOrder(
      request.fundingId,
      request.color,
      request.size,
      request.quantity,
      request.shipping
    );

    return {
      participationId: result.participationId,
      orderNumber: result.orderNumber,
      totalAmount: result.totalAmount,
      immediate: true,
    };
  },
};
