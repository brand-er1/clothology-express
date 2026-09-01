import { describe, expect, it } from "vitest";
import { inferClosetSlotFromCategory } from "@/lib/closet-character-config";

describe("inferClosetSlotFromCategory", () => {
  it.each([
    "short_sleeve",
    "long_sleeve",
    "tights_short_sleeve",
    "tights_long_sleeve",
    "hoodie",
    "sweatshirt",
    "knit",
  ])("classifies %s as a top", (category) => {
    expect(inferClosetSlotFromCategory(category)).toBe("top");
  });

  it("classifies jackets as outerwear", () => {
    expect(inferClosetSlotFromCategory("jacket")).toBe("outer");
  });

  it.each(["short_pants", "long_pants", "leggings", "tights_bottom"])(
    "classifies %s as a bottom",
    (category) => {
      expect(inferClosetSlotFromCategory(category)).toBe("bottom");
    },
  );
});
