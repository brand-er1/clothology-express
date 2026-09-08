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

/** "SPECIAL FABRIC SOURCING" — the specialty/hard-to-find fabric sourcing spotlight on the
 * portfolio page. Kept as data, separate from the section layout, same convention as the
 * capability/process copy above. */
export const FABRIC_SOURCING_KIDS_FLOW = ["WHY SAFETY MATTERS", "SAFE FABRIC SOURCING", "PRODUCTION"];

export const FABRIC_SOURCING_KIDS_POINTS = [
  "아동복용 원단 서칭 및 수급",
  "제품 용도와 연령에 맞는 소재 제안",
  "촉감·두께·컬러·혼용률 등을 고려한 원단 서칭",
  "필요 시 관련 시험·인증 절차를 고려한 제작 진행",
  "원단 수급 → 샘플 → 본생산까지 연결",
];

export const FABRIC_SOURCING_CUSTOM_FLOW_EN = ["REFERENCE", "FABRIC SOURCING", "SAMPLE", "PRODUCTION"];

export const FABRIC_SOURCING_CUSTOM_FLOW_KO = ["레퍼런스 전달", "원단 서칭", "소재 제안", "샘플 제작", "본생산"];

export interface SpecialMaterialCard {
  nameKo: string;
  nameEn: string;
  image: string;
  imageAlt: string;
  /** Rendered as separate paragraph lines. */
  description: string[];
  features: string[];
  note: string;
  /** "highlight" — a positive sourcing/availability line. "disclaimer" — a cautionary line
   * (kept visually distinct so it never reads as a certification claim about the photo itself). */
  noteVariant: "highlight" | "disclaimer";
}

/** "SPECIAL MATERIALS & CERTIFIED FABRICS" — the two-card spotlight on the portfolio page:
 * vegan hanji leather and KC-safety-aware kidswear fabric sourcing. Kept as data, separate from
 * the section layout, same convention as the rest of this file. */
export const SPECIAL_MATERIAL_CARDS: SpecialMaterialCard[] = [
  {
    nameKo: "비건 한지 레더",
    nameEn: "VEGAN HANJI LEATHER",
    image: "/fabrics/hanji-leather.webp",
    imageAlt: "비건 한지 레더 — 앞면 레더 질감과 뒷면 한지 섬유 질감",
    description: [
      "동물성 천연가죽을 사용하지 않는 비건 레더와 한지의 특성을 결합한 차별화 소재입니다.",
      "앞면에서는 레더 특유의 고급스러운 질감과 컬러를 표현하고,",
      "뒷면에서는 한지 특유의 섬유 조직과 자연스러운 질감을 확인할 수 있습니다.",
    ],
    features: [
      "동물성 천연가죽을 대체할 수 있는 소재",
      "레더의 고급스러운 표면감",
      "한지 특유의 독특한 섬유 조직",
      "일반 합성가죽과 차별화되는 소재 스토리",
      "다양한 컬러 및 질감 선택 가능",
      "재킷, 가방, 파우치 및 패션 소품 제작 가능",
    ],
    note: "비건 한지 레더 소재 수급 및 제작 가능",
    noteVariant: "highlight",
  },
  {
    nameKo: "KC 인증 아동복 원단",
    nameEn: "KC CERTIFIED FABRIC",
    image: "/fabrics/kc-safety-swatch.png",
    imageAlt: "KC 인증 아동복 원단 — 아동복용 원단 컬러 스와치 보드",
    description: [
      "아동복 제작 시 제품의 안전성과 관련된 KC 안전기준 및 적용 요건을 고려한 원단 수급을 지원합니다.",
      "다양한 컬러와 사양의 아동복용 원단을 확인하고 제품에 적합한 소재를 선택할 수 있습니다.",
    ],
    features: [
      "아동복 제작용 원단 수급 가능",
      "KC 관련 안전기준을 고려한 소재 선택 지원",
      "다양한 컬러 선택 가능",
      "키즈웨어 및 아동복 제작 대응",
      "샘플 제작부터 본생산까지 연계 가능",
    ],
    note: "※ KC 관련 인증·시험 여부는 실제 사용 원단 및 완제품 사양에 따라 개별 확인",
    noteVariant: "disclaimer",
  },
];
