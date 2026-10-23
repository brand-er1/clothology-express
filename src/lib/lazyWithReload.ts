import { lazy, type ComponentType } from "react";

// 배포 직후 브라우저에 남은 이전 index.html 이 지워진 화면 파일(청크)을 요청하면 import 가 실패한다.
// 그때 한 번만 새로고침해 최신 index.html 을 받게 한다. 이미 새로고침했는데도 실패하면 오류를 그대로 던져
// 화면의 ErrorBoundary 가 안내를 보여준다(무한 새로고침 방지).

const RELOAD_KEY = "brander_chunk_reload_at";
const RELOAD_WINDOW_MS = 60_000;

const CHUNK_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed|Unable to preload CSS/i;

export const isChunkLoadError = (error: unknown) =>
  error instanceof Error && (CHUNK_ERROR.test(error.message) || error.name === "ChunkLoadError");

const readReloadAt = () => {
  try {
    return Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
  } catch {
    return 0;
  }
};

/** 최근에 새로고침하지 않았다면 한 번 새로고침하고 true 를 돌려준다. */
export const reloadOnceForStaleChunk = (now = Date.now()) => {
  if (now - readReloadAt() < RELOAD_WINDOW_MS) return false;
  try {
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    // 저장소를 못 쓰면 새로고침 루프를 막을 수 없으므로 새로고침하지 않는다.
    return false;
  }
  window.location.reload();
  return true;
};

export const lazyWithReload = <T extends ComponentType<never>>(factory: () => Promise<{ default: T }>) =>
  lazy(() =>
    factory().catch((error: unknown) => {
      // 새로고침하는 동안 아무것도 그리지 않도록 끝나지 않는 약속을 돌려준다.
      if (isChunkLoadError(error) && reloadOnceForStaleChunk()) return new Promise<{ default: T }>(() => {});
      throw error;
    }),
  );
