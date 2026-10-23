import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isChunkLoadError, reloadOnceForStaleChunk } from "./lazyWithReload";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  });
  vi.stubGlobal("window", { location: { reload: vi.fn() } });
});

afterEach(() => vi.unstubAllGlobals());

describe("isChunkLoadError", () => {
  it("recognises browser chunk-load failures", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://x/assets/AdminApp-1.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new Error("Unable to preload CSS for /assets/a.css"))).toBe(true);
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
  });
});

describe("reloadOnceForStaleChunk", () => {
  it("reloads once and then stops to avoid a reload loop", () => {
    expect(reloadOnceForStaleChunk(1_000_000)).toBe(true);
    expect(window.location.reload).toHaveBeenCalledTimes(1);
    expect(reloadOnceForStaleChunk(1_010_000)).toBe(false);
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it("allows another reload after the window passes (next deploy)", () => {
    reloadOnceForStaleChunk(1_000_000);
    expect(reloadOnceForStaleChunk(1_000_000 + 61_000)).toBe(true);
  });
});
