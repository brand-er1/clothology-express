import { formatLabPhone, normalizeLabPhone } from "../../supabase/functions/_shared/labApplication";

/**
 * 한국 휴대폰 번호 검사 · 표기. 회원가입, 전화번호 등록 창, BRAND-ER LAB 신청서가 같은 규칙을 쓴다.
 * normalizeMobilePhone: 숫자만 남긴 값(010XXXXXXXX), 형식이 틀리면 null. +82 표기도 받는다.
 * formatMobilePhone: 010-1234-5678 형태.
 */
export const normalizeMobilePhone = normalizeLabPhone;
export const formatMobilePhone = formatLabPhone;
export const MOBILE_PHONE_ERROR = "휴대폰 번호 형식을 확인해주세요. (예: 010-1234-5678)";

/** 프로필에 저장된 전화번호가 비어 있는지. (형식이 옛날 방식이어도 값이 있으면 다시 묻지 않는다) */
export const isPhoneMissing = (value: string | null | undefined) => !value || value.replace(/[^0-9]/g, "").length === 0;
