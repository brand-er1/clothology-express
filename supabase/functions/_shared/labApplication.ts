/**
 * BRAND-ER LAB 무료 의류 제작 신청 — 입력 규칙 · 선택지 · 동의 문구의 단일 기준.
 *
 * 순수 TypeScript 라 Edge Function(Deno) · 화면(vite) · vitest 가 모두 import 한다(외부 import 금지).
 * 같은 규칙을 DB 제약(supabase/migrations/*_brander_lab_applications.sql)이 한 번 더 검사한다.
 *
 * 동의 문구를 바꿀 때는 이 파일의 문구만 고치지 말고
 *  1) LAB_CONSENT_VERSION 을 새 값으로 올리고
 *  2) 새 마이그레이션에서 lab_consent_documents 에 새 버전 행을 넣고 이전 버전의 is_current 를 false 로 바꾼다.
 * src/lib/lab-application.test.ts 가 이 파일과 마이그레이션의 문구가 같은지 검사한다.
 */

// ---------------------------------------------------------------------------
// 선택지
// ---------------------------------------------------------------------------

export const LAB_GARMENT_TYPES = [
  { value: "short_sleeve_tee", label: "반팔 티셔츠" },
  { value: "long_sleeve_tee", label: "긴팔 티셔츠" },
  { value: "sweatshirt", label: "맨투맨" },
  { value: "hoodie", label: "후드티" },
  { value: "hood_zipup", label: "후드집업" },
  { value: "shirt", label: "셔츠" },
  { value: "pants", label: "바지" },
  { value: "outer", label: "아우터 / 재킷" },
  { value: "other", label: "기타" },
] as const;

export type LabGarmentType = (typeof LAB_GARMENT_TYPES)[number]["value"];

export const LAB_SIZES = [
  { value: "XS", label: "XS" },
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
  { value: "XL", label: "XL" },
  { value: "2XL", label: "2XL" },
  { value: "OTHER", label: "기타" },
] as const;

export type LabSize = (typeof LAB_SIZES)[number]["value"];

/** 제작 목적 (필수, 하나 선택) */
export const LAB_PURPOSES = [
  { value: "personal", label: "개인 소장" },
  { value: "gift", label: "선물" },
  { value: "brand_launch", label: "브랜드 창업 준비" },
  { value: "team", label: "팀 · 단체 · 동아리" },
  { value: "content", label: "콘텐츠 · 굿즈" },
  { value: "other", label: "기타" },
] as const;

export type LabPurpose = (typeof LAB_PURPOSES)[number]["value"];

/** 향후 추가 생산 의향 (선택) */
export const LAB_FUTURE_PRODUCTION = [
  { value: "yes", label: "추가 생산 의향 있음" },
  { value: "considering", label: "샘플을 보고 결정" },
  { value: "no", label: "샘플 1벌이면 충분" },
] as const;

export type LabFutureProduction = (typeof LAB_FUTURE_PRODUCTION)[number]["value"];

/**
 * 촬영 참여 가능 여부 (필수, 하나 선택 — 2026-11-23 이후 신청).
 * '촬영 및 SNS 게시 동의'(선택 동의)와는 별개의 응답이다. 이 값만으로 촬영 동의가 된 것으로 보지 않는다.
 */
export const LAB_FILMING_AVAILABILITY = [
  { value: "available", label: "촬영 참여 가능" },
  { value: "discuss", label: "촬영 범위 안내 후 결정" },
  { value: "unavailable", label: "촬영 없이 제작만 희망" },
] as const;

export type LabFilmingAvailability = (typeof LAB_FILMING_AVAILABILITY)[number]["value"];

export const LAB_STATUSES = [
  { value: "received", label: "신청 접수" },
  { value: "reviewing", label: "검토 중" },
  { value: "selected", label: "선정" },
  { value: "not_selected", label: "미선정" },
  { value: "filming_scheduled", label: "촬영 예정" },
  { value: "in_production", label: "제작 진행 중" },
  { value: "production_done", label: "제작 완료" },
  { value: "content_published", label: "콘텐츠 게시 완료" },
] as const;

