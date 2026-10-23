// 결제 운영 모드 서버 가드 단위 테스트.
// 실행: deno test --no-lock --allow-env --allow-net=jsr.io supabase/functions/_shared/payment-mode.test.ts

import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { assertKsnetCheckoutAllowed, KSNET_SAMPLE_MID, PaymentModeError, readServerPaymentMode } from "./payment-mode.ts";

const REAL_MID = "2001234567";
const DEV_API = "https://paydev.ksnet.co.kr";

Deno.test("unset mode keeps the existing live behaviour", () => {
  assertEquals(readServerPaymentMode(undefined), "live");
  assertEquals(assertKsnetCheckoutAllowed({ mode: undefined, mid: REAL_MID, apiBase: undefined }), "live");
  // 기존 로컬 테스트 구성(시험 API + 모드 미지정)도 그대로 동작한다.
  assertEquals(assertKsnetCheckoutAllowed({ mode: undefined, mid: REAL_MID, apiBase: DEV_API }), "live");
});

Deno.test("disabled and mock modes block checkout on the server", () => {
  assertThrows(() => assertKsnetCheckoutAllowed({ mode: "disabled", mid: REAL_MID, apiBase: undefined }), PaymentModeError, "준비");
  assertThrows(() => assertKsnetCheckoutAllowed({ mode: "mock", mid: REAL_MID, apiBase: undefined }), PaymentModeError, "준비");
});

Deno.test("live mode rejects the public KSNET sample store id", () => {
  assertThrows(() => assertKsnetCheckoutAllowed({ mode: "live", mid: KSNET_SAMPLE_MID, apiBase: undefined }), PaymentModeError, "샘플");
  assertThrows(() => assertKsnetCheckoutAllowed({ mode: "LIVE", mid: ` ${KSNET_SAMPLE_MID} `, apiBase: undefined }), PaymentModeError, "샘플");
  // 모드를 지정하지 않은 기존 로컬 시험 구성(docs/KSNET_PAYMENT.md)은 그대로 허용한다.
  assertEquals(assertKsnetCheckoutAllowed({ mode: undefined, mid: KSNET_SAMPLE_MID, apiBase: DEV_API }), "live");
});

Deno.test("explicit live mode rejects the test API host", () => {
  assertThrows(() => assertKsnetCheckoutAllowed({ mode: "live", mid: REAL_MID, apiBase: DEV_API }), PaymentModeError, "운영 API");
  assertEquals(assertKsnetCheckoutAllowed({ mode: "live", mid: REAL_MID, apiBase: "https://pay.ksnet.co.kr/" }), "live");
});

Deno.test("test mode requires the KSNET test API host", () => {
  assertThrows(() => assertKsnetCheckoutAllowed({ mode: "test", mid: KSNET_SAMPLE_MID, apiBase: undefined }), PaymentModeError, "시험");
  assertEquals(assertKsnetCheckoutAllowed({ mode: "test", mid: KSNET_SAMPLE_MID, apiBase: DEV_API }), "test");
});
