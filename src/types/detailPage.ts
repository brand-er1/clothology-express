/**
 * AI product detail page (상세페이지) data model.
 *
 * A detail page is stored as structured data — page fields plus an ordered list of
 * sections — and rendered by a template on the frontend. Generated HTML is never stored,
 * so templates and the mobile layout can change without touching saved pages.
 */

export type DetailPageTemplateId =
  | "minimal"
  | "street"
  | "luxury"
  | "sports"
  | "casual"
  | "vintage"
  | "y2k"
  | "emotional"
  | "lookbook";

/** The five renderer layouts. Newer styles reuse one of them with their own theme tokens. */
export type DetailLayoutId = "minimal" | "street" | "luxury" | "sports" | "casual";

export type DetailPageStatus = "draft" | "ready" | "linked";

export type DetailSectionType =
  | "hero"
  | "story"
  | "design"
  | "detail"
  | "fabric"
  | "fit"
  | "color"
  | "size"
  | "brand"
  | "funding"
  | "production"
  | "notice"
  | "custom_text"
  | "custom_image";

/** Which part of the source image to show. Design images are one frame: left = front, right = back. */
export type DetailImageCrop = "full" | "left" | "right";

export type DetailImageSource = "design" | "upload" | "generated";

export type DetailImage = {
  id: string;
  url: string;
  crop: DetailImageCrop;
  alt: string;
  source: DetailImageSource;
  /**
   * The AI image this slot shows (or will show once generated). A completed generation of
   * this type replaces the image; uploading your own image clears the slot.
   */
  slot?: DetailImageType;
  /** generated_assets row of an AI-generated image. */
  assetId?: string;
};

export type DetailItem = {
  id: string;
  title: string;
  text: string;
};

/** A verified specification row. Only ever filled from `DetailPageSource`, never from AI copy. */
export type DetailFact = {
  label: string;
  value: string;
};

export type DetailSectionBackground = "default" | "white" | "light" | "dark" | "brand";
export type DetailSectionAlign = "default" | "left" | "center";

/** Per-section display overrides chosen in the editor (배경 / 정렬 변경). */
export type DetailSectionLayout = {
  background?: DetailSectionBackground;
  align?: DetailSectionAlign;
};

export type DetailSection = {
  id: string;
  type: DetailSectionType;
  layout?: DetailSectionLayout;
  visible: boolean;
  eyebrow: string;
  title: string;
  description: string;
  items: DetailItem[];
  facts: DetailFact[];
  images: DetailImage[];
};

export type DetailPageDocument = {
  template: DetailPageTemplateId;
  productName: string;
  productNameEn: string;
  /** 한 줄 소개 */
  subtitle: string;
  /** 메인 카피 */
  mainCopy: string;
  sections: DetailSection[];
};

export type DetailDecoration = {
  kind: "print" | "embroidery" | "patch" | "other";
  label: string;
  location: string;
};

/**
 * Facts collected from the design flow / funding. Everything here was chosen or entered by
 * the creator (or measured by the existing estimate), so it may be shown as a specification.
 * `userProvided` holds answers to the "missing information" form.
 */
export type DetailPageSource = {
  imageUrl: string;
  imagePath: string | null;
  /** Whether imageUrl is the two-view (front|back) design frame. */
  isFrontBackComposite: boolean;
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
  decorations: DetailDecoration[];
  accessories: string[];
  constructionFeatures: string[];
  productionCountry: string;
  productionMethod: string;
  estimateUnitMin: number | null;
  estimateUnitMax: number | null;
  estimateDevelopmentTotal: number | null;
  targetQuantity: number | null;
  sizeOptions: string[];
  measurements: Record<string, unknown> | null;
  trademarkScreeningId: string | null;
  designId: string | null;
  creatorName: string;
  creatorBio: string;
  creatorImageUrl: string | null;
  brandId: string | null;
  brandName: string;
  brandShortDescription: string;
  brandDescription: string;
  brandLogoUrl: string | null;
  userProvided: DetailUserProvidedInfo;
  /** 펀딩에 등록된 컬러 옵션 이름(funding_colors). 있으면 AVAILABLE COLORS 섹션이 자동 생성된다. */
  availableColors?: string[];
};

