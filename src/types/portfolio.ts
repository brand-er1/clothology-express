/** A single "Selected Works" portfolio project — backed by `public.portfolio_projects`,
 * seeded from (and falling back to) the static catalog in `src/data/portfolioProducts.ts` so
 * nothing already on the site is lost while an admin can now edit/extend it. */
export interface PortfolioProject {
  id: string;
  nameKo: string;
  nameEn: string;
  /** Garment/production category, e.g. "TOP", "BOTTOM", "OUTER", "HOODIE", "TECHNICAL". */
  category: string;
  /** Main + additional images, main first. Always has at least one entry. */
  images: string[];
  /** 제작 국가 — e.g. "국내(서울·경기)", "중국", "베트남". Null when not yet specified. */
  country: string | null;
  /** 제작 수량 — free text ("50장", "100–300장") since real orders are ranges, not one number. */
  quantity: string | null;
  /** Production services used, e.g. ["Design", "Fabric", "Pattern", "Sample", "Production"]. */
  services: string[];
  description: string | null;
  order: number;
  visible: boolean;
}

export const PORTFOLIO_CATEGORY_LABEL_KO: Record<string, string> = {
  TOP: "상의",
  BOTTOM: "하의",
  OUTER: "아우터",
  HOODIE: "후드",
  TECHNICAL: "테크니컬",
};
