import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClosetGarment, MannequinSize } from "@/types/closet";

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

  it("removes the retired female 77 preset from current and restored state", async () => {
    localStorage.setItem(
      "brander-wardrobe-state-v3",
      JSON.stringify({ character: "female", mannequinSize: "77", outfit: {} }),
    );

    const { getWardrobeState, setMannequinSize } = await import("@/lib/closet-store");
    const { femaleMannequinSizes } = await import("@/lib/mannequin-presets");

    expect(femaleMannequinSizes).toEqual(["44", "55", "66"]);
    expect(getWardrobeState().mannequinSize).toBe("55");

    setMannequinSize("77" as MannequinSize);
    expect(getWardrobeState().mannequinSize).toBe("55");
  });

  // TEST 6: 상의 + 하의 착용 → 상의 벗기기 → Expected: 상의만 제거, 하의 유지
  it("removing one slot's garment never clears any other slot", async () => {
    const { getWardrobeState, setGarment } = await import("@/lib/closet-store");

    setGarment("top", garment("hoodie-top"));
    setGarment("bottom", garment("denim-bottom"));

    setGarment("top", null);

    expect(getWardrobeState().outfit.top).toBeNull();
    expect(getWardrobeState().outfit.bottom?.id).toBe("denim-bottom");
  });

  // TEST 7: 상의 + 하의 착용 → 하의 벗기기 → Expected: 하의만 제거, 상의 유지
  it("removing the bottom slot leaves the top slot untouched", async () => {
    const { getWardrobeState, setGarment } = await import("@/lib/closet-store");

    setGarment("top", garment("hoodie-top"));
    setGarment("bottom", garment("denim-bottom"));

    setGarment("bottom", null);

    expect(getWardrobeState().outfit.bottom).toBeNull();
    expect(getWardrobeState().outfit.top?.id).toBe("hoodie-top");
  });

  // TEST 8: TOP 의류 수정 → Expected: 수정 완료 후에도 TOP 유지 (id/slot preserved across an edit revision)
  it("preserves a garment's id and slot/category across an edit revision", async () => {
    const { withNewGarmentRevision } = await import("@/lib/closet-store");

    const original = garment("top-123");
    const edited = withNewGarmentRevision(original, {
      imageUrl: "https://example.com/top-123-edited.png",
      promptLabel: "색상을 검정으로",
    });

    expect(edited.id).toBe(original.id);
    expect(edited.slot).toBe("top");
    expect(edited.imageUrl).toBe("https://example.com/top-123-edited.png");
  });

  // TEST 9: 모바일에서 TOP 생성 후 PC에서 접속 → Expected: TOP 상태 그대로 유지
  it("keeps a garment's slot stable when the persisted state is reloaded (simulating a different device/session)", async () => {
    const { setGarment } = await import("@/lib/closet-store");
    setGarment("top", garment("mobile-created-top"));

    vi.resetModules();
    const { getWardrobeState } = await import("@/lib/closet-store");

    expect(getWardrobeState().outfit.top?.id).toBe("mobile-created-top");
    expect(getWardrobeState().outfit.top?.slot).toBe("top");
    expect(getWardrobeState().outfit.bottom).toBeNull();
  });
});
