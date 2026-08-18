import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Difficulty = "easy" | "medium" | "hard";
type DecorationKind =
  | "screen_print_1_color"
  | "screen_print_multi_color"
  | "dtf"
  | "dtg"
  | "pu"
  | "silicone_print"
  | "embroidery"
  | "patch"
  | "transfer"
  | "label"
  | "washing"
  | "pigment"
  | "unknown_print";
type DecorationLocation =
  | "front"
  | "back"
  | "left_sleeve"
  | "right_sleeve"
  | "neck"
  | "other";
type ArtworkType = "logo" | "photo" | "illustration";
type PrintSize = "small" | "medium" | "large" | "unknown";
type AccessoryKind =
  | "stud"
  | "zipper"
  | "button"
  | "rivet"
  | "hood_cord"
  | "snap_button"
  | "buckle"
  | "drawstring";

type GarmentPriceRow = {
  category_key: string;
  category_label: string;
  production_min: number | null;
  production_max: number | null;
  production_is_starting_from: boolean;
  pattern_cost: number;
  sample_cost: number;
  moq: number;
  pricing_note: string | null;
  source_file: string;
  source_version: string;
};

type DecorationPriceRow = {
  price_key: string;
  price_label: string;
  analysis_kinds: string[];
  unit_min: number;
  unit_max: number;
  is_starting_from: boolean;
  pricing_note: string | null;
  source_file: string;
  source_version: string;
};

type MaterialSurchargeRow = {
  material_key: string;
  material_label: string;
  aliases: string[];
  sample_surcharge: number;
  production_unit_surcharge: number;
  pricing_note: string | null;
};

type AccessoryPriceRow = {
  accessory_key: AccessoryKind;
  accessory_label: string;
  unit_price: number;
  pricing_note: string | null;
  source_label: string;
  source_version: string;
};

type RawDecoration = {
  kind?: string;
  locations?: string[];
  location?: string;
  size?: string;
  colorCount?: number;
  confidence?: number;
};

type RawAccessory = {
  kind?: string;
  count?: number;
  confidence?: number;
};

type RawAnalysis = {
  categoryKey?: string;
  categoryConfidence?: number;
  materialKey?: string;
  materialLabel?: string;
  materialConfidence?: number;
  materialComposition?: string;
  hasLining?: boolean;
  difficulty?: string;
  difficultyReason?: string;
  hasWashing?: boolean;
  washingConfidence?: number;
  decorations?: RawDecoration[];
  accessories?: RawAccessory[];
  features?: string[];
};

/** Multi-item Gemini response: `{ "items": [RawAnalysis, ...] }`. */
type RawAnalysisResponse = {
  items?: RawAnalysis[];
} & RawAnalysis;

type UploadedArtworkHint = {
  artworkType: ArtworkType;
  recommendedKind: DecorationKind;
  location: DecorationLocation;
  confidence: number;
};

type NormalizedDecoration = {
  kind: DecorationKind;
  location: DecorationLocation;
  size: PrintSize;
  confidence: number;
  source: "image_analysis" | "uploaded_artwork";
  artworkType: ArtworkType | null;
};

const validDecorationKinds = new Set<DecorationKind>([
  "screen_print_1_color",
  "screen_print_multi_color",
  "dtf",
  "dtg",
  "pu",
  "silicone_print",
  "embroidery",
  "patch",
  "transfer",
  "label",
  "washing",
  "pigment",
  "unknown_print",
]);
const validAccessoryKinds = new Set<AccessoryKind>([
  "stud",
  "zipper",
  "button",
  "rivet",
  "hood_cord",
  "snap_button",
  "buckle",
  "drawstring",
]);

const validLocations = new Set<DecorationLocation>([
  "front",
  "back",
  "left_sleeve",
  "right_sleeve",
  "neck",
  "other",
]);
const validPrintSizes = new Set<PrintSize>([
  "small",
  "medium",
  "large",
  "unknown",
]);
const validArtworkTypes = new Set<ArtworkType>([
  "logo",
  "photo",
  "illustration",
]);
const printableDecorationKinds = new Set<DecorationKind>([
  "screen_print_1_color",
  "screen_print_multi_color",
  "dtf",
  "dtg",
  "transfer",
  "unknown_print",
]);
const knitPatchRequiredKinds = new Set<DecorationKind>([
  "screen_print_1_color",
  "screen_print_multi_color",
  "dtf",
  "dtg",
  "pu",
  "silicone_print",
  "embroidery",
  "patch",
  "transfer",
  "unknown_print",
]);

const locationLabels: Record<DecorationLocation, string> = {
  front: "앞",
  back: "뒤",
  left_sleeve: "왼쪽 소매",
  right_sleeve: "오른쪽 소매",
  neck: "목",
  other: "기타 위치",
};

const selectedTypeAliases: Record<string, string> = {
  long_pants: "pants",
  니트: "knit",
};

const virtualGarmentCategories = [
  { key: "tights_short_sleeve", label: "상의형 타이즈 (반팔)", priceKey: "short_sleeve" },
  { key: "tights_long_sleeve", label: "긴팔 타이즈", priceKey: "long_sleeve" },
  { key: "tights_bottom", label: "하의형 타이즈", priceKey: "pants" },
] as const;

const virtualGarmentMap = new Map(
  virtualGarmentCategories.map((category) => [category.key, category]),
);

const materialLabels: Record<string, string> = {
  cotton: "면",
  cotton_30s: "코마 싱글 30수",
  cotton_20s: "헤비 코튼 싱글 20수",
  cotton_rib: "코튼 골지",
  pique_cotton: "PK 피케",
  polyester: "폴리",
  poly: "폴리",
  poly_spandex: "기능성 폴리 스판",
  nylon_spandex: "나일론 스판",
  performance_mesh: "기능성 메쉬",
  functional: "기능성 원단",
  linen: "린넨",
  french_terry: "쭈리(프렌치 테리)",
  brushed_fleece: "기모 원단",
  cotton_twill: "코튼 트윌",
  woven_nylon: "우븐 나일론",
  denim: "데님",
  leather: "레더",
  knit: "니트",
  wool_blend: "울 혼방 니트",
  cotton_knit: "코튼 니트",
  acrylic_blend: "아크릴 혼방 니트",
  other: "기타",
};

const normalizeEstimateQuantity = (
  value: unknown,
  minimumQuantity = 20,
) =>
  Math.min(
    100000,
    Math.max(
      minimumQuantity,
      Math.round(Number(value) || minimumQuantity),
    ),
  );

