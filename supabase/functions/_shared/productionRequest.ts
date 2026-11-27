/**
 * AI 이미지 생성 → 제작의뢰 접수 — 입력 규칙 · 선택지 · 개인정보 동의 문구의 단일 기준.
 *
 * 순수 TypeScript 라 Edge Function(Deno) · 화면(vite) · vitest 가 모두 import 한다(외부 import 금지).
 * 같은 규칙을 DB(create_ai_production_request · 테이블 제약)가 한 번 더 검사한다.
 * 동의 문구를 바꾸면 PRODUCTION_REQUEST_CONSENT_VERSION 을 새 값으로 올린다(접수 행에 동의 버전이 남는다).
 */

export const PRODUCTION_REQUEST_SOURCE = "ai_image_request";
export const PRODUCTION_REQUEST_SOURCE_LABEL = "AI 디자인 제작의뢰";

export const PRODUCTION_REQUEST_CONSENT_VERSION = "2026-11-27.v1";

/** 접수 완료 화면 문구 — DB 저장이 확인된 뒤에만 표시한다. */
export const PRODUCTION_REQUEST_SUCCESS_MESSAGE = [
  "제작의뢰가 정상적으로 접수되었습니다.",
  "브랜더 의류 제작 전문가가 고객님께서 디자인하신 의류를 확인한 후, 입력하신 전화번호로 제작 가능 여부와 견적을 안내해 드리겠습니다.",
] as const;

export const PRODUCTION_REQUEST_PRIVACY_NOTICE = {
  items: "고객 이름, 전화번호, (회원인 경우) 계정 정보, 의뢰한 디자인 이미지 · AI 생성 프롬프트 · 수량 · 예산 · 요청사항",
  purpose: "의류 제작 가능 여부 확인, 제작 상담 및 견적 안내(전화 · 문자)",
  retention: "상담 종료 후 1년간 보관 후 파기 (계약이 체결되면 관계 법령에서 정한 기간 동안 보관)",
  refusal: "동의를 거부할 수 있으며, 거부하면 제작의뢰를 접수할 수 없습니다.",
} as const;

/** 희망 제작 예산(선택). 값은 그대로 저장되어 관리자 화면에 표시된다. */
export const PRODUCTION_BUDGET_OPTIONS = [
  "100만원 미만",
  "100~300만원",
  "300~500만원",
  "500~1,000만원",
  "1,000만원 이상",
  "상담 후 결정",
] as const;

export const PRODUCTION_PROGRESS_STATUSES = [
  { value: "new", label: "신규 접수", tone: "wine" },
  { value: "consult_waiting", label: "상담 대기", tone: "amber" },
  { value: "consult_done", label: "상담 완료", tone: "blue" },
  { value: "quote_sent", label: "견적 발송", tone: "blue" },
  { value: "contract_done", label: "계약 완료", tone: "green" },
  { value: "in_production", label: "제작 진행", tone: "green" },
  { value: "production_done", label: "제작 완료", tone: "green" },
  { value: "not_contracted", label: "계약 미성사", tone: "red" },
] as const;

export type ProductionProgressStatus = (typeof PRODUCTION_PROGRESS_STATUSES)[number]["value"];

export const productionProgressLabel = (value: string | null | undefined) =>
  PRODUCTION_PROGRESS_STATUSES.find((item) => item.value === value)?.label ?? value ?? "-";

export const PRODUCTION_REQUEST_LIMITS = {
  nameMax: 50,
  quantityMax: 1_000_000,
  budgetMax: 50,
  requestMax: 2000,
  promptMax: 8000,
  briefMax: 4000,
  imageMaxBytes: 15 * 1024 * 1024,
} as const;

// ---------------------------------------------------------------------------
// 전화번호: 010-0000-0000 만 받는다 (제작 상담 · 견적 안내용 휴대폰)
// ---------------------------------------------------------------------------

const toDigits = (value: string) => {
  let digits = value.replace(/[^0-9]/g, "");
  // +82 10-1234-5678 / 82 010 1234 5678 → 01012345678
  if (digits.startsWith("82") && digits.length >= 11) digits = `0${digits.slice(2).replace(/^0+/, "")}`;
  return digits;
};

/** 유효한 010 휴대폰 번호면 숫자 11자리, 아니면 null */
export const normalizeProductionPhone = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const digits = toDigits(value);
  return /^010[0-9]{8}$/.test(digits) ? digits : null;
};

