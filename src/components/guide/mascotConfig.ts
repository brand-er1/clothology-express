import type { MascotPose } from "@/components/BrandMascot";

export const RUN_POSES: MascotPose[] = ["run-1", "run-2", "run-3", "run-4", "run-5"];

/** P1 = must-see (errors/payment) ... P5 = throwaway idle chatter. Higher priority wins the bubble slot. */
export type MascotPriority = 1 | 2 | 3 | 4 | 5;

export type GuideMessage = {
  key: string;
  text: string;
  priority: MascotPriority;
  /**
   * Longer explanation shown when the visitor taps "자세히 설명" — the page's actual purpose,
   * what to pick, and what happens after, spelled out instead of the 1-2 line teaser in `text`.
   */
  detail?: string;
  cta?: { label: string; to: string };
  /**
   * Multiple choices instead of a single CTA. Each choice either navigates (`to`), chains to
   * a follow-up message in the same bubble (`next`, e.g. the group-order quantity picker), or
   * just dismisses (neither set — an informational "not sure yet" option).
   */
  choices?: { label: string; to?: string; next?: GuideMessage }[];
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

/** Follow-up shown after picking "단체복 제작하기" (rule 14) — informational, then routes into the real Customize flow. */
export const groupOrderInfo: GuideMessage = {
  key: "group-order-info",
  priority: 2,
  maxDisplayCount: 1,
  text: "회사, 학교, 동아리, 행사 단체복도 제작할 수 있어요. 몇 장 정도 필요하세요?",
  choices: [
    { label: "20~49장", to: "/customize" },
    { label: "50~99장", to: "/customize" },
    { label: "100~299장", to: "/customize" },
    { label: "300장 이상", to: "/customize" },
  ],
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
    { label: "🏢 단체복 제작하기", next: groupOrderInfo },
    { label: "💡 아직 잘 모르겠어요" },
  ],
};

const RETURNING_GREETED_KEY = "brander_mascot_session_greeted";

/** Session-scoped (not persistent) — so a returning visitor gets the light welcome-back line once per visit, not every page. */
export const hasGreetedThisSession = () => {
  try {
    return sessionStorage.getItem(RETURNING_GREETED_KEY) === "1";
  } catch {
    return true;
  }
};

export const markGreetedThisSession = () => {
  try {
    sessionStorage.setItem(RETURNING_GREETED_KEY, "1");
  } catch {
    // sessionStorage unavailable — the greeting just won't be suppressed on repeat visits this tab.
  }
};

/** Shown once per session to visitors who already saw the first-visit intro on an earlier visit (rule 22). */
export const returningVisitorGreeting: GuideMessage = {
  key: "returning-visitor",
  priority: 3,
  maxDisplayCount: 1,
  text: "다시 오셨네요! 👋 필요하신 게 있으면 언제든 눌러주세요.",
};

/**
 * Shown once right when a visitor actually signs in (not on a page load that merely restores an
 * existing session) — greets them by the same name the header shows (브랜드명 → 닉네임 → 이메일
 * 앞부분 순, rule: never invent a name the account doesn't actually have).
 */
export const getLoginWelcomeMessage = (name: string): GuideMessage => ({
  key: "login-welcome",
  priority: 1,
  maxDisplayCount: 1,
  text: `${name}님, 로그인됐어요! 👋 오늘은 뭐 만들어볼까요?`,
});

