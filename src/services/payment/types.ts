import type { ShippingDetails } from "@/types/funding";

export type PaymentProviderType = "mock" | "kakaopay";

export type FundingPaymentRequest = {
  fundingId: string;
  color: string;
  size: string;
  quantity: number;
  shipping: ShippingDetails;
};

export type FundingPaymentResult = {
  participationId: string;
  orderNumber: string;
  totalAmount: number;
  /** Set when the buyer must be redirected to an external PG checkout page. */
  redirectUrl?: string;
  /** True when the order is already finalized (no external redirect needed). */
  immediate: boolean;
};

/**
 * Common contract every payment provider must implement so the funding
 * checkout flow doesn't need to know which PG (or mock) is behind it.
 * Today only MockPaymentProvider is wired into the UI; KakaoPayProvider
 * stays available for when a real PG contract is ready, and future
 * providers (Toss, KG이니시스 등) can drop in the same way.
 */
export interface PaymentProvider {
  type: PaymentProviderType;
  createFundingOrder(request: FundingPaymentRequest): Promise<FundingPaymentResult>;
}
