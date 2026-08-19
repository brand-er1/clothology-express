import { describe, expect, it } from "vitest";
import {
  READY_MADE_DTF_BULK_SIZE_OPTIONS,
  READY_MADE_DTG_BULK_SIZE_OPTIONS,
  createEmptySizeQuantities,
} from "@/data/ready-made-pricing-config";
import {
  calculateReadyMadePrintJobUnitPrice,
  calculateReadyMadeQuote,
  getReadyMadeQuantityTier,
  sumReadyMadeSizeQuantities,
} from "@/lib/ready-made-pricing";
import type { ReadyMadePrintJob } from "@/types/readyMadeOrder";

const sizesWithTotal = (quantity: number) => ({
  ...createEmptySizeQuantities(),
  M: quantity,
});

const frontJob = (overrides: Partial<ReadyMadePrintJob> = {}): ReadyMadePrintJob => ({
  id: "front",
  location: "front_center",
  side: "front",
  placement: { xPercent: 50, yPercent: 50, widthPercent: 30 },
  sizeCategory: "small",
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

describe("getReadyMadeQuantityTier boundaries", () => {
  it.each([
    [1, "sample"],
    [4, "sample"],
    [5, "smallBatch"],
    [49, "smallBatch"],
    [50, "bulk"],
    [51, "bulk"],
  ] as const)("quantity %i -> %s", (quantity, expected) => {
    expect(getReadyMadeQuantityTier(quantity)).toBe(expected);
  });
});

describe("calculateReadyMadePrintJobUnitPrice per tier", () => {
  it("uses the sample-tier (1-4) flat price by size category", () => {
    expect(calculateReadyMadePrintJobUnitPrice(frontJob({ sizeCategory: "small" }), "sample", "dtf")).toBe(5000);
    expect(calculateReadyMadePrintJobUnitPrice(frontJob({ sizeCategory: "medium" }), "sample", "dtf")).toBe(7000);
    expect(calculateReadyMadePrintJobUnitPrice(frontJob({ sizeCategory: "large" }), "sample", "dtg")).toBe(10000);
  });

  it("uses the small-batch-tier (5-49) flat price by size category", () => {
    expect(calculateReadyMadePrintJobUnitPrice(frontJob({ sizeCategory: "small" }), "smallBatch", "dtf")).toBe(3000);
    expect(calculateReadyMadePrintJobUnitPrice(frontJob({ sizeCategory: "medium" }), "smallBatch", "dtf")).toBe(5000);
    expect(calculateReadyMadePrintJobUnitPrice(frontJob({ sizeCategory: "large" }), "smallBatch", "dtg")).toBe(7000);
  });

  it("uses the DTF bulk cm table at bulk tier, including the >28cm override column", () => {
    const job = (bulkSizeKey: string) => frontJob({ bulkSizeKey });
    expect(calculateReadyMadePrintJobUnitPrice(job("10x10"), "bulk", "dtf")).toBe(1500);
    expect(calculateReadyMadePrintJobUnitPrice(job("15x15"), "bulk", "dtf")).toBe(1800);
    expect(calculateReadyMadePrintJobUnitPrice(job("20x20"), "bulk", "dtf")).toBe(2400);
    expect(calculateReadyMadePrintJobUnitPrice(job("27x28"), "bulk", "dtf")).toBe(2800);
    // sides exceeding 28cm use the override column
    expect(calculateReadyMadePrintJobUnitPrice(job("30x30"), "bulk", "dtf")).toBe(4500);
    expect(calculateReadyMadePrintJobUnitPrice(job("35x35"), "bulk", "dtf")).toBe(4500);
    expect(calculateReadyMadePrintJobUnitPrice(job("40x40"), "bulk", "dtf")).toBe(6000);
    expect(calculateReadyMadePrintJobUnitPrice(job("45x45"), "bulk", "dtf")).toBe(7000);
  });

  it("every configured DTF bulk size resolves to its own configured price (data/logic stay in sync)", () => {
    for (const option of READY_MADE_DTF_BULK_SIZE_OPTIONS) {
      const price = calculateReadyMadePrintJobUnitPrice(frontJob({ bulkSizeKey: option.key }), "bulk", "dtf");
      expect(price).toBe(option.price);
    }
  });

  it("uses the DTG bulk cm table at bulk tier, switching on pretreatment", () => {
    expect(
      calculateReadyMadePrintJobUnitPrice(frontJob({ bulkSizeKey: "10x10", pretreatment: true }), "bulk", "dtg"),
    ).toBe(2800);
    expect(
      calculateReadyMadePrintJobUnitPrice(frontJob({ bulkSizeKey: "10x10", pretreatment: false }), "bulk", "dtg"),
    ).toBe(2000);
    expect(
      calculateReadyMadePrintJobUnitPrice(frontJob({ bulkSizeKey: "40x45", pretreatment: true }), "bulk", "dtg"),
    ).toBe(5500);
    expect(
      calculateReadyMadePrintJobUnitPrice(frontJob({ bulkSizeKey: "40x45", pretreatment: false }), "bulk", "dtg"),
    ).toBe(2800);
  });

  it("every configured DTG bulk size resolves to its own configured price for both pretreatment states", () => {
    for (const option of READY_MADE_DTG_BULK_SIZE_OPTIONS) {
      expect(
        calculateReadyMadePrintJobUnitPrice(
          frontJob({ bulkSizeKey: option.key, pretreatment: true }),
          "bulk",
          "dtg",
        ),
      ).toBe(option.pretreatmentPrice);
      expect(
        calculateReadyMadePrintJobUnitPrice(
          frontJob({ bulkSizeKey: option.key, pretreatment: false }),
          "bulk",
          "dtg",
        ),
      ).toBe(option.noPretreatmentPrice);
    }
  });

  it("falls back to a size-category default bulk key when none is explicitly chosen", () => {
    expect(calculateReadyMadePrintJobUnitPrice(frontJob({ sizeCategory: "small" }), "bulk", "dtf")).toBe(1500);
  });

  it("throws for an unknown bulk size key instead of silently mispricing", () => {
    expect(() =>
      calculateReadyMadePrintJobUnitPrice(frontJob({ bulkSizeKey: "does-not-exist" }), "bulk", "dtf"),
    ).toThrow();
  });
});

describe("calculateReadyMadeQuote — full formula (spec section 11)", () => {
  it("matches the worked example: DTF 10x10 front logo, 30 pieces", () => {
    const result = calculateReadyMadeQuote({
      sizeQuantities: sizesWithTotal(30),
      printMethod: "dtf",
      printJobs: [frontJob({ bulkSizeKey: "10x10" })],
    });

    expect(result.quantity).toBe(30);
    expect(result.tier).toBe("smallBatch");
    expect(result.garmentUnitPrice).toBe(7000);
    // 30 pcs falls in the 5-49 small-batch tier, so the flat small-batch price applies, not the DTF cm table.
    expect(result.printUnitPrice).toBe(3000);
    expect(result.unitPrice).toBe(10000);
    expect(result.subtotal).toBe(300000);
    expect(result.vat).toBe(30000);
    expect(result.total).toBe(330000);
  });

  it("matches the section-2 worked example: 50 pieces, DTF 10x10, single location", () => {
    const result = calculateReadyMadeQuote({
      sizeQuantities: sizesWithTotal(50),
      printMethod: "dtf",
      printJobs: [frontJob({ bulkSizeKey: "10x10" })],
    });

    expect(result.tier).toBe("bulk");
    expect(result.unitPrice).toBe(8500);
    expect(result.subtotal).toBe(425000);
  });

  it("matches the section-7 worked example: 1 piece, small print", () => {
    const result = calculateReadyMadeQuote({
      sizeQuantities: sizesWithTotal(1),
      printMethod: "dtf",
      printJobs: [frontJob({ sizeCategory: "small" })],
    });

    expect(result.tier).toBe("sample");
    expect(result.unitPrice).toBe(12000);
  });

  it("sums print cost across multiple locations (front + back)", () => {
    const result = calculateReadyMadeQuote({
      sizeQuantities: sizesWithTotal(20),
      printMethod: "dtf",
      printJobs: [
        frontJob({ id: "front", location: "front_center", sizeCategory: "medium" }),
        frontJob({ id: "back", location: "back_center", sizeCategory: "small" }),
      ],
    });

    // small-batch tier: medium 5000 + small 3000 = 8000 print cost/piece
    expect(result.printUnitPrice).toBe(8000);
    expect(result.unitPrice).toBe(15000);
    expect(result.locationBreakdown).toHaveLength(2);
    expect(result.subtotal).toBe(300000);
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
      printMethod: "dtf",
      printJobs: [frontJob({ bulkSizeKey: "10x10" })],
    });
    expect(result.quantity).toBe(50);
    expect(result.tier).toBe("bulk");
  });

  it("rejects a zero-quantity order", () => {
    expect(() =>
      calculateReadyMadeQuote({
        sizeQuantities: createEmptySizeQuantities(),
        printMethod: "dtf",
        printJobs: [frontJob()],
      }),
    ).toThrow();
  });

  it("rejects an order with no print location selected", () => {
    expect(() =>
      calculateReadyMadeQuote({
        sizeQuantities: sizesWithTotal(10),
        printMethod: "dtf",
        printJobs: [],
      }),
    ).toThrow();
  });

  it("rounds VAT to the nearest won", () => {
    const result = calculateReadyMadeQuote({
      sizeQuantities: sizesWithTotal(7),
      printMethod: "dtf",
      printJobs: [frontJob({ sizeCategory: "small" })],
    });
    // unit 10,000 * 7 = 70,000 subtotal -> vat 7,000 exactly, but verify it's a whole number regardless.
    expect(Number.isInteger(result.vat)).toBe(true);
    expect(result.total).toBe(result.subtotal + result.vat);
  });
});
