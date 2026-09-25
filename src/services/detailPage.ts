import { supabase } from "@/lib/supabase";
import { compressImage, fetchMyBrand } from "@/services/brand";
import { createFundingDraft } from "@/services/funding";
import { screenTrademarkImage } from "@/services/trademarkScreening";
import { buildFallbackCopy } from "@/lib/detail-page/fallbackCopy";
import { buildFundingDescription } from "@/lib/detail-page/document";
import { buildVerifiedCorpus, stripUnverifiedClaims } from "@/lib/detail-page/safety";
import { isDetailTemplateId } from "@/lib/detail-page/templates";
import { EMPTY_USER_PROVIDED } from "@/lib/detail-page/source";
import type {
  DetailPageCopy,
  DetailPageDocument,
  DetailPageGenerationMeta,
  DetailPageSource,
  DetailPageStatus,
  DetailPageTemplateId,
  DetailSection,
  DetailSectionType,
  ProductDetailPage,
} from "@/types/detailPage";

type PageRow = {
  id: string;
  user_id: string;
  funding_id: string | null;
  design_id: string | null;
  brand_id: string | null;
  template: string;
  title: string;
  title_en: string;
  subtitle: string;
  main_copy: string;
  status: DetailPageStatus;
  source: DetailPageSource;
  generation: DetailPageGenerationMeta | null;
  created_at: string;
  updated_at: string;
};

type SectionRow = {
  id: string;
  section_type: DetailSectionType;
  sort_order: number;
  is_visible: boolean;
  content: Partial<Pick<DetailSection, "eyebrow" | "title" | "description" | "items" | "facts">> | null;
  images: DetailSection["images"] | null;
};

// The DB client types predate these tables; keep the untyped escape hatch in one place.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const requireUser = async () => {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) throw new Error("로그인이 필요합니다.");
  return user;
};

export const getDetailPageErrorMessage = (error: unknown, fallback = "잠시 후 다시 시도해주세요.") => {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
};

const toSection = (row: SectionRow): DetailSection => ({
  id: row.id,
  type: row.section_type,
  visible: row.is_visible,
  eyebrow: row.content?.eyebrow ?? "",
  title: row.content?.title ?? "",
  description: row.content?.description ?? "",
  items: Array.isArray(row.content?.items) ? row.content.items : [],
  facts: Array.isArray(row.content?.facts) ? row.content.facts : [],
  images: Array.isArray(row.images) ? row.images : [],
});

