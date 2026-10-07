import { describe, expect, it } from "vitest";
import {
  earlyCloseAchievementRate,
  getEarlyCloseResultLabel,
  isEarlyCloseSuccess,
  isFundingRecruitmentOver,
} from "./funding-close";

const base = {
  status: "approved" as const,
  early_closed: false,
  suspended_at: null,
  reviewed_at: "2026-10-01T00:00:00.000Z",
  funding_days: 30,
};
const now = new Date("2026-10-02T00:00:00.000Z").getTime();

describe("isFundingRecruitmentOver", () => {
  it("keeps an approved funding open within its period", () => {
    expect(isFundingRecruitmentOver(base, now)).toBe(false);
  });

  it("treats early-closed, closed, and suspended fundings as over", () => {
    expect(isFundingRecruitmentOver({ ...base, status: "closed", early_closed: true }, now)).toBe(true);
    expect(isFundingRecruitmentOver({ ...base, status: "closed" }, now)).toBe(true);
    expect(isFundingRecruitmentOver({ ...base, suspended_at: "2026-10-01T12:00:00.000Z" }, now)).toBe(true);
  });

  it("treats an approved funding past its end date as over", () => {
    expect(isFundingRecruitmentOver(base, new Date("2026-11-01T00:00:00.000Z").getTime())).toBe(true);
  });
});

describe("getEarlyCloseResultLabel", () => {
  it("uses the server success state", () => {
    expect(getEarlyCloseResultLabel({ success_at: "2026-10-02T00:00:00.000Z" })).toBe("펀딩 성공 · 조기 마감");
    expect(getEarlyCloseResultLabel({ success_at: null })).toBe("목표 미달 · 조기 마감");
  });
});

describe("earlyCloseAchievementRate", () => {
  it("keeps over-achievement (no cap) and handles unmet / zero goals", () => {
    expect(earlyCloseAchievementRate({ current_orders: 50, moq: 20 })).toBe(250);
    expect(earlyCloseAchievementRate({ current_orders: 18, moq: 30 })).toBe(60);
    expect(earlyCloseAchievementRate({ current_orders: 5, moq: 0 })).toBe(0);
  });
});

describe("isEarlyCloseSuccess", () => {
  it("only counts early-closed fundings the server marked successful", () => {
    expect(isEarlyCloseSuccess({ early_closed: true, success_at: "2026-10-03T00:00:00.000Z" })).toBe(true);
    expect(isEarlyCloseSuccess({ early_closed: true, success_at: null })).toBe(false);
    expect(isEarlyCloseSuccess({ early_closed: false, success_at: "2026-10-03T00:00:00.000Z" })).toBe(false);
  });
});
