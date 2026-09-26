import { describe, expect, it } from "vitest";
import { formatKrPhone, normalizeKrPhone } from "./kr-phone";

describe("normalizeKrPhone", () => {
  it.each([
    ["010-1234-5678", "01012345678"],
    ["01012345678", "01012345678"],
    ["010 1234 5678", "01012345678"],
    ["+82 10-1234-5678", "01012345678"],
    ["+82 010-1234-5678", "01012345678"],
    ["011-123-4567", "0111234567"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeKrPhone(input)).toBe(expected);
  });

  it.each(["", "02-123-4567", "010-123-456", "010-1234-56789", "abc", "070-1234-5678"])("rejects %s", (input) => {
    expect(normalizeKrPhone(input)).toBeNull();
  });
});

describe("formatKrPhone", () => {
  it("formats normalized numbers for display", () => {
    expect(formatKrPhone("01012345678")).toBe("010-1234-5678");
    expect(formatKrPhone("0111234567")).toBe("011-123-4567");
  });
});
