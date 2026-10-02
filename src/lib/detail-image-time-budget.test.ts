import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTimeBudget,
  isTimeBudgetError,
  runWithinBudget,
  TimeBudgetError,
} from "../../supabase/functions/_shared/timeBudget";
import { getImageProvider } from "../../supabase/functions/_shared/imageProviders";
import { inspectGeneratedImage, violatesPeoplePolicy } from "../../supabase/functions/_shared/imageQa";

// imageProviders.ts 는 엣지 함수(Deno)용 — 테스트에서는 env 만 흉내 낸다.
declare global {
  // eslint-disable-next-line no-var
  var Deno: { env: { get(key: string): string | undefined } };
}

describe("detail image time budget", () => {
  it("does not retry when the first attempt passes", async () => {
    let clock = 0;
    const now = () => clock;
    const attempt = vi.fn(async () => {
      clock += 40_000;
      return { ok: true };
    });
    const { attempts } = await runWithinBudget(attempt, createTimeBudget(0, 135_000, now), now);
    expect(attempts).toBe(1);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("retries only when a second attempt (as long as the first) still fits", async () => {
    let clock = 0;
    const now = () => clock;
    const attempt = vi.fn(async (retry: boolean) => {
      clock += 50_000;
      return { ok: retry };
    });
    const { attempts, result } = await runWithinBudget(attempt, createTimeBudget(0, 135_000, now), now);
    expect(attempts).toBe(2);
    expect(result.ok).toBe(true);
    expect(clock).toBeLessThanOrEqual(135_000);
  });

  it("stops before a retry that would run past the gateway limit", async () => {
    let clock = 0;
    const now = () => clock;
    const attempt = vi.fn(async () => {
      clock += 90_000; // 생성 + 검수 + 재구도 재검수까지 탄 착용 컷
      return { ok: false };
    });
    await expect(runWithinBudget(attempt, createTimeBudget(0, 135_000, now), now)).rejects.toBeInstanceOf(TimeBudgetError);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("recognises aborted fetches as time-budget errors", () => {
    expect(isTimeBudgetError(new TimeBudgetError())).toBe(true);
    expect(isTimeBudgetError(new DOMException("timed out", "TimeoutError"))).toBe(true);
    expect(isTimeBudgetError(new Error("model=x status=500"))).toBe(false);
  });
});

/* 실제 Gemini provider · 검수 코드를 느린 가짜 API 에 붙여 함수의 생성 → 검수 → 재시도 흐름을 시간 축소(ms)로 재현한다. */
describe("worn-cut generation against a slow image API", () => {
  const sleep = (ms: number, signal?: AbortSignal | null) =>
    new Promise<void>((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason);
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(signal.reason);
      });
    });

  let calls: { image: number; qa: number };
  const fakeApi = (opts: { generateMs: number; qaMs: number; headVisible: (qaCall: number) => boolean }) => {
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const body = String(init.body);
      if (body.includes("responseModalities")) {
        calls.image += 1;
        await sleep(opts.generateMs, init.signal);
        return Response.json({ candidates: [{ content: { parts: [{ inlineData: { data: "AAAA", mimeType: "image/png" } }] } }] });
      }
      calls.qa += 1;
      await sleep(opts.qaMs, init.signal);
      const verdict = { faceVisible: false, headVisible: opts.headVisible(calls.qa), personCount: 1, garmentIsMainSubject: true, visibleText: [], matchesReference: true };
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(verdict) }] } }] });
    });
  };

  // index.ts 의 generate → inspect → settle 과 같은 조합(재구도 크롭은 Deno 전용이라 제외)
  const generateWornCut = async (budgetMs: number) => {
    const startedAt = Date.now();
    const budget = createTimeBudget(startedAt, budgetMs);
    const provider = getImageProvider();
    const reference = { label: "garment design", data: "AAAA", mimeType: "image/png" };
    try {
      const { attempts, result } = await runWithinBudget(async (retry) => {
        const image = await provider.generate({ prompt: retry ? "strict" : "p", references: [reference], aspectRatio: "3:4", signal: budget.signal() });
        const qa = await inspectGeneratedImage("key", { data: image.base64, mimeType: image.mimeType }, reference, "full", budget.signal());
        if (!qa && budget.expired()) throw new TimeBudgetError();
        return { ok: Boolean(qa) && !violatesPeoplePolicy(qa, "faceless_worn") };
      }, budget);
      return { attempts, ok: result.ok, elapsed: Date.now() - startedAt, error: null as unknown };
    } catch (error) {
      return { attempts: 0, ok: false, elapsed: Date.now() - startedAt, error };
    }
  };

  beforeEach(() => {
    calls = { image: 0, qa: 0 };
    vi.stubGlobal("Deno", { env: { get: (key: string) => (key === "GEMINI_API_KEY" ? "key" : undefined) } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("previous failure: a slow first attempt with the head in frame now answers before the limit instead of timing out", async () => {
    // 예산 250ms(=135초 축소), 생성 120 + 검수 40 → 두 번째 시도까지 하면 320ms 로 게이트웨이 제한을 넘는다.
    fakeApi({ generateMs: 120, qaMs: 40, headVisible: () => true });
    const outcome = await generateWornCut(250);
    expect(isTimeBudgetError(outcome.error)).toBe(true);
    expect(outcome.elapsed).toBeLessThan(250);
    expect(calls.image).toBe(1);
  });

  it("a hanging image model is cut at the budget and does not fall through to the next models", async () => {
    fakeApi({ generateMs: 10_000, qaMs: 10, headVisible: () => false });
    const outcome = await generateWornCut(200);
    expect(isTimeBudgetError(outcome.error)).toBe(true);
    expect(outcome.elapsed).toBeGreaterThanOrEqual(190);
    expect(outcome.elapsed).toBeLessThan(400);
    expect(calls.image).toBe(1);
  });

  it("an image whose check could not finish in time is never accepted unchecked", async () => {
    fakeApi({ generateMs: 50, qaMs: 10_000, headVisible: () => false });
    const outcome = await generateWornCut(200);
    expect(outcome.ok).toBe(false);
    expect(isTimeBudgetError(outcome.error)).toBe(true);
    expect(outcome.elapsed).toBeLessThan(400);
  });

  it("fast attempts still get the strict-framing retry", async () => {
    fakeApi({ generateMs: 30, qaMs: 10, headVisible: (qaCall) => qaCall === 1 });
    const outcome = await generateWornCut(500);
    expect(outcome.error).toBeNull();
    expect(outcome.ok).toBe(true);
    expect(outcome.attempts).toBe(2);
    expect(calls.image).toBe(2);
  });
});
