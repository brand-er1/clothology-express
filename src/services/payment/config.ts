import type { PaymentProviderType } from "./types";

/**
 * 결제 운영 모드. 빌드 환경변수 `VITE_PAYMENT_MODE` 로 정한다.
 *
 * - `mock`     : 테스트 결제 전용. 실제 카드 승인 없이 DB 에 MOCK 주문을 만든다. **로컬 개발 빌드에서만** 동작한다.
 * - `test`     : PG(KSNET) 시험 환경. 결제창은 열리지만 시험 상점으로 승인된다. 화면에 "테스트 결제" 를 표시한다.
 * - `live`     : 실제 운영 결제(KSNET).
 * - `disabled` : 결제 미오픈. 결제 버튼 대신 "결제 오픈 준비 중" 을 보여주고 결제 API 를 부르지 않는다.
 *
 * 운영 빌드(`import.meta.env.PROD`)에서 `mock` 이나 알 수 없는 값은 `disabled` 로 바뀐다. 운영에서 모의결제가
 * 실제 결제처럼 보이거나 결제 완료 주문을 만드는 일을 막기 위해서다(DB 도 브라우저의 모의결제 RPC 실행을 막는다).
 * 운영 빌드에서 값을 주지 않으면 `disabled` 다 — PG 설정 없이도 나머지 기능을 그대로 배포할 수 있다.
 */
export type PaymentMode = "mock" | "test" | "live" | "disabled";

const MODES: readonly PaymentMode[] = ["mock", "test", "live", "disabled"];

export const resolvePaymentMode = (raw: string | undefined | null, isProduction: boolean): PaymentMode => {
  const value = (raw ?? "").trim().toLowerCase() as PaymentMode;
  const known = MODES.includes(value);
  if (isProduction) {
    if (!known || value === "mock") return "disabled";
    return value;
  }
  return known ? value : "mock";
};

export const PAYMENT_MODE: PaymentMode = resolvePaymentMode(import.meta.env.VITE_PAYMENT_MODE, import.meta.env.PROD);

const PROVIDER_BY_MODE: Record<PaymentMode, PaymentProviderType | null> = {
  mock: "mock",
  test: "ksnet",
  live: "ksnet",
  disabled: null,
};

export const providerForMode = (mode: PaymentMode): PaymentProviderType | null => PROVIDER_BY_MODE[mode];

/** 화면 문구용 정보. 결제 상태를 판단하는 데 쓰지 않는다(판단은 서버 DB 상태로만 한다). */
export const paymentModeInfo = (mode: PaymentMode) => ({
  mode,
  enabled: mode !== "disabled",
  isMock: mode === "mock",
  isTest: mode === "test",
  /** 결제 단계 이름 */
  label: mode === "mock" ? "모의결제" : mode === "test" ? "테스트 결제" : "결제",
  /** 상품 페이지 결제 버튼 아래 안내 */
  notice:
    mode === "mock" ? "현재 모의결제 모드이며 실제 금액은 청구되지 않습니다."
    : mode === "test" ? "PG 테스트 환경입니다. 실제 운영 결제가 아닙니다."
    : mode === "disabled" ? "온라인 결제 오픈을 준비하고 있습니다. '샘플 확인 후 구매 예약'으로 먼저 참여 의사를 남길 수 있습니다."
    : null,
});

export class PaymentUnavailableError extends Error {
  constructor() {
    super("온라인 결제 오픈을 준비하고 있습니다. 잠시 후 다시 이용해주세요.");
    this.name = "PaymentUnavailableError";
  }
}
