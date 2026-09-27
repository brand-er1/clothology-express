import { DETAIL_PARTS } from "@/lib/detail-page/analysis";
import {
  DEFAULT_IMAGE_RATIO,
  buildDirection,
  detailShotsFor,
  getConcept,
  pickVariant,
  type PlannedImage,
} from "@/lib/detail-page/artDirection";
import { buildSectionFacts, buildSectionFromCopy, createDetailId, getDesignImages, section } from "@/lib/detail-page/document";
import type {
  DetailArtDirection,
  DetailImage,
  DetailImageType,
  DetailPageCopy,
  DetailPageDocument,
  DetailPageSource,
  DetailPageTemplateId,
  DetailProductAnalysis,
  DetailSection,
  DetailSectionType,
} from "@/types/detailPage";

/**
 * Editorial composer: analysis + copy + art direction + image plan → ordered sections.
 *
 * Every AI image slot starts out showing the creator's own design (never a stock photo) and is
 * filled when its generation finishes. Sections only exist when the product has something true
 * to say (no fabric section without fabric data, no detail close-ups of parts that don't exist,
 * no fit claims when the fit is unknown).
 */

export type ComposeInput = {
  source: DetailPageSource;
  copy: DetailPageCopy;
  direction: DetailArtDirection;
  analysis: DetailProductAnalysis;
  plan: PlannedImage[];
};

const isKnownFit = (source: DetailPageSource) => Boolean(source.fit || source.userProvided.fitNote);

const hasFabricInfo = (source: DetailPageSource) =>
  Boolean(
    source.material ||
      source.userProvided.composition ||
      source.userProvided.fabricWeight ||
      source.userProvided.fabricHand ||
      source.userProvided.fabricStretch ||
      source.userProvided.fabricThickness,
  );

const lines = (values: string[]) =>
  values.map((text) => text.trim()).filter(Boolean).map((text) => ({ id: createDetailId(), title: "", text }));

export const composeEditorialDocument = ({ source, copy, direction, analysis, plan }: ComposeInput): DetailPageDocument => {
  const design = getDesignImages(source);
  const front = design.front[0];
  const back = design.pair[1];
  const name = copy.productName || source.clothType || "제품";
  const planned = new Map(plan.map((entry) => [entry.type, entry]));
  const has = (type: DetailImageType) => planned.has(type);

  /** An AI slot showing `base` (the creator's design) until the generated photo arrives. */
  const slot = (type: DetailImageType, alt: string, base: DetailImage | undefined = front, caption?: string): DetailImage[] =>
    base && has(type)
      ? [{ ...base, id: createDetailId(), alt, slot: type, ratio: planned.get(type)?.ratio ?? DEFAULT_IMAGE_RATIO[type], ...(caption ? { caption } : {}) }]
      : [];

  const built: Partial<Record<DetailSectionType, DetailSection>> = {};

  built.hero = section("hero", {
    eyebrow: (source.brandName || "").toUpperCase(),
    title: copy.productName,
    description: copy.keyMessage || copy.oneLiner,
    images: has("hero") ? slot("hero", `${name} 대표 이미지`) : design.hero,
  });

  if (copy.story.trim()) {
    built.story = section("story", {
      eyebrow: "STORY",
      title: copy.mainCopy || "",
      description: copy.story,
    });
  }

  const laid = has("folded") ? "folded" : "flat_lay";
  const designImages = [
    ...(has("product_front") ? slot("product_front", `${name} 앞면`, front, "FRONT") : design.pair.slice(0, 1).map((image) => ({ ...image, caption: "FRONT" }))),
    ...(has("product_back") ? slot("product_back", `${name} 뒷면`, back ?? front, "BACK") : design.pair.slice(1, 2).map((image) => ({ ...image, caption: "BACK" }))),
    ...slot(laid, `${name} ${laid === "folded" ? "폴딩" : "플랫레이"}`, front, laid === "folded" ? "FOLDED" : "FLAT"),
  ];
  const highlights = (copy.designHighlights?.length ? copy.designHighlights : copy.designPoints.map((point) => point.title)).slice(0, 3);
  built.design = section("design", {
    eyebrow: "PRODUCT",
    title: "",
    description: copy.designDescription,
    items: lines(highlights),
    facts: buildSectionFacts("design", source),
    images: designImages,
  });

  const shots = detailShotsFor(analysis.parts).filter((shot) => has(shot.type));
  const detailImages = shots.flatMap((shot) =>
    slot(shot.type, `${name} ${DETAIL_PARTS[shot.part].label} 디테일`, front, DETAIL_PARTS[shot.part].caption),
  );
  const callouts = (copy.detailCallouts ?? []).filter((callout) => analysis.parts.includes(callout.part));
  const detailItems = callouts.length
    ? callouts.map((callout) => ({ id: createDetailId(), title: DETAIL_PARTS[callout.part].caption, text: callout.text }))
    : copy.designPoints.slice(0, 4).map((point) => ({ id: createDetailId(), title: point.title, text: point.text }));
  if (detailImages.length || detailItems.length) {
    built.detail = section("detail", { eyebrow: "DETAIL", title: "", items: detailItems, images: detailImages });
  }

  if (hasFabricInfo(source)) {
    built.fabric = section("fabric", {
      eyebrow: "FABRIC",
      title: source.material || "",
      description: copy.fabricDescription,
      facts: buildSectionFacts("fabric", source),
      images: [...slot("texture_wide", `${name} 원단 텍스처`, front, "TEXTURE"), ...slot("fabric", `${name} 원단`)],
    });
  }

  const fitShot = has("mannequin") ? "mannequin" : "lifestyle";
  const fitImages = [
    ...slot(fitShot, `${name} ${fitShot === "mannequin" ? "마네킹 착용" : "착용"} 컷`, front, fitShot === "mannequin" ? "ON FORM" : "WORN"),
    ...design.pair.map((image, index) => ({ ...image, id: createDetailId(), caption: index === 0 ? "FRONT" : "BACK" })),
  ];
  built.fit = section("fit", {
    eyebrow: "FIT",
    title: isKnownFit(source) ? source.fit || source.userProvided.fitNote : "",
    // Without a creator-confirmed fit the page shows the views only, never a fit claim.
    description: isKnownFit(source) ? copy.fitDescription : "",
    items: lines(copy.styling).slice(0, 3),
    facts: buildSectionFacts("fit", source),
    images: fitImages,
  });

  const lookbookImages = [...slot("editorial", `${name} 룩북`, front), ...slot("mood", `${name} 무드`, front)];
  if (lookbookImages.length) {
    built.lookbook = section("lookbook", {
      eyebrow: "LOOKBOOK",
      title: "",
      description: copy.lookbookCaption || "",
      images: lookbookImages,
    });
  }

  for (const type of ["color", "size", "production", "funding", "brand", "notice"] as const) {
    const made = buildSectionFromCopy(type, source, copy, []);
    if (made) built[type] = made;
  }

  const concept = getConcept(direction.concept);
  const sections = concept.order
    .map((type) => built[type])
    .filter((entry): entry is DetailSection => Boolean(entry))
    .map((entry, index) => ({
      ...entry,
      layout: {
        variant: pickVariant(entry.type, direction, index),
        ...(concept.backgrounds[entry.type] ? { background: concept.backgrounds[entry.type] } : {}),
      },
    }));

  return {
    template: direction.concept,
    direction,
    productName: copy.productName,
    productNameEn: copy.productNameEn,
    subtitle: copy.oneLiner,
    mainCopy: copy.mainCopy,
    sections,
  };
};

