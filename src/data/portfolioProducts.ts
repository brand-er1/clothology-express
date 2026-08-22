import { getAppPath } from "@/utils/appUrl";

export type PortfolioCategory = "TOP" | "BOTTOM" | "OUTER" | "HOODIE" | "TECHNICAL";

export interface PortfolioProduct {
  id: string;
  index: string;
  nameKo: string;
  nameEn: string;
  category: PortfolioCategory;
  image: string;
}

export const portfolioCategoryLabel: Record<PortfolioCategory, string> = {
  TOP: "상의",
  BOTTOM: "하의",
  OUTER: "아우터",
  HOODIE: "후드",
  TECHNICAL: "테크니컬",
};

/**
 * The 12 production pieces shown in the BRAND-ER portfolio PDF (page 11). Only fields actually
 * printed in the PDF are included — no invented material/spec numbers. Detail-view fields with no
 * source data render "제작 사양 상담 후 확정" instead of a fabricated value.
 */
export const portfolioProducts: PortfolioProduct[] = [
  {
    id: "performance-shorts",
    index: "01",
    nameKo: "퍼포먼스 쇼츠",
    nameEn: "PERFORMANCE SHORTS",
    category: "BOTTOM",
    image: getAppPath("/portfolio/performance-shorts.webp"),
  },
  {
    id: "balloon-cargo-shorts",
    index: "02",
    nameKo: "벌룬 카고 쇼츠",
    nameEn: "BALLOON CARGO SHORTS",
    category: "BOTTOM",
    image: getAppPath("/portfolio/balloon-cargo-shorts.webp"),
  },
  {
    id: "wide-trousers",
    index: "03",
    nameKo: "와이드 트라우저",
    nameEn: "WIDE TROUSERS",
    category: "BOTTOM",
    image: getAppPath("/portfolio/wide-trousers.webp"),
  },
  {
    id: "camo-henley",
    index: "04",
    nameKo: "카모 헨리넥",
    nameEn: "CAMO HENLEY",
    category: "TOP",
    image: getAppPath("/portfolio/camo-henley.webp"),
  },
  {
    id: "rolled-hem-long-sleeve",
    index: "05",
    nameKo: "롤드 헴 롱슬리브",
    nameEn: "ROLLED HEM LONG SLEEVE",
    category: "TOP",
    image: getAppPath("/portfolio/rolled-hem-long-sleeve.webp"),
  },
  {
    id: "burgundy-leather-jacket",
    index: "06",
    nameKo: "버건디 레더 재킷",
    nameEn: "BURGUNDY LEATHER JACKET",
    category: "OUTER",
    image: getAppPath("/portfolio/burgundy-leather-jacket.webp"),
  },
  {
    id: "hood-pullover",
    index: "07",
    nameKo: "후드 풀오버",
    nameEn: "HOOD PULLOVER",
    category: "HOODIE",
    image: getAppPath("/portfolio/hood-pullover.webp"),
  },
  {
    id: "hidden-shirt",
    index: "08",
    nameKo: "히든 셔츠",
    nameEn: "HIDDEN SHIRT",
    category: "TOP",
    image: getAppPath("/portfolio/hidden-shirt.webp"),
  },
  {
    id: "work-jacket",
    index: "09",
    nameKo: "워크 재킷",
    nameEn: "WORK JACKET",
    category: "OUTER",
    image: getAppPath("/portfolio/work-jacket.webp"),
  },
  {
    id: "rib-half-zip",
    index: "10",
    nameKo: "리브 하프집업",
    nameEn: "RIB HALF-ZIP",
    category: "TOP",
    image: getAppPath("/portfolio/rib-half-zip.webp"),
  },
  {
    id: "technical-shell",
    index: "11",
    nameKo: "테크니컬 셸",
    nameEn: "TECHNICAL SHELL",
    category: "TECHNICAL",
    image: getAppPath("/portfolio/technical-shell.webp"),
  },
  {
    id: "studded-hoodie",
    index: "12",
    nameKo: "스터드 후디",
    nameEn: "STUDDED HOODIE",
    category: "HOODIE",
    image: getAppPath("/portfolio/studded-hoodie.webp"),
  },
];

export const portfolioPdfUrl = getAppPath("/portfolio/brand-er-portfolio-2026.pdf");
