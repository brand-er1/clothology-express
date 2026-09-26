// deno test supabase/functions/_shared/sms_test.ts
import {
  buildFundingSuccessCreatorText,
  createSmsProvider,
  MockSmsProvider,
  normalizeKrPhone,
  sendFundingSuccessSMS,
  SolapiProvider,
  solapiSignature,
} from "./sms.ts";
import { dispatchNotificationJobs } from "./notificationDispatch.ts";

const assertEquals = (actual: unknown, expected: unknown, label = "") => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
};

const env = (values: Record<string, string>) => ({ get: (key: string) => values[key] });

Deno.test("creator funding-success text matches the approved copy", () => {
  assertEquals(
    buildFundingSuccessCreatorText({ fundingName: "FENRAX 후드티", targetQuantity: 20, quantity: 20, participants: 18 }),
    [
      "[BRAND-ER]",
      "축하드립니다!",
      "\"FENRAX 후드티\" 펀딩이 목표 수량 20장을 달성했습니다.",
      "현재 18명/20장 참여가 완료되었습니다.",
      "BRAND-ER에서 펀딩 현황을 확인하고 제작을 준비해주세요.",
      "brand-er.store",
    ].join("\n"),
  );
});

Deno.test("phone normalization mirrors the DB rule", () => {
  assertEquals(normalizeKrPhone("+82 10-1234-5678"), "01012345678");
  assertEquals(normalizeKrPhone("010-1234-5678"), "01012345678");
  assertEquals(normalizeKrPhone("02-123-4567"), null);
});

Deno.test("provider selection never throws and reports missing configuration", async () => {
  const none = createSmsProvider(env({}));
  assertEquals(none.name, "none");
  const result = await none.send({ to: "01012345678", text: "x" });
  assertEquals(result.ok, false);
  const partial = createSmsProvider(env({ SMS_PROVIDER: "solapi", SMS_API_KEY: "k" }));
  assertEquals(partial.name, "none");
  assertEquals(createSmsProvider(env({ SMS_PROVIDER: "solapi", SMS_API_KEY: "k", SMS_API_SECRET: "s", SMS_SENDER_NUMBER: "02-000-0000" })).name, "solapi");
  assertEquals(createSmsProvider(env({ SMS_PROVIDER: "mock" })).name, "mock");
});

Deno.test("solapi request is signed with HMAC-SHA256(date+salt) and never leaks the secret", async () => {
  let captured: { url: string; init: RequestInit } | null = null;
  const fakeFetch = ((url: string, init: RequestInit) => {
    captured = { url, init };
    return Promise.resolve(new Response(JSON.stringify({ statusCode: "2000", messageId: "M1" }), { status: 200 }));
  }) as unknown as typeof fetch;
  const provider = new SolapiProvider({ apiKey: "KEY", apiSecret: "TOP-SECRET", sender: "0212345678" }, fakeFetch);
  const result = await sendFundingSuccessSMS(provider, { to: "010-2222-3333", fundingName: "티", targetQuantity: 20, quantity: 21, participants: 3 }, env({}));
  assertEquals(result, { ok: true, provider: "solapi", messageId: "M1", channel: "sms" });
  const { url, init } = captured!;
  assertEquals(url, "https://api.solapi.com/messages/v4/send");
  const auth = (init.headers as Record<string, string>).Authorization;
  const match = auth.match(/^HMAC-SHA256 apiKey=KEY, date=(\S+), salt=(\w+), signature=([0-9a-f]{64})$/);
  if (!match) throw new Error(`bad auth header ${auth}`);
  assertEquals(match[3], await solapiSignature("TOP-SECRET", match[1], match[2]), "signature");
  const body = JSON.parse(String(init.body));
  assertEquals(body.message.to, "01022223333");
  assertEquals(body.message.from, "0212345678");
  if (String(init.body).includes("TOP-SECRET") || auth.includes("TOP-SECRET")) throw new Error("secret leaked");
});

Deno.test("solapi http error is returned as failure (not thrown)", async () => {
  const fakeFetch = (() => Promise.resolve(new Response(JSON.stringify({ errorCode: "ValidationError", errorMessage: "bad" }), { status: 400 }))) as unknown as typeof fetch;
  const provider = new SolapiProvider({ apiKey: "KEY", apiSecret: "S", sender: "0212345678" }, fakeFetch);
  const result = await provider.send({ to: "01012345678", text: "x" });
  assertEquals(result, { ok: false, provider: "solapi", error: "HTTP 400 ValidationError bad" });
});

Deno.test("dispatcher sends claimed jobs once and records results", async () => {
  const calls: Array<[string, Record<string, unknown> | undefined]> = [];
  const jobs = [
    { log_id: "L1", event_type: "funding_success", recipient_role: "creator", channel: "sms", phone: "01022223333", payload: { funding_name: "티", target_quantity: 20, quantity: 20, participants: 2 }, attempt_count: 1 },
    { log_id: "L2", event_type: "funding_success", recipient_role: "participant", channel: "sms", phone: "01077778888", payload: { funding_name: "티" }, attempt_count: 1 },
  ];
  const client = {
    rpc: (fn: string, args?: Record<string, unknown>) => {
      calls.push([fn, args]);
      if (fn === "claim_notification_jobs") return Promise.resolve({ data: jobs, error: null });
      return Promise.resolve({ data: true, error: null });
    },
  };
  const provider = new MockSmsProvider("mock");
  const summary = await dispatchNotificationJobs(client, { fundingId: "F1" }, provider);
  assertEquals(summary, { claimed: 2, sent: 2, failed: 0, errors: [] });
  assertEquals(calls.map(([fn]) => fn), ["evaluate_funding_success", "claim_notification_jobs", "complete_notification_job", "complete_notification_job"]);
  assertEquals(provider.sent.length, 2);
  if (!provider.sent[1].text.includes("참여하신")) throw new Error("participant template not used");

  const failing = await dispatchNotificationJobs(client, {}, new MockSmsProvider("mock_fail"));
  assertEquals(failing.failed, 2);
  const lastComplete = calls.filter(([fn]) => fn === "complete_notification_job").pop()![1]!;
  assertEquals(lastComplete.p_success, false);
});
