import { formatKst } from "@/lib/order-export";
import { formatLabPhone, labFutureProductionLabel, labGarmentLabel, labPurposeLabel, labStatusLabel, labStatusStages } from "../../supabase/functions/_shared/labApplication";

export type LabConsentSnapshot = Partial<Record<string, { agreed: boolean; at: string; version: string; action: string }>>;

/** admin_export_lab_applications 의 행 */
export type LabExportRow = {
  application_no: string;
  created_at: string;
  status: string;
  applicant_name: string;
  phone: string;
  email: string | null;
  instagram_id: string | null;
  garment_types: string[];
  garment_type_other: string | null;
  size: string | null;
  size_other: string | null;
  design_description: string;
  reason: string | null;
  purpose?: string | null;
  future_production?: string | null;
  image_count: number;
  admin_memo: string | null;
  retention_until: string;
  consents: LabConsentSnapshot;
};

export const labGarmentText = (types: string[], other: string | null) =>
  types.map((type) => (type === "other" && other ? `기타(${other})` : labGarmentLabel(type))).join(", ");

export const labSizeText = (size: string | null, other: string | null) => (!size ? "-" : size === "OTHER" ? `기타(${other ?? ""})` : size);

const consentText = (consents: LabConsentSnapshot, key: string) => {
  const entry = consents[key];
  if (!entry) return "기록 없음";
  return `${entry.agreed ? "동의" : entry.action === "withdraw" ? "철회" : "미동의"} ${formatKst(entry.at)}`;
};

// 엑셀이 수식으로 실행하지 않도록 =, +, -, @, 탭, CR 로 시작하는 값 앞에 작은따옴표를 붙인다.
const safeCell = (value: unknown) => {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const LAB_CSV_HEADER = [
  "접수번호", "신청 접수일", "신청 상태", "검토 상태", "선정 여부", "제작 진행 상태", "이름", "연락처", "이메일", "인스타그램",
  "희망 의류 종류", "희망 사이즈", "디자인 설명", "제작 목적", "제작 목적 상세", "추가 생산 의향", "참고 이미지 수", "프로젝트 참여 동의", "촬영·게시 동의", "개인정보 동의", "홍보 활용 동의(선택)",
  "관리자 메모", "보유 기한",
];

/** 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM 을 붙인 CSV 문자열 */
export const buildLabCsv = (rows: LabExportRow[]) => {
  const lines = rows.map((row) => {
    const stages = labStatusStages(row.status);
    return [
    row.application_no,
    formatKst(row.created_at),
    labStatusLabel(row.status),
    stages.review,
    stages.selection,
    stages.production,
    row.applicant_name,
    formatLabPhone(row.phone),
    row.email ?? "",
    row.instagram_id ?? "",
    labGarmentText(row.garment_types, row.garment_type_other),
    labSizeText(row.size, row.size_other),
    row.design_description,
    labPurposeLabel(row.purpose),
    row.reason ?? "",
    labFutureProductionLabel(row.future_production),
    row.image_count,
    consentText(row.consents, "participation"),
    consentText(row.consents, "filming"),
    consentText(row.consents, "privacy"),
    consentText(row.consents, "marketing"),
    row.admin_memo ?? "",
    formatKst(row.retention_until).slice(0, 10),
    ].map(safeCell).join(",");
  });
  return `\uFEFF${[LAB_CSV_HEADER.map(safeCell).join(","), ...lines].join("\r\n")}\r\n`;
};