export type LabStatus = (typeof LAB_STATUSES)[number]["value"];

export const labGarmentLabel = (value: string) => LAB_GARMENT_TYPES.find((item) => item.value === value)?.label ?? value;
export const labStatusLabel = (value: string) => LAB_STATUSES.find((item) => item.value === value)?.label ?? value;
export const labPurposeLabel = (value: string | null | undefined) => (value ? LAB_PURPOSES.find((item) => item.value === value)?.label ?? value : "");
export const labFutureProductionLabel = (value: string | null | undefined) =>
  (value ? LAB_FUTURE_PRODUCTION.find((item) => item.value === value)?.label ?? value : "");
export const labFilmingAvailabilityLabel = (value: string | null | undefined) =>
  (value ? LAB_FILMING_AVAILABILITY.find((item) => item.value === value)?.label ?? value : "");

/**
 * 관리자 화면용: 하나의 진행 상태를 '검토 상태 · 선정 여부 · 제작 진행 상태' 세 가지 관점으로 풀어 보여준다.
 * 상태값은 하나(lab_applications.status)로 관리해 서로 어긋나지 않게 한다.
 */
export const labStatusStages = (status: string) => {
  const reviewed = !["received", "reviewing"].includes(status);
  const selected = !["received", "reviewing", "not_selected"].includes(status);
  const production: Record<string, string> = {
    filming_scheduled: "제작 준비(촬영 예정)",
    in_production: "제작 진행 중",
    production_done: "제작 완료",
    content_published: "완성품 공개",
  };
  return {
    review: status === "received" ? "미검토" : status === "reviewing" ? "검토 중" : "검토 완료",
    selection: !reviewed ? "대기" : selected ? "선정" : "미선정",
    production: production[status] ?? (selected ? "제작 대기" : "-"),
  };
};

// ---------------------------------------------------------------------------
// 한도
// ---------------------------------------------------------------------------

export const LAB_LIMITS = {
  nameMax: 30,
  emailMax: 254,
  instagramMax: 30,
  garmentOtherMax: 50,
  designMin: 10,
  designMax: 2000,
  sizeOtherMax: 50,
  reasonMax: 1000,
  purposeOtherMin: 2,
  maxImages: 5,
  maxImageBytes: 10 * 1024 * 1024,
} as const;

export const LAB_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type LabImageMimeType = (typeof LAB_IMAGE_MIME_TYPES)[number];
export const LAB_IMAGE_EXTENSION: Record<LabImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** 개인정보 보유 기간(일). 선정되어 콘텐츠가 게시되면 게시 완료일부터 같은 기간으로 연장한다. */
export const LAB_RETENTION_DAYS = 365;

// ---------------------------------------------------------------------------
// 문의처 (푸터의 사업자 정보와 같다)
// ---------------------------------------------------------------------------

export const LAB_CONTACT = {
  privacyOfficer: "김하성",
  email: "hasung03@gmail.com",
  phone: "070-4708-3015",
} as const;

// ---------------------------------------------------------------------------
// 동의 문구 (버전 관리)
// ---------------------------------------------------------------------------

export const LAB_CONSENT_VERSION = "2026-11-23.v1";

export type LabConsentKey = "participation" | "filming" | "privacy" | "marketing";

export type LabConsentDocument = {
  key: LabConsentKey;
  version: string;
  required: boolean;
  title: string;
  body: string;
};

