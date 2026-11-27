// AI 이미지 제작의뢰 입력 검증 단위 테스트.
// 실행: deno test --no-lock --allow-net=jsr.io supabase/functions/_shared/productionRequest.test.ts

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  decodeBase64Image, detectProductionImageType, formatPhoneInput, formatProductionPhone, normalizeProductionPhone,
  parseOwnStorageUrl, validateProductionRequest,
} from "./productionRequest.ts";

const valid = {
  contactName: "  홍   길동 ",
  phone: "010 1234 5678",
  quantity: "1,200",
  quantityUndecided: false,
  budget: "100~300만원",
  request: "",
  privacyConsent: true,
};

Deno.test("normalizes a valid request", () => {
  const result = validateProductionRequest(valid);
  assert(result.ok);
  assertEquals(result.value, {
    contactName: "홍 길동", phone: "01012345678", quantity: 1200, quantityUndecided: false, budget: "100~300만원", request: null, privacyConsent: true,
  });
});

Deno.test("phone: only 010-0000-0000 mobile numbers", () => {
  assertEquals(normalizeProductionPhone("010-1234-5678"), "01012345678");
  assertEquals(normalizeProductionPhone("+82 10-1234-5678"), "01012345678");
  assertEquals(normalizeProductionPhone("011-123-4567"), null);
  assertEquals(normalizeProductionPhone("010-123-4567"), null);
  assertEquals(normalizeProductionPhone("02-123-4567"), null);
  assertEquals(normalizeProductionPhone(""), null);
  assertEquals(formatProductionPhone("01012345678"), "010-1234-5678");
});

Deno.test("phone input is auto-formatted while typing", () => {
  assertEquals(formatPhoneInput("010"), "010");
  assertEquals(formatPhoneInput("0101"), "010-1");
  assertEquals(formatPhoneInput("0101234"), "010-1234");
  assertEquals(formatPhoneInput("01012345"), "010-1234-5");
  assertEquals(formatPhoneInput("010123456789999"), "010-1234-5678");
  assertEquals(formatPhoneInput("010.1234.5678"), "010-1234-5678");
});

Deno.test("required fields block submission", () => {
  const result = validateProductionRequest({ ...valid, contactName: " ", phone: "", privacyConsent: false });
  assert(!result.ok);
  assertEquals(Object.keys(result.errors).sort(), ["contactName", "phone", "privacyConsent"]);
  const badPhone = validateProductionRequest({ ...valid, phone: "010-12" });
  assert(!badPhone.ok);
  assert(badPhone.errors.phone?.includes("010-0000-0000"));
});

Deno.test("quantity can be undecided; otherwise a positive number", () => {
  const undecided = validateProductionRequest({ ...valid, quantity: "", quantityUndecided: true });
  assert(undecided.ok);
  assertEquals(undecided.value.quantity, null);
  assert(!validateProductionRequest({ ...valid, quantity: "" }).ok);
  assert(!validateProductionRequest({ ...valid, quantity: "0" }).ok);
  assert(!validateProductionRequest({ ...valid, quantity: "-3" }).ok);
});

Deno.test("image type is detected from content", () => {
  assertEquals(detectProductionImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assertEquals(detectProductionImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assertEquals(detectProductionImageType(new TextEncoder().encode("<svg></svg>")), null);
  assertEquals(decodeBase64Image("data:image/png;base64,iVBORw0KGgo=").slice(0, 4), new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
});

Deno.test("own storage urls are copied from storage, others are not", () => {
  const base = "https://abc.supabase.co";
  assertEquals(parseOwnStorageUrl(`${base}/storage/v1/object/public/generated_images/a%20b/c.jpg`, base), { bucket: "generated_images", path: "a b/c.jpg" });
  assertEquals(parseOwnStorageUrl("https://evil.example/storage/v1/object/public/generated_images/x.jpg", base), null);
  assertEquals(parseOwnStorageUrl(`${base}/storage/v1/object/public/generated_images/../secret`, base), null);
  assertEquals(parseOwnStorageUrl("not a url", base), null);
});
