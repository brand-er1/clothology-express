import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/lib/supabase", () => ({ supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } } }));

import { requestDetailImage } from "./imagePipeline";

const failure = (payload: Record<string, unknown>) => ({ data: null, error: { message: "Edge Function returned a non-2xx status code", context: new Response(JSON.stringify(payload)) } });
const input = { detailPageId: "p1", imageType: "lifestyle" as const, style: "minimal" as const };

describe("requestDetailImage", () => {
  beforeEach(() => invoke.mockReset());

  it("retries once by itself when the server stopped for its time budget", async () => {
    invoke
      .mockResolvedValueOnce(failure({ error: "이미지 생성 시간이 너무 오래 걸려 중단했습니다. 다시 생성해 주세요.", timedOut: true }))
      .mockResolvedValueOnce({ data: { url: "https://x/y.png", assetId: "a1", model: "m" }, error: null });
    await expect(requestDetailImage(input)).resolves.toEqual({ assetId: "a1", url: "https://x/y.png", model: "m" });
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("does not retry policy or quota failures", async () => {
    invoke.mockResolvedValueOnce(failure({ error: "오늘 AI 이미지 생성 한도(40회)를 모두 사용했습니다." }));
    await expect(requestDetailImage(input)).rejects.toThrow(/한도/);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("gives up after the single automatic retry", async () => {
    invoke.mockImplementation(async () => failure({ error: "이미지 생성 시간이 너무 오래 걸려 중단했습니다. 다시 생성해 주세요.", timedOut: true }));
    await expect(requestDetailImage(input)).rejects.toThrow(/오래 걸려/);
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
