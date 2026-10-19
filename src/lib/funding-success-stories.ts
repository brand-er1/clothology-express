import type { Funding, FundingSuccessStory } from "@/types/funding";

/** 성공 판정은 서버가 기록한 success_at 으로만 한다(프론트엔드에서 수량을 비교하지 않음). */
export const isFundingSucceeded = (funding: Pick<Funding, "success_at" | "funding_status">) =>
  Boolean(funding.success_at) && funding.funding_status !== "funding";

const getSuccessQuantity = (funding: Funding) => funding.final_quantity ?? funding.current_orders;

export const getSuccessFundingRate = (funding: Funding) => {
  if (funding.success_showcase_rate != null) return Math.round(Number(funding.success_showcase_rate));
  return funding.moq > 0 ? Math.round((getSuccessQuantity(funding) / funding.moq) * 100) : 0;
};

export const toFundingSuccessStory = (funding: Funding): FundingSuccessStory | null => {
  if (!funding.success_at || !isFundingSucceeded(funding)) return null;
  const quantity = getSuccessQuantity(funding);

  return {
    fundingId: funding.id,
    brandName: funding.brand?.brand_name ?? "BRAND-ER",
    brandLogo: funding.brand?.brand_logo_url ?? null,
    productName: funding.product_name,
    thumbnail: funding.image_url,
    category: funding.success_showcase_category?.trim() || funding.cloth_type,
    fundingRate: getSuccessFundingRate(funding),
    fundingAmount: funding.price ? funding.price * quantity : null,
    participantCount: funding.success_participant_count ?? null,
    completedAt: funding.success_at,
    description:
      funding.success_showcase_summary?.trim() ||
      funding.brand?.short_description?.trim() ||
      funding.description?.trim() ||
      null,
    status: "success",
    funding,
  };
};

/** 노출 대상 성공 펀딩만 골라 성공일(completedAt) 최신순으로 정렬한다. */
export const buildFundingSuccessStories = (fundings: Funding[]): FundingSuccessStory[] =>
  fundings
    .filter((funding) => funding.success_showcase_visible !== false && !funding.is_hidden)
    .map(toFundingSuccessStory)
    .filter((story): story is FundingSuccessStory => story !== null)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

export type SuccessTimelineStep = {
  key: string;
  title: string;
  description: string;
  date: string | null;
  state: "done" | "current" | "upcoming";
};

/** 성공 스토리 타임라인: 아이디어 등록 → 디자인·제작 준비 → 펀딩 오픈 → 목표 달성 → 제작 진행 → 펀딩 성공 */
export const buildSuccessTimeline = (funding: Funding): SuccessTimelineStep[] => {
  const completedAt = funding.closed_at ?? funding.early_closed_at ?? null;
  const productionDone = funding.production_status === "delivered" || Boolean(completedAt);

  return [
    {
      key: "idea",
      title: "아이디어 등록",
      description: "브랜드의 아이디어를 BRAND-ER에 등록하고 AI 디자인으로 첫 형태를 만들었습니다.",
      date: funding.created_at,
      state: "done",
    },
    {
      key: "prepare",
      title: "디자인 및 제작 준비",
      description: "원단과 디테일을 정하고 상표 검수·제작 견적까지 준비를 마쳤습니다.",
      date: null,
      state: "done",
    },
    {
      key: "open",
      title: "펀딩 오픈",
      description: "검수를 통과해 펀딩이 공개되고 선주문을 받기 시작했습니다.",
      date: funding.reviewed_at,
      state: "done",
    },
    {
      key: "goal",
      title: "목표 달성",
      description: "목표 수량을 넘겨 제작이 확정되었습니다.",
      date: funding.success_at ?? null,
      state: "done",
    },
    {
      key: "production",
      title: "제작 진행",
      description: "펀딩으로 모인 수량만큼 샘플 검수를 거쳐 본생산을 진행합니다.",
      date: funding.production_updated_at ?? null,
      state: productionDone ? "done" : "current",
    },
    {
      key: "success",
      title: "펀딩 성공",
      description: "펀딩을 성공적으로 마무리하고 참여자에게 제품을 전달합니다.",
      date: completedAt,
      state: completedAt ? "done" : "upcoming",
    },
  ];
};