export const LAB_PRIVACY_NOTICE = {
  items: "(필수) 이름, 휴대폰 번호, 이메일 주소, 제작하고 싶은 의류 종류·설명, 제작 목적, 촬영 참여 가능 여부 / (선택) 인스타그램 아이디, 디자인 참고 이미지, 제작 목적 상세, 향후 추가 생산 의향 / (자동 수집) 신청한 회원 계정 식별값, 신청 일시, 중복·부정 신청 방지를 위한 접속 정보(IP 주소의 암호화 값, 브라우저 정보)",
  purpose: "신청 접수 및 신청자 확인, 참여자 선정 및 결과 안내, 제작·촬영 일정 협의를 위한 연락, 중복·부정 신청 방지",
  retention: "접수일로부터 1년간 보관 후 파기합니다. 선정되어 콘텐츠가 게시된 경우 게시 완료일로부터 1년간 보관합니다. 보유 기간이 지나거나 삭제를 요청하시면 지체 없이 파기합니다.",
  refusal: "개인정보 수집·이용 동의를 거부할 권리가 있습니다. 다만 필수 항목에 동의하지 않으시면 신청 접수와 참여자 선정이 불가능합니다.",
} as const;

export const LAB_CONSENT_DOCUMENTS: readonly LabConsentDocument[] = [
  {
    key: "participation",
    version: LAB_CONSENT_VERSION,
    required: true,
    title: "프로젝트 참여 및 제작 과정 공개 동의",
    body: "본인은 브랜더 LAB 무료 샘플 제작 프로젝트의 진행 방식에 대해 안내받았으며, 선정 시 신청한 디자인의 제작 과정 및 완성품(의류)이 브랜더의 콘텐츠로 소개될 수 있음에 동의합니다. 본인의 얼굴·음성 등 초상이 담기는 촬영은 이 동의에 포함되지 않으며, 아래 촬영 및 게시 동의와 촬영 전 개별 동의에 따릅니다.",
  },
  {
    key: "filming",
    version: LAB_CONSENT_VERSION,
    required: false,
    title: "인스타그램 릴스 촬영 및 게시 동의",
    body: "본인은 선정 시 길거리 인터뷰, 의류 제작 과정, 완성품 전달 및 착용 장면 촬영에 참여하고, 촬영된 영상과 음성, 초상 등이 편집되어 BRAND-ER LAB 공식 인스타그램 릴스로 게시되는 것에 동의합니다. 이 동의는 선택 사항으로, 동의하지 않아도 신청과 제작 검토는 가능합니다. 신청서 제출만으로 촬영이 확정되지 않으며, 실제 촬영 전에는 촬영 범위, 게시 매체, 이용 기간, 편집 및 재사용 범위를 구체적으로 안내받고 별도로 동의 여부를 결정합니다.",
  },
  {
    key: "privacy",
    version: LAB_CONSENT_VERSION,
    required: true,
    title: "개인정보 수집 및 이용 동의",
    body: "신청 접수, 참여자 선정 및 연락을 위해 필요한 개인정보의 수집·이용에 동의합니다.",
  },
  {
    key: "marketing",
    version: LAB_CONSENT_VERSION,
    required: false,
    title: "추가 콘텐츠 및 홍보 활용 동의",
    body: "브랜더가 프로젝트 촬영물을 공식 웹사이트, 추가 SNS 콘텐츠 및 홍보 목적으로 활용하는 것에 동의합니다.",
  },
];

export const LAB_REQUIRED_CONSENT_KEYS = LAB_CONSENT_DOCUMENTS.filter((doc) => doc.required).map((doc) => doc.key);

// ---------------------------------------------------------------------------
// 정규화
// ---------------------------------------------------------------------------

const MOBILE_PATTERN = /^(010[0-9]{8}|01[16789][0-9]{7,8})$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INSTAGRAM_PATTERN = /^[a-z0-9._]{1,30}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 휴대폰 번호를 숫자만 남긴 형태로. +82 표기도 받는다. 형식이 틀리면 null. */
export const normalizeLabPhone = (value: string | null | undefined): string | null => {
  if (!value) return null;
  let digits = value.replace(/[^0-9]/g, "");
  if (digits.startsWith("82") && digits.length >= 11) digits = `0${digits.slice(2).replace(/^0+/, "")}`;
  return MOBILE_PATTERN.test(digits) ? digits : null;
};