/** Page-contextual messages, keyed by exact pathname. */
export const staticMessages: Record<string, GuideMessage> = {
  "/": {
    key: "home",
    priority: 3,
    text: "안녕하세요! 저는 BRAND-ER 제작 매니저예요. 만들고 싶은 옷의 아이디어만 있어도 실제 제품 제작까지 진행할 수 있어요.",
    detail:
      "BRAND-ER의 제작 과정은 어렵지 않아요.\n\n① 만들고 싶은 옷을 정하고\n② AI로 디자인을 만들어보고\n③ 제작 조건과 예상 견적을 확인하고\n④ 필요한 경우 샘플·의뢰로 실물을 확인한 뒤\n⑤ 펀딩으로 주문을 모으거나 바로 제작을 진행합니다.\n\n직접 판매하고 싶다면 펀딩을 열어서 주문을 먼저 받은 뒤 생산하는 방법도 있어요.",
    cta: { label: "AI 디자인 시작하기", to: "/customize" },
  },
  "/customize": {
    key: "customize",
    priority: 4,
    text: "여기는 머릿속에 있는 옷을 실제 이미지로 만들어보는 곳이에요. 어떤 옷을 원하는지 하나씩 알려주세요!",
    detail:
      "디자인 프로그램을 사용할 줄 몰라도 괜찮아요. 종류 → 원단 → 상세 디자인을 차례로 고르면 AI가 앞·뒤 디자인을 만들어드리고, 이후 로고 배치와 사이즈·수량까지 정하면 펀딩을 열거나 바로 제작을 의뢰할 수 있어요.",
  },
  "/design-quote": {
    key: "design-quote",
    priority: 4,
    text: "여기서는 이미 가지고 있는 디자인 이미지로 예상 제작비를 확인할 수 있어요.",
    detail:
      "옷 제작비는 원단 가격만으로 결정되지 않아요. 원단비와 함께 패턴, 샘플, 봉제 공임, 부자재, 프린팅이나 자수 같은 후가공 비용 등이 포함됩니다.\n\n제작 수량이 많아질수록 한 번만 필요한 개발비가 여러 장에 나뉘기 때문에 장당 제작비가 낮아질 수 있어요. 견적이 괜찮다면 그대로 제작 의뢰를 접수할 수 있어요.",
  },
  "/fundings": {
    key: "fundings",
    priority: 3,
    text: "이 옷들은 목표 수량만큼 주문이 모이면 제작이 시작돼요. 지금 참여하고 한정판을 만들어보세요.",
  },
  "/orders": {
    key: "orders",
    priority: 4,
    text: "여기서 내가 접수한 제작 의뢰 상태를 확인할 수 있어요.",
    detail:
      "관리자가 이미지와 견적을 확인하는 중이면 대기 상태로, 확인이 끝나면 승인 또는 수정 요청으로 상태가 바뀌어요. 승인되면 등록하신 연락처로 이후 제작 일정을 안내드립니다.",
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

/** Step-keyed tips on the Customize wizard (rule 3/15/16, kept generic — options are DB-driven, so no specific fabric/color is named). */
export const customizeStepTips: Record<number, GuideMessage> = {
  1: {
    key: "customize-step-type",
    priority: 4,
    maxDisplayCount: 1,
    text: "먼저 어떤 종류의 옷을 만들고 싶은지 선택해주세요.",
    detail: "반팔, 맨투맨, 후드, 셔츠, 팬츠, 자켓 등 원하는 제품을 선택하면 다음 단계에서 그 제품에 맞는 원단을 추천해드려요.",
  },
  2: {
    key: "customize-step-material",
    priority: 4,
    maxDisplayCount: 1,
    text: "같은 디자인도 원단에 따라 핏과 분위기가 완전히 달라져요. 카테고리별 추천 원단부터 살펴보시는 걸 추천해요.",
  },
  3: {
    key: "customize-step-detail",
    priority: 4,
    maxDisplayCount: 1,
    text: "이번 단계에서 핏, 컬러, 포켓·지퍼 같은 디테일을 한 번에 정해주세요.",
    detail:
      "같은 티셔츠라도 오버핏인지 레귤러핏인지 크롭인지에 따라 완전히 다른 제품이 되고, 색상도 최대한 구체적으로 알려주실수록 좋아요. 포켓, 지퍼, 절개, 스티치, 워싱처럼 원하는 디테일이 있다면 아래 설명 칸에 함께 적어주세요. 구체적으로 입력할수록 원하는 디자인에 가까워집니다.",
  },
  4: {
    key: "customize-step-generate",
    priority: 4,
    maxDisplayCount: 1,
    text: "입력한 내용을 바탕으로 디자인을 만들어볼게요. 결과가 마음에 들지 않으면 다시 만들 수 있으니 부담 없이 시작해보세요.",
    detail:
      "지금 만들어지는 이미지는 완성된 생산 제품이 아니라 제작 방향을 확인하기 위한 디자인 시안이에요. 실제 생산에서는 원단, 패턴, 봉제 방식, 프린팅 방법 등에 따라 디테일이 조금 달라질 수 있어요.",
  },
  5: {
    key: "customize-step-image",
    priority: 4,
    maxDisplayCount: 1,
    text: "이 이미지를 실제 로고·그래픽으로 다듬고, 예상 견적도 함께 확인하는 단계예요.",
    detail:
      "이미지에 배경이 있다면 제작에 적합하도록 배경 제거가 필요할 수 있어요. 실제 생산에서는 디자인에 따라 나염, DTF, 자수, 실리콘 등 여러 가공 방법을 사용할 수 있고, 적합한 방식은 이 단계의 견적에 반영됩니다.",
  },
  6: {
    key: "customize-step-size",
    priority: 4,
    maxDisplayCount: 1,
    text: "MOQ는 최소 제작 수량이에요. 브랜더에서는 소량 제작부터 시작할 수 있어요.",
    detail:
      "사이즈와 수량을 확인한 뒤, 여러 사람에게 먼저 판매하고 싶다면 '이 이미지로 펀딩 만들기'를, 이미 제작이 확정됐다면 '제작 의뢰하기'를 눌러주세요. 이 디자인이 처음이라면 본생산 전에 샘플로 실제 핏·원단·프린팅 위치를 먼저 확인하는 것도 추천해요.",
  },
};

/** Idle nudge on a funding detail page (rule 19, adapted — this app has no persistent cart, so it's scoped to "still looking at this design"). */
export const fundingDetailHelp: GuideMessage = {
  key: "funding-detail-help",
  priority: 4,
  maxDisplayCount: 1,
  text: "이 디자인 마음에 드세요? 👀 궁금한 부분이 있나요?",
  choices: [
    { label: "제작 과정 알아보기", to: "/fundings" },
    { label: "1:1 문의하기" },
  ],
};

/** Idle nudge on the quote page once a real estimate exists, pointing at the page's own adjustment controls (rule 8). */
export const quoteObjectionNudge: GuideMessage = {
  key: "quote-objection-nudge",
  priority: 4,
  maxDisplayCount: 1,
  text: "가격이 조금 고민되시나요? 위 요청사항 메모에 원하는 수량·예산을 적어주시면 옵션을 다시 맞춰볼 수 있어요.",
};

/** KakaoPay result page: mirrors the page's own already-accurate state text in the mascot's voice (rule 20) — never a separate, possibly-stale claim. */
export const getKakaoPayResultMessage = (resultState: string, resultMessage: string): GuideMessage | null => {
  if (resultState === "failed") {
    return {
      key: "kakaopay-failed",
      priority: 1,
      maxDisplayCount: 1,
      text: `앗, 결제에 문제가 있었어요. ${resultMessage}`,
      choices: [{ label: "다시 시도하기", to: "/my-fundings" }, { label: "1:1 문의하기" }],
    };
  }
  if (resultState === "success") {
    return {
      key: "kakaopay-success",
      priority: 2,
      maxDisplayCount: 1,
      text: "결제 완료! 🎉 참여해주셔서 감사해요. 목표 인원이 모이면 바로 제작이 시작됩니다.",
      cta: { label: "내 펀딩 보기", to: "/my-fundings" },
    };
  }
  return null;
};

type MyFundingsSummary = {
  plannedCount: number;
  needsRevisionCount: number;
};

/**
 * My-page priority message built only from counts the page actually fetched — never a guessed
 * status (rule 18/24). "Goal reached" isn't included: the fetched data has each funding's admin
 * approval status, not whether its participation goal was met, so claiming that would be a guess.
 */
export const getMyFundingsMessage = (summary: MyFundingsSummary): GuideMessage => {
  if (summary.needsRevisionCount > 0) {
    return {
      key: "my-fundings-revision",
      priority: 2,
      maxDisplayCount: 1,
      text: `수정이 필요한 펀딩이 ${summary.needsRevisionCount}건 있어요. 확인해보시겠어요?`,
    };
  }
  if (summary.plannedCount > 0) {
    return {
      key: "my-fundings-planned",
      priority: 3,
      maxDisplayCount: 1,
      text: `결제 예정인 상품이 ${summary.plannedCount}건 있어요.`,
    };
  }
  return {
    key: "my-fundings-generic",
    priority: 4,
    maxDisplayCount: 1,
    text: "내 펀딩 진행상황을 확인해볼까요?",
  };
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

/** Shown once when a seller opens the funding editor for a design (rule: real page, no fabricated state). */
export const fundingEditorIntro: GuideMessage = {
  key: "funding-editor-intro",
  priority: 4,
  maxDisplayCount: 1,
  text: "직접 만든 디자인을 판매해보고 싶으신가요? 제품을 먼저 생산하지 않고 주문을 모집한 뒤 목표 수량이 달성되면 생산을 시작할 수 있어요.",
  detail:
    "몇 장의 주문이 모이면 생산을 시작할지 목표 수량을 정하고, 제작비뿐 아니라 판매 수수료와 예상 수익도 함께 고려해서 판매가격을 설정해주세요. 진행 기간 동안 고객들의 주문을 받게 되고, 예상 순이익은 입력하는 즉시 화면에서 바로 계산돼요. 준비가 끝났다면 저장 후 관리자 승인을 기다리면 됩니다.",
};

/** Shown once when a seller opens the participant-management page for their funding. */
export const fundingManagerIntro: GuideMessage = {
  key: "funding-manager-intro",
  priority: 4,
  maxDisplayCount: 1,
  text: "여기서는 이 펀딩에 참여한 주문자 목록과 결제 현황을 관리할 수 있어요.",
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
