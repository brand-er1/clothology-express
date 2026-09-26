// 국내 휴대폰 번호 정규화/표시. 서버(normalize_kr_phone)와 같은 규칙이며, 최종 검증은 서버가 한다.
const MOBILE_PATTERN = /^(010[0-9]{8}|01[16789][0-9]{7,8})$/;

export const normalizeKrPhone = (value: string | null | undefined): string | null => {
  if (!value) return null;
  let digits = value.replace(/[^0-9]/g, "");
  if (digits.startsWith("82") && digits.length >= 11) digits = `0${digits.slice(2).replace(/^0+/, "")}`;
  return MOBILE_PATTERN.test(digits) ? digits : null;
};

export const formatKrPhone = (value: string | null | undefined): string => {
  const digits = normalizeKrPhone(value);
  if (!digits) return value ?? "";
  return digits.length === 11
    ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    : `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};
