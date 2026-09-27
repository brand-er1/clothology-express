import { describe, expect, it } from "vitest";
import { buildFallbackAnalysis, sanitizeAnalysis } from "@/lib/detail-page/analysis";
import {
  CONCEPTS,
  accentFor,
  buildDirection,
  pickVariant,
  planImages,
  recommendConcepts,
} from "@/lib/detail-page/artDirection";
import { applyConcept, composeEditorialDocument, createEditorialSection } from "@/lib/detail-page/editorialCompose";
import { buildFallbackCopy } from "@/lib/detail-page/fallbackCopy";
import { hasHype, stripHype } from "@/lib/detail-page/safety";
import { EMPTY_USER_PROVIDED } from "@/lib/detail-page/source";
import { sanitizeDetailCopy } from "@/services/detailPage";
import { toEmbedUrl } from "@/components/detail-page/editorial/tokens";
import type { DetailPageSource } from "@/types/detailPage";

const base: DetailPageSource = {
  imageUrl: "https://example.com/design.png",
  imagePath: null,
  isFrontBackComposite: true,
  clothTypeId: "hoodie",
  clothType: "후드티",
  materialId: "",
  material: "",
  colorId: "gray",
  color: "회색",
  fitId: "",
  fit: "",
  designDescription: "등판 그래픽",
  aiPrompt: "",
  styleOptions: [],
  decorations: [{ kind: "print", label: "실크스크린 프린트", location: "등판" }],
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
  designId: "design-a",
  creatorName: "제작자",
  creatorBio: "",
  creatorImageUrl: null,
  brandId: null,
  brandName: "Northbound",
  brandShortDescription: "",
  brandDescription: "",
  brandLogoUrl: null,
  userProvided: { ...EMPTY_USER_PROVIDED, price: 59000 },
};

describe("product analysis", () => {
  it("derives parts only from the creator's data", () => {
    const analysis = buildFallbackAnalysis(base);
    expect(analysis.parts).toContain("print");
    expect(analysis.parts).toContain("hood");
    expect(analysis.parts).not.toContain("zipper");
    expect(analysis.parts).not.toContain("embroidery");
    expect(analysis.unknowns).toEqual(expect.arrayContaining(["원단 혼용률", "원단명"]));
  });

  it("never lets AI analysis state composition, and the creator's data wins", () => {
    const analysis = sanitizeAnalysis(
      {
        mainColor: { name: "블랙", hex: "#000000" },
        materialGuess: "면 100% 스웨트",
        parts: ["zipper", "not-a-part", "pocket"],
        designFeatures: ["최고의 품질을 자랑하는 원단입니다.", "등판 대형 그래픽"],
      },
      base,
    );
    expect(analysis.mainColor.name).toBe("회색");
    expect(analysis.materialGuess).toBe("");
    expect(analysis.parts).toEqual(expect.arrayContaining(["print", "hood", "zipper", "pocket"]));
    expect(analysis.parts).not.toContain("not-a-part");
    expect(analysis.provider).toBe("ai");
  });
});

describe("concept recommendation", () => {
  const analysis = buildFallbackAnalysis(base);

  it("returns three distinct concepts from different visual groups", () => {
    const concepts = recommendConcepts(analysis, base);
    expect(concepts).toHaveLength(3);
    expect(new Set(concepts.map((concept) => concept.id)).size).toBe(3);
    expect(new Set(concepts.map((concept) => CONCEPTS[concept.id].group)).size).toBe(3);
    concepts.forEach((concept) => expect(concept.reason).toBeTruthy());
  });

  it("puts a graphic hoodie toward street and an outdoor jacket toward outdoor", () => {
    expect(recommendConcepts(analysis, base)[0].id).toBe("street");
    const jacket = { ...base, clothType: "바람막이 자켓", decorations: [] };
    expect(recommendConcepts(buildFallbackAnalysis(jacket), jacket).map((concept) => concept.id)).toContain("outdoor");
  });

  it("ranks valid AI suggestions first and ignores unknown ids", () => {
    const concepts = recommendConcepts(analysis, base, [{ id: "vintage", reason: "워싱 느낌" }, { id: "space-opera" }]);
    expect(concepts[0]).toEqual({ id: "vintage", reason: "워싱 느낌" });
  });
});