export type DetailEmphasis = "design" | "fit" | "fabric" | "detail" | "process" | "scarcity" | "price" | "brand_story";

export type DetailUserProvidedInfo = {
  price: number | null;
  /** 제품 한 줄 소개 (제작자 입력) */
  oneLiner?: string;
  /** 강조하고 싶은 특징 */
  highlights?: string;
  /** 디테일 (프린팅·자수·지퍼·포켓 등 실제 존재하는 것만) */
  details?: string;
  /** 제작 방식 메모 */
  productionNote?: string;
  /** 강조할 요소 (복수 선택) */
  emphasis?: DetailEmphasis[];
  /** 원단 혼용률 — shown only when the creator typed it. */
  composition: string;
  /** 제작 배경 / 기획 의도 */
  background: string;
  targetCustomer: string;
  careNote: string;
  colorName: string;
  fitNote: string;
};

export type DetailPageGenerationMeta = {
  provider?: "ai" | "fallback";
  generatedAt?: string;
  fallbackReason?: string | null;
};

export type ProductDetailPage = {
  id: string;
  userId: string;
  fundingId: string | null;
  designId: string | null;
  brandId: string | null;
  status: DetailPageStatus;
  source: DetailPageSource;
  generation: DetailPageGenerationMeta;
  document: DetailPageDocument;
  createdAt: string;
  updatedAt: string;
};

/** Live funding numbers the FUNDING section renders; never stored in the page. */
export type DetailFundingStats = {
  targetQuantity: number | null;
  currentQuantity: number;
  price: number | null;
  endDate: Date | null;
  fundingDays: number | null;
  sizeOptions: string[];
  measurements: Record<string, unknown> | null;
};

/** Copy returned by the AI (edge function) or the deterministic fallback writer. */
export type DetailPageCopy = {
  productName: string;
  productNameEn: string;
  oneLiner: string;
  mainCopy: string;
  story: string;
  designDescription: string;
  designPoints: Array<{ title: string; text: string }>;
  fabricDescription: string;
  fitDescription: string;
  colorDescription: string;
  productionMethod: string;
  styling: string[];
  sizeGuide: string;
  care: string[];
  fundingGuide: string;
  productionSchedule: string;
  shippingGuide: string;
  notices: string[];
  /** Questions the AI could not answer from verified facts. */
  missingInfo: string[];
};

export type DetailImageType =
  | "hero"
  | "product_front"
  | "product_back"
  | "detail"
  | "editorial"
  | "lifestyle"
  | "fabric"
  | "mood"
  | "flat_lay";

/** "AI 다시 작성" tone. Facts stay the same; only the voice changes. */
export type DetailCopyTone = "concise" | "emotional" | "professional" | "street" | "luxury";

export type DetailPageVersionKind =
  | "ai_generated"
  | "manual_save"
  | "image_regenerated"
  | "copy_regenerated"
  | "published"
  | "restore_backup"
  | "migrated";

export type DetailPageVersion = {
  id: string;
  version: number;
  kind: DetailPageVersionKind;
  note: string | null;
  createdByName: string;
  createdAt: string;
  sectionCount: number;
  isPublished: boolean;
};

export type DetailPagePublishState = {
  publishedVersion: number;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
  latestVersion: number | null;
  canEdit: boolean;
};

export type DetailReferenceKind = "sample" | "fabric" | "detail" | "wearing" | "reference" | "logo" | "brand";

export type DetailReference = {
  id: string;
  kind: DetailReferenceKind;
  url: string;
  storagePath: string | null;
  useForGeneration: boolean;
  createdAt: string;
};

export type AiQuota = { imageUsed: number; imageLimit: number; copyUsed: number; copyLimit: number };

export type DetailImageJobStatus = "pending" | "generating" | "completed" | "failed";

export type DetailImageJob = {
  imageType: DetailImageType;
  status: DetailImageJobStatus;
  assetId: string | null;
  url: string | null;
  error: string | null;
  updatedAt: string;
};
