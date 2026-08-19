import type { MascotPose } from "@/components/BrandMascot";

export type TutorialPosition = "top" | "bottom" | "left" | "right" | "auto";

export interface TutorialCta {
  label: string;
  to: string;
}

export interface TutorialStep {
  /**
   * CSS selector for the real, already-rendered DOM element to spotlight. Omit for a
   * "conceptual" slide — no real UI exists yet for that part of the story (e.g. production
   * stages), so the character just narrates, centered, without a fake mockup.
   */
  target?: string;
  character?: MascotPose;
  message: string;
  position?: TutorialPosition;
  /** Route this step belongs to. If it differs from the current route, the overlay navigates
   * there first — this is what lets one tutorial walk across multiple real pages. */
  page?: string;
  /** Use instead of `page` when the destination route is only known at runtime and matches a
   * pattern rather than one fixed path — e.g. "we clicked into *some* funding's detail page,
   * whichever one is first in the list" (`/^\/fundings\/[^/]+$/`). */
  pagePattern?: RegExp;
  /** Instead of just advancing the tutorial step, real-click the spotlighted element itself
   * (e.g. a funding card) so its own real navigation fires — matches the spec's "show the real
   * page, don't fake it" rule for content that only exists once you're actually there. */
  clickThrough?: boolean;
  /** Extra action buttons shown on this step (typically the last one), e.g. the process
   * tour's closing "AI로 옷 만들어보기 / 자동견적 받아보기 / 펀딩 둘러보기" links. */
  ctas?: TutorialCta[];
}

type PageContext = Record<string, unknown>;

type TutorialSource = TutorialStep[] | ((pageContext: PageContext) => TutorialStep[]);

const homeTutorial: TutorialStep[] = [
  {
    target: '[data-tutorial="home-hero"]',
    page: "/",
    character: "happy",
    message: "안녕하세요! 저는 브랜더예요 👋 원하는 옷을 직접 만들 수 있도록 제가 도와드릴게요.",
    position: "bottom",
  },
  {
    target: '[data-tutorial="home-start-cta"]',
    character: "point-down",
    message: "옷을 만들어보고 싶다면 여기, 컬렉션 시작하기 버튼을 눌러보세요!",
    position: "top",
  },
  {
    target: '[data-tutorial="home-collection"]',
    character: "point-up",
    message: "다른 사람들이 만든 디자인도 여기서 둘러볼 수 있어요.",
    position: "bottom",
  },
  {
    target: '[data-tutorial="header-account"]',
    character: "point-up",
    message: "내가 만든 디자인과 제작 진행상황은 여기서 확인할 수 있어요.",
    position: "bottom",
  },
];

const fundingsTutorial: TutorialStep[] = [
  {
    target: '[data-tutorial="fundings-grid"]',
    page: "/fundings",
    character: "point-down",
    message: "목표 수량만큼 주문이 모이면 제작이 시작되는 한정판 상품들이에요. 마음에 드는 디자인을 눌러 참여해보세요.",
    position: "top",
  },
];

const designQuoteTutorial: TutorialStep[] = [
  {
    target: '[data-tutorial="quote-steps"]',
    page: "/design-quote",
    character: "thinking",
    message: "제작하기 전에 가장 궁금한 건 역시 가격이겠죠? 디자인 업로드 → AI 분석·견적 → 제작 의뢰 접수, 이 세 단계로 예상 제작비를 확인할 수 있어요.",
    position: "bottom",
  },
  {
    target: '[data-tutorial="quote-upload"]',
    page: "/design-quote",
    character: "point-down",
    message: "이미 가지고 있는 디자인 이미지가 있다면 여기에 올려주세요.",
    position: "right",
  },
  {
    target: '[data-tutorial="quote-analyze"]',
    page: "/design-quote",
    character: "calculator",
    message: "이미지를 올렸다면 이 버튼을 눌러주세요. 의류 종류·원단·수량은 물론, 프린팅·자수 같은 후가공 방식과 지퍼·단추 같은 부자재까지 AI가 자동으로 분석해요.",
    position: "top",
  },
  {
    target: '[data-tutorial="quote-result"]',
    page: "/design-quote",
    character: "point-left",
    message: "분석이 끝나면 여기서 항목을 하나씩 직접 조정할 수 있어요 — 의류 종류를 바꾸거나, 원단·수량을 조절하거나, 후가공·부자재를 추가하면 예상 장당 제작비·패턴개발비·샘플비·후가공비·총 제작비가 그 즉시 다시 계산돼요.",
    position: "left",
  },
  {
    page: "/design-quote",
    character: "warning",
    message: "이 견적은 제작을 결정하기 전에 예산을 빠르게 확인하기 위한 예상 견적이에요. 실제 제작에서는 디자인 구조·원단·부자재·가공 난이도에 따라 최종 금액이 조정될 수 있어요.",
  },
];

