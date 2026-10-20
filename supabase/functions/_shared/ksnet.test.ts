// KSNET 어댑터 단위 테스트. KSNET 서버 대신 fetch 를 가로채 요청·응답 처리를 고정한다.
//
// 실행: deno test --no-lock --allow-env --allow-net=jsr.io supabase/functions/_shared/ksnet.test.ts

import { assert, assertEquals, assertRejects, assertThrows } from "jsr:@std/assert@1";
import {
  buildKspayForm,
  cancelKsnetPayment,
  confirmKsnetTransaction,
  decodeParticipationKey,
  encodeParticipationKey,
  parseKsnetAuthResult,
} from "./ksnet.ts";

const PARTICIPATION_ID = "97423773-737e-4d1e-b099-3aa84e1bd260";
/** 운영 Supabase 주소 길이 그대로. sndReply 100자 제한을 이 길이로 확인한다. */
const PROD_RETURN_URL = "https://jwmzjszdjlrqrhadbggr.supabase.co/functions/v1/ksnet-return";

const setEnv = (values: Record<string, string | null>) => {
  for (const [key, value] of Object.entries(values)) {
    if (value === null) Deno.env.delete(key);
    else Deno.env.set(key, value);
  }
};

/** fetch 를 한 번 가로챈다. 받은 요청을 돌려줘서 무엇을 보냈는지 검사할 수 있다. */
const withFetch = async (respond: () => Response, run: () => Promise<unknown>) => {
  const original = globalThis.fetch;
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = ((url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return Promise.resolve(respond());
  }) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
  return calls;
};

const form = () =>
  buildKspayForm({
    participationId: PARTICIPATION_ID,
    itemName: "테스트 반팔티",
    amount: 2000,
    buyerName: "테스트구매자",
    buyerEmail: "buyer@test.local",
    buyerPhone: "010-1234-5678",
  });

// ── 복귀 URL 키 ──

Deno.test("참여 ID 는 22자 키로 줄었다가 그대로 돌아온다", () => {
  const key = encodeParticipationKey(PARTICIPATION_ID);
  assertEquals(key.length, 22);
  assertEquals(decodeParticipationKey(key), PARTICIPATION_ID);
});

Deno.test("형식이 다른 키는 참여 ID 로 바꾸지 않는다", () => {
  assertEquals(decodeParticipationKey(""), null);
  assertEquals(decodeParticipationKey("abc"), null);
  assertEquals(decodeParticipationKey(PARTICIPATION_ID), null);
});

// ── 결제창 form ──

Deno.test("결제창 form 에는 서버가 정한 금액·상점·참여 ID 가 실린다", () => {
  setEnv({ KSNET_MID: "2999199999", KSNET_RETURN_URL: PROD_RETURN_URL });
  const { fields } = form();
  assertEquals(fields.sndAmount, "2000");
  assertEquals(fields.sndStoreid, "2999199999");
  assertEquals(fields.sndOrdernumber, PARTICIPATION_ID);
  assertEquals(fields.sndMobile, "01012345678");
  assertEquals(fields.sndReply, `${PROD_RETURN_URL}?o=${encodeParticipationKey(PARTICIPATION_ID)}`);
});

Deno.test("운영 주소 길이로도 sndReply 가 100자를 넘지 않는다", () => {
  setEnv({ KSNET_MID: "2999199999", KSNET_RETURN_URL: PROD_RETURN_URL });
  assert(form().fields.sndReply.length <= 100);
});

Deno.test("복귀 주소가 100자를 넘으면 결제창을 만들지 않는다", () => {
  setEnv({ KSNET_MID: "2999199999", KSNET_RETURN_URL: `https://${"a".repeat(80)}.example/ksnet-return` });
  assertThrows(form, Error, "100자");
});

Deno.test("상점아이디가 없으면 결제창을 만들지 않는다", () => {
  setEnv({ KSNET_MID: null, KSNET_RETURN_URL: PROD_RETURN_URL });
  assertThrows(form, Error, "KSNET_MID");
});

// ── 인증 결과 ──

const returnUrl = `${PROD_RETURN_URL}?o=${encodeParticipationKey(PARTICIPATION_ID)}`;

Deno.test("인증 성공: 거래 식별자와 참여 ID 를 꺼낸다", () => {
  assertEquals(parseKsnetAuthResult("reCommConId=ABC123&reCommType=0&reCnclType=0", returnUrl), {
    commConId: "ABC123",
    cancelled: false,
    participationId: PARTICIPATION_ID,
  });
});

Deno.test("결제창 취소: reCnclType=1 이면 취소로 본다", () => {
  assertEquals(parseKsnetAuthResult("reCnclType=1", returnUrl)?.cancelled, true);
});