/**
 * Switches an existing page to another concept without touching its content: new palette and
 * typography, concept order for standard sections (custom sections keep their place relative to
 * their neighbour), and fresh variants/backgrounds.
 */
export const applyConcept = (
  document: DetailPageDocument,
  conceptId: DetailPageTemplateId,
  analysis: DetailProductAnalysis | null | undefined,
  seedKey: string,
): DetailPageDocument => {
  const direction = buildDirection(conceptId, analysis, seedKey);
  const concept = getConcept(conceptId);
  const rank = (type: DetailSectionType) => {
    const index = concept.order.indexOf(type);
    return index < 0 ? Number.POSITIVE_INFINITY : index;
  };
  // Stable reorder: standard sections by concept order, others stay after their predecessor.
  const standard = document.sections.filter((entry) => rank(entry.type) !== Number.POSITIVE_INFINITY);
  const orderedStandard = [...standard].sort((a, b) => rank(a.type) - rank(b.type));
  const result: DetailSection[] = [];
  let pointer = 0;
  for (const entry of document.sections) {
    if (rank(entry.type) === Number.POSITIVE_INFINITY) result.push(entry);
    else result.push(orderedStandard[pointer++]);
  }
  return {
    ...document,
    template: conceptId,
    direction,
    sections: result.map((entry, index) => ({
      ...entry,
      layout: {
        ...entry.layout,
        variant: pickVariant(entry.type, direction, index),
        background: concept.backgrounds[entry.type] ?? "default",
      },
    })),
  };
};

/** Creates an editor-added section (섹션 추가) for editorial pages. */
export const createEditorialSection = (
  type: DetailSectionType,
  source: DetailPageSource,
  document: DetailPageDocument,
): DetailSection => {
  const copyLike: DetailPageCopy = {
    productName: document.productName,
    productNameEn: document.productNameEn,
    oneLiner: document.subtitle,
    mainCopy: document.mainCopy,
    story: document.subtitle || "내용을 입력하세요.",
    designDescription: "",
    designPoints: [],
    fabricDescription: source.material ? `${source.material} 원단으로 제작합니다.` : "",
    fitDescription: "",
    colorDescription: "",
    productionMethod: "",
    styling: [],
    sizeGuide: "",
    care: [],
    fundingGuide: "",
    productionSchedule: "",
    shippingGuide: "",
    notices: [],
    missingInfo: [],
  };
  const design = getDesignImages(source);
  const base = (() => {
    switch (type) {
      case "lookbook":
        return section("lookbook", { eyebrow: "LOOKBOOK", title: "", images: design.front.map((image) => ({ ...image, id: createDetailId(), slot: "editorial" as const })) });
      case "video":
        return section("video", { eyebrow: "FILM", title: "", videoUrl: "" });
      case "custom_image":
        return section("custom_image", { eyebrow: "", title: "", images: design.front.map((image) => ({ ...image, id: createDetailId() })) });
      case "custom_text":
        return section("custom_text", { eyebrow: "NOTE", title: "", description: "내용을 입력하세요." });
      case "design":
        return section("design", { eyebrow: "PRODUCT", title: "", facts: buildSectionFacts("design", source), images: design.pair.map((image) => ({ ...image, id: createDetailId() })) });
      case "detail":
        return section("detail", { eyebrow: "DETAIL", title: "", images: design.full.map((image) => ({ ...image, id: createDetailId() })) });
      default:
        return buildSectionFromCopy(type, source, copyLike, []) ?? section(type, { title: "", description: "내용을 입력하세요." });
    }
  })();
  const direction = document.direction;
  return {
    ...base,
    layout: direction ? { variant: pickVariant(type, direction, document.sections.length) } : base.layout,
  };
};