/** 입력 중인 값을 010-0000-0000 형태로 바꾼다(숫자 11자리까지만). */
export const formatPhoneInput = (value: string): string => {
  const digits = (value.trim().startsWith("+82") ? toDigits(value) : value.replace(/[^0-9]/g, "")).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

export const formatProductionPhone = (value: string | null | undefined): string => {
  const digits = normalizeProductionPhone(value);
  if (!digits) return value ?? "";
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_PATTERN.test(value);

// ---------------------------------------------------------------------------
// 입력 검증
// ---------------------------------------------------------------------------

export type ProductionRequestInput = {
  contactName: unknown;
  phone: unknown;
  quantity: unknown;
  quantityUndecided: unknown;
  budget: unknown;
  request: unknown;
  privacyConsent: unknown;
};

export type ProductionRequestField = keyof ProductionRequestInput;

export type ProductionRequestValue = {
  contactName: string;
  phone: string;
  quantity: number | null;
  quantityUndecided: boolean;
  budget: string | null;
  request: string | null;
  privacyConsent: true;
};

export type ProductionRequestValidation =
  | { ok: true; value: ProductionRequestValue }
  | { ok: false; errors: Partial<Record<ProductionRequestField, string>> };

const text = (value: unknown) => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "");

export const validateProductionRequest = (raw: Partial<ProductionRequestInput>): ProductionRequestValidation => {
  const errors: Partial<Record<ProductionRequestField, string>> = {};

  const contactName = text(raw.contactName).replace(/\s+/g, " ");
  if (!contactName) errors.contactName = "고객 이름을 입력해주세요.";
  else if (contactName.length > PRODUCTION_REQUEST_LIMITS.nameMax) errors.contactName = `이름은 ${PRODUCTION_REQUEST_LIMITS.nameMax}자까지 입력할 수 있습니다.`;

  const phoneText = text(raw.phone);
  const phone = normalizeProductionPhone(phoneText);
  if (!phoneText) errors.phone = "전화번호를 입력해주세요.";
  else if (!phone) errors.phone = "전화번호를 010-0000-0000 형식으로 정확히 입력해주세요.";

  const quantityUndecided = raw.quantityUndecided === true;
  let quantity: number | null = null;
  if (!quantityUndecided) {
    const quantityText = text(raw.quantity).replace(/,/g, "");
    if (!/^[0-9]{1,7}$/.test(quantityText)) errors.quantity = "제작 희망 수량을 숫자로 입력하거나 '미정'을 선택해주세요.";
    else {
      quantity = Number(quantityText);
      if (quantity < 1) errors.quantity = "제작 희망 수량은 1장 이상으로 입력해주세요.";
      else if (quantity > PRODUCTION_REQUEST_LIMITS.quantityMax) errors.quantity = "제작 희망 수량을 다시 확인해주세요.";
    }
  }

  const budget = text(raw.budget) || null;
  if (budget && budget.length > PRODUCTION_REQUEST_LIMITS.budgetMax) errors.budget = `희망 제작 예산은 ${PRODUCTION_REQUEST_LIMITS.budgetMax}자까지 입력할 수 있습니다.`;

  const request = text(raw.request) || null;
  if (request && request.length > PRODUCTION_REQUEST_LIMITS.requestMax) errors.request = `추가 요청사항은 ${PRODUCTION_REQUEST_LIMITS.requestMax}자까지 입력할 수 있습니다.`;

  if (raw.privacyConsent !== true) errors.privacyConsent = "개인정보 수집 및 이용에 동의해주세요.";

  if (Object.keys(errors).length > 0 || !phone) return { ok: false, errors };
  return { ok: true, value: { contactName, phone, quantity, quantityUndecided, budget, request, privacyConsent: true } };
};

// ---------------------------------------------------------------------------
// 이미지
// ---------------------------------------------------------------------------

export type ProductionImageMime = "image/png" | "image/jpeg" | "image/webp";
export const PRODUCTION_IMAGE_EXTENSION: Record<ProductionImageMime, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** 파일 내용(매직 바이트)으로 형식을 판별한다. */
export const detectProductionImageType = (bytes: Uint8Array): ProductionImageMime | null => {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
};

/**
 * 우리 Supabase Storage 공개 URL 이면 { bucket, path } 를 돌려준다.
 * (생성 직후 이미 영구 저장된 이미지는 외부 다운로드 없이 Storage 에서 바로 복사한다.)
 */
export const parseOwnStorageUrl = (raw: string, supabaseUrl: string): { bucket: string; path: string } | null => {
  try {
    const url = new URL(raw);
    const base = new URL(supabaseUrl);
    if (url.origin !== base.origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
    if (!match) return null;
    const path = decodeURIComponent(match[2]);
    if (path.includes("..")) return null;
    return { bucket: decodeURIComponent(match[1]), path };
  } catch {
    return null;
  }
};

/** 'data:image/png;base64,....' 또는 순수 base64 → bytes */
export const decodeBase64Image = (value: string): Uint8Array => {
  const normalized = value.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "").replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};
