import { describe, expect, it } from "vitest";
import { buildXlsx, columnName, crc32 } from "./xlsx";
import { buildOrderSheet, buildQuantitySheet, formatKst, type OrderExportRow } from "./order-export";

const decoder = new TextDecoder();

/** store-only ZIP 을 파싱해 파일 목록/내용을 돌려준다(테스트용) */
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
  expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
  return files;
};

const row = (overrides: Partial<OrderExportRow>): OrderExportRow => ({
  orderNumber: "BRANDER-1", orderedAt: "2026-09-26T03:00:00Z", paidAt: "2026-09-26T03:00:00Z", productName: "후드", brandName: "FENRAX",
  color: "BLACK", size: "M", quantity: 1, unitPrice: 40000, totalAmount: 40000, paymentType: "MOCK", paymentProvider: "mock",
  paymentStatus: "paid", orderStatus: "pledged", ordererName: "김구매", ordererPhone: "010-1234-5678", ordererEmail: null,
  recipientName: "김구매", recipientPhone: "010-1234-5678", postalCode: "06000", address: "서울 강남구 <테헤란로> & 1", addressDetail: null,
  deliveryMessage: null, productionStage: "funding", shippingStatus: "preparing", trackingNumber: null, ...overrides,
});

describe("xlsx writer", () => {
  it("column names", () => {
    expect([0, 25, 26, 27, 701, 702].map(columnName)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
  });

  it("produces a valid package with escaped korean text and numbers", () => {
    const files = unzip(buildXlsx([buildOrderSheet([row({})]), { name: "a/b:c*?", rows: [["x"]] }]));
    expect(Object.keys(files)).toEqual([
      "[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml",
      "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml",
    ]);
    expect(files["xl/workbook.xml"]).toContain('name="주문 목록"');
    expect(files["xl/workbook.xml"]).toContain('name="a b c"');
    const sheet = files["xl/worksheets/sheet1.xml"];
    expect(sheet).toContain("서울 강남구 &lt;테헤란로&gt; &amp; 1");
    expect(sheet).toContain("<v>40000</v>");
    expect(sheet).toContain('state="frozen"');
    expect(sheet).toContain("<autoFilter");
  });
});

describe("order export", () => {
  it("formats KST time and labels", () => {
    expect(formatKst("2026-09-26T15:30:00Z")).toBe("2026-09-27 00:30");
    const sheet = buildOrderSheet([row({ paymentType: "REAL", paymentProvider: "kakaopay", paymentStatus: "ready" })], false);
    expect(sheet.rows[0]).not.toContain("브랜드");
    expect(sheet.rows[1]).toContain("실결제(kakaopay)");
    expect(sheet.rows[1]).toContain("결제 대기");
  });

  it("builds color × size production quantities from paid, non-cancelled orders only", () => {
    const sheet = buildQuantitySheet([
      row({ color: "BLACK", size: "M", quantity: 3 }),
      row({ color: "BLACK", size: "L", quantity: 2 }),
      row({ color: "NAVY", size: "M", quantity: 4 }),
      row({ color: "NAVY", size: "L", quantity: 9, paymentStatus: "ready" }),
      row({ color: "NAVY", size: "L", quantity: 9, orderStatus: "cancelled" }),
    ], ["M", "L"], ["NAVY", "BLACK"]);
    expect(sheet.rows.slice(0, 4)).toEqual([
      ["컬러 \\ 사이즈", "M", "L", "합계"],
      ["NAVY", 4, 0, 4],
      ["BLACK", 3, 2, 5],
      ["합계", 7, 2, 9],
    ]);
  });
});
