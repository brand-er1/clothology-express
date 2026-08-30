import { describe, expect, it } from "vitest";
import { inferClosetSlotFromCategory } from "@/lib/closet-character-config";

describe("inferClosetSlotFromCategory", () => {
  it("classifies every current clothType id from customize-constants.tsx correctly", () => {
    // Regression guard: "short_sleeve"/"tights_short_sleeve" are tops (category: "tops" in
    // customize-constants.tsx) but a bare `/short/` bottom check used to sweep them into "bottom".
    expect(inferClosetSlotFromCategory("short_sleeve")).toBe("top");
    expect(inferClosetSlotFromCategory("tights_short_sleeve")).toBe("top");
    expect(inferClosetSlotFromCategory("long_sleeve")).toBe("top");
    expect(inferClosetSlotFromCategory("tights_long_sleeve")).toBe("top");
    expect(inferClosetSlotFromCategory("hoodie")).toBe("top");
    expect(inferClosetSlotFromCategory("sweatshirt")).toBe("top");
    expect(inferClosetSlotFromCategory("knit")).toBe("top");

    expect(inferClosetSlotFromCategory("jacket")).toBe("outer");

    expect(inferClosetSlotFromCategory("short_pants")).toBe("bottom");
    expect(inferClosetSlotFromCategory("long_pants")).toBe("bottom");
    expect(inferClosetSlotFromCategory("leggings")).toBe("bottom");
    expect(inferClosetSlotFromCategory("tights_bottom")).toBe("bottom");
  });

  it("still recognizes dress and skirt ids", () => {
    expect(inferClosetSlotFromCategory("dress")).toBe("dress");
    expect(inferClosetSlotFromCategory("onepiece")).toBe("dress");
    expect(inferClosetSlotFromCategory("mini_skirt")).toBe("skirt");
  });

  it("is case-insensitive", () => {
    expect(inferClosetSlotFromCategory("SHORT_SLEEVE")).toBe("top");
    expect(inferClosetSlotFromCategory("JACKET")).toBe("outer");
  });
});