describe("art direction", () => {
  it("uses the product color as accent only when it reads on the page", () => {
    expect(accentFor(CONCEPTS.minimal.palette, "#1f3a93")).toBe("#1f3a93");
    expect(accentFor(CONCEPTS.minimal.palette, "#fbfbf9")).toBe(CONCEPTS.minimal.palette.accent);
  });

  it("varies layouts between products of the same concept", () => {
    const types = ["hero", "story", "design", "detail", "fabric", "fit", "lookbook"] as const;
    const signature = (seedKey: string) => {
      const direction = buildDirection("minimal", null, seedKey);
      return types.map((type, index) => pickVariant(type, direction, index)).join("|");
    };
    const signatures = new Set(["a", "b", "c", "d", "e", "f"].map(signature));
    expect(signatures.size).toBeGreaterThan(1);
  });

  it("plans detail close-ups only for existing parts and texture only with fabric info", () => {
    const analysis = buildFallbackAnalysis(base);
    const direction = buildDirection("street", analysis, "a");
    const types = planImages(direction, analysis, base).map((entry) => entry.type);
    expect(types).toContain("detail_print");
    expect(types).not.toContain("detail_embroidery");
    expect(types).not.toContain("texture_wide");
    expect(new Set(types).size).toBe(types.length);

    const withFabric = { ...base, material: "기모 스웨트" };
    expect(planImages(direction, analysis, withFabric).map((entry) => entry.type)).toContain("texture_wide");
    expect(planImages(direction, analysis, withFabric, 3)).toHaveLength(3);
  });

  it("shoots the hero in the ratio of its layout", () => {
    const analysis = buildFallbackAnalysis(base);
    for (const seed of ["a", "b", "c", "d"]) {
      const direction = buildDirection("editorial", analysis, seed);
      const hero = planImages(direction, analysis, base)[0];
      expect(hero.type).toBe("hero");
      expect(hero.ratio).toBe(pickVariant("hero", direction, 0) === "fullbleed" ? "16:9" : "4:5");
    }
  });
});

describe("editorial composition", () => {
  const analysis = buildFallbackAnalysis(base);
  const copy = {
    ...buildFallbackCopy(base),
    fitDescription: "여유 있는 오버핏입니다.",
    detailCallouts: [
      { part: "print" as const, text: "두껍게 올린 잉크층" },
      { part: "zipper" as const, text: "존재하지 않는 지퍼" },
    ],
  };

  const compose = (source: DetailPageSource, conceptId: "minimal" | "street" | "editorial" = "street") => {
    const direction = buildDirection(conceptId, analysis, "a");
    return composeEditorialDocument({ source, copy, direction, analysis, plan: planImages(direction, analysis, source) });
  };

  it("skips sections the product has nothing true to say about", () => {
    const document = compose(base);
    const types = document.sections.map((section) => section.type);
    expect(types).not.toContain("fabric");
    const fit = document.sections.find((section) => section.type === "fit");
    expect(fit?.description).toBe("");
    const detail = document.sections.find((section) => section.type === "detail");
    expect(detail?.items.map((item) => item.title)).toEqual(["PRINT"]);
  });

  it("orders sections by concept, gives each a variant and keeps slot ratios", () => {
    const street = compose(base, "street");
    const editorial = compose(base, "editorial");
    expect(street.sections.map((section) => section.type)).not.toEqual(editorial.sections.map((section) => section.type));
    street.sections.forEach((section) => expect(section.layout?.variant).toBeTruthy());
    const slots = street.sections.flatMap((section) => section.images).filter((image) => image.slot);
    expect(slots.length).toBeGreaterThan(0);
    slots.forEach((image) => {
      expect(image.ratio).toMatch(/^\d+:\d+$/);
      expect(image.url).toBe(base.imageUrl); // design until the AI photo arrives
    });
    expect(street.direction?.concept).toBe("street");
  });

  it("switching concept keeps content and custom sections in place", () => {
    const document = compose(base, "street");
    const custom = createEditorialSection("custom_text", base, document);
    const withCustom = { ...document, sections: [...document.sections.slice(0, 2), custom, ...document.sections.slice(2)] };
    const switched = applyConcept(withCustom, "minimal", analysis, "a");
    expect(switched.template).toBe("minimal");
    expect(switched.sections).toHaveLength(withCustom.sections.length);
    expect(switched.sections[2].id).toBe(custom.id);
    expect(switched.sections.find((section) => section.type === "story")?.description).toBe(
      withCustom.sections.find((section) => section.type === "story")?.description,
    );
  });
});

describe("copy safety", () => {
  it("drops unsupported superlatives", () => {
    expect(hasHype("최고의 품질로 만들었습니다.")).toBe(true);
    expect(stripHype("등판에 그래픽을 올렸습니다. 완벽한 핏을 약속합니다.")).toBe("등판에 그래픽을 올렸습니다.");
  });

  it("keeps detail callouts only for confirmed parts", () => {
    const copy = sanitizeDetailCopy(
      { detailCallouts: [{ part: "print", text: "잉크층" }, { part: "zipper", text: "지퍼" }], keyMessage: "당신만을 위한 특별한 후드" },
      base,
      ["print", "hood"],
    );
    expect(copy.detailCallouts).toEqual([{ part: "print", text: "잉크층" }]);
    expect(copy.keyMessage).toBe("");
  });
});

describe("video embed", () => {
  it("accepts https YouTube / Vimeo / mp4 only", () => {
    expect(toEmbedUrl("https://youtu.be/abcdef12345")?.src).toContain("youtube-nocookie.com/embed/abcdef12345");
    expect(toEmbedUrl("https://vimeo.com/12345")?.src).toBe("https://player.vimeo.com/video/12345");
    expect(toEmbedUrl("https://cdn.example.com/a.mp4")?.kind).toBe("video");
    expect(toEmbedUrl("http://youtu.be/abcdef12345")).toBeNull();
    expect(toEmbedUrl("javascript:alert(1)")).toBeNull();
  });
});
