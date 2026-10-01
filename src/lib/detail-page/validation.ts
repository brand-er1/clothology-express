import type { DetailPageDocument, DetailPageSource } from "@/types/detailPage";
import type { Funding } from "@/types/funding";

/**
 * "상세페이지 등록" 전 필수 항목 검사. 서버의 `_detail_page_missing_items`
 * (20261001000000_detail_page_publish_validation.sql) 와 같은 규칙이다 — 화면에서 먼저 막고,
 * 서버가 한 번 더 검증한다.
 */
export type DetailPublishMissingKey = "hero_image" | "product_name" | "description" | "price" | "options" | "sizes" | "funding";

export type DetailPublishMissingItem = {
  key: DetailPublishMissingKey;
  label: string;
  message: string;
  /** 어디서 고치는지: 상세페이지 편집기 / 펀딩 정보 수정 */
  target: "page" | "funding";
};

type FundingFacts = Pick<Funding, "price" | "size_options" | "color_options" | "color" | "moq" | "funding_days">;

const filled = (value: string | null | undefined) => Boolean(value && value.trim());

export const validateDetailPageForPublish = (input: {
  document: DetailPageDocument;
  source: DetailPageSource;
  funding: FundingFacts | null;
  /** 활성 funding_colors 개수 */
  fundingColorCount?: number;
}): DetailPublishMissingItem[] => {
  const { document, source, funding } = input;
  const missing: DetailPublishMissingItem[] = [];
  const visible = document.sections.filter((section) => section.visible);
  const fundingTarget = funding ? "funding" : "page";

  const hasHeroImage = visible.some((section) => section.type === "hero" && section.images.some((image) => filled(image.url)));
  if (!hasHeroImage) {
    missing.push({ key: "hero_image", label: "대표 이미지", message: "메인 비주얼(히어로) 섹션에 대표 이미지를 1장 이상 넣어주세요.", target: "page" });
  }
  if (!filled(document.productName)) {
    missing.push({ key: "product_name", label: "상품명", message: "상품명을 입력해주세요.", target: "page" });
  }
  const hasDescription =
    filled(document.subtitle) ||
    visible.some((section) => ["story", "design", "custom_text"].includes(section.type) && filled(section.description));
  if (!hasDescription) {
    missing.push({ key: "description", label: "상품 설명", message: "한 줄 소개 또는 제품 소개 본문을 입력해주세요.", target: "page" });
  }

  const price = funding ? funding.price : source.userProvided.price;
  if (!price || price <= 0) {
    missing.push({ key: "price", label: "가격", message: "판매 가격을 입력해주세요.", target: fundingTarget });
  }

  const colorCount = funding
    ? Math.max(
        funding.color_options?.filter(filled).length ?? 0,
        input.fundingColorCount ?? 0,
        filled(funding.color) ? 1 : 0,
      )
    : filled(source.color) || filled(source.userProvided.colorName) || (source.availableColors?.length ?? 0) > 0
      ? 1
      : 0;
  if (colorCount === 0) {
    missing.push({ key: "options", label: "옵션(컬러)", message: "구매 옵션(컬러)을 1개 이상 등록해주세요.", target: fundingTarget });
  }

  const sizeCount = funding ? funding.size_options?.length ?? 0 : source.sizeOptions.length;
  if (sizeCount === 0) {
    missing.push({ key: "sizes", label: "사이즈", message: "판매할 사이즈를 1개 이상 선택해주세요.", target: fundingTarget });
  }

  if (!funding) {
    missing.push({
      key: "funding",
      label: "펀딩 정보",
      message: "상세페이지를 등록할 펀딩이 없습니다. ‘펀딩 시작하기’로 펀딩을 먼저 만들어주세요.",
      target: "funding",
    });
  } else if (!(funding.moq > 0) || !(funding.funding_days > 0)) {
    missing.push({ key: "funding", label: "펀딩 정보", message: "목표 수량(MOQ)과 펀딩 기간을 입력해주세요.", target: "funding" });
  }
  return missing;
};

/** publish_detail_page 의 검증 실패(P0001, detail = JSON 배열)를 화면용 목록으로 바꾼다. */
export const parseMissingItemsError = (error: unknown): DetailPublishMissingItem[] | null => {
  const value = error as { hint?: string; details?: string } | null;
  if (!value || value.hint !== "detail_page_missing_items" || typeof value.details !== "string") return null;
  try {
    const parsed = JSON.parse(value.details);
    return Array.isArray(parsed) ? (parsed as DetailPublishMissingItem[]) : null;
  } catch {
    return null;
  }
};