/** Customize is a one-step-at-a-time wizard, so the tutorial only ever explains the step
 * currently mounted on screen instead of steps that don't exist in the DOM yet. */
const customizeTutorial = (pageContext: PageContext): TutorialStep[] => {
  const step = typeof pageContext.step === "number" ? pageContext.step : 1;

  switch (step) {
    case 1:
      return [
        {
          target: '[data-tutorial="customize-type"]',
          page: "/customize",
          character: "clothes",
          message: "먼저 만들고 싶은 옷 종류를 선택해주세요.",
          position: "auto",
        },
      ];
    case 2:
      return [
        {
          target: '[data-tutorial="customize-material"]',
          page: "/customize",
          character: "point-down",
          message: "같은 디자인도 원단에 따라 느낌과 가격이 달라져요. 원하는 원단을 선택해주세요.",
          position: "auto",
        },
      ];
    case 3:
      return [
        {
          target: '[data-tutorial="customize-prompt"]',
          page: "/customize",
          character: "thinking",
          message: "여기에 만들고 싶은 옷을 색상, 핏, 프린트 위치까지 자유롭게 설명해주세요.",
          position: "auto",
        },
        {
          target: '[data-tutorial="customize-example"]',
          page: "/customize",
          character: "point-down",
          message: "어떻게 적어야 할지 모르겠다면 이 예시를 참고해보세요!",
          position: "top",
        },
      ];
    case 4:
      return [
        {
          target: '[data-tutorial="customize-generate"]',
          page: "/customize",
          character: "point-down",
          message: "이제 생성하기를 눌러볼까요?",
          position: "top",
        },
        {
          target: '[data-tutorial="customize-results"]',
          page: "/customize",
          character: "happy",
          message: "짜잔! 생성된 디자인은 여기에서 확인할 수 있어요.",
          position: "auto",
        },
      ];
    case 5:
      return [
        {
          target: '[data-tutorial="customize-modify"]',
          page: "/customize",
          character: "point-right",
          message: "이미지를 어떻게 수정할지 아래에 설명하면 AI가 바로 다시 반영해드려요.",
          position: "auto",
        },
        {
          target: '[data-tutorial="customize-artwork"]',
          page: "/customize",
          character: "point-left",
          message: "직접 만든 로고나 이미지를 옷의 원하는 위치에 배치할 수도 있어요.",
          position: "left",
        },
      ];
    case 6:
    default:
      return [
        {
          target: '[data-tutorial="customize-quantity"]',
          page: "/customize",
          character: "calculator",
          message: "제작하고 싶은 수량을 입력해주세요. MOQ는 최소 제작 수량이고, 수량에 따라 예상 단가가 달라져요.",
          position: "auto",
        },
        {
          target: "[data-mascot-safezone]",
          page: "/customize",
          character: "happy",
          message: "준비됐어요! 여러 사람에게 먼저 판매하고 싶다면 펀딩을, 이미 제작이 확정됐다면 제작 의뢰하기를 눌러주세요.",
          position: "top",
        },
      ];
  }
};

const fundingEditorTutorial: TutorialStep[] = [
  {
    target: '[data-tutorial="funding-image"]',
    character: "point-right",
    message: "펀딩에서 가장 먼저 보여질 대표 이미지예요.",
    position: "right",
  },
  {
    target: "#product-name",
    character: "point-down",
    message: "사람들이 쉽게 이해할 수 있는 상품명을 적어주세요.",
    position: "bottom",
  },
  {
    target: "#price",
    character: "calculator",
    message: "판매할 가격을 설정해주세요.",
    position: "bottom",
  },
  {
    target: "#moq",
    character: "point-up",
    message: "몇 명이 모이면 제작을 시작할지, 목표 수량을 정해주세요.",
    position: "bottom",
  },
  {
    target: "#funding-days",
    character: "point-up",
    message: "펀딩을 진행할 기간을 설정해주세요.",
    position: "bottom",
  },
  {
    target: '[data-tutorial="funding-preview"]',
    character: "point-left",
    message: "등록하기 전에 실제 고객에게 어떻게 보이는지 미리 확인할 수 있어요.",
    position: "bottom",
  },
  {
    target: '[data-tutorial="funding-submit"]',
    character: "happy",
    message: "모두 준비됐어요! 저장하면 관리자 승인 후 바로 공개돼요 🎉",
    position: "top",
  },
];

