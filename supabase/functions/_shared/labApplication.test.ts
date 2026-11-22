// BRAND-ER LAB 신청 검증 단위 테스트.
// 실행: deno test --no-lock --allow-net=jsr.io supabase/functions/_shared/labApplication.test.ts

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  detectLabImageType, LAB_CONSENT_DOCUMENTS, normalizeInstagramId, normalizeLabPhone, validateLabApplication, validateLabConsents,
} from "./labApplication.ts";

const valid = {
  applicantName: "  홍길동 ",
  phone: "010-1234-5678",
  email: " Gil@Example.com ",
  instagramId: "@Gil.Dong_",
  garmentTypes: ["hoodie", "hoodie"],
  garmentTypeOther: "무시됨",
  designDescription: "검은색 오버핏 후드티에 등판 그래픽",
  size: "L",
  sizeOther: "무시됨",
  purpose: "brand_launch",
  reason: "",
  futureProduction: "considering",
  filmingAvailability: "discuss",
};

const consents = (overrides: Record<string, boolean> = {}) =>
  LAB_CONSENT_DOCUMENTS.map((doc) => ({ key: doc.key, version: doc.version, agreed: overrides[doc.key] ?? true }));

Deno.test("normalizes a valid application for storage", () => {
  const result = validateLabApplication(valid);
  assert(result.ok);
  assertEquals(result.value, {
    applicantName: "홍길동",
    phone: "01012345678",
    email: "gil@example.com",
    instagramId: "gil.dong_",
    garmentTypes: ["hoodie"],
    garmentTypeOther: null,
    designDescription: "검은색 오버핏 후드티에 등판 그래픽",
    size: "L",
    sizeOther: null,
    purpose: "brand_launch",
    reason: null,
    futureProduction: "considering",
    filmingAvailability: "discuss",
  });
});

Deno.test("instagram id is accepted with or without @ and as a profile URL", () => {
  assertEquals(normalizeInstagramId("brand_er"), "brand_er");
  assertEquals(normalizeInstagramId("@brand_er"), "brand_er");
  assertEquals(normalizeInstagramId(" @@Brand.ER "), "brand.er");
  assertEquals(normalizeInstagramId("https://www.instagram.com/brand.er/?hl=ko"), "brand.er");
  assertEquals(normalizeInstagramId("brand..er"), null);
  assertEquals(normalizeInstagramId(".brand"), null);
  assertEquals(normalizeInstagramId("브랜더"), null);
  assertEquals(normalizeInstagramId("a".repeat(31)), null);
});

Deno.test("phone accepts Korean mobile numbers only", () => {
  assertEquals(normalizeLabPhone("+82 10-1234-5678"), "01012345678");
  assertEquals(normalizeLabPhone("011-123-4567"), "0111234567");
  assertEquals(normalizeLabPhone("02-123-4567"), null);
});

Deno.test("other garment type and other size require text", () => {
  const result = validateLabApplication({ ...valid, garmentTypes: ["other"], garmentTypeOther: "", size: "OTHER", sizeOther: " " });
  assert(!result.ok);
  assert(result.errors.garmentTypeOther);
  assert(result.errors.sizeOther);
});

Deno.test("rejects unknown options and missing required fields", () => {
  const result = validateLabApplication({ garmentTypes: ["cape"], size: "XXXL", designDescription: "짧음", futureProduction: "maybe" });
  assert(!result.ok);
  for (const field of ["applicantName", "phone", "email", "garmentTypes", "designDescription", "size", "purpose", "futureProduction", "filmingAvailability"]) {
    assert(field in result.errors, field);
  }
  assert(!("instagramId" in result.errors), "instagram is optional");
});

Deno.test("instagram, size and future production are optional; an invalid instagram id is still rejected", () => {
  const result = validateLabApplication({ ...valid, instagramId: "", size: "", sizeOther: "", futureProduction: "" });
  assert(result.ok);
  assertEquals(result.value.instagramId, null);
  assertEquals(result.value.size, null);
  assertEquals(result.value.futureProduction, null);
  const bad = validateLabApplication({ ...valid, instagramId: "브랜더" });
  assert(!bad.ok);
  assert(bad.errors.instagramId);
});

Deno.test("purpose 'other' needs a short description", () => {
  const missing = validateLabApplication({ ...valid, purpose: "other", reason: "" });
  assert(!missing.ok);
  assert(missing.errors.reason);
  assert(validateLabApplication({ ...valid, purpose: "other", reason: "졸업 작품 전시용" }).ok);
});

Deno.test("optional filming / marketing consents may be declined, required ones may not", () => {
  assert(validateLabConsents(consents({ marketing: false })).ok);
  assert(validateLabConsents(consents({ filming: false, marketing: false })).ok);
  assert(!validateLabConsents(consents({ privacy: false })).ok);
  assert(!validateLabConsents(consents({ participation: false })).ok);
  assert(!validateLabConsents(consents().slice(1)).ok);
  assert(!validateLabConsents(consents().map((c) => ({ ...c, version: "old" }))).ok);
  assert(!validateLabConsents([...consents(), consents()[0]]).ok);
});

Deno.test("image type is detected from content, not the name", () => {
  assertEquals(detectLabImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assertEquals(detectLabImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assertEquals(detectLabImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")), "image/webp");
  assertEquals(detectLabImageType(new TextEncoder().encode("<svg onload=alert(1)>")), null);
  assertEquals(detectLabImageType(new TextEncoder().encode("GIF89a")), null);
});
