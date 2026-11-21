import { supabase } from "@/lib/supabase";
import { adminRpc } from "@/services/adminApi";
import type { LabConsentSnapshot, LabExportRow } from "@/lib/lab-export";
import type { LabStatus } from "../../supabase/functions/_shared/labApplication";

// BRAND-ER LAB 관리자 API. 모든 호출은 서버 RPC 가 lab.view / lab.manage 권한을 다시 검사한다.

export const LAB_BUCKET = "lab-applications";

export type LabListRow = {
  id: string;
  application_no: string;
  created_at: string;
  applicant_name: string;
  phone: string;
  email: string | null;
  instagram_id: string;
  garment_types: string[];
  garment_type_other: string | null;
  size: string;
  size_other: string | null;
  design_description: string;
  image_paths: string[];
  status: LabStatus;
  status_changed_at: string;
  has_memo: boolean;
  retention_until: string;
  consents: LabConsentSnapshot;
  has_filming_agreement: boolean;
};

export type LabList = {
  total: number;
  counts: Partial<Record<LabStatus | "all", number>>;
  expired_count: number;
  can_manage: boolean;
  rows: LabListRow[];
};

export type LabListFilter = { status: LabStatus | "all"; search: string; sort: "newest" | "oldest"; retention: "all" | "expired" };

export type LabConsentRecord = {
  id: number; consent_key: string; consent_version: string; title: string; body: string; is_required: boolean;
  agreed: boolean; action: "initial" | "withdraw" | "re_agree"; source: "applicant_web" | "admin_recorded";
  note: string | null; recorded_by_name: string | null; created_at: string;
};

export type LabFilmingAgreement = {
  id: string; filming_scope: string; channels: string; usage_period: string; edit_reuse_scope: string;
  agreement_method: "written" | "electronic" | "messenger" | "other"; agreed_at: string; evidence_note: string | null;
  withdrawn_at: string | null; withdrawn_note: string | null; recorded_by_name: string | null; created_at: string;
};

export type LabEvent = {
  id: number; event_type: string; from_status: string | null; to_status: string | null; note: string | null;
  actor_name: string | null; created_at: string;
};

export type LabDetail = {
  application: Omit<LabListRow, "consents" | "has_memo" | "has_filming_agreement"> & {
    reason: string | null; admin_memo: string | null; admin_memo_updated_at: string | null; admin_memo_updated_by_name: string | null;
    is_member: boolean; updated_at: string;
  };
  can_manage: boolean;
  consents: LabConsentSnapshot;
  consent_records: LabConsentRecord[];
  filming_agreements: LabFilmingAgreement[];
  events: LabEvent[];
};

export const listLabApplications = (filter: LabListFilter, page: number, pageSize: number) =>
  adminRpc<LabList>("admin_list_lab_applications", {
    p_status: filter.status, p_search: filter.search || null, p_sort: filter.sort, p_retention: filter.retention,
    p_limit: pageSize, p_offset: page * pageSize,
  });

export const getLabApplication = (id: string) => adminRpc<LabDetail>("admin_get_lab_application", { p_id: id });

export const updateLabApplication = (id: string, changes: { status?: LabStatus; memo?: string; retentionUntil?: string; reason?: string }) =>
  adminRpc("admin_update_lab_application", {
    p_id: id, p_status: changes.status ?? null, p_memo: changes.memo ?? null,
    p_retention_until: changes.retentionUntil ?? null, p_reason: changes.reason ?? null,
  });

export const recordLabConsent = (id: string, consentKey: string, agreed: boolean, note: string) =>
  adminRpc("admin_record_lab_consent", { p_id: id, p_consent_key: consentKey, p_agreed: agreed, p_note: note });

export const addLabFilmingAgreement = (id: string, input: {
  filmingScope: string; channels: string; usagePeriod: string; editReuseScope: string;
  method: LabFilmingAgreement["agreement_method"]; agreedAt: string; evidenceNote: string;
}) => adminRpc("admin_add_lab_filming_agreement", {
  p_id: id, p_filming_scope: input.filmingScope, p_channels: input.channels, p_usage_period: input.usagePeriod,
  p_edit_reuse_scope: input.editReuseScope, p_agreement_method: input.method, p_agreed_at: input.agreedAt,
  p_evidence_note: input.evidenceNote || null,
});

export const withdrawLabFilmingAgreement = (agreementId: string, note: string) =>
  adminRpc("admin_withdraw_lab_filming_agreement", { p_agreement_id: agreementId, p_note: note });

export const exportLabApplications = (filter: Omit<LabListFilter, "sort">) =>
  adminRpc<LabExportRow[]>("admin_export_lab_applications", {
    p_status: filter.status, p_search: filter.search || null, p_retention: filter.retention,
  });

/** 비공개 버킷의 참고 이미지를 10분짜리 서명 URL 로 연다(lab.view 권한이 있어야 발급된다). */
export async function signLabImages(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(LAB_BUCKET).createSignedUrls(paths, 600);
  if (error) throw error;
  return Object.fromEntries((data ?? []).filter((item) => item.signedUrl && item.path).map((item) => [item.path as string, item.signedUrl]));
}

/**
 * 신청 정보 파기: 참고 이미지를 먼저 지우고(Storage API) 신청서 · 동의 이력 · 처리 이력을 삭제한다.
 * 이미지 삭제에 실패하면 신청서는 남겨 두어 다시 시도할 수 있게 한다.
 */
export async function deleteLabApplications(rows: { id: string; image_paths: string[] }[], reason: string) {
  const paths = rows.flatMap((row) => row.image_paths);
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await supabase.storage.from(LAB_BUCKET).remove(paths.slice(index, index + 100));
    if (error) throw new Error(`참고 이미지를 삭제하지 못해 신청 정보를 남겨두었습니다. 다시 시도해주세요. (${error.message})`);
  }
  for (let index = 0; index < rows.length; index += 500) {
    await adminRpc("admin_delete_lab_applications", { p_ids: rows.slice(index, index + 500).map((row) => row.id), p_reason: reason });
  }
  return { deleted: rows.length };
}
