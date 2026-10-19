import { mockPaymentProvider } from "./MockPaymentProvider";
import { kakaoPayProvider } from "./KakaoPayProvider";
import { ksnetProvider } from "./KsnetProvider";
import type { PaymentProvider, PaymentProviderType } from "./types";

const providers: Record<PaymentProviderType, PaymentProvider> = {
  mock: mockPaymentProvider,
  kakaopay: kakaoPayProvider,
  ksnet: ksnetProvider,
};

/** 현재 활성 결제 수단. 운영 전환 후 모의결제 RPC는 DB에서 차단됩니다. */
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