const myFundingsTutorial: TutorialStep[] = [
  {
    target: '[data-tutorial="myf-created-tab"]',
    page: "/my-fundings",
    character: "point-down",
    message: "직접 만든 펀딩은 여기서 관리할 수 있어요.",
    position: "bottom",
  },
  {
    target: '[data-tutorial="myf-joined-tab"]',
    character: "point-down",
    message: "구매하거나 참여한 상품, 결제 완료·예정 내역은 여기에서 확인할 수 있어요.",
    position: "bottom",
  },
];

/**
 * Sample → mass production → inspection → shipping have no dedicated screen anywhere in the
 * app yet, so these stay pure narration (no `target`) instead of spotlighting a fabricated
 * mockup — honest about what's real UI and what's a preview of what's coming.
 */
const productionProcessSteps: TutorialStep[] = [
  {
    character: "production",
    message: "제작이 정해지면 본생산 전에 먼저 실제 샘플을 만들어요. 원단 확인 → 패턴 → 샘플 제작 → 샘플 확인 순서로, 화면 속 디자인이 실제 옷이 되는 첫 단계예요.",
  },
  {
    character: "production",
    message: "샘플 확인이 끝나면 실제 주문 수량만큼 본생산을 진행해요. 지금 제작이 어디까지 진행됐는지는 마이페이지에서 확인할 수 있어요.",
  },
  {
    character: "delivery",
    message: "생산이 끝났다고 바로 보내지는 않아요 — 제품 상태를 확인하는 검수와 포장을 거쳐 배송을 준비해요.",
  },
  {
    character: "delivery",
    message: "완성! 아이디어였던 옷이 실제 제품이 되어 배송돼요 🎉",
  },
];

/** Matches any funding's detail route (/fundings/<id>) — used once we've clicked into
 * *some* funding from the list, whose id is only known at runtime. */
const FUNDING_DETAIL_PATTERN = /^\/fundings\/[^/]+$/;

/** Real spotlights on an actual funding detail page — reached via a real click-through from the
 * funding list, never a fabricated mock. No real order/payment is ever triggered here. */
const fundingDetailSteps: TutorialStep[] = [
  {
    target: '[data-tutorial="funding-detail-image"]',
    pagePattern: FUNDING_DETAIL_PATTERN,
    character: "point-right",
    message: "고객은 여기서 실제 디자인을 확인해요.",
    position: "right",
  },
  {
    target: '[data-tutorial="funding-detail-price"]',
    pagePattern: FUNDING_DETAIL_PATTERN,
    character: "calculator",
    message: "판매 가격도 여기에서 확인할 수 있어요.",
    position: "bottom",
  },
  {
    target: '[data-tutorial="funding-detail-progress"]',
    pagePattern: FUNDING_DETAIL_PATTERN,
    character: "point-up",
    message: "현재 몇 명이 참여했고 목표까지 얼마나 남았는지 확인할 수 있어요.",
    position: "bottom",
  },
  {
    target: '[data-tutorial="funding-detail-size"]',
    pagePattern: FUNDING_DETAIL_PATTERN,
    character: "point-down",
    message: "구매자는 원하는 사이즈를 선택해서 참여할 수 있어요.",
    position: "bottom",
  },
  {
    target: '[data-tutorial="funding-detail-participate"]',
    pagePattern: FUNDING_DETAIL_PATTERN,
    character: "happy",
    message: "마음에 들면 여기에서 펀딩에 참여하게 돼요. (이 튜토리얼에서는 실제 결제로 이어지지 않아요.)",
    position: "top",
  },
];

/** /fundings is public (no login required), so this walks the real list → a real card → a real
 * detail page, exactly as the visitor would themselves — never a mocked-up substitute. */
