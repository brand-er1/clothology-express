import { describe, expect, it } from "vitest";
import { normalizeKrPhone } from "./kr-phone";
import {
  formatPhoneInput, normalizeProductionPhone, PRODUCTION_PROGRESS_STATUSES, validateProductionRequest,
} from "../../supabase/functions/_shared/productionRequest";

describe("AI 디자인 제작의뢰 입력 규칙", () => {
  it("전화번호는 010-0000-0000 형식으로 자동 변환된다", () => {
    expect(formatPhoneInput("01012345678")).toBe("010-1234-5678");
    expect(formatPhoneInput("010-1234-56789")).toBe("010-1234-5678");
  });

  it("010 휴대폰만 받고, 서버 normalize_kr_phone 이 받는 번호의 부분집합이다", () => {
    for (const value of ["010-1234-5678", "+82 10 1234 5678", "01099998888"]) {
      expect(normalizeProductionPhone(value)).toBe(normalizeKrPhone(value));
    }
    expect(normalizeProductionPhone("011-123-4567")).toBeNull();
    expect(normalizeProductionPhone("010-1234-567")).toBeNull();
  });

  it("이름 · 전화번호 · 동의만 있으면 접수 가능(수량 미정 기본)", () => {
    const result = validateProductionRequest({ contactName: "홍길동", phone: "010-1234-5678", quantityUndecided: true, privacyConsent: true });
    expect(result.ok).toBe(true);
  });

  it("진행 상태 8단계", () => {
    expect(PRODUCTION_PROGRESS_STATUSES.map((s) => s.label)).toEqual([
      "신규 접수", "상담 대기", "상담 완료", "견적 발송", "계약 완료", "제작 진행", "제작 완료", "계약 미성사",
    ]);
  });
});
