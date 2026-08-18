import type { MascotPose } from "@/components/BrandMascot";

export const RUN_POSES: MascotPose[] = ["run-1", "run-2", "run-3", "run-4", "run-5"];

/** P1 = must-see (errors/payment) ... P5 = throwaway idle chatter. Higher priority wins the bubble slot. */
export type MascotPriority = 1 | 2 | 3 | 4 | 5;

export type GuideMessage = {
  key: string;
  text: string;
  priority: MascotPriority;
  cta?: { label: string; to: string };
  /** Multiple choices instead of a single CTA (e.g. the first-visit purpose picker). */
  choices?: { label: string; to?: string }[];
  /** Minimum time before this exact message key can be shown again this session. Default: never repeats. */
  cooldownMs?: number;
  /** Max times this key can be shown in a session. Default: 1. */
  maxDisplayCount?: number;
};

const FIRST_VISIT_KEY = "brander_mascot_first_visit_done";

export const hasSeenFirstVisitIntro = () => {
  try {
    return localStorage.getItem(FIRST_VISIT_KEY) === "1";
  } catch {
    return true;
  }
};

export const markFirstVisitIntroSeen = () => {
  try {
    localStorage.setItem(FIRST_VISIT_KEY, "1");
  } catch {
    // localStorage unavailable (private mode etc.) — the intro just won't be suppressed, that's fine.
  }
};

/** Shown once, before any route-specific message, to first-time visitors (rule 1 + 2). */
export const firstVisitIntro: GuideMessage = {
  key: "first-visit-intro",
  priority: 2,
  maxDisplayCount: 1,
  text: "처음 오셨나요? 👋 브랜더에서는 아이디어만 있어도 AI 디자인부터 펀딩·제작·배송까지 이어져요. 오늘은 어떤 일로 오셨어요?",
  choices: [
    { label: "👕 내 옷 제작하기", to: "/customize" },
    { label: "🚀 디자인해서 판매하기", to: "/customize" },
    { label: "🛍 펀딩 상품 구매하기", to: "/fundings" },
    { label: "🏢 단체복 제작하기", to: "/customize" },
    { label: "💡 아직 잘 모르겠어요" },
  ],
};

/** Page-contextual messages, keyed by exact pathname. */
export const staticMessages: Record<string, GuideMessage> = {
  "/": {
    key: "home",
    priority: 3,
    text: "안녕하세요! 👋 브랜더예요. 같이 옷 만들어볼까요?",
    cta: { label: "펀딩 둘러보기", to: "/fundings" },
  },
  "/customize": {
    key: "customize",
    priority: 4,
    text: "어떤 스타일을 만들고 싶으신가요? AI가 멋진 디자인을 도와드릴게요!",
  },
  "/design-quote": {
    key: "design-quote",
    priority: 4,
    text: "제작 수량이 많아질수록 장당 단가는 내려가요. 샘플비·패턴비는 처음 한 번만 드는 개발비이고, 원단·후가공에 따라 총액이 달라져요.",
  },
  "/fundings": {
    key: "fundings",
    priority: 3,
    text: "펀딩에 참여하면 제작이 시작돼요! 지금 참여하고 한정판을 만드세요.",
  },
  "/my-fundings": {
    key: "my-fundings",
    priority: 4,
    text: "내 펀딩 진행상황을 확인해볼까요?",
  },
};

/** Shown once on the first visit to any funding page, explaining the funding concept (rule 10). */
export const fundingConceptIntro: GuideMessage = {
  key: "funding-concept-intro",
  priority: 4,
  maxDisplayCount: 1,
  text: "이 옷들은 주문이 목표 수량만큼 모이면 제작이 시작돼요. 그래서 재고를 미리 만들어두지 않아도 되고, 목표를 채우면 바로 생산에 들어갑니다.",
};

/** Nudge for the Customize AI-prompt step when the description is still short after a while (rule 4/5). */
export const customizeDetailNudge: GuideMessage = {
  key: "customize-detail-nudge",
  priority: 4,
  maxDisplayCount: 1,
  text: "어떻게 설명해야 할지 막막하다면, 아래 예시 카드의 '예시 사용하기'를 눌러보세요. 선택하신 아이템과 요즘 트렌드에 맞춘 문장을 바로 채워드려요.",
};

/** Random tips shown when the visitor has been idle for a while, per rule 7 of the spec. */
export const idleTips = [
  "어떤 옷을 만들지 고민 중이에요? 👀",
  "제가 도와드릴까요?",
  "AI로 디자인부터 만들어볼 수도 있어요!",
];

export const getFundingDetailId = (pathname: string) => {
  const match = pathname.match(/^\/fundings\/([^/]+)$/);
  return match ? match[1] : null;
};

/** Real progress from actual funding data only — never a fabricated percentage (rule 12 / 24). */
export const getFundingProgressMessage = (
  fundingId: string,
  currentOrders: number,
  moq: number
): GuideMessage => {
  const remaining = Math.max(0, moq - currentOrders);
  const ratio = moq > 0 ? currentOrders / moq : 0;

  if (remaining <= 0) {
    return {
      key: `funding-${fundingId}-done`,
      priority: 3,
      text: "🎉 목표 달성! 이제 실제 생산이 시작됩니다.",
    };
  }

  if (ratio >= 0.7) {
    return {
      key: `funding-${fundingId}-hot`,
      priority: 3,
      text: `🔥 제작까지 얼마 안 남았어요! 목표 달성까지 ${remaining}명.`,
    };
  }

  if (ratio >= 0.3) {
    return {
      key: `funding-${fundingId}-warm`,
      priority: 3,
      text: `조금씩 사람들이 모이고 있어요 👀 목표 달성까지 ${remaining}명 남았어요.`,
    };
  }

  return {
    key: `funding-${fundingId}-new`,
    priority: 3,
    text: "이 디자인의 첫 번째 서포터가 되어보세요! 함께 참여해주시면 더 빨리 제작돼요.",
  };
};

/**
 * Elements marked with this attribute (checkout/order buttons, modals, nav, forms) tell the
 * mascot to dock into a compact, out-of-the-way corner instead of roaming the bottom band —
 * satisfying "never cover important UI" without a full generic collision engine.
 */
export const SAFE_ZONE_SELECTOR = "[data-mascot-safezone]";