const resolveMinimumOrderQuantity = (
  categoryKey: string,
  materialKey: string,
  catalogMoq: number,
) => {
  const isKnit = categoryKey === "knit";
  const isLeatherJacket =
    (categoryKey === "jacket" || categoryKey === "jacket_lined") &&
    materialKey === "leather";

  return Math.max(catalogMoq, isKnit || isLeatherJacket ? 100 : 20);
};

const getProductionDiscountRate = (quantity: number) => {
  if (quantity >= 300) return 0.1;
  if (quantity >= 200) return 0.07;
  if (quantity >= 100) return 0.05;
  return 0;
};

const allowedImageMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const parseJsonResponse = (text: string): RawAnalysisResponse => {
  const normalized = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "");
  return JSON.parse(normalized);
};

/**
 * Accepts the new `{ items: [...] }` multi-item shape. Falls back to treating the whole parsed
 * object as a single item if the model ever returns the old flat shape, so a prompt-following
 * slip never crashes the request outright.
 */
const extractRawItems = (parsed: RawAnalysisResponse): RawAnalysis[] => {
  if (Array.isArray(parsed.items) && parsed.items.length > 0) {
    return parsed.items;
  }
  return [parsed];
};

const decodeBase64Image = (value: string) => {
  const normalized = value.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    for (let index = 0; index < chunk.length; index += 1) {
      binary += String.fromCharCode(chunk[index]);
    }
  }

  return btoa(binary);
};

const clampConfidence = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.5;
  return Math.min(1, Math.max(0, parsed));
};

const normalizeDifficulty = (value: unknown): Difficulty =>
  value === "easy" || value === "hard" ? value : "medium";

const normalizePrintSize = (value: unknown): PrintSize => {
  const size = String(value || "") as PrintSize;
  return validPrintSizes.has(size) ? size : "unknown";
};

const normalizeManualAnalysis = (value: unknown): RawAnalysis | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const categoryKey = String(record.categoryKey || "").trim();
  if (!categoryKey) return null;

  return {
    categoryKey,
    categoryConfidence: clampConfidence(record.categoryConfidence ?? 1),
    materialKey: String(record.materialKey || "other"),
    materialLabel: String(record.materialLabel || ""),
    materialConfidence: clampConfidence(record.materialConfidence ?? 1),
    materialComposition: String(record.materialComposition || ""),
    hasLining: Boolean(record.hasLining),
    hasWashing: Boolean(record.hasWashing),
    washingConfidence: 1,
    difficulty: normalizeDifficulty(record.difficulty),
    difficultyReason: String(record.difficultyReason || ""),
    decorations: Array.isArray(record.decorations)
      ? (record.decorations as RawDecoration[])
      : [],
    accessories: Array.isArray(record.accessories)
      ? (record.accessories as RawAccessory[])
      : [],
    features: Array.isArray(record.features)
      ? record.features.map((feature) => String(feature)).slice(0, 12)
      : [],
  };
};

const normalizeUploadedArtwork = (
  value: unknown,
): UploadedArtworkHint | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const artworkType = String(record.artworkType || "") as ArtworkType;
  const recommendedKind = String(
    record.recommendedKind || "",
  ) as DecorationKind;
  const location = String(record.location || "") as DecorationLocation;

  if (
    !validArtworkTypes.has(artworkType) ||
    !validDecorationKinds.has(recommendedKind) ||
    !validLocations.has(location)
  ) {
    return null;
  }

  return {
    artworkType,
    recommendedKind,
    location,
    confidence: clampConfidence(record.confidence),
  };
};

const resolveGarmentCategory = (
  rawAnalysis: RawAnalysis,
  selectedType: string,
  availableKeys: Set<string>,
) => {
  const selectedKey = selectedTypeAliases[selectedType] || selectedType;
  const selectedSpecialCategory =
    selectedKey === "knit" ||
    selectedKey === "leggings" ||
    virtualGarmentMap.has(selectedKey);
  let categoryKey = selectedSpecialCategory
    ? selectedKey
    : String(rawAnalysis.categoryKey || "");
  const fallbackKey = selectedTypeAliases[selectedType] || selectedType;
  const isAvailable = (key: string) =>
    availableKeys.has(key) || virtualGarmentMap.has(key);

  if (!isAvailable(categoryKey)) {
    categoryKey = isAvailable(fallbackKey) ? fallbackKey : "";
  }

  if (
    rawAnalysis.hasLining &&
    (categoryKey === "jacket" || categoryKey === "jumper") &&
    availableKeys.has(`${categoryKey}_lined`)
  ) {
    categoryKey = `${categoryKey}_lined`;
  }

  const virtualCategory = virtualGarmentMap.get(categoryKey);
  return {
    categoryKey,
    priceKey: virtualCategory?.priceKey || categoryKey,
    label: virtualCategory?.label || null,
    referenceNote: virtualCategory
      ? `${virtualCategory.label}은 ${virtualCategory.priceKey === "pants" ? "일반 팬츠" : virtualCategory.priceKey === "long_sleeve" ? "긴팔 티셔츠" : "반팔 티셔츠"}의 패턴비·샘플비·생산공임을 그대로 적용합니다.`
      : null,
  };
};

