import { describe, expect, it } from "vitest";
import type { Funding } from "@/types/funding";
import { buildFundingSuccessStories, buildSuccessTimeline, toFundingSuccessStory } from "./funding-success-stories";

const funding = (overrides: Partial<Funding> = {}): Funding =>
  ({
    id: "f1",
    creator_id: "c1",
    brand_id: "b1",
    brand: { brand_name: "FENRAX", brand_logo_url: null, short_description: "퍼포먼스웨어 브랜드" } as Funding["brand"],
    product_name: "반팔 티셔츠",
    cloth_type: "반팔 티셔츠",
    image_url: "https://x/fenrax.png",
    description: null,
    moq: 20,
    current_orders: 50,
    price: 39000,
    status: "approved",
    created_at: "2026-09-01T00:00:00Z",
    reviewed_at: "2026-09-10T00:00:00Z",
    funding_status: "success",
    success_at: "2026-10-01T00:00:00Z",
    final_quantity: 50,
    success_participant_count: 31,
    ...overrides,
  }) as Funding;

describe("funding success stories", () => {
  it("maps an existing successful funding without duplicating data", () => {
    const story = toFundingSuccessStory(funding({ success_showcase_category: "퍼포먼스웨어" }))!;
    expect(story).toMatchObject({
      fundingId: "f1",
      brandName: "FENRAX",
      thumbnail: "https://x/fenrax.png",
      category: "퍼포먼스웨어",
      fundingRate: 250,
      fundingAmount: 50 * 39000,
      participantCount: 31,
      completedAt: "2026-10-01T00:00:00Z",
      description: "퍼포먼스웨어 브랜드",
      status: "success",
    });
  });

  it("prefers the admin display rate when set", () => {
    expect(toFundingSuccessStory(funding({ success_showcase_rate: 250, final_quantity: 41 }))!.fundingRate).toBe(250);
  });

  it("ignores fundings the server has not marked as successful", () => {
    expect(toFundingSuccessStory(funding({ success_at: null, funding_status: "funding" }))).toBeNull();
  });

  it("drops hidden showcase entries and sorts newest success first", () => {
    const stories = buildFundingSuccessStories([
      funding({ id: "old", success_at: "2026-08-01T00:00:00Z" }),
      funding({ id: "off", success_at: "2026-10-05T00:00:00Z", success_showcase_visible: false }),
      funding({ id: "new", success_at: "2026-10-03T00:00:00Z" }),
    ]);
    expect(stories.map((story) => story.fundingId)).toEqual(["new", "old"]);
  });

  it("builds the six-step timeline in order", () => {
    expect(buildSuccessTimeline(funding()).map((step) => step.title)).toEqual([
      "아이디어 등록",
      "디자인 및 제작 준비",
      "펀딩 오픈",
      "목표 달성",
      "제작 진행",
      "펀딩 성공",
    ]);
  });
});
