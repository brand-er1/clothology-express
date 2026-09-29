import { mockPaymentProvider } from "./MockPaymentProvider";
import { kakaoPayProvider } from "./KakaoPayProvider";
import { ksnetProvider } from "./KsnetProvider";
import type { PaymentProvider, PaymentProviderType } from "./types";

const providers: Record<PaymentProviderType, PaymentProvider> = {
  mock: mockPaymentProvider,
  kakaopay: kakaoPayProvider,
  ksnet: ksnetProvider,
};

/** 현재 활성 결제 수단. 모의결제로 되돌리려면 'mock' 으로 바꿉니다. */
export const ACTIVE_PAYMENT_PROVIDER: PaymentProviderType = "ksnet";

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
