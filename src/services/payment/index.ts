import { mockPaymentProvider } from "./MockPaymentProvider";
import { kakaoPayProvider } from "./KakaoPayProvider";
import type { PaymentProvider, PaymentProviderType } from "./types";

const providers: Record<PaymentProviderType, PaymentProvider> = {
  mock: mockPaymentProvider,
  kakaopay: kakaoPayProvider,
};

/** 현재 활성 결제 수단. PG 계약이 준비되면 'kakaopay' 등으로 교체합니다. */
export const ACTIVE_PAYMENT_PROVIDER: PaymentProviderType = "mock";

export const PaymentService = {
  getProvider(type: PaymentProviderType = ACTIVE_PAYMENT_PROVIDER): PaymentProvider {
    return providers[type];
  },
};

export type {
  PaymentProvider,
  PaymentProviderType,
  FundingPaymentRequest,
  FundingPaymentResult,
} from "./types";
