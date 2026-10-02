/**
 * 엣지 함수 응답 시간 예산.
 *
 * Supabase 게이트웨이는 150초 안에 응답하지 않는 요청을 본문 없는 오류(504/546)로 끊는다. 그러면 제작자는
 * 이유 없는 "non-2xx" 만 보게 되고 생성 기록은 "생성 중" 에 멈춘다. AI 호출(생성 · 검수)은 이 예산 안에서만
 * 하고, 넘길 것 같으면 시작하지 않거나 중단해서 이유가 담긴 오류로 응답한다.
 */

/** AI 호출에 쓸 수 있는 시간. 나머지(약 15초)는 저장소 업로드 · DB 기록 · 응답에 남겨 둔다. */
export const DETAIL_IMAGE_AI_BUDGET_MS = 135_000;

export const TIME_BUDGET_MESSAGE = "이미지 생성 시간이 너무 오래 걸려 중단했습니다. 다시 생성해 주세요.";

export class TimeBudgetError extends Error {
  constructor(message = TIME_BUDGET_MESSAGE) {
    super(message);
    this.name = "TimeBudgetError";
  }
}

/** 예산 초과로 중단된 오류(AbortSignal.timeout 의 TimeoutError/AbortError 포함). */
export const isTimeBudgetError = (error: unknown) => {
  if (error instanceof TimeBudgetError) return true;
  const name = error && typeof error === "object" && "name" in error ? String((error as { name: unknown }).name) : "";
  return name === "TimeoutError" || name === "AbortError";
};

export type TimeBudget = {
  remainingMs: () => number;
  expired: () => boolean;
  /** 남은 예산 안에 estimateMs 가 걸리는 작업을 끝낼 수 있는지. */
  canAfford: (estimateMs: number) => boolean;
  /** 예산이 끝나면 중단되는 signal(fetch 등에 전달). */
  signal: () => AbortSignal;
};

export const createTimeBudget = (startedAt: number, budgetMs: number, now: () => number = Date.now): TimeBudget => {
  const deadline = startedAt + budgetMs;
  const remainingMs = () => Math.max(0, deadline - now());
  return {
    remainingMs,
    expired: () => remainingMs() <= 0,
    canAfford: (estimateMs) => now() + estimateMs <= deadline,
    signal: () => AbortSignal.timeout(Math.max(1, remainingMs())),
  };
};

/**
 * 생성 + 검수를 한 번 하고, 통과하지 못하면 한 번 더 한다. 두 번째 시도는 첫 시도만큼 걸린다고 보고,
 * 예산 안에 끝낼 수 없으면 시작하지 않고 TimeBudgetError 를 던진다(게이트웨이 시간 초과로 끊기지 않도록).
 */
export const runWithinBudget = async <T extends { ok: boolean }>(
  attempt: (retry: boolean) => Promise<T>,
  budget: TimeBudget,
  now: () => number = Date.now,
): Promise<{ result: T; attempts: number }> => {
  const firstStartedAt = now();
  const first = await attempt(false);
  if (first.ok) return { result: first, attempts: 1 };
  if (!budget.canAfford(now() - firstStartedAt)) throw new TimeBudgetError();
  return { result: await attempt(true), attempts: 2 };
};
