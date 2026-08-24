/**
 * Copy/data for the redesigned portfolio ("Selected Works") page — kept as plain data, separate
 * from layout, so any of these numbers or labels can be updated without touching component code.
 */

export interface PortfolioStat {
  value: string;
  label: string;
}

/** "BRAND-ER IN NUMBERS" — production capability shown as figures, not prose. */
export const PORTFOLIO_STATS: PortfolioStat[] = [
  { value: "30–100+", label: "SMALL BATCH PRODUCTION" },
  { value: "KOREA · CHINA · JAPAN", label: "PRODUCTION NETWORK" },
  { value: "AI → SAMPLE → PRODUCTION", label: "ONE-STOP PROCESS" },
  { value: "FASHION · UNIFORM · MERCH", label: "PRODUCTION CATEGORY" },
];

export interface PortfolioCapability {
  number: string;
  title: string;
  description: string;
}

/** "From Concept to Production." */
export const PORTFOLIO_CAPABILITIES: PortfolioCapability[] = [
  { number: "01", title: "DESIGN", description: "아이디어를 실제 제작 가능한 의류 디자인으로 구체화합니다." },
  { number: "02", title: "FABRIC", description: "제품 콘셉트와 예산에 맞는 원단을 제안합니다." },
  { number: "03", title: "PATTERN", description: "실제 생산을 위한 패턴과 사이즈 스펙을 설계합니다." },
  { number: "04", title: "SAMPLE", description: "본 생산 전 실제 샘플을 제작하고 완성도를 확인합니다." },
  { number: "05", title: "PRODUCTION", description: "국내·중국·일본 생산 네트워크를 통해 제품을 생산합니다." },
  { number: "06", title: "PRINTING", description: "나염, 전사, 자수 등 다양한 후가공을 지원합니다." },
];

export interface PortfolioProcessStep {
  number: string;
  title: string;
}

/** "How We Make." */
export const PORTFOLIO_PROCESS_STEPS: PortfolioProcessStep[] = [
  { number: "01", title: "IDEA" },
  { number: "02", title: "DESIGN" },
  { number: "03", title: "FABRIC" },
  { number: "04", title: "PATTERN & SAMPLE" },
  { number: "05", title: "PRODUCTION" },
  { number: "06", title: "DELIVERY" },
];

/** Default service tags shown for a project that hasn't had its own `services` set yet by an
 * admin (all 12 seeded launch projects) — a generic, defensible default rather than a blank line. */
export const PORTFOLIO_DEFAULT_SERVICES = ["Design", "Sample", "Production"];
