import type {
  DetailFact,
  DetailImage,
  DetailImageCrop,
  DetailImageType,
  DetailPageCopy,
  DetailPageDocument,
  DetailPageSource,
  DetailPageTemplateId,
  DetailSection,
  DetailSectionType,
} from "@/types/detailPage";

export const createDetailId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

export type DetailSectionMeta = {
  label: string;
  eyebrow: string;
  title: string;
  hint: string;
};

export const SECTION_META: Record<DetailSectionType, DetailSectionMeta> = {
  hero: { label: "히어로", eyebrow: "NEW COLLECTION", title: "", hint: "큰 제품 이미지, 상품명, 한 줄 카피" },
  story: { label: "제품 스토리", eyebrow: "PRODUCT STORY", title: "PRODUCT STORY", hint: "제품을 만든 배경과 설명" },
  design: { label: "디자인", eyebrow: "DESIGN", title: "DESIGN", hint: "앞면·뒷면 이미지와 디자인 특징" },
  detail: { label: "디테일", eyebrow: "DETAIL", title: "DETAIL POINT", hint: "디자인 포인트 3~5개" },
  fabric: { label: "원단", eyebrow: "FABRIC", title: "FABRIC", hint: "원단 및 소재 설명" },
  fit: { label: "핏", eyebrow: "FIT", title: "FIT & STYLING", hint: "핏·실루엣과 추천 스타일링" },
  color: { label: "컬러", eyebrow: "COLOR", title: "COLOR", hint: "컬러 정보" },
  size: { label: "사이즈", eyebrow: "SIZE", title: "SIZE & CARE", hint: "사이즈표와 세탁·관리" },
  brand: { label: "제작자 / 브랜드", eyebrow: "MAKER / BRAND", title: "MAKER", hint: "제작자 프로필과 브랜드 소개" },
  funding: { label: "펀딩", eyebrow: "FUNDING", title: "FUNDING", hint: "목표·참여 수량, 진행률, 가격, 종료일" },
  production: { label: "제작 과정", eyebrow: "PRODUCTION", title: "PRODUCTION", hint: "펀딩 성공부터 배송까지" },
  notice: { label: "안내", eyebrow: "NOTICE", title: "NOTICE", hint: "배송·교환·환불·펀딩 안내" },
  custom_text: { label: "텍스트 섹션", eyebrow: "NOTE", title: "새 섹션", hint: "자유 텍스트" },
  custom_image: { label: "이미지 섹션", eyebrow: "LOOKBOOK", title: "LOOKBOOK", hint: "이미지 갤러리" },
};

export const DEFAULT_SECTION_ORDER: DetailSectionType[] = [
  "hero",
  "story",
  "design",
  "detail",
  "fabric",
  "fit",
  "color",
  "size",
  "brand",
  "funding",
  "production",
  "notice",
];

/** Mirrors the funding production stages (PRODUCTION_STAGE_LABEL) customers later track. */
export const PRODUCTION_FLOW = [
  { title: "펀딩 성공", text: "목표 수량이 모이면 제작이 확정됩니다." },
  { title: "원단 컨택", text: "디자인에 맞는 원단과 부자재를 확보합니다." },
  { title: "샘플 제작", text: "본생산 전 샘플로 핏과 완성도를 확인합니다." },
  { title: "본생산", text: "확정된 수량만큼 생산합니다." },
  { title: "검수/포장", text: "한 벌씩 검수한 뒤 포장합니다." },
  { title: "배송", text: "주문하신 주소로 순차 발송합니다." },
];

const image = (url: string, crop: DetailImageCrop, alt: string): DetailImage => ({
  id: createDetailId(),
  url,
  crop,
  alt,
  source: "design",
});

/**
 * An image slot that shows the creator's own design until the AI image of `slot` is
 * generated (the studio then swaps it in). Never a stock/mock image.
 */
const slotImage = (base: DetailImage | undefined, slot: DetailImageType, alt: string): DetailImage[] =>
  base ? [{ ...base, id: createDetailId(), alt, slot }] : [];

type DesignImageSet = Record<"hero" | "front" | "pair" | "full", DetailImage[]>;

export const getDesignImages = (source: DetailPageSource): DesignImageSet => {
  if (!source.imageUrl) return { hero: [], front: [], pair: [], full: [] };
  const name = source.clothType || "의류";
  const full = image(source.imageUrl, "full", `${name} 디자인`);
  if (!source.isFrontBackComposite) {
    return { hero: [full], front: [image(source.imageUrl, "full", `${name}`)], pair: [full], full: [full] };
  }
  return {
    hero: [image(source.imageUrl, "left", `${name} 앞면`)],
    front: [image(source.imageUrl, "left", `${name} 앞면`)],
    pair: [image(source.imageUrl, "left", `${name} 앞면`), image(source.imageUrl, "right", `${name} 뒷면`)],
    full: [image(source.imageUrl, "full", `${name} 앞면과 뒷면`)],
  };
};

