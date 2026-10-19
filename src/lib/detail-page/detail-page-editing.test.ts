import { describe, expect, it } from "vitest";
import { buildFallbackCopy } from "@/lib/detail-page/fallbackCopy";
import {
  composeDetailDocument,
  duplicateSection,
  getTextField,
  moveItem,
  setTextField,
} from "@/lib/detail-page/document";
import { EMPTY_USER_PROVIDED, refreshFundingInSource } from "@/lib/detail-page/source";
import { parseMissingItemsError, validateDetailPageForPublish } from "@/lib/detail-page/validation";
import { shortenText } from "@/services/detailPage";
import type { DetailPageSource } from "@/types/detailPage";
import type { Funding } from "@/types/funding";

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

const funding = { price: 59000, size_options: ["M", "L"], color_options: ["블랙"], color: "블랙", moq: 20, funding_days: 30 };
const doc = () => composeDetailDocument(source, buildFallbackCopy(source), "minimal");

describe("field-level editing", () => {
  it("changes only the targeted field and keeps other sections by reference", () => {
    const document = doc();
    const story = document.sections.find((section) => section.type === "story")!;
    const next = setTextField(document, { scope: "section", sectionId: story.id, field: "description" }, "새 스토리");
    expect(next.sections.find((section) => section.id === story.id)!.description).toBe("새 스토리");
    for (const section of document.sections) {
      if (section.id !== story.id) expect(next.sections.find((entry) => entry.id === section.id)).toBe(section);
    }
  });

  it("keeps hero title and product name in sync both ways", () => {
    const document = doc();
    const hero = document.sections.find((section) => section.type === "hero")!;
    const viaHero = setTextField(document, { scope: "section", sectionId: hero.id, field: "title" }, "오버핏 후드");
    expect(viaHero.productName).toBe("오버핏 후드");
    const viaDoc = setTextField(document, { scope: "document", field: "subtitle" }, "한 줄");
    expect(viaDoc.sections.find((section) => section.type === "hero")!.description).toBe("한 줄");
    expect(getTextField(viaDoc, { scope: "section", sectionId: hero.id, field: "description" })).toBe("한 줄");
  });

  it("edits list items and facts by id / index", () => {
    const document = doc();
    const detail = document.sections.find((section) => section.items.length > 0)!;
    const item = detail.items[0];
    const next = setTextField(document, { scope: "item", sectionId: detail.id, itemId: item.id, field: "text" }, "바뀐 항목");
    expect(getTextField(next, { scope: "item", sectionId: detail.id, itemId: item.id, field: "text" })).toBe("바뀐 항목");
    const withFacts = document.sections.find((section) => section.facts.length > 0)!;
    const factNext = setTextField(document, { scope: "fact", sectionId: withFacts.id, index: 0, field: "value" }, "값");
    expect(factNext.sections.find((section) => section.id === withFacts.id)!.facts[0].value).toBe("값");
  });

  it("duplicates a section right below with fresh ids and detached AI slots", () => {
    const document = composeDetailDocument(source, buildFallbackCopy(source), "minimal", ["hero"]);
    const hero = document.sections[0];
    const { document: next, id } = duplicateSection(document, hero.id);
    expect(next.sections).toHaveLength(document.sections.length + 1);
    expect(next.sections[1].id).toBe(id);
    expect(next.sections[1].images.every((image) => !image.slot)).toBe(true);
    expect(next.sections[1].images[0].id).not.toBe(hero.images[0].id);
  });

  it("moves list entries and ignores out-of-range moves", () => {
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    const list = [1, 2];
    expect(moveItem(list, 0, 5)).toBe(list);
  });

  it("shortens text without AI", () => {
    const shorter = shortenText("첫 문장입니다. 두 번째 문장은 조금 더 깁니다. 세 번째 문장도 있습니다.");
    expect(shorter.length).toBeLessThan(40);
    expect(shorter.startsWith("첫 문장입니다.")).toBe(true);
  });
});

describe("publish validation", () => {
  it("passes a complete page linked to a complete funding", () => {
    expect(validateDetailPageForPublish({ document: doc(), source, funding })).toEqual([]);
  });

  it("lists every missing item with where to fix it", () => {
    const document = { ...doc(), productName: "", subtitle: "" };
    document.sections = document.sections
      .filter((section) => !["story", "design"].includes(section.type))
      .map((section) => (section.type === "hero" ? { ...section, images: [] } : section));
    const missing = validateDetailPageForPublish({
      document,
      source,
      funding: { ...funding, price: null, size_options: [], color_options: [], color: null },
    });
    expect(missing.map((item) => item.key)).toEqual(["hero_image", "product_name", "description", "price", "options", "sizes"]);
    expect(missing.find((item) => item.key === "price")!.target).toBe("funding");
  });

  it("requires a funding before registering", () => {
    const missing = validateDetailPageForPublish({ document: doc(), source: { ...source, userProvided: { ...source.userProvided, price: 1000 } }, funding: null });
    expect(missing.map((item) => item.key)).toEqual(["funding"]);
  });

  it("parses the server error payload", () => {
    const parsed = parseMissingItemsError({ hint: "detail_page_missing_items", details: '[{"key":"price","label":"가격","message":"m","target":"funding"}]' });
    expect(parsed?.[0].key).toBe("price");
    expect(parseMissingItemsError(new Error("x"))).toBeNull();
  });

  it("refreshes funding facts into the source", () => {
    const refreshed = refreshFundingInSource(source, { ...funding, measurements: null, size_options: ["S"] } as unknown as Funding);
    expect(refreshed.userProvided.price).toBe(59000);
    expect(refreshed.sizeOptions).toEqual(["S"]);
    expect(refreshed.fundingDays).toBe(30);
  });
});