const toPage = (row: PageRow, sections: SectionRow[]): ProductDetailPage => ({
  id: row.id,
  userId: row.user_id,
  fundingId: row.funding_id,
  designId: row.design_id,
  brandId: row.brand_id,
  status: row.status,
  source: { ...row.source, userProvided: { ...EMPTY_USER_PROVIDED, ...(row.source?.userProvided ?? {}) } },
  generation: row.generation ?? {},
  document: {
    template: isDetailTemplateId(row.template) ? row.template : "minimal",
    productName: row.title,
    productNameEn: row.title_en,
    subtitle: row.subtitle,
    mainCopy: row.main_copy,
    sections: [...sections].sort((a, b) => a.sort_order - b.sort_order).map(toSection),
  },
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toSectionPayload = (sections: DetailSection[]) =>
  sections.map((section, index) => ({
    id: section.id,
    section_type: section.type,
    sort_order: index,
    is_visible: section.visible,
    content: {
      eyebrow: section.eyebrow,
      title: section.title,
      description: section.description,
      items: section.items,
      facts: section.facts,
    },
    images: section.images,
  }));

const PAGE_SELECT = "*, sections:detail_page_sections(*)";

const readPage = (row: PageRow & { sections?: SectionRow[] }) => toPage(row, row.sections ?? []);

export const fetchDetailPage = async (id: string): Promise<ProductDetailPage> => {
  await supabase.auth.getSession();
  const { data, error } = await db.from("product_detail_pages").select(PAGE_SELECT).eq("id", id).single();
  if (error) throw error;
  return readPage(data);
};

/**
 * Public read used by the funding page. Returns null on any failure (no page, not public
 * yet, or the migration not applied) so the funding page falls back to its existing UI.
 */
export const fetchDetailPageForFunding = async (fundingId: string): Promise<ProductDetailPage | null> => {
  try {
    const { data, error } = await db
      .from("product_detail_pages")
      .select(PAGE_SELECT)
      .eq("funding_id", fundingId)
      .maybeSingle();
    if (error || !data) return null;
    return readPage(data);
  } catch (error) {
    console.error("Detail page lookup failed:", error);
    return null;
  }
};

export const fetchMyDetailPageForFunding = async (fundingId: string) => {
  const user = await requireUser();
  const { data, error } = await db
    .from("product_detail_pages")
    .select("id")
    .eq("funding_id", fundingId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
};

export const createDetailPage = async (input: {
  source: DetailPageSource;
  template: DetailPageTemplateId;
  fundingId?: string | null;
}): Promise<string> => {
  const user = await requireUser();
  const { data, error } = await db
    .from("product_detail_pages")
    .insert({
      user_id: user.id,
      funding_id: input.fundingId ?? null,
      design_id: input.source.designId,
      brand_id: input.source.brandId,
      template: input.template,
      title: [input.source.color, input.source.clothType].filter(Boolean).join(" "),
      status: input.fundingId ? "linked" : "draft",
      source: input.source,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
};

export const saveDetailPage = async (input: {
  id: string;
  document: DetailPageDocument;
  source: DetailPageSource;
  generation: DetailPageGenerationMeta;
  status?: Exclude<DetailPageStatus, "linked">;
}): Promise<string> => {
  const { data, error } = await db.rpc("save_product_detail_page", {
    p_page_id: input.id,
    p_page: {
      template: input.document.template,
      title: input.document.productName,
      title_en: input.document.productNameEn,
      subtitle: input.document.subtitle,
      main_copy: input.document.mainCopy,
      source: input.source,
      generation: input.generation,
      ...(input.status ? { status: input.status } : {}),
    },
    p_sections: toSectionPayload(input.document.sections),
  });
  if (error) throw error;
  return (data as string) ?? new Date().toISOString();
};

const text = (value: unknown, max = 1200) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const list = (value: unknown, max = 8) =>
  Array.isArray(value) ? value.map((entry) => text(entry, 400)).filter(Boolean).slice(0, max) : [];

/** Validates AI output and removes unverified claims (composition, weight, functions, certifications). */
export const sanitizeDetailCopy = (raw: unknown, source: DetailPageSource): DetailPageCopy => {
  const fallback = buildFallbackCopy(source);
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const corpus = buildVerifiedCorpus(
    source.material,
    source.designDescription,
    source.aiPrompt,
    source.clothType,
    source.productionMethod,
    source.userProvided.composition,
    source.userProvided.careNote,
    source.userProvided.background,
    source.userProvided.fitNote,
    source.decorations.map((decoration) => decoration.label).join(" "),
  );
  const clean = (input: string) => stripUnverifiedClaims(input, corpus);
  const pick = (key: keyof DetailPageCopy, max?: number) => clean(text(value[key], max)) || (fallback[key] as string);
  const points = Array.isArray(value.designPoints)
    ? value.designPoints
        .map((point) => {
          const entry = (point && typeof point === "object" ? point : {}) as Record<string, unknown>;
          return { title: clean(text(entry.title, 60)), text: clean(text(entry.text, 300)) };
        })
        .filter((point) => point.title && point.text)
        .slice(0, 5)
    : [];
  return {
    productName: pick("productName", 60),
    productNameEn: text(value.productNameEn, 60).toUpperCase() || fallback.productNameEn,
    oneLiner: pick("oneLiner", 120),
    mainCopy: pick("mainCopy", 120),
    story: pick("story", 1500),
    designDescription: pick("designDescription"),
    designPoints: points.length >= 3 ? points : fallback.designPoints.length ? fallback.designPoints : points,
    fabricDescription: source.material ? pick("fabricDescription") : "",
    fitDescription: pick("fitDescription"),
    colorDescription: pick("colorDescription"),
    productionMethod: clean(text(value.productionMethod)) || fallback.productionMethod,
    styling: list(value.styling, 4).map(clean).filter(Boolean),
    sizeGuide: pick("sizeGuide"),
    care: (list(value.care, 5).map(clean).filter(Boolean).length ? list(value.care, 5).map(clean).filter(Boolean) : fallback.care),
    fundingGuide: pick("fundingGuide"),
    productionSchedule: pick("productionSchedule"),
    shippingGuide: pick("shippingGuide"),
    notices: list(value.notices, 6).map(clean).filter(Boolean).length
      ? list(value.notices, 6).map(clean).filter(Boolean)
      : fallback.notices,
    missingInfo: list(value.missingInfo, 6),
  };
};

export type DetailCopyResult = {
  copy: DetailPageCopy;
  provider: "ai" | "fallback";
  fallbackReason: string | null;
};

/**
 * Asks the `generate-detail-page` edge function (Gemini) for copy. Falls back to the
 * deterministic writer when the function is unavailable, so generation never hard-fails.
 */
export const generateDetailCopy = async (
  source: DetailPageSource,
  template: DetailPageTemplateId,
): Promise<DetailCopyResult> => {
  try {
    const { data, error } = await supabase.functions.invoke("generate-detail-page", {
      body: { source, template },
    });
    if (error) throw error;
    if (!data?.copy) throw new Error(data?.error || "AI 응답이 비어 있습니다.");
    return { copy: sanitizeDetailCopy(data.copy, source), provider: "ai", fallbackReason: null };
  } catch (error) {
    console.error("AI detail copy generation failed, using fallback writer:", error);
    return {
      copy: buildFallbackCopy(source),
      provider: "fallback",
      fallbackReason: getDetailPageErrorMessage(error, "AI 연결 실패"),
    };
  }
};

export const uploadDetailPageImage = async (file: File) => {
  const user = await requireUser();
  const blob = await compressImage(file);
  const path = `${user.id}/detail-pages/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from("creator-assets")
    .upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
  if (error) throw error;
  return supabase.storage.from("creator-assets").getPublicUrl(path).data.publicUrl;
};

export class DetailPageBrandRequiredError extends Error {
  constructor() {
    super("펀딩을 시작하려면 제작자 프로필과 내 브랜드를 먼저 등록해주세요.");
    this.name = "DetailPageBrandRequiredError";
  }
}

/**
 * "펀딩 시작하기": creates the funding draft through the existing funding path (brand check,
 * final-design trademark screening, createFundingDraft) and links this detail page to it.
 * Re-running on an already linked page just returns its funding.
 */
export const startFundingFromDetailPage = async (
  page: ProductDetailPage,
): Promise<{ fundingId: string; linked: boolean }> => {
  if (page.fundingId) return { fundingId: page.fundingId, linked: true };
  await requireUser();
  const brand = await fetchMyBrand();
  if (!brand) throw new DetailPageBrandRequiredError();

  const { source, document } = page;
  if (!source.imageUrl) throw new Error("펀딩에 사용할 디자인 이미지가 없습니다.");

  const screening = await screenTrademarkImage({
    imageUrl: source.imageUrl,
    source: "final_design",
    selectedType: source.clothTypeId,
    selectedMaterial: source.materialId,
    parentScreeningId: source.trademarkScreeningId,
  });
  if (screening.decision === "blocked") {
    throw new Error(
      "최종 이미지에서 유명 타사 상표 또는 매우 유사한 로고가 감지되어 펀딩을 등록할 수 없습니다. 해당 요소를 제거한 뒤 다시 시도해주세요.",
    );
  }

  const sizeOptions = source.sizeOptions.length ? source.sizeOptions : ["M"];
  const funding = await createFundingDraft({
    productName: document.productName.trim() || [source.color, source.clothType].filter(Boolean).join(" ") || source.clothType,
    clothType: source.clothType,
    material: source.material,
    color: source.userProvided.colorName || source.color,
    size: sizeOptions[0],
    sizeOptions,
    measurements: source.measurements,
    imageUrl: source.imageUrl,
    imagePath: source.imagePath,
    description: buildFundingDescription(document),
    estimateDirectUnitMin: source.estimateUnitMin,
    estimateDirectUnitMax: source.estimateUnitMax,
    estimateDevelopmentTotal: source.estimateDevelopmentTotal,
    trademarkScreeningId: screening.id,
    price: source.userProvided.price,
  });

  // The funding now exists, so never throw past this point (a retry would create a second
  // funding). A failed link is reported and can be retried from the funding editor.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { error } = await db
      .from("product_detail_pages")
      .update({ funding_id: funding.id, brand_id: brand.id, status: "linked" })
      .eq("id", page.id);
    if (!error) return { fundingId: funding.id, linked: true };
    console.error("Failed to link detail page to funding:", error);
  }
  return { fundingId: funding.id, linked: false };
};

/** Links an unlinked detail page to one of the creator's existing fundings. */
export const linkDetailPageToFunding = async (pageId: string, fundingId: string) => {
  const { error } = await db
    .from("product_detail_pages")
    .update({ funding_id: fundingId, status: "linked" })
    .eq("id", pageId);
  if (error) throw error;
};
