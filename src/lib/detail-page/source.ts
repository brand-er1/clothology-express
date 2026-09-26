import type {
  DetailDecoration,
  DetailPageSource,
  DetailUserProvidedInfo,
} from "@/types/detailPage";
import type { BrandWithCreator } from "@/types/brand";
import type { Funding } from "@/types/funding";
import type {
  DecorationAnalysisKind,
  ProductionEstimateResult,
  UploadedArtworkAnalysis,
} from "@/types/productionEstimate";

export const EMPTY_USER_PROVIDED: DetailUserProvidedInfo = {
  price: null,
  composition: "",
  background: "",
  targetCustomer: "",
  careNote: "",
  colorName: "",
  fitNote: "",
  oneLiner: "",
  highlights: "",
  details: "",
  productionNote: "",
  emphasis: [],
};

const decorationKind = (kind: DecorationAnalysisKind): DetailDecoration["kind"] => {
  if (kind === "embroidery") return "embroidery";
  if (kind === "patch" || kind === "label") return "patch";
  if (kind === "washing" || kind === "pigment") return "other";
  return "print";
};

const unique = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const decorationsFromEstimate = (
  estimate: ProductionEstimateResult | null,
  artworks: UploadedArtworkAnalysis[],
): DetailDecoration[] => {
  const fromEstimate = (estimate?.decorations ?? []).map((line) => ({
    kind: decorationKind(line.kind),
    label: line.label,
    location: line.locationLabel,
  }));
  const fromArtworks = fromEstimate.length
    ? []
    : artworks.map((artwork) => ({
        kind: decorationKind(artwork.recommendedKind),
        label: artwork.artworkTypeLabel,
        location: artwork.locationLabel,
      }));
  const seen = new Set<string>();
  return [...fromEstimate, ...fromArtworks].filter((decoration) => {
    const key = `${decoration.kind}:${decoration.location}:${decoration.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const productionMethodText = (countryLabel: string, decorations: DetailDecoration[]) => {
  const methods = unique(decorations.map((decoration) => decoration.label));
  return [countryLabel ? `${countryLabel} 생산` : "", methods.length ? methods.join(", ") : ""]
    .filter(Boolean)
    .join(" · ");
};

const brandFields = (brand: BrandWithCreator | null) => ({
  creatorName: brand?.creator_profile?.display_name ?? "",
  creatorBio: brand?.creator_profile?.bio ?? "",
  creatorImageUrl: brand?.creator_profile?.profile_image_url ?? null,
  brandId: brand?.id ?? null,
  brandName: brand?.brand_name ?? "",
  brandShortDescription: brand?.short_description ?? "",
  brandDescription: brand?.description ?? "",
  brandLogoUrl: brand?.brand_logo_url ?? null,
});

export type DesignDetailSourceInput = {
  imageUrl: string;
  imagePath: string | null;
  clothTypeId: string;
  clothType: string;
  materialId: string;
  material: string;
  colorId: string;
  color: string;
  fitId: string;
  fit: string;
  designDescription: string;
  aiPrompt: string;
  styleOptions: string[];
  estimate: ProductionEstimateResult | null;
  artworkAnalyses: UploadedArtworkAnalysis[];
  productionCountryLabel: string;
  targetQuantity: number | null;
  sizeOptions: string[];
  measurements: Record<string, unknown> | null;
  trademarkScreeningId: string | null;
  designId: string | null;
  brand: BrandWithCreator | null;
};

/** Facts from the /customize design flow. */
export const buildDetailSourceFromDesign = (input: DesignDetailSourceInput): DetailPageSource => {
  const decorations = decorationsFromEstimate(input.estimate, input.artworkAnalyses);
  return {
    imageUrl: input.imageUrl,
    imagePath: input.imagePath,
    isFrontBackComposite: true,
    clothTypeId: input.clothTypeId,
    clothType: input.clothType,
    materialId: input.materialId,
    material: input.material,
    colorId: input.colorId,
    color: input.color,
    fitId: input.fitId,
    fit: input.fit,
    designDescription: input.designDescription,
    aiPrompt: input.aiPrompt,
    styleOptions: unique(input.styleOptions),
    decorations,
    accessories: unique(
      (input.estimate?.accessories ?? []).map((line) =>
        line.count > 1 ? `${line.label} ${line.count}개` : line.label,
      ),
    ),
    constructionFeatures: unique(input.estimate?.analysis.features ?? []),
    productionCountry: input.productionCountryLabel,
    productionMethod: productionMethodText(input.productionCountryLabel, decorations),
    estimateUnitMin: input.estimate?.totals.directUnitMin ?? null,
    estimateUnitMax: input.estimate?.totals.directUnitMax ?? null,
    estimateDevelopmentTotal: input.estimate?.totals.developmentTotal ?? null,
    targetQuantity: input.targetQuantity,
    sizeOptions: input.sizeOptions,
    measurements: input.measurements,
    trademarkScreeningId: input.trademarkScreeningId,
    designId: input.designId,
    ...brandFields(input.brand),
    userProvided: { ...EMPTY_USER_PROVIDED },
  };
};

/** Facts from an existing funding (for fundings created before detail pages existed). */
export const buildDetailSourceFromFunding = (funding: Funding): DetailPageSource => {
  const legacyDescription = (funding.description ?? "")
    .split("\n")
    .map((line) => line.replace(/^디자인 특징:\s*/, "").trim())
    .filter((line) => line && !line.includes("목표 인원이") && !/^(핏|소재):/.test(line))
    .join("\n");
  const fitLine = (funding.description ?? "").match(/^핏:\s*(.+)$/m)?.[1]?.trim() ?? "";
  return {
    imageUrl: funding.image_url,
    imagePath: funding.image_path,
    isFrontBackComposite: true,
    clothTypeId: funding.cloth_type,
    clothType: funding.cloth_type,
    materialId: funding.material,
    material: funding.material,
    colorId: funding.color ?? "",
    color: (funding.color_options?.length ? funding.color_options : [funding.color ?? ""])
      .filter((color) => color && color !== "기본 색상")
      .join(", "),
    fitId: "",
    fit: fitLine,
    designDescription: legacyDescription,
    aiPrompt: "",
    styleOptions: [],
    decorations: [],
    accessories: [],
    constructionFeatures: [],
    productionCountry: "",
    productionMethod: "",
    estimateUnitMin: funding.estimate_direct_unit_min,
    estimateUnitMax: funding.estimate_direct_unit_max,
    estimateDevelopmentTotal: funding.estimate_development_total,
    targetQuantity: funding.moq,
    sizeOptions: funding.size_options ?? [],
    measurements: funding.measurements,
    trademarkScreeningId: funding.trademark_screening_id,
    designId: null,
    ...brandFields(funding.brand ?? null),
    userProvided: { ...EMPTY_USER_PROVIDED, price: funding.price },
  };
};

export const refreshBrandInSource = (
  source: DetailPageSource,
  brand: BrandWithCreator | null,
): DetailPageSource => (brand ? { ...source, ...brandFields(brand) } : source);

export type MissingInfoKey = keyof DetailUserProvidedInfo;

export type MissingInfoField = {
  key: MissingInfoKey;
  label: string;
  placeholder: string;
  required: boolean;
  multiline?: boolean;
};

/** Only asks for what the design flow could not supply. */
export const getMissingInfoFields = (source: DetailPageSource): MissingInfoField[] => {
  const fields: MissingInfoField[] = [];
  if (!source.color) {
    fields.push({ key: "colorName", label: "컬러명", placeholder: "예: 차콜 그레이", required: false });
  }
  if (!source.fit) {
    fields.push({ key: "fitNote", label: "핏 / 실루엣", placeholder: "예: 어깨가 떨어지는 오버핏", required: false });
  }
  fields.push({
    key: "price",
    label: "판매 예정가 (원)",
    placeholder: source.estimateUnitMin
      ? `예상 제작비 ${source.estimateUnitMin.toLocaleString("ko-KR")}원~ 참고`
      : "예: 59000",
    required: false,
  });
  fields.push({
    key: "background",
    label: "제작 배경 / 기획 의도",
    placeholder: "이 옷을 만들게 된 이유를 한두 문장으로 적어주세요.",
    required: false,
    multiline: true,
  });
  fields.push({
    key: "composition",
    label: "원단 혼용률 (확인된 경우만)",
    placeholder: "예: 면 100% — 모르면 비워두세요. AI는 혼용률을 추측하지 않습니다.",
    required: false,
  });
  fields.push({ key: "targetCustomer", label: "추천 대상", placeholder: "예: 데일리 캠퍼스룩을 찾는 20대", required: false });
  fields.push({ key: "careNote", label: "세탁 / 관리 메모", placeholder: "예: 찬물 단독 손세탁 권장", required: false });
  return fields;
};