const fundingConceptSteps: TutorialStep[] = [
  {
    target: '[data-tutorial="fundings-grid"]',
    page: "/fundings",
    character: "point-down",
    message: "펀딩은 옷을 먼저 많이 생산해두는 방식이 아니에요. 디자인을 먼저 공개하고, 사람들이 얼마나 원하는지 먼저 확인해볼 수 있어요.",
    position: "top",
  },
  {
    target: '[data-tutorial="funding-card"]',
    page: "/fundings",
    character: "point-up",
    message: "상품 이미지·이름·가격은 물론, 지금까지 참여한 인원과 목표 인원·달성률·남은 기간까지 카드 하나에서 확인할 수 있어요. 하나를 눌러 자세히 볼까요?",
    position: "bottom",
    clickThrough: true,
  },
  ...fundingDetailSteps,
  {
    pagePattern: FUNDING_DETAIL_PATTERN,
    character: "thinking",
    message: "이번엔 이 옷을 만든 사람 입장에서 볼게요. 내가 AI로 만든 디자인도 이렇게 펀딩 상품으로 등록할 수 있어요.",
  },
  {
    pagePattern: FUNDING_DETAIL_PATTERN,
    character: "happy",
    message: "목표 인원이 모이면 그대로 실제 생산 단계로 이어져요. 재고를 먼저 많이 만들어두지 않아도 아이디어를 시장에서 검증할 수 있다는 게 펀딩의 장점이에요.",
    ctas: [{ label: "펀딩 만들어보기", to: "/customize" }],
  },
];

/**
 * The full "브랜더 어떻게 이용하나요?" walkthrough — walks the real pages one by one:
 * /customize (AI design) → /design-quote (real quote flow) → /fundings → a real funding's own
 * detail page. Not narration over a single screen — each page actually loads before its part is
 * explained. /customize and /design-quote require being logged in (AuthGuard); TutorialOverlay's
 * navigation effect already bails out with a "로그인 후 이용할 수 있어요" toast instead of
 * hanging if a step's page redirects an anonymous visitor to /auth.
 */
const brandProcessSteps: TutorialStep[] = [
  {
    character: "thinking",
    message: "처음 오셨군요! 제가 브랜더에서 옷을 만드는 과정을 직접 보여드릴게요. 디자인부터 실제 펀딩까지, 페이지를 직접 옮겨가며 같이 가볼까요?",
  },
  {
    target: '[data-tutorial="customize-type"]',
    page: "/customize",
    character: "clothes",
    message: "첫 번째는 디자인이에요. 원하는 옷을 글로 설명하면 AI가 디자인 이미지를 만들어드려요. 디자인을 직접 그리지 못해도 괜찮아요 — 원하는 느낌부터 시작하면 됩니다.",
    position: "auto",
  },
  {
    page: "/customize",
    character: "point-down",
    message: "종류를 고르면 원단과 디테일을 차례로 정하고, 마지막엔 색상·핏·프린트 위치 같은 걸 문장으로 자유롭게 설명해요. 예: '빈티지한 오버핏 반팔, 워싱 블랙 컬러, 앞면 작은 로고, 뒷면 그래픽'처럼요.",
  },
  {
    page: "/customize",
    character: "happy",
    message: "이렇게 AI가 디자인을 만들어줘요. 중요한 건 여기서 끝이 아니라는 거예요 — AI로 만든 디자인을 실제 옷으로 제작할 수도 있고, 펀딩 상품으로 만들어볼 수도 있어요.",
  },
  ...designQuoteTutorial,
  {
    page: "/design-quote",
    character: "thinking",
    message: "견적까지 확인했다면 이제 어떻게 진행할지 선택하면 돼요. 필요한 수량이 정해져 있다면 이 디자인 그대로 제작을 의뢰하고, 아직 바로 생산하기 부담스럽다면 펀딩으로 사람들의 반응을 먼저 확인할 수도 있어요.",
  },
  {
    page: "/design-quote",
    character: "funding",
    message: "이번엔 펀딩 쪽으로 같이 가볼게요 →",
  },
  ...fundingConceptSteps.map((s) => ({ ...s, ctas: undefined })),
  ...productionProcessSteps,
  {
    character: "happy",
    message: "브랜더에서는 AI로 이미지만 만드는 게 아니라, 그 디자인을 실제 옷으로 연결할 수 있어요. 아이디어 → AI 디자인 → 디자인 견적 → 제작 의뢰/펀딩 → 샘플 → 본생산 → 검수·배송, 하나로 이어지는 과정이에요.",
    ctas: [
      { label: "AI로 옷 만들어보기", to: "/customize" },
      { label: "자동견적 확인하기", to: "/design-quote" },
      { label: "펀딩 둘러보기", to: "/fundings" },
    ],
  },
];

