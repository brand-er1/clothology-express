import { describe, expect, it } from "vitest";
import { paymentModeInfo, providerForMode, resolvePaymentMode } from "./config";

describe("resolvePaymentMode", () => {
  it("never runs mock checkout in a production build", () => {
    expect(resolvePaymentMode("mock", true)).toBe("disabled");
    expect(resolvePaymentMode("MOCK", true)).toBe("disabled");
  });

  it("disables payment in production when the mode is missing or unknown", () => {
    expect(resolvePaymentMode(undefined, true)).toBe("disabled");
    expect(resolvePaymentMode("", true)).toBe("disabled");
    expect(resolvePaymentMode("ksnet", true)).toBe("disabled");
  });

  it("keeps explicit test/live/disabled in production", () => {
    expect(resolvePaymentMode("live", true)).toBe("live");
    expect(resolvePaymentMode(" Test ", true)).toBe("test");
    expect(resolvePaymentMode("disabled", true)).toBe("disabled");
  });

  it("defaults local development to mock so features work without PG settings", () => {
    expect(resolvePaymentMode(undefined, false)).toBe("mock");
    expect(resolvePaymentMode("nonsense", false)).toBe("mock");
    expect(resolvePaymentMode("live", false)).toBe("live");
  });
});

describe("providerForMode", () => {
  it("maps modes to providers", () => {
    expect(providerForMode("mock")).toBe("mock");
    expect(providerForMode("test")).toBe("ksnet");
    expect(providerForMode("live")).toBe("ksnet");
    expect(providerForMode("disabled")).toBeNull();
  });
});

describe("paymentModeInfo", () => {
  it("labels mock and test payments so they are never mistaken for real ones", () => {
    expect(paymentModeInfo("mock").label).toBe("모의결제");
    expect(paymentModeInfo("test").label).toBe("테스트 결제");
    expect(paymentModeInfo("live").label).toBe("결제");
    expect(paymentModeInfo("live").notice).toBeNull();
    expect(paymentModeInfo("disabled").enabled).toBe(false);
  });
});
