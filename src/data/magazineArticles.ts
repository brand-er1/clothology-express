/**
 * BRAND-ER 매거진(/community 의 "BRAND-ER NEWS" 섹션 · /magazine/:slug 상세페이지) 기사 모델.
 *
 * - 기사 원본은 Supabase public.magazine_articles 테이블이며 관리자 페이지(/admin/magazine)에서 관리한다.
 * - magazine-articles.json 은 DB 에 시드된 기존 기사와 같은 내용의 정적 사본이다.
 *   DB 를 읽지 못할 때(네트워크 오류, 마이그레이션 배포 전)에 대체 목록으로 쓰고,
 *   빌드 시 scripts/seo/generate-magazine-pages.mjs 가 이 파일로 기사별 SEO 정적 페이지를 만든다.
 * - publishedAt 은 ISO 날짜(YYYY-MM-DD). 화면에는 최신순으로 정렬되어 "YYYY.MM.DD"로 표시된다.
 *
 * 저작권: 요약(summary) · 주요 내용(keyPoints) · BRAND-ER 핵심(brandHighlight)은 BRAND-ER 가 직접 작성한 요약만 넣는다.
 * 원문 전문을 옮기지 말고, 전체 기사는 externalUrl(원문 기사 보기)로 연결한다.
 */
import seedArticles from "./magazine-articles.json";

export type MagazineCategory = "press" | "brand_news";

export type MagazineArticle = {
  slug: string;
  category: MagazineCategory;
  title: string;
  publisher: string;
  /** ISO 날짜 문자열 (YYYY-MM-DD) */
  publishedAt: string;
  summary: string;
  keyPoints: string[];
  brandHighlight: string | null;
  thumbnail: string | null;
  thumbnailCredit: string | null;
  externalUrl: string | null;
};

export const MAGAZINE_CATEGORY_LABEL: Record<MagazineCategory, string> = {
  press: "언론보도",
  brand_news: "브랜드 뉴스",
};

export const magazineArticles = seedArticles as MagazineArticle[];

export const magazineArticlePath = (slug: string) => `/magazine/${slug}`;

/** "2026-06-06" → "2026.06.06" */
export const formatMagazineDate = (isoDate: string) => isoDate.slice(0, 10).replace(/-/g, ".");

/** publishedAt 기준 최신순 정렬 (원본 배열은 변경하지 않음). */
export const sortMagazineArticles = (articles: MagazineArticle[]) =>
  [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
