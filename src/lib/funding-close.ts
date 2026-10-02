import type { Funding } from "@/types/funding";

const DAY_MS = 24 * 60 * 60 * 1000;

/** 펀딩 종료 예정일(승인일 + 펀딩 기간). 승인 전이면 null. */
export const getFundingEndDate = (funding: Pick<Funding, "reviewed_at" | "funding_days">) =>
  funding.reviewed_at ? new Date(new Date(funding.reviewed_at).getTime() + funding.funding_days * DAY_MS) : null;

/** 모집이 끝난 펀딩인지(조기 마감 · 종료 · 운영 중단 · 기간 만료). 최종 차단은 서버가 한다. */
export const isFundingRecruitmentOver = (
  funding: Pick<Funding, "status" | "early_closed" | "suspended_at" | "reviewed_at" | "funding_days">,
  now = Date.now(),
) => {
  if (funding.early_closed || funding.status === "closed" || funding.suspended_at) return true;
  const endDate = getFundingEndDate(funding);
  return funding.status === "approved" && endDate !== null && now >= endDate.getTime();
};

/** 조기 마감 결과 라벨. 성공 판정은 서버(success_at)가 한 값을 그대로 쓴다. */
export const getEarlyCloseResultLabel = (funding: Pick<Funding, "success_at">) =>
  funding.success_at ? "펀딩 성공 · 조기 마감" : "목표 미달 · 조기 마감";
