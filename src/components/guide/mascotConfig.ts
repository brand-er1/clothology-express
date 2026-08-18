import type { MascotPose } from "@/components/BrandMascot";

export const RUN_POSES: MascotPose[] = ["run-1", "run-2", "run-3", "run-4", "run-5"];

export type GuideMessage = {
  key: string;
  text: string;
  cta?: { label: string; to: string };
};

/** Page-contextual messages, keyed by exact pathname. */
export const staticMessages: Record<string, GuideMessage> = {
  "/": {
    key: "home",
    text: "안녕하세요! 👋 브랜더예요. 같이 옷 만들어볼까요?",
    cta: { label: "펀딩 둘러보기", to: "/fundings" },
  },
  "/customize": {
    key: "customize",
    text: "어떤 스타일을 만들고 싶으신가요? AI가 멋진 디자인을 도와드릴게요!",
  },
  "/design-quote": {
    key: "design-quote",
    text: "예상 제작비를 확인해보세요! 수량에 따라 할인도 받을 수 있어요.",
  },
  "/fundings": {
    key: "fundings",
    text: "펀딩에 참여하면 제작이 시작돼요! 지금 참여하고 한정판을 만드세요.",
  },
  "/my-fundings": {
    key: "my-fundings",
    text: "내 펀딩 진행상황을 확인해볼까요?",
  },
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

/**
 * Elements marked with this attribute (checkout/order buttons, modals, nav, forms) tell the
 * mascot to dock into a compact, out-of-the-way corner instead of roaming the bottom band —
 * satisfying "never cover important UI" without a full generic collision engine.
 */
export const SAFE_ZONE_SELECTOR = "[data-mascot-safezone]";