export const formatLabPhone = (digits: string | null | undefined) => {
  const value = normalizeLabPhone(digits);
  if (!value) return digits ?? "";
  return value.length === 11
    ? `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`
    : `${value.slice(0, 3)}-${value.slice(3, 6)}-${value.slice(6)}`;
};

/**
 * 인스타그램 아이디: '@' 유무, 공백, 프로필 주소(instagram.com/아이디) 형태를 모두 받아 소문자 아이디만 남긴다.
 * 인스타그램 규칙(영문 · 숫자 · 마침표 · 밑줄, 30자, 마침표로 시작/끝 · 연속 마침표 불가)에 맞지 않으면 null.
 */
export const normalizeInstagramId = (value: string | null | undefined): string | null => {
  if (!value) return null;
  let id = value.trim();
  const url = id.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#\s]+)/i);
  if (url) id = url[1];
  id = id.replace(/^@+/, "").trim().toLowerCase();
  if (!INSTAGRAM_PATTERN.test(id)) return null;
  if (id.startsWith(".") || id.endsWith(".") || id.includes("..")) return null;
  return id;
};

export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_PATTERN.test(value);

const cleanText = (value: unknown) => (typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "");
const charLength = (value: string) => Array.from(value).length;

// ---------------------------------------------------------------------------
// 검증
// ---------------------------------------------------------------------------

export type LabApplicationInput = {
  applicantName: string;
  phone: string;
  email: string;
  instagramId: string;
  garmentTypes: string[];
  garmentTypeOther: string;
  designDescription: string;
  size: string;
  sizeOther: string;
  purpose: string;
  reason: string;
  futureProduction: string;
  filmingAvailability: string;
};

export type LabApplicationField = keyof LabApplicationInput;

export type LabApplicationValue = {
  applicantName: string;
  phone: string;
  email: string;
  instagramId: string;
  garmentTypes: LabGarmentType[];
  garmentTypeOther: string | null;
  designDescription: string;
  size: LabSize | null;
  sizeOther: string | null;
  purpose: LabPurpose;
  reason: string | null;
  futureProduction: LabFutureProduction | null;
  filmingAvailability: LabFilmingAvailability;
};

export type LabValidationResult =
  | { ok: true; value: LabApplicationValue; errors: Partial<Record<LabApplicationField, string>> }
  | { ok: false; value: null; errors: Partial<Record<LabApplicationField, string>> };

const garmentValues = new Set<string>(LAB_GARMENT_TYPES.map((item) => item.value));
const sizeValues = new Set<string>(LAB_SIZES.map((item) => item.value));
const purposeValues = new Set<string>(LAB_PURPOSES.map((item) => item.value));
const futureValues = new Set<string>(LAB_FUTURE_PRODUCTION.map((item) => item.value));
const filmingValues = new Set<string>(LAB_FILMING_AVAILABILITY.map((item) => item.value));

