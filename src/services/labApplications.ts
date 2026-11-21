import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  LAB_CONSENT_DOCUMENTS, type LabApplicationInput, type LabConsentKey,
} from "../../supabase/functions/_shared/labApplication";

export type LabSubmitResult = { applicationNo: string; createdAt: string; duplicate: boolean };

export class LabSubmitError extends Error {
  constructor(message: string, readonly code: string, readonly fields?: Partial<Record<keyof LabApplicationInput, string>>) {
    super(message);
    this.name = "LabSubmitError";
  }
}

/**
 * 신청서 제출. 같은 submissionKey 로 다시 보내면 서버가 새로 저장하지 않고 기존 접수 번호를 돌려준다
 * (응답을 못 받은 채 다시 누르거나 네트워크가 끊겼다 재시도해도 한 건만 접수된다).
 */
export async function submitLabApplication(params: {
  submissionKey: string;
  input: LabApplicationInput;
  consents: Record<LabConsentKey, boolean>;
  images: File[];
}): Promise<LabSubmitResult> {
  const form = new FormData();
  form.append("payload", JSON.stringify({
    ...params.input,
    submissionKey: params.submissionKey,
    consents: LAB_CONSENT_DOCUMENTS.map((doc) => ({ key: doc.key, version: doc.version, agreed: Boolean(params.consents[doc.key]) })),
  }));
  params.images.forEach((file) => form.append("images", file, file.name));

  const { data, error } = await supabase.functions.invoke("submit-lab-application", { body: form });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null) as { error?: string; code?: string; fields?: Record<string, string> } | null;
      throw new LabSubmitError(body?.error ?? "신청을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.", body?.code ?? "HTTP", body?.fields);
    }
    if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
      throw new LabSubmitError("네트워크 연결이 불안정해 신청을 보내지 못했습니다. 연결을 확인한 뒤 다시 눌러주세요. 같은 신청서는 한 번만 접수됩니다.", "NETWORK");
    }
    throw new LabSubmitError("신청을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.", "UNKNOWN");
  }

  const result = data as { ok?: boolean; applicationNo?: string; createdAt?: string; duplicate?: boolean } | null;
  if (!result?.ok || !result.applicationNo) throw new LabSubmitError("신청 결과를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.", "UNKNOWN");
  return { applicationNo: result.applicationNo, createdAt: result.createdAt ?? new Date().toISOString(), duplicate: Boolean(result.duplicate) };
}

const MAX_EDGE = 2560;
const REENCODE_BYTES = 2.5 * 1024 * 1024;

/**
 * 업로드 전 사진 정리: JPG · WEBP 는 촬영 위치(GPS) 등 메타데이터를 지우기 위해 다시 저장하고, 긴 변 2560px 로 줄인다.
 * PNG 는 크거나(2.5MB 초과) 너무 크면만 JPG 로 바꾼다. 변환에 실패하면 원본을 그대로 보낸다(서버가 다시 검사한다).
 */
export async function prepareLabImage(file: File): Promise<File> {
  const isPng = file.type === "image/png" || /\.png$/i.test(file.name);
  if (typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (isPng && scale === 1 && file.size <= REENCODE_BYTES) { bitmap.close(); return file; }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) { bitmap.close(); return file; }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob || blob.size === 0) return file;
    if (blob.size >= file.size && scale === 1 && !/jpe?g|webp/i.test(file.type)) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "reference";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