/** Keyed by an internal tutorial id, not the raw pathname — see getTutorialKeyForPath. */
export const tutorials: Record<string, TutorialSource> = {
  home: homeTutorial,
  fundings: fundingsTutorial,
  "design-quote": designQuoteTutorial,
  customize: customizeTutorial,
  fundingEditor: fundingEditorTutorial,
  myFundings: myFundingsTutorial,
  brandProcess: brandProcessSteps,
  fundingConcept: fundingConceptSteps,
  productionProcess: productionProcessSteps,
};

export const tutorialLabels: Record<string, string> = {
  home: "홈",
  fundings: "펀딩 둘러보기",
  "design-quote": "디자인 견적",
  customize: "AI 디자인 만들기",
  fundingEditor: "펀딩 만들기",
  myFundings: "내 펀딩",
  brandProcess: "브랜더 이용방법",
  fundingConcept: "펀딩 안내",
  productionProcess: "제작 과정",
};

/** Real page → tutorial id, so a new page only needs a new entry here + above (rule 11). */
export const getTutorialKeyForPath = (pathname: string): string | null => {
  if (pathname === "/") return "home";
  if (pathname === "/fundings") return "fundings";
  if (pathname === "/design-quote") return "design-quote";
  if (pathname === "/customize") return "customize";
  if (pathname === "/my-fundings") return "myFundings";
  if (/^\/fundings\/[^/]+\/edit$/.test(pathname)) return "fundingEditor";
  return null;
};

export const resolveTutorialSteps = (
  key: string | null,
  pageContext: PageContext,
): TutorialStep[] => {
  if (!key) return [];
  const source = tutorials[key];
  if (!source) return [];
  return typeof source === "function" ? source(pageContext) : source;
};

export interface FaqItem {
  q: string;
  a: string;
}

export const faqItems: FaqItem[] = [
  {
    q: "펀딩이 뭔가요?",
    a: "목표 수량만큼 주문이 모이면 제작이 시작되는 방식이에요. 재고를 미리 만들어두지 않고, 목표를 채운 디자인만 실제로 생산합니다.",
  },
  {
    q: "MOQ(최소 제작 수량)는 뭔가요?",
    a: "한 번 생산할 때 필요한 최소 수량이에요. 의류 종류와 원단에 따라 최소 수량이 다르게 적용됩니다.",
  },
  {
    q: "AI로 만든 디자인이 실제 제품과 똑같이 나오나요?",
    a: "생성된 이미지는 제작 방향을 확인하기 위한 시안이에요. 실제 생산에서는 원단, 패턴, 봉제 방식, 프린팅 방법 등에 따라 디테일이 조금 달라질 수 있어요.",
  },
  {
    q: "결제는 언제, 어떻게 하나요?",
    a: "펀딩 참여 시 카카오페이로 결제할 수 있고, 목표 수량이 채워지지 않으면 제작이 시작되지 않아요. 진행 방식은 펀딩마다 다를 수 있습니다.",
  },
  {
    q: "취소·환불도 가능한가요?",
    a: "내 펀딩 페이지에서 결제한 참여 건을 직접 취소할 수 있고, 카카오페이 결제 건은 취소 시 전액 환불됩니다.",
  },
  {
    q: "펀딩 없이 바로 제작을 의뢰할 수도 있나요?",
    a: "네, AI 디자인 마지막 단계나 디자인 견적 페이지에서 펀딩을 열지 않고 바로 제작 의뢰를 접수할 수 있어요. 관리자가 확인 후 연락드립니다.",
  },
  {
    q: "직접 만든 로고나 이미지를 옷에 넣을 수 있나요?",
    a: "네, AI 디자인 수정 단계에서 로고·이미지를 업로드하면 위치와 크기를 지정해 옷에 배치하고, 자동으로 상표 위험도 검수할 수 있어요.",
  },
  {
    q: "더 궁금한 점은 어디서 물어보나요?",
    a: "브랜더 캐릭터 메뉴의 1:1 도움받기를 누르면 카카오톡 채널로 바로 문의할 수 있어요.",
  },
];
