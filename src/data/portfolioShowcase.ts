/**
 * Copy/data for the redesigned portfolio ("Selected Works") page — kept as plain data, separate
 * from layout, so any of these numbers or labels can be updated without touching component code.
 */

export interface PortfolioStat {
  value: string;
  label: string;
}

/** "브랜더, 숫자로 보다" — production capability shown as figures, not prose. */
export const PORTFOLIO_STATS: PortfolioStat[] = [
  { value: "30–100+", label: "소량 생산 가능 수량" },
  { value: "한국 · 중국 · 일본", label: "생산 네트워크" },
  { value: "AI → 샘플 → 생산", label: "원스톱 제작 프로세스" },
  { value: "패션 · 단체복 · 굿즈", label: "제작 카테고리" },
];

export interface PortfolioCapability {
  number: string;
  title: string;
  description: string;
}

/** "컨셉에서 생산까지." */
export const PORTFOLIO_CAPABILITIES: PortfolioCapability[] = [
  { number: "01", title: "디자인", description: "아이디어를 실제 제작 가능한 의류 디자인으로 구체화합니다." },
  { number: "02", title: "원단", description: "제품 콘셉트와 예산에 맞는 원단을 제안합니다." },
  { number: "03", title: "패턴", description: "실제 생산을 위한 패턴과 사이즈 스펙을 설계합니다." },
  { number: "04", title: "샘플", description: "본 생산 전 실제 샘플을 제작하고 완성도를 확인합니다." },
  { number: "05", title: "생산", description: "국내·중국·일본 생산 네트워크를 통해 제품을 생산합니다." },
  { number: "06", title: "프린팅", description: "나염, 전사, 자수 등 다양한 후가공을 지원합니다." },
];

export interface PortfolioProcessStep {
  number: string;
  title: string;
}

/** "이렇게 만듭니다." */
export const PORTFOLIO_PROCESS_STEPS: PortfolioProcessStep[] = [
  { number: "01", title: "아이디어" },
  { number: "02", title: "디자인" },
  { number: "03", title: "원단" },
  { number: "04", title: "패턴 · 샘플" },
  { number: "05", title: "생산" },
  { number: "06", title: "배송" },
];

/** Default service tags shown for a project that hasn't had its own `services` set yet by an
 * admin (all 12 seeded launch projects) — a generic, defensible default rather than a blank line. */
export const PORTFOLIO_DEFAULT_SERVICES = ["디자인", "샘플", "생산"];