export const validateLabApplication = (raw: Partial<Record<LabApplicationField, unknown>>): LabValidationResult => {
  const errors: Partial<Record<LabApplicationField, string>> = {};

  const applicantName = cleanText(raw.applicantName).replace(/\s+/g, " ");
  if (!applicantName) errors.applicantName = "이름을 입력해주세요.";
  else if (charLength(applicantName) > LAB_LIMITS.nameMax) errors.applicantName = `${LAB_LIMITS.nameMax}자 이내로 입력해주세요.`;

  const phoneText = cleanText(raw.phone);
  const phone = normalizeLabPhone(phoneText);
  if (!phoneText) errors.phone = "연락받으실 휴대폰 번호를 입력해주세요.";
  else if (!phone) errors.phone = "휴대폰 번호 형식을 확인해주세요. (예: 010-1234-5678)";

  const emailText = cleanText(raw.email).toLowerCase();
  if (!emailText) errors.email = "선정 안내를 받으실 이메일 주소를 입력해주세요.";
  else if (emailText.length > LAB_LIMITS.emailMax || !EMAIL_PATTERN.test(emailText)) errors.email = "이메일 주소 형식을 확인해주세요.";

  const instagramText = cleanText(raw.instagramId);
  const instagramId = normalizeInstagramId(instagramText);
  if (!instagramText) errors.instagramId = "인스타그램 아이디를 입력해주세요.";
  else if (!instagramId) errors.instagramId = "영문 · 숫자 · 마침표(.) · 밑줄(_)로 된 30자 이내 아이디를 입력해주세요.";

  const garmentTypes = Array.from(new Set(Array.isArray(raw.garmentTypes) ? raw.garmentTypes.filter((v): v is string => typeof v === "string") : []));
  const garmentTypeOther = cleanText(raw.garmentTypeOther);
  if (garmentTypes.length === 0) errors.garmentTypes = "제작하고 싶은 옷의 종류를 하나 이상 선택해주세요.";
  else if (garmentTypes.some((value) => !garmentValues.has(value))) errors.garmentTypes = "선택할 수 없는 의류 종류가 포함되어 있습니다.";
  if (garmentTypes.includes("other")) {
    if (!garmentTypeOther) errors.garmentTypeOther = "기타 의류 종류를 입력해주세요.";
    else if (charLength(garmentTypeOther) > LAB_LIMITS.garmentOtherMax) errors.garmentTypeOther = `${LAB_LIMITS.garmentOtherMax}자 이내로 입력해주세요.`;
  }

  const designDescription = cleanText(raw.designDescription);
  if (!designDescription) errors.designDescription = "원하는 디자인을 설명해주세요.";
  else if (charLength(designDescription) < LAB_LIMITS.designMin) errors.designDescription = `조금 더 자세히 적어주세요. (${LAB_LIMITS.designMin}자 이상)`;
  else if (charLength(designDescription) > LAB_LIMITS.designMax) errors.designDescription = `${LAB_LIMITS.designMax.toLocaleString("ko-KR")}자 이내로 입력해주세요.`;

  const size = cleanText(raw.size);
  const sizeOther = cleanText(raw.sizeOther);
  // 희망 사이즈는 선택 항목이다(선정 후 개별 확인). 보낸 경우에만 검사한다.
  if (size && !sizeValues.has(size)) errors.size = "선택할 수 없는 사이즈입니다.";
  if (size === "OTHER") {
    if (!sizeOther) errors.sizeOther = "희망 사이즈를 직접 입력해주세요.";
    else if (charLength(sizeOther) > LAB_LIMITS.sizeOtherMax) errors.sizeOther = `${LAB_LIMITS.sizeOtherMax}자 이내로 입력해주세요.`;
  }

  const purpose = cleanText(raw.purpose);
  if (!purpose) errors.purpose = "제작 목적을 선택해주세요.";
  else if (!purposeValues.has(purpose)) errors.purpose = "선택할 수 없는 제작 목적입니다.";

  const reason = cleanText(raw.reason);
  if (charLength(reason) > LAB_LIMITS.reasonMax) errors.reason = `${LAB_LIMITS.reasonMax.toLocaleString("ko-KR")}자 이내로 입력해주세요.`;
  else if (purpose === "other" && charLength(reason) < LAB_LIMITS.purposeOtherMin) errors.reason = "기타 제작 목적을 간단히 적어주세요.";

  const futureProduction = cleanText(raw.futureProduction);
  if (futureProduction && !futureValues.has(futureProduction)) errors.futureProduction = "선택할 수 없는 항목입니다.";

  const filmingAvailability = cleanText(raw.filmingAvailability);
  if (!filmingAvailability) errors.filmingAvailability = "촬영 참여 가능 여부를 선택해주세요.";
  else if (!filmingValues.has(filmingAvailability)) errors.filmingAvailability = "선택할 수 없는 항목입니다.";

  if (Object.keys(errors).length > 0 || !phone) return { ok: false, value: null, errors };

  return {
    ok: true,
    errors,
    value: {
      applicantName,
      phone,
      email: emailText,
      instagramId: instagramId as string,
      garmentTypes: garmentTypes as LabGarmentType[],
      garmentTypeOther: garmentTypes.includes("other") ? garmentTypeOther : null,
      designDescription,
      size: size ? (size as LabSize) : null,
      sizeOther: size === "OTHER" ? sizeOther : null,
      purpose: purpose as LabPurpose,
      reason: reason || null,
      futureProduction: futureProduction ? (futureProduction as LabFutureProduction) : null,
      filmingAvailability: filmingAvailability as LabFilmingAvailability,
    },
  };
};