const normalizeDecorations = (rawDecorations: RawDecoration[] | undefined) => {
  const normalized: NormalizedDecoration[] = [];
  const seen = new Set<string>();

  for (const rawDecoration of rawDecorations || []) {
    let kind = String(rawDecoration.kind || "") as DecorationKind;
    if (!validDecorationKinds.has(kind)) continue;
    const confidence = clampConfidence(rawDecoration.confidence);
    if (confidence < 0.45) continue;

    if (
      kind === "screen_print_1_color" &&
      Number(rawDecoration.colorCount) > 1
    ) {
      kind = "screen_print_multi_color";
    }

    const locations = (
      rawDecoration.locations ||
      (rawDecoration.location ? [rawDecoration.location] : [])
    )
      .map((location) => String(location) as DecorationLocation)
      .filter((location) => validLocations.has(location));
    const safeLocations = locations.length > 0 ? locations : ["other" as const];

    for (const location of safeLocations) {
      const key = `${kind}:${location}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push({
        kind,
        location,
        size: normalizePrintSize(rawDecoration.size),
        confidence,
        source: "image_analysis",
        artworkType: null,
      });
    }
  }

  return normalized;
};

const normalizeAccessories = (rawAccessories: RawAccessory[] | undefined) => {
  const counts = new Map<
    AccessoryKind,
    { count: number; confidence: number }
  >();

  for (const rawAccessory of rawAccessories || []) {
    const kind = String(rawAccessory.kind || "") as AccessoryKind;
    const confidence = clampConfidence(rawAccessory.confidence);
    const count = Math.min(
      50,
      Math.max(0, Math.round(Number(rawAccessory.count) || 0)),
    );
    if (
      !validAccessoryKinds.has(kind) ||
      confidence < 0.55 ||
      count === 0
    ) {
      continue;
    }

    const current = counts.get(kind);
    if (!current || count > current.count) {
      counts.set(kind, { count, confidence });
    }
  }

  return Array.from(counts.entries()).map(([kind, value]) => ({
    kind,
    count: value.count,
    confidence: value.confidence,
  }));
};

type PricingContext = {
  garmentRows: GarmentPriceRow[];
  decorationRows: DecorationPriceRow[];
  materialRows: MaterialSurchargeRow[];
  accessoryRows: AccessoryPriceRow[];
  availableKeys: Set<string>;
};

/**
 * Category/material/decoration/accessory resolution for one item — everything that does NOT
 * depend on the shared quantity yet. Mirrors the original single-item pipeline exactly; the only
 * change from the pre-multi-item version is that this is now a function instead of inline code,
 * so it can run once per detected item.
 */
const resolveItem = (
  rawAnalysis: RawAnalysis,
  selectedType: string,
  selectedMaterial: string,
  uploadedArtworkHint: UploadedArtworkHint | null,
  ctx: PricingContext,
) => {
  const { garmentRows, decorationRows, materialRows, accessoryRows, availableKeys } = ctx;

  const garmentResolution = resolveGarmentCategory(
    rawAnalysis,
    selectedType,
    availableKeys,
  );
  const garmentPrice = garmentRows.find(
    (row) => row.category_key === garmentResolution.priceKey,
  );
  if (!garmentPrice) {
    throw new Error("분석된 의류 종류의 단가를 찾지 못했습니다.");
  }
  const garment: GarmentPriceRow = {
    ...garmentPrice,
    category_key: garmentResolution.categoryKey,
    category_label: garmentResolution.label || garmentPrice.category_label,
    pricing_note: [garmentResolution.referenceNote, garmentPrice.pricing_note]
      .filter(Boolean)
      .join(" ") || null,
  };
  const isKnit = garment.category_key === "knit";

  const selectedMaterialValue = String(selectedMaterial).trim().toLowerCase();
  const normalizedSelectedMaterial =
    selectedMaterialValue === "poly" || selectedMaterialValue === "폴리"
      ? "polyester"
      : /레더|가죽/.test(selectedMaterialValue)
        ? "leather"
        : selectedMaterialValue === "니트"
          ? "knit"
          : selectedMaterialValue;
  const rawMaterialKey = String(rawAnalysis.materialKey || "other")
    .trim()
    .toLowerCase();
  const resolvedMaterialKey =
    normalizedSelectedMaterial || rawMaterialKey || "other";
  const resolvedMaterialLabel =
    materialLabels[resolvedMaterialKey] ||
    String(rawAnalysis.materialLabel || "").trim() ||
    resolvedMaterialKey;
  const resolvedMaterialConfidence = normalizedSelectedMaterial
    ? 1
    : clampConfidence(rawAnalysis.materialConfidence);
  const resolvedMaterialComposition = normalizedSelectedMaterial
    ? resolvedMaterialLabel
    : String(rawAnalysis.materialComposition || "").trim() ||
      `${resolvedMaterialLabel} 추정`;
  const materialSearchValue =
    `${resolvedMaterialKey} ${resolvedMaterialLabel}`.toLowerCase();
  const materialPremium = materialRows.find((row) => {
    if (row.material_key.toLowerCase() === resolvedMaterialKey) return true;
    return row.aliases.some((alias) => {
      const normalizedAlias = alias.trim().toLowerCase();
      return materialSearchValue.includes(normalizedAlias);
    });
  }) || null;

  let normalizedDecorations = normalizeDecorations(rawAnalysis.decorations);
  const hasWashingSignal =
    Boolean(rawAnalysis.hasWashing) &&
    clampConfidence(rawAnalysis.washingConfidence) >= 0.55;
  if (
    hasWashingSignal &&
    !normalizedDecorations.some((decoration) => decoration.kind === "washing")
  ) {
    normalizedDecorations.push({
      kind: "washing",
      location: "other",
      size: "unknown",
      confidence: clampConfidence(rawAnalysis.washingConfidence),
      source: "image_analysis",
      artworkType: null,
    });
  }
  if (uploadedArtworkHint) {
    normalizedDecorations = normalizedDecorations.filter(
      (decoration) =>
        decoration.location !== uploadedArtworkHint.location ||
        !printableDecorationKinds.has(decoration.kind),
    );
    normalizedDecorations.push({
      kind: isKnit ? "patch" : uploadedArtworkHint.recommendedKind,
      location: uploadedArtworkHint.location,
      size: "unknown",
      confidence: uploadedArtworkHint.confidence,
      source: "uploaded_artwork",
      artworkType: uploadedArtworkHint.artworkType,
    });
  }
  if (isKnit) {
    normalizedDecorations = normalizedDecorations.map((decoration) =>
      knitPatchRequiredKinds.has(decoration.kind)
        ? { ...decoration, kind: "patch" }
        : decoration
    );
  }
  const hasWashing = normalizedDecorations.some(
    (decoration) => decoration.kind === "washing",
  );
  const hasDyeing = normalizedDecorations.some(
    (decoration) => decoration.kind === "pigment",
  );
  const decorationLines = normalizedDecorations.flatMap((decoration) => {
    const pricingKind =
      decoration.kind === "pigment" ? "washing" : decoration.kind;
    const price = decorationRows.find((row) =>
      row.analysis_kinds.includes(pricingKind)
    );
    if (!price) {
      return [{
        kind: decoration.kind,
        label: decoration.kind === "label" ? "라벨 부착" : "기타 후가공",
        location: decoration.location,
        locationLabel: locationLabels[decoration.location],
        size: decoration.size,
        confidence: decoration.confidence,
        unitMin: 0,
        unitMax: 0,
        lineMin: 0,
        lineMax: 0,
        isStartingFrom: false,
        note: "자동 단가가 없어 상담 후 금액이 추가됩니다.",
        source: decoration.source,
        artworkType: decoration.artworkType,
      }];
    }

    return [{
      kind: decoration.kind,
      label:
        decoration.kind === "pigment"
          ? "염색 / 피그먼트 가공"
          : price.price_label,
      location: decoration.location,
      locationLabel:
        decoration.kind === "washing" || decoration.kind === "pigment"
          ? "전체 의류"
          : locationLabels[decoration.location],
      size: decoration.size,
      confidence: decoration.confidence,
      unitMin: price.unit_min,
      unitMax: price.unit_max,
      lineMin: price.unit_min,
      lineMax: price.unit_max,
      isStartingFrom: price.is_starting_from,
      note: price.pricing_note,
      source: decoration.source,
      artworkType: decoration.artworkType,
    }];
  });
  const normalizedAccessories = normalizeAccessories(rawAnalysis.accessories);
  const accessoryLines = normalizedAccessories.flatMap((accessory) => {
    const price = accessoryRows.find(
      (row) => row.accessory_key === accessory.kind,
    );
    if (!price) return [];

    return [{
      kind: accessory.kind,
      label: price.accessory_label,
      count: accessory.count,
      confidence: accessory.confidence,
      unitPrice: price.unit_price,
      lineTotal: price.unit_price * accessory.count,
      note: price.pricing_note,
    }];
  });

  const decorationMin = decorationLines.reduce((sum, line) => sum + line.lineMin, 0);
  const decorationMax = decorationLines.reduce((sum, line) => sum + line.lineMax, 0);
  const accessoryUnitTotal = accessoryLines.reduce((sum, line) => sum + line.lineTotal, 0);
  const printPlateCount = decorationLines.filter(
    (line) =>
      line.kind !== "embroidery" &&
      line.kind !== "patch" &&
      line.kind !== "label" &&
      line.kind !== "washing" &&
      line.kind !== "pigment",
  ).length;
  const embroiderySampleCount = decorationLines.filter((line) => line.kind === "embroidery").length;
  const dyeingSampleCount = decorationLines.filter((line) => line.kind === "pigment").length;
  const washingSampleCount = decorationLines.filter((line) => line.kind === "washing").length;
  const hasPrinting = printPlateCount > 0;
  const hasEmbroidery = embroiderySampleCount > 0;
  const printPlateCost = printPlateCount * 30000;
  const embroiderySampleCost = embroiderySampleCount * 50000;
  const dyeingSampleCost = dyeingSampleCount * 50000;
  const washingSampleCost = washingSampleCount * 50000;
  const decorationDevelopmentCost =
    printPlateCost + embroiderySampleCost + dyeingSampleCost + washingSampleCost;
  const productionUnitSurcharge = materialPremium?.production_unit_surcharge || 0;
  const productionOriginalMin =
    garment.production_min === null ? null : garment.production_min + productionUnitSurcharge;
  const productionOriginalMax =
    garment.production_max === null ? null : garment.production_max + productionUnitSurcharge;
  const minimumOrderQuantity = resolveMinimumOrderQuantity(
    garment.category_key,
    resolvedMaterialKey,
    garment.moq,
  );
  const sampleSurcharge = materialPremium?.sample_surcharge || 0;
  const sampleCost = garment.sample_cost + sampleSurcharge + decorationDevelopmentCost;
  const categoryConfidence = clampConfidence(rawAnalysis.categoryConfidence);

  const reviewReasons: string[] = [];
  if (garment.production_min === null || garment.production_max === null) {
    reviewReasons.push("엑셀 단가표에 생산공임이 없어 해당 공임은 상담 후 추가됩니다.");
  }
  if (categoryConfidence < 0.6) {
    reviewReasons.push("의류 종류 판단 신뢰도가 낮아 상담 시 카테고리를 확인합니다.");
  }
  if (normalizedDecorations.some((decoration) => decoration.kind === "unknown_print")) {
    reviewReasons.push("기법이 불분명한 프린팅은 실크스크린 1도 기준으로 계산했습니다.");
  }
  if (normalizedDecorations.some((decoration) => decoration.kind === "label")) {
    reviewReasons.push("라벨 부착은 사양에 따라 단가가 달라 상담 후 금액이 추가됩니다.");
  }
  if (resolvedMaterialConfidence < 0.6) {
    reviewReasons.push("소재 판단 신뢰도가 낮아 실제 원단 확인 후 견적이 달라질 수 있습니다.");
  }

  const totalIsStartingFrom =
    garment.production_is_starting_from || decorationLines.some((line) => line.isStartingFrom);

  return {
    garment,
    isKnit,
    minimumOrderQuantity,
    material: {
      key: resolvedMaterialKey,
      label: resolvedMaterialLabel,
      confidence: resolvedMaterialConfidence,
      composition: resolvedMaterialComposition,
    },
    materialPremium: materialPremium
      ? {
        key: materialPremium.material_key,
        label: materialPremium.material_label,
        sampleSurcharge,
        productionUnitSurcharge,
        note: materialPremium.pricing_note,
      }
      : null,
    decorationLines,
    accessoryLines,
    decorationMin,
    decorationMax,
    accessoryUnitTotal,
    printPlateCount,
    printPlateCost,
    embroiderySampleCount,
    embroiderySampleCost,
    dyeingSampleCount,
    dyeingSampleCost,
    washingSampleCount,
    washingSampleCost,
    decorationDevelopmentCost,
    productionUnitSurcharge,
    productionOriginalMin,
    productionOriginalMax,
    sampleCost,
    categoryConfidence,
    analysis: {
      categoryKey: garment.category_key,
      categoryLabel: garment.category_label,
      categoryConfidence,
      hasLining: Boolean(rawAnalysis.hasLining),
      difficulty: normalizeDifficulty(rawAnalysis.difficulty),
      difficultyReason:
        String(rawAnalysis.difficultyReason || "").trim() || "기본 봉제 난이도로 판단했습니다.",
      hasPrinting,
      hasEmbroidery,
      hasDyeing,
      hasWashing,
      detectedDecorationCount: decorationLines.length,
      detectedAccessoryCount: accessoryLines.reduce((sum, line) => sum + line.count, 0),
      features: (rawAnalysis.features || [])
        .map((feature) => String(feature).trim())
        .filter(Boolean)
        .slice(0, 12),
    },
    totalIsStartingFrom,
    reviewReasons,
  };
};

type ResolvedItem = ReturnType<typeof resolveItem>;

/** Quantity-dependent totals for one item, at the shared quantity applied to the whole set. */
const priceItem = (resolved: ResolvedItem, quantity: number) => {
  const productionDiscountRate = resolved.isKnit ? 0 : getProductionDiscountRate(quantity);
  const productionMin =
    resolved.productionOriginalMin === null
      ? null
      : Math.round(resolved.productionOriginalMin * (1 - productionDiscountRate));
  const productionMax =
    resolved.productionOriginalMax === null
      ? null
      : Math.round(resolved.productionOriginalMax * (1 - productionDiscountRate));
  const knownProductionMin = productionMin ?? 0;
  const knownProductionMax = productionMax ?? 0;
  const productionTotalMin = knownProductionMin * quantity;
  const productionTotalMax = knownProductionMax * quantity;
  const decorationTotalMin = resolved.decorationMin * quantity;
  const decorationTotalMax = resolved.decorationMax * quantity;
  const accessoryTotal = resolved.accessoryUnitTotal * quantity;
  const directUnitMin = knownProductionMin + resolved.decorationMin + resolved.accessoryUnitTotal;
  const directUnitMax = knownProductionMax + resolved.decorationMax + resolved.accessoryUnitTotal;
  const developmentTotal = resolved.garment.pattern_cost + resolved.sampleCost;
  const totalMin = productionTotalMin + decorationTotalMin + accessoryTotal + developmentTotal;
  const totalMax = productionTotalMax + decorationTotalMax + accessoryTotal + developmentTotal;

  const reviewReasons = [...resolved.reviewReasons];

  return {
    quantity,
    productionOriginalMin: resolved.productionOriginalMin,
    productionOriginalMax: resolved.productionOriginalMax,
    productionMin,
    productionMax,
    productionIsStartingFrom: resolved.garment.production_is_starting_from,
    productionDiscountRate,
    productionUnitSurcharge: resolved.productionUnitSurcharge,
    productionTotalMin,
    productionTotalMax,
    patternCost: resolved.garment.pattern_cost,
    baseSampleCost: resolved.garment.sample_cost,
    sampleCost: resolved.sampleCost,
    sampleSurcharge: resolved.materialPremium?.sampleSurcharge || 0,
    printPlateCount: resolved.printPlateCount,
    printPlateCost: resolved.printPlateCost,
    embroiderySampleCount: resolved.embroiderySampleCount,
    embroiderySampleCost: resolved.embroiderySampleCost,
    dyeingSampleCount: resolved.dyeingSampleCount,
    dyeingSampleCost: resolved.dyeingSampleCost,
    washingSampleCount: resolved.washingSampleCount,
    washingSampleCost: resolved.washingSampleCost,
    decorationDevelopmentCost: resolved.decorationDevelopmentCost,
    developmentTotal,
    decorationMin: resolved.decorationMin,
    decorationMax: resolved.decorationMax,
    decorationTotalMin,
    decorationTotalMax,
    accessoryUnitTotal: resolved.accessoryUnitTotal,
    accessoryTotal,
    directUnitMin,
    directUnitMax,
    totalMin,
    totalMax,
    effectiveUnitMin: Math.ceil(totalMin / quantity),
    effectiveUnitMax: Math.ceil(totalMax / quantity),
    totalIsStartingFrom: resolved.totalIsStartingFrom,
    reviewReasons,
  };
};

const sumOrNull = (values: Array<number | null>) =>
  values.some((value) => value === null)
    ? null
    : (values as number[]).reduce((sum, value) => sum + value, 0);

const difficultyRank: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };
const worstDifficulty = (values: Difficulty[]): Difficulty =>
  values.reduce((worst, value) => (difficultyRank[value] > difficultyRank[worst] ? value : worst), "easy" as Difficulty);

/**
 * Pure pricing pipeline, no I/O: takes the (already AI- or manually-derived) per-item raw
 * analyses plus the price catalog rows and builds the full multi-item estimate, including the
 * backward-compatible aggregate top-level view. Kept separate from the HTTP handler so it can be
 * exercised directly in tests without Deno/Gemini/Supabase.
 */
const buildEstimate = (
  rawItems: RawAnalysis[],
  selectedType: string,
  selectedMaterial: string,
  requestedQuantity: number,
  uploadedArtworkHint: UploadedArtworkHint | null,
  garmentRows: GarmentPriceRow[],
  decorationRows: DecorationPriceRow[],
  materialRows: MaterialSurchargeRow[],
  accessoryRows: AccessoryPriceRow[],
) => {
  if (rawItems.length === 0) {
    throw new Error("이미지에서 제작 가능한 의류를 찾지 못했습니다.");
  }

  const availableKeys = new Set(garmentRows.map((row) => row.category_key));
  const pricingContext: PricingContext = {
    garmentRows,
    decorationRows,
    materialRows,
    accessoryRows,
    availableKeys,
  };

  // Only the first/primary item gets the selected-type/material hints and the uploaded-artwork
  // override — matching the exact single-item behavior from before this feature existed.
  const resolvedItems = rawItems.map((rawItem, index) =>
    resolveItem(
      rawItem,
      index === 0 ? selectedType : "",
      index === 0 ? selectedMaterial : "",
      index === 0 ? uploadedArtworkHint : null,
      pricingContext,
    )
  );

  // A set is only as small as its most demanding item — you can't produce fewer jackets than
  // the jacket's own MOQ just because the paired pants allow a smaller batch.
  const overallMinimumOrderQuantity = Math.max(
    ...resolvedItems.map((item) => item.minimumOrderQuantity),
  );
  const quantity = normalizeEstimateQuantity(
    requestedQuantity,
    overallMinimumOrderQuantity,
  );

  const pricedItems = resolvedItems.map((resolved, index) => {
    const { reviewReasons, ...totals } = priceItem(resolved, quantity);
    const itemLabel = resolved.garment.category_label;
    return {
      itemIndex: index,
      itemLabel,
      analysis: resolved.analysis,
      garment: {
        key: resolved.garment.category_key,
        label: resolved.garment.category_label,
        moq: resolved.minimumOrderQuantity,
        note: [
          resolved.garment.pricing_note,
          resolved.minimumOrderQuantity > resolved.garment.moq
            ? "레더 자켓은 MOQ 총 100장 이상입니다."
            : null,
        ].filter(Boolean).join(" ") || null,
      },
      material: resolved.material,
      materialPremium: resolved.materialPremium,
      decorations: resolved.decorationLines,
      accessories: resolved.accessoryLines,
      totals,
      isPartial: totals.productionMin === null || totals.productionMax === null,
      manualReviewReasons: reviewReasons,
    };
  });

  // Aggregate ("SET TOTAL") view: sums every item's own totals so it is always internally
  // consistent with the per-item breakdown, and — for the single-item case — is byte-for-byte
  // identical to what the pre-multi-item pipeline used to return at the top level.
  const primary = pricedItems[0];
  const aggTotals = {
    quantity,
    productionOriginalMin: sumOrNull(pricedItems.map((item) => item.totals.productionOriginalMin)),
    productionOriginalMax: sumOrNull(pricedItems.map((item) => item.totals.productionOriginalMax)),
    productionMin: sumOrNull(pricedItems.map((item) => item.totals.productionMin)),
    productionMax: sumOrNull(pricedItems.map((item) => item.totals.productionMax)),
    productionIsStartingFrom: pricedItems.some((item) => item.totals.productionIsStartingFrom),
    productionDiscountRate: primary.totals.productionDiscountRate,
    productionUnitSurcharge: pricedItems.reduce((sum, item) => sum + item.totals.productionUnitSurcharge, 0),
    productionTotalMin: pricedItems.reduce((sum, item) => sum + item.totals.productionTotalMin, 0),
    productionTotalMax: pricedItems.reduce((sum, item) => sum + item.totals.productionTotalMax, 0),
    patternCost: pricedItems.reduce((sum, item) => sum + item.totals.patternCost, 0),
    baseSampleCost: pricedItems.reduce((sum, item) => sum + item.totals.baseSampleCost, 0),
    sampleCost: pricedItems.reduce((sum, item) => sum + item.totals.sampleCost, 0),
    sampleSurcharge: pricedItems.reduce((sum, item) => sum + item.totals.sampleSurcharge, 0),
    printPlateCount: pricedItems.reduce((sum, item) => sum + item.totals.printPlateCount, 0),
    printPlateCost: pricedItems.reduce((sum, item) => sum + item.totals.printPlateCost, 0),
    embroiderySampleCount: pricedItems.reduce((sum, item) => sum + item.totals.embroiderySampleCount, 0),
    embroiderySampleCost: pricedItems.reduce((sum, item) => sum + item.totals.embroiderySampleCost, 0),
    dyeingSampleCount: pricedItems.reduce((sum, item) => sum + item.totals.dyeingSampleCount, 0),
    dyeingSampleCost: pricedItems.reduce((sum, item) => sum + item.totals.dyeingSampleCost, 0),
    washingSampleCount: pricedItems.reduce((sum, item) => sum + item.totals.washingSampleCount, 0),
    washingSampleCost: pricedItems.reduce((sum, item) => sum + item.totals.washingSampleCost, 0),
    decorationDevelopmentCost: pricedItems.reduce((sum, item) => sum + item.totals.decorationDevelopmentCost, 0),
    developmentTotal: pricedItems.reduce((sum, item) => sum + item.totals.developmentTotal, 0),
    decorationMin: pricedItems.reduce((sum, item) => sum + item.totals.decorationMin, 0),
    decorationMax: pricedItems.reduce((sum, item) => sum + item.totals.decorationMax, 0),
    decorationTotalMin: pricedItems.reduce((sum, item) => sum + item.totals.decorationTotalMin, 0),
    decorationTotalMax: pricedItems.reduce((sum, item) => sum + item.totals.decorationTotalMax, 0),
    accessoryUnitTotal: pricedItems.reduce((sum, item) => sum + item.totals.accessoryUnitTotal, 0),
    accessoryTotal: pricedItems.reduce((sum, item) => sum + item.totals.accessoryTotal, 0),
    directUnitMin: pricedItems.reduce((sum, item) => sum + item.totals.directUnitMin, 0),
    directUnitMax: pricedItems.reduce((sum, item) => sum + item.totals.directUnitMax, 0),
    totalMin: pricedItems.reduce((sum, item) => sum + item.totals.totalMin, 0),
    totalMax: pricedItems.reduce((sum, item) => sum + item.totals.totalMax, 0),
    totalIsStartingFrom: pricedItems.some((item) => item.totals.totalIsStartingFrom),
  };
  const effectiveUnitMin = Math.ceil(aggTotals.totalMin / quantity);
  const effectiveUnitMax = Math.ceil(aggTotals.totalMax / quantity);

  const aggGarment = pricedItems.length === 1
    ? primary.garment
    : {
      key: pricedItems.map((item) => item.garment.key).join("+"),
      label: pricedItems.map((item) => `${item.itemLabel}`).join(" + "),
      moq: overallMinimumOrderQuantity,
      note: pricedItems
        .map((item) => item.garment.note)
        .filter(Boolean)
        .join(" ") || null,
    };
  const aggAnalysis = pricedItems.length === 1
    ? primary.analysis
    : {
      categoryKey: pricedItems.map((item) => item.analysis.categoryKey).join("+"),
      categoryLabel: aggGarment.label,
      categoryConfidence: Math.min(...pricedItems.map((item) => item.analysis.categoryConfidence)),
      hasLining: pricedItems.some((item) => item.analysis.hasLining),
      difficulty: worstDifficulty(pricedItems.map((item) => item.analysis.difficulty)),
      difficultyReason: pricedItems
        .map((item) => `${item.itemLabel}: ${item.analysis.difficultyReason}`)
        .join(" / "),
      hasPrinting: pricedItems.some((item) => item.analysis.hasPrinting),
      hasEmbroidery: pricedItems.some((item) => item.analysis.hasEmbroidery),
      hasDyeing: pricedItems.some((item) => item.analysis.hasDyeing),
      hasWashing: pricedItems.some((item) => item.analysis.hasWashing),
      detectedDecorationCount: pricedItems.reduce((sum, item) => sum + item.analysis.detectedDecorationCount, 0),
      detectedAccessoryCount: pricedItems.reduce((sum, item) => sum + item.analysis.detectedAccessoryCount, 0),
      features: Array.from(new Set(pricedItems.flatMap((item) => item.analysis.features))).slice(0, 24),
    };
  const aggDecorations = pricedItems.length === 1
    ? primary.decorations
    : pricedItems.flatMap((item) =>
      item.decorations.map((decoration) => ({
        ...decoration,
        itemIndex: item.itemIndex,
        itemLabel: item.itemLabel,
      }))
    );
  const aggAccessories = pricedItems.length === 1
    ? primary.accessories
    : pricedItems.flatMap((item) =>
      item.accessories.map((accessory) => ({
        ...accessory,
        itemIndex: item.itemIndex,
        itemLabel: item.itemLabel,
      }))
    );
  const aggManualReviewReasons = pricedItems.length === 1
    ? primary.manualReviewReasons
    : Array.from(
      new Set(
        pricedItems.flatMap((item) =>
          item.manualReviewReasons.map((reason) => `${item.itemLabel}: ${reason}`)
        ),
      ),
    );
  if (pricedItems.length > 1) {
    aggManualReviewReasons.unshift(
      `이미지에서 ${pricedItems.length}개의 제작 품목(${pricedItems.map((item) => item.itemLabel).join(", ")})을 감지해 각각 분석하고 합산했습니다. 잘못 감지된 품목이 있다면 체크를 해제해 견적에서 제외할 수 있습니다.`,
    );
  }

  const sourceRow = garmentRows[0];
  return {
    sourceFile: sourceRow.source_file,
    sourceVersion: sourceRow.source_version,
    generatedAt: new Date().toISOString(),
    currency: "KRW",
    analysis: aggAnalysis,
    garment: aggGarment,
    material: primary.material,
    materialPremium: primary.materialPremium,
    decorations: aggDecorations,
    accessories: aggAccessories,
    totals: { ...aggTotals, effectiveUnitMin, effectiveUnitMax },
    isPartial: pricedItems.some((item) => item.isPartial),
    manualReviewReasons: aggManualReviewReasons,
    items: pricedItems,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      imageUrl = "",
      imageBase64 = "",
      imageMimeType = "",
      selectedType = "",
      selectedMaterial = "",
      designContext = "",
      uploadedArtwork,
      manualAnalysis,
      quantity: requestedQuantity = 20,
    } = await req.json();
    const normalizedManualAnalysis = normalizeManualAnalysis(manualAnalysis);
    if (!normalizedManualAnalysis && !imageUrl && !imageBase64) {
      return new Response(
        JSON.stringify({ error: "분석할 이미지가 필요합니다." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || "";
    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      (!normalizedManualAnalysis && !geminiApiKey)
    ) {
      throw new Error("자동 견적 서비스 환경변수가 설정되지 않았습니다.");
    }

    const uploadedArtworkHint = normalizeUploadedArtwork(uploadedArtwork);
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const [
      garmentResult,
      decorationResult,
      materialResult,
      accessoryResult,
    ] = await Promise.all([
      supabase
        .from("quote_garment_prices")
        .select(
          "category_key,category_label,production_min,production_max,production_is_starting_from,pattern_cost,sample_cost,moq,pricing_note,source_file,source_version",
        )
        .eq("active", true),
      supabase
        .from("quote_decoration_prices")
        .select(
          "price_key,price_label,analysis_kinds,unit_min,unit_max,is_starting_from,pricing_note,source_file,source_version",
        )
        .eq("active", true),
      supabase
        .from("quote_material_surcharges")
        .select(
          "material_key,material_label,aliases,sample_surcharge,production_unit_surcharge,pricing_note",
        )
        .eq("active", true),
      supabase
        .from("quote_accessory_prices")
        .select(
          "accessory_key,accessory_label,unit_price,pricing_note,source_label,source_version",
        )
        .eq("active", true),
    ]);

    if (garmentResult.error) throw garmentResult.error;
    if (decorationResult.error) throw decorationResult.error;
    if (materialResult.error) throw materialResult.error;
    if (accessoryResult.error) throw accessoryResult.error;

    const garmentRows = (garmentResult.data || []) as GarmentPriceRow[];
    const decorationRows = (decorationResult.data || []) as DecorationPriceRow[];
    const materialRows = (materialResult.data || []) as MaterialSurchargeRow[];
    const accessoryRows = (accessoryResult.data || []) as AccessoryPriceRow[];
    if (garmentRows.length === 0) {
      throw new Error("의류 단가 데이터가 없습니다.");
    }

    let imageBuffer: ArrayBuffer | null = null;
    let resolvedImageMimeType = "image/png";

    if (!normalizedManualAnalysis && imageBase64) {
      resolvedImageMimeType = String(imageMimeType || "").toLowerCase();
      if (!allowedImageMimeTypes.has(resolvedImageMimeType)) {
        throw new Error("PNG, JPG, JPEG, WEBP 이미지만 분석할 수 있습니다.");
      }
      const bytes = decodeBase64Image(String(imageBase64));
      if (bytes.byteLength > 10 * 1024 * 1024) {
        throw new Error("10MB 이하 이미지만 분석할 수 있습니다.");
      }
      imageBuffer = bytes.buffer;
    } else if (!normalizedManualAnalysis && imageUrl) {
      const parsedImageUrl = new URL(imageUrl);
      const storageHostname = new URL(supabaseUrl).hostname;
      if (
        parsedImageUrl.protocol !== "https:" ||
        parsedImageUrl.hostname !== storageHostname
      ) {
        throw new Error("분석할 수 없는 이미지 주소입니다.");
      }

      const imageResponse = await fetch(parsedImageUrl.toString());
      if (!imageResponse.ok) {
        throw new Error(`이미지를 불러오지 못했습니다: ${imageResponse.status}`);
      }
      const contentLength = Number(
        imageResponse.headers.get("content-length") || 0,
      );
      if (contentLength > 10 * 1024 * 1024) {
        throw new Error("10MB 이하 이미지만 분석할 수 있습니다.");
      }
      resolvedImageMimeType =
        imageResponse.headers.get("content-type") || "image/png";
      imageBuffer = await imageResponse.arrayBuffer();
      if (imageBuffer.byteLength > 10 * 1024 * 1024) {
        throw new Error("10MB 이하 이미지만 분석할 수 있습니다.");
      }
    }

    const availableCategories = [
      ...garmentRows.map((row) => `${row.category_key}: ${row.category_label}`),
      ...virtualGarmentCategories.map(
        (category) => `${category.key}: ${category.label}`,
      ),
    ].join("\n");
    let rawItems: RawAnalysis[];

    if (normalizedManualAnalysis) {
      // Manual override (from the "AI 분석 결과 확인" edit UI) is always exactly one item —
      // that flow edits a single garment's fields directly and never introduces new items.
      rawItems = [normalizedManualAnalysis];
    } else {
      if (!imageBuffer) {
        throw new Error("AI가 분석할 이미지 데이터가 없습니다.");
      }
      const analysisPrompt = `
You are a Korean apparel production specialist. Inspect the supplied ecommerce
garment image. It may show one garment (possibly with front and back views in
one frame), or a full outfit / set with multiple independent garments (for
example a jacket with pants, or a hoodie with jogger pants).

Step 1 — figure out how many physically separate garments are actually being
offered for production, not how many rendered views appear in the image.
- The SAME garment shown from the front and from the back is still one item.
  Example: "hoodie front + hoodie back" → 1 item, not 2.
- Genuinely different garments are separate items, even if each also has its
  own front/back views. Example: "jacket front, jacket back, pants front,
  pants back" → 2 items (jacket, pants), not 4.
- Only split into multiple items when you can identify each as a distinct,
  independently producible garment (different category, e.g. top vs bottom,
  outer vs top). Do not invent a second item from color blocking, layering
  within the same single garment, or a printed graphic that merely depicts
  another garment.
- If you are not confident whether two regions are the same garment's two
  views or two different garments, prefer treating them as two views of one
  garment (the less speculative reading) and lower that item's
  categoryConfidence instead of guessing a split.

Step 2 — for EACH separate item you identified, produce one full analysis
object with this exact shape:
{
  "categoryKey": "one allowed category key",
  "categoryConfidence": 0.0,
  "materialKey": "cotton | polyester | functional | linen | denim | leather | knit | other",
  "materialLabel": "short Korean material label",
  "materialConfidence": 0.0,
  "materialComposition": "visible/estimated composition such as 면 100% or 기능성 폴리 혼방",
  "hasLining": false,
  "hasWashing": false,
  "washingConfidence": 0.0,
  "difficulty": "easy | medium | hard",
  "difficultyReason": "short Korean reason",
  "decorations": [
    {
      "kind": "screen_print_1_color | screen_print_multi_color | dtf | dtg | pu | silicone_print | embroidery | patch | transfer | label | pigment | unknown_print",
      "locations": ["front | back | left_sleeve | right_sleeve | neck | other"],
      "size": "small | medium | large | unknown",
      "colorCount": 1,
      "confidence": 0.0
    }
  ],
  "accessories": [
    {
      "kind": "stud | zipper | button | rivet | hood_cord | snap_button | buckle | drawstring",
      "count": 1,
      "confidence": 0.0
    }
  ],
  "features": ["short Korean visible construction feature, for example 캥거루 포켓"]
}

Return JSON only, with this exact top-level shape wrapping every item you found:
{
  "items": [ <one object per distinct garment, shape above> ]
}
Always return the "items" array, even when there is only one garment — put
that single analysis object as the only entry.

CRITICAL: decorations and accessories inside one item must describe ONLY
that garment. Never repeat a jacket's chest embroidery inside the pants
item, and never let a pants item's leg print bleed into a top item. Each
item is analyzed and priced completely independently downstream.

Allowed garment categories:
${availableCategories}

Rules:
- The image is authoritative. Use the selected type only as a fallback hint,
  and only for the first / primary item.
- Distinguish leggings from bottom tights. For tights, choose the exact
  short-sleeve, long-sleeve, or bottom tights category.
- Estimate the most likely material from visible texture and garment purpose.
  Use functional for compression and performance fabrics. Do not claim an exact
  fiber percentage unless it is visually clear; otherwise describe it as 추정.
- Count every visibly separate front, back, sleeve, and neck decoration.
- A visible graphic, logo, lettering, or motif is a decoration even when the
  exact technique is uncertain. Use unknown_print in that case.
- For knitwear, every visible or uploaded logo/graphic must be patch. Never
  return printing, transfer, direct embroidery, PU, or silicone for knitwear.
- If the design context explicitly names a printing technique or location, use
  it to distinguish visually similar methods unless the image contradicts it.
- Return pigment for a visible pigment-dyed or pigment-washed finish, label for
  a visibly attached brand/care label, and include print size for each item.
- Do not mark fabric texture, seams, pockets, buttons, or zippers as printing.
- Inspect the actual image for every visible accessory and return its per-garment
  count in accessories.
- Count a complete zipper closure as one zipper, never individual teeth or the
  zipper pull.
- Count each visible normal button, snap button, stud, denim rivet, and buckle
  separately.
- Count a pair/set of hood cords on one garment as one hood_cord.
- Count a pair/set of non-hood waist or hem cords as one drawstring.
- Do not count eyelets, cord tips, seams, printed drawings of hardware, or
  accessories that are not actually visible.
- Do not count the same accessory twice when front and back views of the same
  garment appear together.
- Distinguish stud from denim rivet, button from snap_button, and hood_cord from
  drawstring. If uncertain, lower confidence instead of guessing.
- Mark hasWashing true only when the finished garment visibly shows deliberate
  washing effects such as fading, whiskers, abrasion, stone wash, acid wash,
  uneven washed color, or a clearly washed vintage finish. A plain solid denim
  or leather color without these effects is not washing.
- Use hard for complex paneling, lining, tailoring, padding, layered
  construction, numerous pockets, unusual cut lines, or difficult sewing.
- List visible construction features such as 캥거루 포켓, 포켓, 안감, 후드,
  절개, 패널링 in features. Do not duplicate priced accessories there.
- Inspect every garment visible anywhere in the frame, front and back alike.
${uploadedArtworkHint
      ? `- A separately verified customer-uploaded ${uploadedArtworkHint.artworkType} artwork was applied at ${uploadedArtworkHint.location} on the first / primary item. Treat it as ${/니트|knit/i.test(String(selectedType)) ? "patch" : uploadedArtworkHint.recommendedKind} on that item even if the composite image makes the technique visually ambiguous.`
      : ""}

Selected type hint (primary item only): ${selectedType}
Selected material hint (primary item only): ${selectedMaterial}
Design context:
${String(designContext).slice(0, 3000)}
`.trim();

      const geminiModels = [
        "gemini-3-flash-preview",
        "gemini-3-pro-preview",
        "gemini-3-pro-image-preview",
      ];
      const geminiRequestBody = JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: analysisPrompt },
              {
                inlineData: {
                  data: arrayBufferToBase64(imageBuffer),
                  mimeType: resolvedImageMimeType,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      let geminiResponse: Response | null = null;
      const modelErrors: string[] = [];

      for (const model of geminiModels) {
        const candidateResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: geminiRequestBody,
          },
        );

        if (candidateResponse.ok) {
          geminiResponse = candidateResponse;
          break;
        }

        const responseBody = await candidateResponse.text();
        modelErrors.push(
          `${model}: ${candidateResponse.status} ${responseBody}`,
        );

        if (![400, 404].includes(candidateResponse.status)) {
          break;
        }
      }

      if (!geminiResponse) {
        throw new Error(`AI 이미지 분석 실패: ${modelErrors.join(" | ")}`);
      }

      const geminiData = await geminiResponse.json();
      const responseText = (geminiData?.candidates?.[0]?.content?.parts || [])
        .map((part: { text?: string }) => part.text || "")
        .join("")
        .trim();
      if (!responseText) {
        throw new Error("AI가 이미지 분석 결과를 반환하지 않았습니다.");
      }

      rawItems = extractRawItems(parseJsonResponse(responseText));
    }

    const estimate = buildEstimate(
      rawItems,
      selectedType,
      selectedMaterial,
      requestedQuantity,
      uploadedArtworkHint,
      garmentRows,
      decorationRows,
      materialRows,
      accessoryRows,
    );

    return new Response(JSON.stringify({ estimate }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-production-estimate error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "자동 견적 분석 중 오류가 발생했습니다.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
