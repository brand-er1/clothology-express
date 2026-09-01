import { describe, expect, it } from "vitest";
import { garmentCategoryMap, inferClosetSlotFromCategory } from "@/lib/closet-character-config";

describe("inferClosetSlotFromCategory", () => {
  // TEST 1: 모바일 → 반팔티 생성 → Expected: TOP
  it("classifies 반팔티 (short_sleeve) as top", () => {
    expect(inferClosetSlotFromCategory("short_sleeve")).toBe("top");
  });

  // TEST 2: 모바일 → 후드티 생성 → Expected: TOP
  it("classifies 후드티 (hoodie) as top", () => {
    expect(inferClosetSlotFromCategory("hoodie")).toBe("top");
  });

  // TEST 3: 모바일 → 팬츠 생성 → Expected: BOTTOM
  it("classifies 팬츠 (pants/long_pants) as bottom", () => {
    expect(inferClosetSlotFromCategory("pants")).toBe("bottom");
    expect(inferClosetSlotFromCategory("long_pants")).toBe("bottom");
  });

  it("never lets a substring like \"short\" inside a TOP id fall through to bottom", () => {
    // Regression: "short_sleeve" and "tights_short_sleeve" both contain the substring "short",
    // which a naive /short/ regex test previously matched as BOTTOM even though these are TOPs.
    expect(inferClosetSlotFromCategory("short_sleeve")).toBe("top");
    expect(inferClosetSlotFromCategory("tights_short_sleeve")).toBe("top");
  });

  it("classifies every top garment id from the task's category mapping as top", () => {
    for (const id of ["short_sleeve", "long_sleeve", "sweatshirt", "hoodie", "shirt", "knit", "vest"]) {
      expect(inferClosetSlotFromCategory(id)).toBe("top");
    }
  });

  it("classifies every bottom garment id from the task's category mapping as bottom", () => {
    for (const id of ["pants", "long_pants", "denim_pants", "jogger_pants", "short_pants", "leggings"]) {
      expect(inferClosetSlotFromCategory(id)).toBe("bottom");
    }
  });

  it("classifies every outer garment id from the task's category mapping as outer, not top", () => {
    // Regression: "jumper"/"jumper_lined"/"padding" weren't matched by the old outer regex
    // (/jacket|coat|outer/) and silently fell through to the "top" default.
    for (const id of ["jacket", "jacket_lined", "jumper", "jumper_lined", "padding", "coat"]) {
      expect(inferClosetSlotFromCategory(id)).toBe("outer");
    }
  });

  it("classifies 원피스 as dress and 스커트 as skirt", () => {
    expect(inferClosetSlotFromCategory("dress")).toBe("dress");
    expect(inferClosetSlotFromCategory("skirt")).toBe("skirt");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(inferClosetSlotFromCategory(" Hoodie ")).toBe("top");
    expect(inferClosetSlotFromCategory("JUMPER")).toBe("outer");
  });

  it("falls back to a whole-word keyword match for unrecognized ids without reintroducing the substring bug", () => {
    // "short" alone (not "shorts") must never trigger the bottom fallback on its own.
    expect(inferClosetSlotFromCategory("essential_cardigan_short")).toBe("top");
    // A genuine unrecognized bottom-ish id should still resolve via whole-word match.
    expect(inferClosetSlotFromCategory("custom_denim_overalls")).toBe("bottom");
    expect(inferClosetSlotFromCategory("custom_padding_vest")).toBe("outer");
  });

  it("keeps garmentCategoryMap as the exhaustive source of truth for every known clothType/categoryKey id", () => {
    expect(garmentCategoryMap.short_sleeve).toBe("top");
    expect(garmentCategoryMap.jumper).toBe("outer");
    expect(garmentCategoryMap.dress).toBe("dress");
  });
});
