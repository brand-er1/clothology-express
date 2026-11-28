import { supabase } from "@/lib/supabase";
import type { ProductionDesignHandoff } from "@/lib/production-request";

/**
 * 간편 제작 의뢰 접수. 기존 save-order 엣지 함수(request_source = 'production_inquiry')로 저장되어
 * 관리자 콘솔 '제작 의뢰' 메뉴에 다른 제작 의뢰와 함께 쌓인다. 비회원도 접수할 수 있다.
 */
export const MAX_INQUIRY_ATTACHMENTS = 5;
export const MAX_INQUIRY_FILE_BYTES = 15 * 1024 * 1024;
export const INQUIRY_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export interface ProductionInquiryInput {
  contactName: string;
  contactPhone: string;
  item: string | null;
  quantityLabel: string | null;
  quantityValue: number | null;
  budgetRange: string | null;
  desiredDueDate: string | null;
  notes: string;
  privacyConsent: boolean;
  attachments: File[];
  design: ProductionDesignHandoff | null;
  source: string;
}

type EncodedImage = { base64: string; mimeType: string };

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]+;base64,/, ""));
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(blob);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 열지 못했습니다."));
    image.src = src;
  });

/** 큰 사진은 긴 변 2000px JPEG 로 줄여 전송량을 낮춘다. 1.5MB 이하 이미지(로고 등)는 원본 그대로 보낸다. */
export const encodeInquiryImage = async (blob: Blob): Promise<EncodedImage> => {
  const type = INQUIRY_ACCEPTED_TYPES.includes(blob.type) ? blob.type : "image/jpeg";
  if (blob.size <= 1.5 * 1024 * 1024 && INQUIRY_ACCEPTED_TYPES.includes(blob.type)) {
    return { base64: await blobToBase64(blob), mimeType: type };
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지를 처리하지 못했습니다.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    return { base64: dataUrl.replace(/^data:image\/jpeg;base64,/, ""), mimeType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
};

const storagePublicPrefix = () => {
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "https://jwmzjszdjlrqrhadbggr.supabase.co";
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/`;
};

/** 우리 스토리지에 이미 저장된 AI 이미지는 URL 만 넘기고(재업로드 없음), 그 밖의 이미지는 내려받아 함께 올린다. */
export const isStoredDesignUrl = (url: string) => url.startsWith(storagePublicPrefix());

const resolveDesignImage = async (design: ProductionDesignHandoff) => {
  if (isStoredDesignUrl(design.imageUrl)) {
    // 관리자 화면은 image_path 를 generated_images 버킷 기준으로 읽으므로 그 버킷일 때만 경로를 넘긴다.
    const objectPath = decodeURIComponent(design.imageUrl.slice(storagePublicPrefix().length).split("?")[0]);
    const imagePath = objectPath.startsWith("generated_images/") ? objectPath.slice("generated_images/".length) : null;
    return { generatedImageUrl: design.imageUrl, imagePath, upload: null as EncodedImage | null };
  }
  const response = await fetch(design.imageUrl);
  if (!response.ok) throw new Error("AI 디자인 이미지를 불러오지 못했습니다. 다시 시도해주세요.");
  return { generatedImageUrl: null, imagePath: null, upload: await encodeInquiryImage(await response.blob()) };
};

export const buildInquiryDescription = (input: ProductionInquiryInput) =>
  [
    input.item ? `제작 희망 품목: ${input.item}` : "",
    input.quantityLabel ? `예상 제작 수량: ${input.quantityLabel}` : "",
    input.budgetRange ? `희망 예산: ${input.budgetRange}` : "",
    input.desiredDueDate ? `희망 납기일: ${input.desiredDueDate}` : "",
    input.design ? `AI 디자인 첨부: ${input.design.origin === "detail_page_done" ? "상세페이지 디자인" : "AI 이미지 생성 결과"}` : "",
    input.design?.description ? `디자인 설명: ${input.design.description}` : "",
    input.notes.trim() ? `\n기타 요청사항:\n${input.notes.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

export const submitProductionInquiry = async (input: ProductionInquiryInput) => {
  const design = input.design ? await resolveDesignImage(input.design) : null;
  const attachments: EncodedImage[] = [];
  if (design?.upload) attachments.push(design.upload);
  for (const file of input.attachments.slice(0, MAX_INQUIRY_ATTACHMENTS)) {
    attachments.push(await encodeInquiryImage(file));
  }

  const clothType = input.item && input.item !== "아직 모르겠어요" ? input.item : input.design?.clothType || "상담 후 결정";
  const measurements: Record<string, string> = {};
  if (input.item) measurements["제작 희망 품목"] = input.item;
  if (input.quantityLabel) measurements["예상 제작 수량"] = input.quantityLabel;
  if (input.budgetRange) measurements["희망 예산"] = input.budgetRange;
  if (input.desiredDueDate) measurements["희망 납기일"] = input.desiredDueDate;

  const { data, error } = await supabase.functions.invoke("save-order", {
    body: {
      requestSource: "production_inquiry",
      status: "pending",
      clothType,
      material: input.design?.material || "상담 후 결정",
      requestTitle: `${input.contactName.trim() || "고객"} · ${clothType} 제작 의뢰`,
      detailDescription: buildInquiryDescription(input),
      measurements: Object.keys(measurements).length ? measurements : null,
      requestedQuantity: input.quantityValue ?? input.design?.quantity ?? null,
      generatedImageUrl: design?.generatedImageUrl ?? null,
      imagePath: design?.imagePath ?? null,
      images: attachments.length ? attachments : null,
      contactName: input.contactName.trim() || null,
      contactPhone: input.contactPhone,
      budgetRange: input.budgetRange,
      desiredDueDate: input.desiredDueDate,
      privacyConsent: input.privacyConsent,
      inquiryMeta: {
        from: input.source,
        item: input.item,
        quantity_label: input.quantityLabel,
        has_ai_design: Boolean(input.design),
        design_origin: input.design?.origin ?? null,
        design_id: input.design?.designId ?? null,
        attachment_count: input.attachments.length,
      },
    },
  });

  if (error) {
    // FunctionsHttpError 는 본문에 서버가 보낸 한국어 메시지를 담고 있다.
    const context = (error as { context?: Response }).context;
    let message = error.message;
    if (context && typeof context.json === "function") {
      try {
        const body = await context.json();
        if (body?.error) message = body.error;
      } catch {
        // noop
      }
    }
    throw new Error(message || "제작 의뢰를 접수하지 못했습니다.");
  }
  if (!data?.success) throw new Error(data?.error || "제작 의뢰를 접수하지 못했습니다.");
  return { id: (data.id as string | undefined) ?? null };
};