export type LabConsentInput = { key: string; version: string; agreed: boolean };

/** 제출된 동의 목록 검사: 현재 버전의 모든 항목이 정확히 한 번씩 있고, 필수 항목은 모두 동의해야 한다. */
export const validateLabConsents = (raw: unknown): { ok: true; value: LabConsentInput[] } | { ok: false; error: string } => {
  if (!Array.isArray(raw)) return { ok: false, error: "동의 정보가 올바르지 않습니다." };
  const byKey = new Map<string, LabConsentInput>();
  for (const item of raw) {
    if (!item || typeof item !== "object") return { ok: false, error: "동의 정보가 올바르지 않습니다." };
    const { key, version, agreed } = item as Record<string, unknown>;
    if (typeof key !== "string" || typeof version !== "string" || typeof agreed !== "boolean" || byKey.has(key)) {
      return { ok: false, error: "동의 정보가 올바르지 않습니다." };
    }
    byKey.set(key, { key, version, agreed });
  }
  if (byKey.size !== LAB_CONSENT_DOCUMENTS.length) return { ok: false, error: "동의 항목이 변경되었습니다. 페이지를 새로고침한 뒤 다시 신청해주세요." };
  for (const doc of LAB_CONSENT_DOCUMENTS) {
    const submitted = byKey.get(doc.key);
    if (!submitted || submitted.version !== doc.version) {
      return { ok: false, error: "동의 문구가 변경되었습니다. 페이지를 새로고침한 뒤 다시 신청해주세요." };
    }
    if (doc.required && !submitted.agreed) return { ok: false, error: `[필수] ${doc.title}에 동의해주세요.` };
  }
  return { ok: true, value: LAB_CONSENT_DOCUMENTS.map((doc) => byKey.get(doc.key)!) };
};

// ---------------------------------------------------------------------------
// 이미지
// ---------------------------------------------------------------------------

/** 파일 앞부분(매직 넘버)으로 실제 형식을 판별한다. 확장자 · Content-Type 은 믿지 않는다. */
export const detectLabImageType = (bytes: Uint8Array): LabImageMimeType | null => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  if (
    bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
};

/** 브라우저에서 고른 파일의 1차 검사(서버가 내용으로 다시 검사한다). 문제가 없으면 null. */
export const checkLabImageFile = (file: { name: string; size: number; type: string }): string | null => {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const typeOk = (LAB_IMAGE_MIME_TYPES as readonly string[]).includes(file.type) || ["jpg", "jpeg", "png", "webp"].includes(extension);
  if (!typeOk) return `${file.name}: JPG · PNG · WEBP 이미지만 올릴 수 있습니다.`;
  if (file.size <= 0) return `${file.name}: 빈 파일입니다.`;
  if (file.size > LAB_LIMITS.maxImageBytes) return `${file.name}: 이미지당 10MB 이하만 올릴 수 있습니다.`;
  return null;
};
