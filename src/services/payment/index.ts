import { mockPaymentProvider } from "./MockPaymentProvider";
import { kakaoPayProvider } from "./KakaoPayProvider";
import { ksnetProvider } from "./KsnetProvider";
import { PAYMENT_MODE, PaymentUnavailableError, paymentModeInfo, providerForMode } from "./config";
import type { PaymentProvider, PaymentProviderType } from "./types";

const providers: Record<PaymentProviderType, PaymentProvider> = {
  mock: mockPaymentProvider,
  kakaopay: kakaoPayProvider,
  ksnet: ksnetProvider,
};

/**
 * 현재 활성 결제 수단. `VITE_PAYMENT_MODE` 로 정해지며(services/payment/config.ts), 결제 미오픈(disabled)이면 null 이다.
 * 운영 전환 후 모의결제 RPC는 DB에서 차단됩니다.
 */
export const ACTIVE_PAYMENT_PROVIDER: PaymentProviderType | null = providerForMode(PAYMENT_MODE);

export const PAYMENT = paymentModeInfo(PAYMENT_MODE);

export const PaymentService = {
  isEnabled: () => ACTIVE_PAYMENT_PROVIDER !== null,
  getProvider(type: PaymentProviderType | null = ACTIVE_PAYMENT_PROVIDER): PaymentProvider {
    if (!type) throw new PaymentUnavailableError();
    return providers[type];
  },
};

export { PAYMENT_MODE, PaymentUnavailableError } from "./config";
export type { PaymentMode } from "./config";
export type {
  PaymentProvider,
  PaymentProviderType,
  FundingPaymentRequest,
  FundingPaymentResult,
} from "./types";
