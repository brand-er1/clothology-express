import { describe, expect, it } from "vitest";
import { buildXlsx, crc32 } from "./xlsx";
import {
  BUYER_EXPORT_HEADERS, buildBuyerListSheet, buildBuyerWorkbook, buildProductionSummary, buyerExportFileName, filterBuyers,
  paymentStatusLabel, shippingStatusLabel, sortSizes, summarizeBuyers, EMPTY_BUYER_FILTER, type BuyerRow,
} from "./buyer-management";

const decoder = new TextDecoder();

const unzip = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files: Record<string, string> = {};
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const crc = view.getUint32(offset + 14, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
    const data = bytes.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size);
    expect(crc32(data)).toBe(crc);
    files[name] = decoder.decode(data);
    offset += 30 + nameLength + size;
  }
  return files;
};

let seq = 0;
const row = (overrides: Partial<BuyerRow> = {}): BuyerRow => ({
  id: `id-${++seq}`, funding_id: "f1", brand_id: "b1", creator_id: "c1", participant_id: `p-${seq}`,
  order_number: `BRANDER-${seq}`, funding_name: "에이 후드티", brand_name: "브랜드에이", creator_name: "크리에이터 A",
  buyer_name: "김구매", buyer_phone: "010-1234-5678", buyer_email: "buyer@test.local",
  color: "BLACK", size: "M", quantity: 1, unit_price: 39000, total_amount: 39000,
  order_status: "pledged", payment_status: "paid", payment_type: "MOCK", payment_provider: "mock",
  payment_approved_at: "2026-10-01T03:00:00Z", ordered_at: "2026-10-01T03:00:00Z", status_group: "paid",
  production_stage: "funding", shipping_status: "preparing", recipient_name: "김수령", recipient_phone: "010-9876-5432",
  postal_code: "06236", address: "서울특별시 강남구 테헤란로 1", address_detail: "101동 202호", delivery_message: "문 앞",
  tracking_number: "012345678901", courier: "CJ대한통운",
  ...overrides,
});

describe("buyer filters & summary", () => {
  const rows = [
    row({ color: "BLACK", size: "S", quantity: 5, participant_id: "u1" }),
    row({ color: "BLACK", size: "M", quantity: 10, participant_id: "u1", shipping_status: "shipped" }),
    row({ color: "WHITE", size: "L", quantity: 9, participant_id: "u2", shipping_status: "delivered" }),
    row({ color: "WHITE", size: "S", quantity: 3, participant_id: "u3", status_group: "pending", payment_status: "ready", payment_approved_at: null }),
    row({ color: "BLACK", size: "XL", quantity: 4, participant_id: "u4", status_group: "cancelled", order_status: "cancelled", buyer_name: "박취소", buyer_phone: "02-555-0001" }),
  ];

  it("filters by status group and shipping step (paid only)", () => {
    const by = (status: typeof EMPTY_BUYER_FILTER.status) => filterBuyers(rows, { ...EMPTY_BUYER_FILTER, status }).length;
    expect(by("all")).toBe(5);
    expect(by("paid")).toBe(3);
    expect(by("pending")).toBe(1);
    expect(by("cancelled")).toBe(1);
    expect(by("preparing")).toBe(1); // 결제 대기/취소 주문의 기본값 preparing 은 제외
    expect(by("shipped")).toBe(1);
    expect(by("delivered")).toBe(1);
  });

  it("filters by size, color and search (name / phone digits / order number)", () => {
    expect(filterBuyers(rows, { ...EMPTY_BUYER_FILTER, size: "S" })).toHaveLength(2);
    expect(filterBuyers(rows, { ...EMPTY_BUYER_FILTER, color: "WHITE", size: "S" })).toHaveLength(1);
    expect(filterBuyers(rows, { ...EMPTY_BUYER_FILTER, search: "박취소" })).toHaveLength(1);
    expect(filterBuyers(rows, { ...EMPTY_BUYER_FILTER, search: "0255500" })).toHaveLength(1);
    expect(filterBuyers(rows, { ...EMPTY_BUYER_FILTER, search: rows[2].order_number!.toLowerCase() })).toHaveLength(1);
  });

  it("summarizes buyers, orders and paid quantity", () => {
    expect(summarizeBuyers(rows)).toEqual({ buyers: 3, orders: 5, quantity: 24, paid: 3, pending: 1, cancelled: 1 });
  });

  it("aggregates production by size, color and color × size from paid orders only", () => {
    const summary = buildProductionSummary(rows, ["S", "M", "L", "XL"], ["BLACK", "WHITE"]);
    expect(summary.bySize).toEqual([{ key: "S", quantity: 5 }, { key: "M", quantity: 10 }, { key: "L", quantity: 9 }]);
    expect(summary.byColor).toEqual([{ key: "BLACK", quantity: 15 }, { key: "WHITE", quantity: 9 }]);
    expect(summary.matrix).toEqual({ BLACK: { S: 5, M: 10 }, WHITE: { L: 9 } });
    expect(summary.total).toBe(24);
  });

  it("sorts sizes by funding order, then standard apparel order", () => {
    expect(sortSizes(["XL", "S", "2XL", "M", "FREE", "L"])).toEqual(["S", "M", "L", "XL", "2XL", "FREE"]);
    expect(sortSizes(["L", "S", "M"], ["L", "M", "S"])).toEqual(["L", "M", "S"]);
    expect(sortSizes(["100", "95", "105"])).toEqual(["95", "100", "105"]);
  });

  it("labels payment and shipping state", () => {
    expect(paymentStatusLabel(rows[0])).toBe("결제 완료");
    expect(paymentStatusLabel(rows[3])).toBe("결제 대기");
    expect(paymentStatusLabel(rows[4])).toBe("환불(취소)");
    expect(paymentStatusLabel({ ...rows[4], payment_approved_at: null })).toBe("취소");
    expect(shippingStatusLabel(rows[1])).toBe("배송 중");
    expect(shippingStatusLabel(rows[3])).toBe("-");
  });
});