const fact = (label: string, value: string | null | undefined): DetailFact[] =>
  value && value.trim() ? [{ label, value: value.trim() }] : [];

const DECORATION_LABEL = { print: "프린팅", embroidery: "자수", patch: "패치", other: "장식" } as const;

/** Specification rows built only from verified source data. */
export const buildSectionFacts = (type: DetailSectionType, source: DetailPageSource): DetailFact[] => {
  const provided = source.userProvided;
  switch (type) {
    case "design":
      return [
        ...fact("카테고리", source.clothType),
        ...source.decorations.map((decoration) => ({
          label: DECORATION_LABEL[decoration.kind],
          value: [decoration.location, decoration.label].filter(Boolean).join(" · "),
        })),
        ...fact("부자재", source.accessories.join(", ")),
        ...fact("구성", source.constructionFeatures.join(", ")),
      ];
    case "fabric":
      return [
        ...fact("원단", source.material),
        ...fact("혼용률", provided.composition),
        ...fact("제작 방식", source.productionMethod),
      ];
    case "fit":
      return [...fact("핏", source.fit), ...fact("핏 메모", provided.fitNote)];
    case "color":
      return fact("컬러", provided.colorName || source.color);
    case "size":
      return fact("사이즈", source.sizeOptions.join(" / "));
    default:
      return [];
  }
};

const items = (entries: Array<{ title: string; text: string }>) =>
  entries
    .filter((entry) => entry.title.trim() || entry.text.trim())
    .map((entry) => ({ id: createDetailId(), title: entry.title.trim(), text: entry.text.trim() }));

const textItems = (lines: string[]) => items(lines.map((line) => ({ title: "", text: line })));

const section = (
  type: DetailSectionType,
  values: Partial<Omit<DetailSection, "id" | "type">>,
): DetailSection => ({
  id: createDetailId(),
  type,
  visible: true,
  eyebrow: SECTION_META[type].eyebrow,
  title: SECTION_META[type].title,
  description: "",
  items: [],
  facts: [],
  images: [],
  ...values,
});

/**
 * Builds one section from AI/fallback copy. Returns null when the product has nothing to
 * say for that section (e.g. no color information), which is how unneeded sections are
 * excluded automatically.
 */
export const buildSectionFromCopy = (
  type: DetailSectionType,
  source: DetailPageSource,
  copy: DetailPageCopy,
  imageTypes: DetailImageType[] = [],
): DetailSection | null => {
  const images = getDesignImages(source);
  const facts = buildSectionFacts(type, source);
  const wants = (slot: DetailImageType) => imageTypes.includes(slot);
  const front = images.front[0];
  const back = images.pair[1];
  const name = copy.productName || source.clothType || "제품";
  switch (type) {
    case "hero":
      return section("hero", {
        title: copy.productName,
        description: copy.oneLiner,
        eyebrow: source.brandName ? source.brandName.toUpperCase() : SECTION_META.hero.eyebrow,
        images: wants("hero") ? slotImage(front, "hero", `${name} 대표 이미지`) : images.hero,
      });
    case "story":
      return copy.story
        ? section("story", {
            description: copy.story,
            title: copy.mainCopy || SECTION_META.story.title,
            images: wants("editorial") ? slotImage(front, "editorial", `${name} 에디토리얼`) : [],
          })
        : null;
    case "design":
      return section("design", {
        description: copy.designDescription,
        facts,
        images: [
          ...(wants("product_front") ? slotImage(front, "product_front", `${name} 앞면`) : images.pair.slice(0, 1)),
          ...(wants("product_back") ? slotImage(back ?? front, "product_back", `${name} 뒷면`) : images.pair.slice(1, 2)),
        ],
      });
    case "detail": {
      const points = items(copy.designPoints).slice(0, 5);
      if (!points.length) return null;
      return section("detail", {
        items: points,
        description: copy.productionMethod,
        images: wants("detail") ? slotImage(images.full[0], "detail", `${name} 디테일`) : images.full,
      });
    }
    case "fabric":
      if (!source.material && !copy.fabricDescription) return null;
      return section("fabric", {
        description: copy.fabricDescription,
        facts,
        images: wants("fabric") ? slotImage(images.full[0], "fabric", `${name} 원단`) : [],
      });
    case "fit":
      if (!source.fit && !copy.fitDescription && !copy.styling.length) return null;
      return section("fit", {
        description: copy.fitDescription,
        items: textItems(copy.styling).slice(0, 4),
        facts,
        images: wants("lifestyle") ? slotImage(front, "lifestyle", `${name} 착용 컷`) : images.front,
      });
    case "color":
      if (!source.color && !source.userProvided.colorName) return null;
      return section("color", { description: copy.colorDescription, facts });
    case "size":
      return section("size", { description: copy.sizeGuide, items: textItems(copy.care), facts });
    case "brand":
      if (!source.brandName && !source.creatorName) return null;
      return section("brand", {
        title: source.brandName || source.creatorName,
        description: source.brandDescription || source.brandShortDescription || source.creatorBio,
      });
    case "funding":
      return section("funding", { description: copy.fundingGuide });
    case "production":
      return section("production", {
        description: copy.productionSchedule,
        items: items(PRODUCTION_FLOW),
      });
    case "notice":
      return section("notice", {
        description: copy.shippingGuide,
        items: textItems(copy.notices),
      });
    case "custom_text":
    case "custom_image":
      return createCustomSection(type);
  }
};

