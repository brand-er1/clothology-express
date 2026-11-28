import { describe, expect, it } from "vitest";
import {
  CONSULT_STATUSES,
  CONSULT_STATUS_LABEL,
  isConsultStatus,
  normalizeCtaSource,
  parseProductionDesignHandoff,
  productionRequestHref,
} from "./production-request";
import { buildInquiryDescription, type ProductionInquiryInput } from "@/services/productionInquiry";

describe("production request handoff", () => {
  it("accepts a stored AI design image", () => {
    const parsed = parseProductionDesignHandoff({
      imageUrl: "https://example.supabase.co/storage/v1/object/public/generated_images/a.png",
      origin: "ai_result",
      clothType: "후드티",
      quantity: 50,
      createdAt: 1000,
    }, 2000);
    expect(parsed?.clothType).toBe("후드티");
    expect(parsed?.quantity).toBe(50);
    expect(parsed?.origin).toBe("ai_result");
  });

  it("rejects missing, non-http and expired images", () => {
    expect(parseProductionDesignHandoff(null)).toBeNull();
    expect(parseProductionDesignHandoff({ imageUrl: "javascript:alert(1)" })).toBeNull();
    expect(parseProductionDesignHandoff({ imageUrl: "https://x/y.png", createdAt: 0 }, 7 * 60 * 60 * 1000)).toBeNull();
  });

  it("tags the CTA source in the request link", () => {
    expect(productionRequestHref("header")).toBe("/production-request?from=header");
    expect(normalizeCtaSource("ai_result")).toBe("ai_result");
    expect(normalizeCtaSource(null)).toBe("direct");
    expect(normalizeCtaSource("<script>")).toBe("other");
  });
});

describe("consult statuses", () => {
  it("has the seven admin statuses in order", () => {
    expect(CONSULT_STATUSES.map((status) => CONSULT_STATUS_LABEL[status])).toEqual([
      "접수 완료", "상담 진행", "견적 전달", "계약 완료", "제작 진행", "제작 완료", "계약 미성사",
    ]);
    expect(isConsultStatus("quote_sent")).toBe(true);
    expect(isConsultStatus("approved")).toBe(false);
  });
});

describe("inquiry description", () => {
  const base: ProductionInquiryInput = {
    contactName: "", contactPhone: "01012345678", item: null, quantityLabel: null, quantityValue: null,
    budgetRange: null, desiredDueDate: null, notes: "", privacyConsent: true, attachments: [], design: null, source: "direct",
  };

  it("is empty when the customer only left a phone number", () => {
    expect(buildInquiryDescription(base)).toBe("");
  });

  it("lists every optional answer the customer chose", () => {
    const text = buildInquiryDescription({
      ...base, item: "티셔츠", quantityLabel: "50 ~ 100장", budgetRange: "100 ~ 300만원", desiredDueDate: "2027-01-10", notes: "로고 자수",
    });
    expect(text).toContain("제작 희망 품목: 티셔츠");
    expect(text).toContain("예상 제작 수량: 50 ~ 100장");
    expect(text).toContain("희망 예산: 100 ~ 300만원");
    expect(text).toContain("희망 납기일: 2027-01-10");
    expect(text).toContain("기타 요청사항:\n로고 자수");
  });
});
