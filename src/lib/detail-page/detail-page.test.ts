import { describe, expect, it } from "vitest";
import { buildVerifiedCorpus, stripUnverifiedClaims } from "@/lib/detail-page/safety";
import { buildFallbackCopy } from "@/lib/detail-page/fallbackCopy";
import { applyGeneratedImage, composeDetailDocument } from "@/lib/detail-page/document";
import { EMPTY_USER_PROVIDED } from "@/lib/detail-page/source";
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
  designDescription: "가슴에 작은 로고 자수, 등판에 큰 그래픽 프린트",
  aiPrompt: "",
  styleOptions: [],
  decorations: [{ kind: "embroidery", label: "자수", location: "앞면" }],
  accessories: [],
  constructionFeatures: ["캥거루 포켓"],
  productionCountry: "한국",
  productionMethod: "한국 생산 · 자수",
  estimateUnitMin: 18000,
  estimateUnitMax: 21000,
  estimateDevelopmentTotal: null,
  targetQuantity: 20,
  sizeOptions: ["M", "L"],
  measurements: null,
  trademarkScreeningId: null,
  designId: null,
  creatorName: "하성",
  creatorBio: "",
  creatorImageUrl: null,
  brandId: "brand-1",
  brandName: "TEST BRAND",
  brandShortDescription: "데일리 스트리트 브랜드",
  brandDescription: "",
  brandLogoUrl: null,
  userProvided: { ...EMPTY_USER_PROVIDED },
};

describe("stripUnverifiedClaims", () => {
  const corpus = buildVerifiedCorpus(source.material, source.designDescription);

  it("drops composition, weight, function and certification claims that were not provided", () => {
    const text = "부드러운 후디입니다. 면 100% 원단을 사용했습니다. 400gsm 헤비웨이트. 방수 기능이 있습니다. OEKO-TEX 인증 원단입니다.";
    expect(stripUnverifiedClaims(text, corpus)).toBe("부드러운 후디입니다.");
  });

  it("keeps a claim the creator actually entered", () => {
    const withComposition = buildVerifiedCorpus(source.material, "면 100%");
    expect(stripUnverifiedClaims("면 100% 원단입니다.", withComposition)).toBe("면 100% 원단입니다.");
  });
});

describe("composeDetailDocument", () => {
  const copy = buildFallbackCopy(source);

  it("builds the default section order with AI image slots", () => {
    const document = composeDetailDocument(source, copy, "street", ["hero", "product_front", "product_back", "detail", "editorial", "lifestyle", "mood"]);
    const types = document.sections.map((section) => section.type);
    expect(types.slice(0, 4)).toEqual(["hero", "story", "design", "detail"]);
    expect(types).toContain("funding");
    expect(types).toContain("custom_image");
    const design = document.sections.find((section) => section.type === "design")!;
    expect(design.images.map((image) => [image.crop, image.slot])).toEqual([
      ["left", "product_front"],
      ["right", "product_back"],
    ]);
  });

  it("excludes sections without data (no color → no COLOR section)", () => {
    const document = composeDetailDocument({ ...source, color: "", colorId: "" }, copy, "minimal");
    expect(document.sections.some((section) => section.type === "color")).toBe(false);
  });

  it("fills every slot of a generated image type and leaves uploads alone", () => {
    const document = composeDetailDocument(source, copy, "minimal", ["hero"]);
    const next = applyGeneratedImage(document, "hero", { url: "https://cdn/hero.png", assetId: "a1" });
    const hero = next.sections.find((section) => section.type === "hero")!.images[0];
    expect(hero).toMatchObject({ url: "https://cdn/hero.png", source: "generated", crop: "full", slot: "hero" });
  });

  it("never states unverified facts in fallback copy", () => {
    const text = JSON.stringify(copy);
    expect(text).not.toMatch(/100%|gsm|방수|인증/);
  });
});