export const createCustomSection = (type: DetailSectionType): DetailSection =>
  section(type, {
    title: SECTION_META[type].title,
    description: type === "custom_text" ? "내용을 입력하세요." : "",
  });

/**
 * Assembles the full page: copy + image slots. `imageTypes` are the AI images being
 * generated; each slot shows the creator's design until its AI image arrives.
 */
export const composeDetailDocument = (
  source: DetailPageSource,
  copy: DetailPageCopy,
  template: DetailPageTemplateId,
  imageTypes: DetailImageType[] = [],
): DetailPageDocument => {
  const sections = DEFAULT_SECTION_ORDER.map((type) => buildSectionFromCopy(type, source, copy, imageTypes)).filter(
    (value): value is DetailSection => value !== null,
  );
  if (imageTypes.includes("mood")) {
    const mood: DetailSection = {
      ...createCustomSection("custom_image"),
      eyebrow: "MOOD",
      title: copy.mainCopy || "MOOD",
      description: "",
      images: slotImage(getDesignImages(source).front[0], "mood", `${copy.productName} 무드`),
    };
    const brandIndex = sections.findIndex((entry) => entry.type === "brand" || entry.type === "funding");
    sections.splice(brandIndex >= 0 ? brandIndex : sections.length, 0, mood);
  }
  return {
    template,
    productName: copy.productName,
    productNameEn: copy.productNameEn,
    subtitle: copy.oneLiner,
    mainCopy: copy.mainCopy,
    sections,
  };
};

/** Default AI image slot for an image in a given section (used by "AI 다시 생성"). */
export const defaultSlotForSection = (type: DetailSectionType, crop: DetailImageCrop): DetailImageType => {
  switch (type) {
    case "hero":
      return "hero";
    case "story":
      return "editorial";
    case "design":
      return crop === "right" ? "product_back" : "product_front";
    case "detail":
      return "detail";
    case "fabric":
      return "fabric";
    case "fit":
      return "lifestyle";
    case "custom_image":
      return "mood";
    default:
      return "editorial";
  }
};

/** Puts a generated image into every slot of its type (one generation can fill several slots). */
export const applyGeneratedImage = (
  document: DetailPageDocument,
  slot: DetailImageType,
  generated: { url: string; assetId: string },
): DetailPageDocument => ({
  ...document,
  sections: document.sections.map((entry) => ({
    ...entry,
    images: entry.images.map((current) =>
      current.slot === slot
        ? { ...current, url: generated.url, crop: "full", source: "generated", assetId: generated.assetId }
        : current,
    ),
  })),
});

/**
 * Re-applies freshly generated copy to one section, keeping the creator's own images and
 * the section's position/visibility.
 */
export const regenerateSectionText = (
  current: DetailSection,
  source: DetailPageSource,
  copy: DetailPageCopy,
): DetailSection => {
  const next = buildSectionFromCopy(current.type, source, copy);
  if (!next || current.type === "custom_text" || current.type === "custom_image") return current;
  return {
    ...current,
    title: current.type === "hero" ? copy.productName : next.title,
    description: next.description,
    items: next.items.length ? next.items : current.items,
    facts: next.facts,
  };
};

/** Plain text used for the legacy funding description (admin review, list cards, fallback UI). */
export const buildFundingDescription = (document: DetailPageDocument) => {
  const get = (type: DetailSectionType) => document.sections.find((entry) => entry.type === type && entry.visible);
  return [
    document.subtitle,
    get("story")?.description,
    get("design")?.description,
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 4000);
};
