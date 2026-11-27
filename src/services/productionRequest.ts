import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  PRODUCTION_REQUEST_CONSENT_VERSION, type ProductionRequestField,
} from "../../supabase/functions/_shared/productionRequest";

export type ProductionRequestImage = { url: string } | { base64: string };

export type ProductionRequestDesign = {
  clothType: string;
  material: string;
  aiPrompt: string;
  designBrief: string;
  designId: string | null;
};

export type ProductionRequestForm = {
  contactName: string;
  phone: string;
  quantity: string;
  quantityUndecided: boolean;
  budget: string;
  request: string;
  privacyConsent: boolean;
};

export type ProductionRequestResult = { orderId: string; createdAt: string; duplicate: boolean };

export class ProductionRequestError extends Error {
  constructor(message: string, readonly code: string, readonly fields?: Partial<Record<ProductionRequestField, string>>) {
    super(message);
    this.name = "ProductionRequestError";
  }
}

/**
 * AI 생성 이미지 제작의뢰 접수. 서버가 이미지를 영구 저장하고 DB 에 저장한 뒤에만 ok 를 돌려준다.
 * 같은 submissionKey 로 다시 보내면(응답 유실 후 재시도 · 더블 클릭) 새로 저장하지 않고 기존 접수를 돌려준다.
 */
export async function submitProductionRequest(params: {
  submissionKey: string;
  form: ProductionRequestForm;
  image: ProductionRequestImage;
  design: ProductionRequestDesign;
  entryPoint: string;
  entryPath: string;
}): Promise<ProductionRequestResult> {
  const { data, error } = await supabase.functions.invoke("submit-production-request", {
    body: {
      submissionKey: params.submissionKey,
      ...params.form,
      privacyConsentVersion: PRODUCTION_REQUEST_CONSENT_VERSION,
      image: params.image,
      design: params.design,
      entryPoint: params.entryPoint,
      entryPath: params.entryPath,
    },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null) as { error?: string; code?: string; fields?: Record<string, string> } | null;
      throw new ProductionRequestError(body?.error ?? "제작의뢰를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.", body?.code ?? "HTTP", body?.fields);
    }
    if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
      throw new ProductionRequestError("네트워크 연결이 불안정해 제작의뢰를 보내지 못했습니다. 연결을 확인한 뒤 다시 눌러주세요. 같은 의뢰는 한 번만 접수됩니다.", "NETWORK");
    }
    throw new ProductionRequestError("제작의뢰를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.", "UNKNOWN");
  }

  const result = data as { ok?: boolean; orderId?: string; createdAt?: string; duplicate?: boolean } | null;
  if (!result?.ok || !result.orderId) throw new ProductionRequestError("접수 결과를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.", "UNKNOWN");
  return { orderId: result.orderId, createdAt: result.createdAt ?? new Date().toISOString(), duplicate: Boolean(result.duplicate) };
}
