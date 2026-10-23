// 결제 운영 모드 서버 가드. 프론트의 VITE_PAYMENT_MODE 와 같은 값을 Edge Function 시크릿 PAYMENT_MODE 로 둔다.
//
// - disabled : 결제 미오픈. 결제창을 만들지 않는다(화면을 우회해 함수를 직접 불러도 막힌다).
// - test     : PG 시험 환경. KSNET_API_BASE 가 운영 주소면 거절한다(시험 결제를 운영 PG 로 보내지 않는다).
// - live     : 운영 결제. KSNET 공개 샘플 상점아이디(2999199999)나 시험 API 주소를 쓰면 거절한다.
// - 값이 없으면 추가 검사 없이 기존 동작을 그대로 유지한다 — 이미 배포된 함수와 로컬 시험 구성을 바꾸지 않기 위해서다.
// mock 은 서버 결제 함수가 다루지 않는다(모의결제 RPC 는 DB 에서 브라우저 실행이 막혀 있다).

export type ServerPaymentMode = "test" | "live" | "disabled";

export const KSNET_SAMPLE_MID = "2999199999";
const KSNET_PRODUCTION_API = "https://pay.ksnet.co.kr";

export class PaymentModeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentModeError";
  }
}

export const readServerPaymentMode = (raw: string | undefined): ServerPaymentMode => {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "disabled" || value === "test" || value === "live") return value;
  if (value === "mock") return "disabled";
  return "live";
};

export const assertKsnetCheckoutAllowed = (env: {
  mode: string | undefined;
  mid: string | undefined;
  apiBase: string | undefined;
}) => {
  const mode = readServerPaymentMode(env.mode);
  const mid = env.mid?.trim() ?? "";
  const apiBase = (env.apiBase ?? KSNET_PRODUCTION_API).replace(/\/+$/, "");

  if (mode === "disabled") {
    throw new PaymentModeError("온라인 결제 오픈을 준비하고 있습니다. 잠시 후 다시 이용해주세요.");
  }
  // 아래 운영 검사는 PAYMENT_MODE=live 를 명시했을 때만 한다. 값이 없으면 기존 배포 · 로컬 시험 구성과 똑같이 동작한다.
  const explicitLive = (env.mode ?? "").trim().toLowerCase() === "live";
  if (explicitLive && mid === KSNET_SAMPLE_MID) {
    throw new PaymentModeError("운영 결제에 KSNET 샘플 상점아이디를 사용할 수 없습니다. KSNET_MID 를 확인해주세요.");
  }
  if (explicitLive && apiBase !== KSNET_PRODUCTION_API) {
    throw new PaymentModeError("운영 결제 모드에서는 KSNET 운영 API 주소만 사용할 수 있습니다.");
  }
  if (mode === "test" && apiBase === KSNET_PRODUCTION_API) {
    throw new PaymentModeError("테스트 결제 모드에서는 KSNET_API_BASE 를 시험 서버로 지정해야 합니다.");
  }
  return mode;
};