Deno.test("알아볼 수 없는 요청은 버린다", () => {
  assertEquals(parseKsnetAuthResult("", returnUrl), null);
  assertEquals(parseKsnetAuthResult("reCommConId=<script>", returnUrl), null);
  assertEquals(parseKsnetAuthResult("reCommConId=ABC123", PROD_RETURN_URL), null);
});

// ── 승인 ──

/** KSNET 승인 응답: EUC-KR, backtick 구분, 첫 토큰은 구분자. */
const approvalResponse = (authyn: string) => {
  const head = new TextEncoder().encode(`\`${authyn}\`TID0001\`20261001\`120000\`2000\`AUTH01\``);
  const message = new Uint8Array([193, 164, 187, 243, 189, 194, 192, 206]); // "정상승인" (EUC-KR)
  const tail = new TextEncoder().encode(`\`\`${PARTICIPATION_ID}\`01\`01\`0000`);
  return new Response(new Uint8Array([...head, ...message, ...tail]));
};

Deno.test("승인 요청에는 우리가 넘긴 금액이 실리고, 응답은 EUC-KR 로 읽는다", async () => {
  let approval: Awaited<ReturnType<typeof confirmKsnetTransaction>> | undefined;
  const calls = await withFetch(() => approvalResponse("O"), async () => {
    approval = await confirmKsnetTransaction("ABC123", 2000);
  });

  const body = new URLSearchParams(String(calls[0].init?.body));
  assertEquals(body.get("sndCommConId"), "ABC123");
  assertEquals(body.get("sndAmount"), "2000");
  assertEquals(approval, {
    approved: true,
    tid: "TID0001",
    amount: 2000,
    authNo: "AUTH01",
    message: "정상승인",
    orderNo: PARTICIPATION_ID,
  });
});

Deno.test("authyn 이 O 가 아니면 미승인이다", async () => {
  let approved = true;
  await withFetch(() => approvalResponse("X"), async () => {
    approved = (await confirmKsnetTransaction("ABC123", 2000)).approved;
  });
  assertEquals(approved, false);
});

Deno.test("모르는 거래는 빈 필드로 오고 미승인이다 (실제 KSNET 응답 형태)", async () => {
  let approved = true;
  await withFetch(() => new Response("`````````````"), async () => {
    approved = (await confirmKsnetTransaction("FAKE", 2000)).approved;
  });
  assertEquals(approved, false);
});

// ── 취소 ──

const cancelResponse = (code: string, respCode?: string) =>
  new Response(JSON.stringify({ code, aid: "AID1", data: respCode ? { respCode, respMessage: "" } : undefined }));

Deno.test("취소 인증키가 없으면 KSNET 을 부르지 않고 실패한다", async () => {
  setEnv({ KSNET_MID: "2999199999", KSNET_AUTH_HEADER: null });
  const calls = await withFetch(() => cancelResponse("A0200", "0000"), async () => {
    await assertRejects(() => cancelKsnetPayment("TID0001"), Error, "KSNET_AUTH_HEADER");
  });
  assertEquals(calls.length, 0);
});

Deno.test("취소 성공(A0200 + 0000): pgapi 스킴을 붙여 TID 로 전액 취소한다", async () => {
  setEnv({ KSNET_MID: "2999199999", KSNET_AUTH_HEADER: "BASE64KEY" });
  const calls = await withFetch(() => cancelResponse("A0200", "0000"), () => cancelKsnetPayment("TID0001"));

  const headers = calls[0].init?.headers as Record<string, string>;
  assertEquals(headers.authorization, "pgapi BASE64KEY");
  const body = JSON.parse(String(calls[0].init?.body));
  assertEquals(body.cancelType, "FULL");
  assertEquals(body.orgTradeKeyType, "TID");
  assertEquals(body.orgTradeKey, "TID0001");
});

Deno.test("취소 거절(P10Q)은 성공으로 삼지 않는다", async () => {
  setEnv({ KSNET_MID: "2999199999", KSNET_AUTH_HEADER: "pgapi BASE64KEY" });
  await withFetch(() => cancelResponse("A0200", "P10Q"), async () => {
    await assertRejects(() => cancelKsnetPayment("TID0001"), Error, "거절");
  });
});

Deno.test("인증 실패(A0403)도 실패로 던진다", async () => {
  setEnv({ KSNET_MID: "2999199999", KSNET_AUTH_HEADER: "BASE64KEY" });
  await withFetch(() => cancelResponse("A0403"), async () => {
    await assertRejects(() => cancelKsnetPayment("TID0001"), Error, "A0403");
  });
});