describe("buyer excel", () => {
  it("builds the buyer list sheet with every DB column in order", () => {
    const sheet = buildBuyerListSheet([row({ id: "x" })]);
    expect(sheet.name).toBe("구매자 목록");
    expect(sheet.rows[0]).toEqual([...BUYER_EXPORT_HEADERS]);
    expect(sheet.rows[1]).toEqual([
      expect.stringMatching(/^BRANDER-/), "에이 후드티", "브랜드에이", "크리에이터 A", "김구매", "010-1234-5678", "buyer@test.local",
      "BLACK", "M", 1, 39000, 39000, "결제 완료", "2026-10-01 12:00",
      "배송 준비", "김수령", "010-9876-5432", "06236", "서울특별시 강남구 테헤란로 1", "101동 202호", "문 앞", "012345678901", "CJ대한통운",
    ]);
  });

  it("writes a workbook with 구매자 목록 + 생산수량 요약, text-formatted phone/postal/order columns and korean text", () => {
    const files = unzip(buildXlsx(buildBuyerWorkbook([
      row({ color: "BLACK", size: "S", quantity: 2 }),
      row({ color: "WHITE", size: "M", quantity: 3, postal_code: "01234", buyer_phone: "01011112222" }),
    ], ["S", "M"], ["BLACK", "WHITE"])));
    expect(files["xl/workbook.xml"]).toContain('name="구매자 목록"');
    expect(files["xl/workbook.xml"]).toContain('name="생산수량 요약"');
    expect(files["xl/styles.xml"]).toContain('numFmtId="49"');

    const list = files["xl/worksheets/sheet1.xml"];
    // 헤더 고정 + 자동 필터
    expect(list).toContain('state="frozen"');
    expect(list).toContain('<autoFilter ref="A1:W3"/>');
    // 앞자리 0 유지: 숫자 셀이 아닌 텍스트(@ 서식, s=2) 문자열 셀
    expect(list).toContain('<c r="F3" t="inlineStr" s="2"><is><t xml:space="preserve">01011112222</t></is></c>');
    expect(list).toContain('<c r="R3" t="inlineStr" s="2"><is><t xml:space="preserve">01234</t></is></c>');
    expect(list).toContain('<c r="V2" t="inlineStr" s="2"><is><t xml:space="preserve">012345678901</t></is></c>');
    // 금액은 숫자(#,##0)
    expect(list).toContain('<c r="L2" s="3"><v>39000</v></c>');
    // 한글은 UTF-8 그대로
    expect(list).toContain("서울특별시 강남구 테헤란로 1");
    expect(list).toContain("김구매");

    const production = files["xl/worksheets/sheet2.xml"];
    expect(production).toContain("컬러 \\ 사이즈");
    expect(production).toContain("사이즈별");
    expect(production).toContain("컬러별");
  });

  it("names the file BRAND-ER_펀딩명_구매자목록_YYYY-MM-DD.xlsx", () => {
    expect(buyerExportFileName("에이 후드티", "2026-10-04")).toBe("BRAND-ER_에이 후드티_구매자목록_2026-10-04.xlsx");
    expect(buyerExportFileName("a/b:c*", "2026-10-04")).toBe("BRAND-ER_a b c_구매자목록_2026-10-04.xlsx");
  });
});
