import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClosetGarment } from "@/types/closet";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const garment = (
  id: string,
  source: ClosetGarment["source"] = "ai_design",
): ClosetGarment => ({
  id,
  slot: "top",
  label: id,
  imageUrl: `https://example.com/${id}.png`,
  source,
});

describe("closet my wardrobe", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("localStorage", new MemoryStorage());
    vi.stubGlobal("sessionStorage", new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps both generated and uploaded garments available for later replacement", async () => {
    const { addToMyWardrobe, loadMyWardrobe } = await import("@/lib/closet-store");

    addToMyWardrobe(garment("generated-top"));
    addToMyWardrobe(garment("uploaded-top", "upload"));

    expect(loadMyWardrobe().map((item) => item.id)).toEqual([
      "uploaded-top",
      "generated-top",
    ]);
  });

  it("moves a reselected garment to the front without creating a duplicate", async () => {
    const { addToMyWardrobe, loadMyWardrobe } = await import("@/lib/closet-store");

    addToMyWardrobe(garment("first"));
    addToMyWardrobe(garment("second"));
    addToMyWardrobe(garment("first"));

    expect(loadMyWardrobe().map((item) => item.id)).toEqual(["first", "second"]);
  });

  it("migrates the previous session wardrobe into persistent storage", async () => {
    sessionStorage.setItem(
      "brander-my-wardrobe-v1",
      JSON.stringify([{ ...garment("legacy"), createdAt: "2026-08-21T00:00:00.000Z" }]),
    );

    const { loadMyWardrobe } = await import("@/lib/closet-store");

    expect(loadMyWardrobe().map((item) => item.id)).toEqual(["legacy"]);
    expect(localStorage.getItem("brander-my-wardrobe-v2")).toContain("legacy");
  });
});
