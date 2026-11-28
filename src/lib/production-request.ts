import { trackSiteEvent } from "@/lib/site-analytics";

/**
 * 제작 의뢰(/production-request) 공통 규칙.
 *
 * - 어느 화면에서든 제작 의뢰로 넘어올 때 CTA 위치(source)를 남겨 유입 페이지별 전환율을 계산한다.
 * - AI 디자인 결과 · 상세페이지 완료 화면은 디자인 이미지를 sessionStorage 에 넘겨 양식에 자동 첨부한다.
 *   고객은 이미지를 내려받거나 다시 올릴 필요가 없고, 새로고침 · 로그인 왕복에도 첨부가 유지된다.
 */
export const PRODUCTION_REQUEST_PATH = "/production-request";

/** CTA 위치. 관리자 통계의 'CTA 위치별 전환'에 그대로 표시된다. */
export type ProductionCtaSource =
  | "header"
  | "mobile_bar"
  | "menu_sheet"
  | "mega_menu"
  | "home_hero"
  | "home_service"
  | "home_services_index"
  | "home_process"
  | "home_bottom"
  | "ai_result"
  | "detail_page_done"
  | "customize_intro"
  | "footer"
  | "other";

export const PRODUCTION_CTA_LABEL: Record<string, string> = {
  header: "PC 헤더 버튼",
  mobile_bar: "모바일 하단 고정 버튼",
  menu_sheet: "전체 메뉴",
  mega_menu: "제작하기 메뉴",
  home_hero: "메인 히어로",
  home_service: "메인 제작 서비스 섹션",
  home_services_index: "메인 서비스 목록",
  home_process: "메인 제작 과정 섹션",
  home_bottom: "메인 하단 제작 상담",
  ai_result: "AI 이미지 결과 화면",
  detail_page_done: "상세페이지 완료 화면",
  customize_intro: "디자인 스튜디오 안내",
  footer: "푸터",
  other: "기타",
  unknown: "알 수 없음",
  direct: "직접 진입",
};

export const productionRequestHref = (source: ProductionCtaSource) => `${PRODUCTION_REQUEST_PATH}?from=${source}`;

export const trackProductionCtaClick = (source: ProductionCtaSource, extra: Record<string, unknown> = {}) => {
  void trackSiteEvent(source === "ai_result" ? "ai_result_production_cta_clicked" : "production_cta_clicked", { source, ...extra });
};

// ---------------------------------------------------------------------------
// AI 디자인 → 제작 의뢰 이미지 핸드오프
// ---------------------------------------------------------------------------
const HANDOFF_KEY = "brander_production_request_design";
const HANDOFF_TTL_MS = 6 * 60 * 60 * 1000;

export interface ProductionDesignHandoff {
  imageUrl: string;
  imagePath?: string | null;
  /** 어떤 화면에서 넘어왔는지(ai_result | detail_page_done) */
  origin: "ai_result" | "detail_page_done";
  clothType?: string | null;
  material?: string | null;
  description?: string | null;
  quantity?: number | null;
  designId?: string | null;
  createdAt: number;
}

export const saveProductionDesignHandoff = (handoff: Omit<ProductionDesignHandoff, "createdAt">) => {
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ ...handoff, createdAt: Date.now() }));
  } catch {
    // 저장이 막힌 브라우저(사생활 보호 모드 등)에서는 history state 로만 넘긴다.
  }
};

export const parseProductionDesignHandoff = (raw: unknown, now = Date.now()): ProductionDesignHandoff | null => {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<ProductionDesignHandoff>;
  if (typeof value.imageUrl !== "string" || !value.imageUrl) return null;
  if (!/^(https?:|data:image\/)/.test(value.imageUrl)) return null;
  if (typeof value.createdAt === "number" && now - value.createdAt > HANDOFF_TTL_MS) return null;
  return {
    imageUrl: value.imageUrl,
    imagePath: typeof value.imagePath === "string" ? value.imagePath : null,
    origin: value.origin === "detail_page_done" ? "detail_page_done" : "ai_result",
    clothType: typeof value.clothType === "string" ? value.clothType : null,
    material: typeof value.material === "string" ? value.material : null,
    description: typeof value.description === "string" ? value.description.slice(0, 1000) : null,
    quantity: typeof value.quantity === "number" && Number.isFinite(value.quantity) ? value.quantity : null,
    designId: typeof value.designId === "string" ? value.designId : null,
    createdAt: typeof value.createdAt === "number" ? value.createdAt : now,
  };
};

export const loadProductionDesignHandoff = (stateValue?: unknown): ProductionDesignHandoff | null => {
  const fromState = parseProductionDesignHandoff(stateValue);
  if (fromState) return fromState;
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    return raw ? parseProductionDesignHandoff(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

export const clearProductionDesignHandoff = () => {
  try {
    sessionStorage.removeItem(HANDOFF_KEY);
  } catch {
    // noop
  }
};

// ---------------------------------------------------------------------------
// 양식 선택지 — 제작 경험이 없는 고객도 고르기만 하면 되도록 칩으로 제공한다.
// ---------------------------------------------------------------------------
export const PRODUCTION_ITEM_OPTIONS = [
  "티셔츠",
  "맨투맨 · 후드",
  "셔츠 · 블라우스",
  "니트",
  "아우터 · 자켓",
  "팬츠 · 스커트",
  "단체복 · 유니폼",
  "아직 모르겠어요",
] as const;

export const PRODUCTION_QUANTITY_OPTIONS = [
  { label: "20 ~ 50장", value: 20 },
  { label: "50 ~ 100장", value: 50 },
  { label: "100 ~ 300장", value: 100 },
  { label: "300 ~ 1,000장", value: 300 },
  { label: "1,000장 이상", value: 1000 },
  { label: "아직 모르겠어요", value: null },
] as const;

export const PRODUCTION_BUDGET_OPTIONS = [
  "100만원 미만",
  "100 ~ 300만원",
  "300 ~ 500만원",
  "500 ~ 1,000만원",
  "1,000만원 이상",
  "상담 후 결정",
] as const;

// ---------------------------------------------------------------------------
// 상담 진행 상태(관리자) — DB orders.consult_status 와 같은 키
// ---------------------------------------------------------------------------
export const CONSULT_STATUSES = [
  "received",
  "consulting",
  "quote_sent",
  "contracted",
  "in_production",
  "completed",
  "not_contracted",
] as const;
export type ConsultStatus = (typeof CONSULT_STATUSES)[number];

export const CONSULT_STATUS_LABEL: Record<ConsultStatus, string> = {
  received: "접수 완료",
  consulting: "상담 진행",
  quote_sent: "견적 전달",
  contracted: "계약 완료",
  in_production: "제작 진행",
  completed: "제작 완료",
  not_contracted: "계약 미성사",
};

export const isConsultStatus = (value: unknown): value is ConsultStatus =>
  typeof value === "string" && (CONSULT_STATUSES as readonly string[]).includes(value);

/** 화면에 보일 'from' 값을 허용된 CTA 위치로만 정규화한다. */
export const normalizeCtaSource = (value: string | null | undefined): string => {
  if (!value) return "direct";
  const clean = value.trim().slice(0, 40);
  return /^[a-z_]+$/.test(clean) ? clean : "other";
};
