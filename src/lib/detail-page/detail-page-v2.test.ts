import { describe, expect, it } from "vitest";
import { buildFallbackCopy } from "@/lib/detail-page/fallbackCopy";
import { composeDetailDocument, defaultSlotForSection } from "@/lib/detail-page/document";
import { DETAIL_TEMPLATES, getLayoutTemplate } from "@/lib/detail-page/templates";
import { DETAIL_IMAGE_SPECS } from "@/lib/detail-page/imagePipeline";
import { EMPTY_USER_PROVIDED } from "@/lib/detail-page/source";
import { sanitizeDetailCopy } from "@/services/detailPage";
import { DETAIL_THEMES } from "@/components/detail-page/templateThemes";
import type { DetailPageSource } from "@/types/detailPage";

const source: DetailPageSource = {
  imageUrl: "https://example.com/design.png",
  imagePath: null,
  isFrontBackComposite: true,
  clothTypeId: "hoodie",
  clothType: "후드티",
  materialId: "fleece",
  material: "기모 스웨트",
  colorId: "black",
  color: "검정",
  fitId: "loose",
  fit: "루즈핏",
  designDescription: "등판 그래픽 프린트",
  aiPrompt: "",
  styleOptions: [],
  decorations: [],
  accessories: [],
  constructionFeatures: [],
  productionCountry: "한국",
  productionMethod: "",
  estimateUnitMin: null,
  estimateUnitMax: null,
  estimateDevelopmentTotal: null,
  targetQuantity: 30,
  sizeOptions: ["M", "L"],
  measurements: null,
  trademarkScreeningId: null,
  designId: null,
  creatorName: "제작자",
  creatorBio: "",
  creatorImageUrl: null,
  brandId: null,
  brandName: "",
  brandShortDescription: "",
  brandDescription: "",
  brandLogoUrl: null,
  userProvided: { ...EMPTY_USER_PROVIDED },
};

describe("AI detail page v2", () => {
  it("every style maps to a base layout and has its own theme", () => {
    expect(DETAIL_TEMPLATES).toHaveLength(9);
    for (const template of DETAIL_TEMPLATES) {
      expect(["minimal", "street", "luxury", "sports", "casual"]).toContain(getLayoutTemplate(template.id));
      expect(DETAIL_THEMES[template.id]).toBeTruthy();
    }
    expect(getLayoutTemplate("vintage")).toBe("luxury");
    expect(getLayoutTemplate("y2k")).toBe("street");
  });

  it("places the FLAT LAY image in COLOR, or DESIGN when there is no color info", () => {
    const copy = buildFallbackCopy(source);
    const withColor = composeDetailDocument(source, copy, "lookbook", ["flat_lay"]);
    expect(withColor.sections.find((s) => s.type === "color")?.images.some((i) => i.slot === "flat_lay")).toBe(true);

    const noColor = { ...source, color: "", colorId: "", userProvided: { ...EMPTY_USER_PROVIDED } };
    const withoutColor = composeDetailDocument(noColor, buildFallbackCopy(noColor), "minimal", ["flat_lay"]);
    expect(withoutColor.sections.find((s) => s.type === "design")?.images.some((i) => i.slot === "flat_lay")).toBe(true);
    expect(defaultSlotForSection("color", "full")).toBe("flat_lay");
    expect(DETAIL_IMAGE_SPECS.some((spec) => spec.type === "flat_lay")).toBe(true);
  });

  it("treats the creator brief as verified facts but still blocks invented claims", () => {
    const withBrief = { ...source, userProvided: { ...EMPTY_USER_PROVIDED, details: "생활 방수 코팅 지퍼" } };
    const raw = { story: "비 오는 날에도 방수 지퍼가 든든합니다. 면 100% 원단입니다." };
    const cleaned = sanitizeDetailCopy(raw, withBrief).story;
    expect(cleaned).toContain("방수");
    expect(cleaned).not.toContain("면 100%");
    expect(sanitizeDetailCopy(raw, source).story).not.toContain("방수");
  });
});

describe("available colors section", () => {
  it("builds AVAILABLE COLORS from the funding's registered colors", () => {
    const withColors = { ...source, color: "", availableColors: ["BLACK", "BURGUNDY", "NAVY"] };
    const document = composeDetailDocument(withColors, buildFallbackCopy(withColors), "minimal");
    const color = document.sections.find((section) => section.type === "color");
    expect(color?.title).toBe("AVAILABLE COLORS");
    expect(color?.eyebrow).toBe("COLOR");
    expect(color?.facts).toEqual([{ label: "컬러", value: "BLACK / BURGUNDY / NAVY" }]);
  });

  it("keeps the legacy single-color section when no colors are registered", () => {
    const document = composeDetailDocument(source, buildFallbackCopy(source), "minimal");
    expect(document.sections.find((section) => section.type === "color")?.title).toBe("COLOR");
  });
});
