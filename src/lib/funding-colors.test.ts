import { describe, expect, it } from "vitest";
import { buildColorSlides, colorHexOf, guessColorHex, slideIndexForColor, type FundingColor } from "./funding-colors";

const color = (id: string, name: string, views: Partial<Record<"front" | "back", string>> = {}): FundingColor => ({
  id, fundingId: "f", name, hex: null, sortOrder: 0, isBase: false, candidates: [],
  approved: Object.fromEntries(Object.entries(views).map(([view, url]) => [view, { id: `${id}-${view}`, colorId: id, view, status: "approved", source: "ai", url, errorMessage: null, createdAt: "" }])),
});

describe("funding color slides", () => {
  const colors = [
    color("1", "BLACK", { front: "b-f", back: "b-b" }),
    color("2", "BURGUNDY", { front: "r-f" }),
    color("3", "NAVY"),
  ];

  it("orders slides by color then front/back, falling back to the design image", () => {
    expect(buildColorSlides(colors, "design").map((slide) => `${slide.colorName}:${slide.view}:${slide.url}`)).toEqual([
      "BLACK:front:b-f", "BLACK:back:b-b", "BURGUNDY:front:r-f", "NAVY:design:design",
    ]);
  });

  it("maps a color to its first slide (case-insensitive) and back", () => {
    const slides = buildColorSlides(colors, "design");
    expect(slideIndexForColor(slides, "burgundy")).toBe(2);
    expect(slideIndexForColor(slides, "NAVY")).toBe(3);
    expect(slides[1].colorName).toBe("BLACK");
    expect(slideIndexForColor(slides, "PINK")).toBe(-1);
  });

  it("keeps a single design slide when there are no colors", () => {
    expect(buildColorSlides([], "design")).toHaveLength(1);
    expect(buildColorSlides([], null)).toHaveLength(0);
  });
});

describe("color hex", () => {
  it("guesses from presets and Korean aliases", () => {
    expect(guessColorHex("버건디")).toBe("#6D1F2F");
    expect(guessColorHex(" navy ")).toBe("#1F2A44");
    expect(guessColorHex("라벤더")).toBeNull();
    expect(colorHexOf({ name: "라벤더", hex: null })).toBe("#D6D3CE");
    expect(colorHexOf({ name: "BLACK", hex: "#000000" })).toBe("#000000");
  });
});
