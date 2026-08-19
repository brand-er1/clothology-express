import { describe, expect, it } from "vitest";
import { createEmptySizeQuantities, READY_MADE_PRINT_LOCATION_PRICE } from "@/data/ready-made-pricing-config";
import { calculateReadyMadeQuote, sumReadyMadeSizeQuantities } from "@/lib/ready-made-pricing";
import type { ReadyMadePrintJob } from "@/types/readyMadeOrder";

const sizesWithTotal = (quantity: number) => ({
  ...createEmptySizeQuantities(),
  M: quantity,
});

const printJob = (overrides: Partial<ReadyMadePrintJob> = {}): ReadyMadePrintJob => ({
  id: "front",
  location: "front_center",
  side: "front",
  placement: { xPercent: 50, yPercent: 50, widthPercent: 30 },
  ...overrides,
});

describe("sumReadyMadeSizeQuantities", () => {
  it("sums every size bucket", () => {
    const sizes = {
      ...createEmptySizeQuantities(),
      XS: 0,
      S: 5,
      M: 10,
      L: 15,
      XL: 10,
      "2XL": 5,
      "3XL": 5,
    };
    expect(sumReadyMadeSizeQuantities(sizes)).toBe(50);
  });

  it("ignores negative/non-finite values instead of letting them reduce the total", () => {
    const sizes = { ...createEmptySizeQuantities(), M: 10, L: Number.NaN, XL: -3 };
    expect(sumReadyMadeSizeQuantities(sizes)).toBe(10);
  });
});

describe("calculateReadyMadeQuote", () => {
  it("장당 예상금액 = 기본단가 + 프린팅 위치 개수 × 5,000원 (1개 위치)", () => {
    const result = calculateReadyMadeQuote({
      sizeQuantities: sizesWithTotal(30),
      garmentBasePrice: 7000,
      printJobs: [printJob()],
    });

    expect(result.quantity).toBe(30);
    expect(result.garmentUnitPrice).toBe(7000);
    expect(result.printUnitPrice).toBe(READY_MADE_PRINT_LOCATION_PRICE);
    expect(result.unitPrice).toBe(12000);
    expect(result.subtotal).toBe(360000);
    expect(result.vat).toBe(36000);
    expect(result.total).toBe(396000);
  });

  it("sums print cost across multiple locations (front + back = +10,000원)", () => {
    const result = calculateReadyMadeQuote({
      sizeQuantities: sizesWithTotal(50),
      garmentBasePrice: 7000,
      printJobs: [
        printJob({ id: "front", location: "front_center", side: "front" }),
        printJob({ id: "back", location: "back_center", side: "back" }),
      ],
    });

    expect(result.printUnitPrice).toBe(10000);
    expect(result.unitPrice).toBe(17000);
    expect(result.locationBreakdown).toHaveLength(2);
    expect(result.subtotal).toBe(850000);
  });

  it("matches the worked example: 맨투맨 기본 12,000 + 앞면/뒷면 프린팅 2곳", () => {
    const result = calculateReadyMadeQuote({
      sizeQuantities: sizesWithTotal(50),
      garmentBasePrice: 12000,
      printJobs: [
        printJob({ id: "front", location: "front_center", side: "front" }),
        printJob({ id: "back", location: "back_center", side: "back" }),
      ],
    });

    expect(result.unitPrice).toBe(22000);
    expect(result.total).toBe(result.subtotal + result.vat);
    expect(result.subtotal).toBe(1100000);
  });

  it("sums quantities across every size bucket for the boundary example (XS..3XL = 50)", () => {
    const sizeQuantities = {
      XS: 0,
      S: 5,
      M: 10,
      L: 15,
      XL: 10,
      "2XL": 5,
      "3XL": 5,
    };
    const result = calculateReadyMadeQuote({
      sizeQuantities,
      garmentBasePrice: 7000,
      printJobs: [printJob()],
    });
    expect(result.quantity).toBe(50);
  });

  it("rejects a zero-quantity order", () => {
    expect(() =>
      calculateReadyMadeQuote({
        sizeQuantities: createEmptySizeQuantities(),
        garmentBasePrice: 7000,
        printJobs: [printJob()],
      }),
    ).toThrow();
  });

  it("rejects an order with no print location selected", () => {
    expect(() =>
      calculateReadyMadeQuote({
        sizeQuantities: sizesWithTotal(10),
        garmentBasePrice: 7000,
        printJobs: [],
      }),
    ).toThrow();
  });

  it("rounds VAT to the nearest won", () => {
    const result = calculateReadyMadeQuote({
      sizeQuantities: sizesWithTotal(7),
      garmentBasePrice: 7000,
      printJobs: [printJob()],
    });
    expect(Number.isInteger(result.vat)).toBe(true);
    expect(result.total).toBe(result.subtotal + result.vat);
  });
});
