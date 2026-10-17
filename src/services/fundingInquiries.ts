import { supabase } from "@/lib/supabase";

// 펀딩 상품 문의. 열람(비공개 마스킹) · 작성 · 답변 권한은 서버 RPC 와 RLS 가 매번 다시 판단하므로
// 이 파일은 권한을 판단하지 않는다.

export type InquiryType = "size_fit" | "fabric" | "production" | "shipping" | "exchange_refund" | "other";
export type InquiryStatus = "pending" | "answered";
export type InquiryFilter = "all" | "mine" | "pending" | "answered";
export type AnswerRole = "creator" | "admin";

export const INQUIRY_TYPES: { value: InquiryType; label: string }[] = [
  { value: "size_fit", label: "사이즈 및 핏 문의" },
  { value: "fabric", label: "원단 및 소재 문의" },
  { value: "production", label: "제작 및 생산 문의" },
  { value: "shipping", label: "배송 일정 문의" },
  { value: "exchange_refund", label: "교환 및 환불 문의" },
  { value: "other", label: "기타 문의" },
];

export const INQUIRY_TYPE_LABEL: Record<InquiryType, string> = Object.fromEntries(
  INQUIRY_TYPES.map((type) => [type.value, type.label]),
) as Record<InquiryType, string>;

export const ANSWER_ROLE_LABEL: Record<AnswerRole, string> = {
  creator: "제작자 답변",
  admin: "BRAND-ER 관리자 답변",
};

export type InquiryAnswer = {
  content: string;
  role: AnswerRole;
  answered_at: string;
  updated_at: string | null;
};

export type FundingInquiry = {
  id: string;
  inquiry_type: InquiryType;
  title: string;
  content: string | null;
  image_paths: string[];
  is_private: boolean;
  is_hidden: boolean;
  status: InquiryStatus;
  nickname: string;
  is_mine: boolean;
  can_view: boolean;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
  answer: InquiryAnswer | null;
};

export type InquiryViewer = {
  logged_in: boolean;
  is_creator: boolean;
  can_answer: boolean;
  can_ask: boolean;
};

export type InquiryList = {
  total: number;
  pending: number;
  rows: FundingInquiry[];
  viewer: InquiryViewer;
};

export type InquiryDraft = {
  inquiryType: InquiryType;
  title: string;
  content: string;
  isPrivate: boolean;
  /** 이미 올라가 있는 사진 경로(수정 시 유지할 것) */
  keepPaths: string[];
  /** 새로 올릴 사진 */
  files: File[];
};

export const INQUIRY_BUCKET = "funding-inquiries";
export const MAX_INQUIRY_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args: Record<string, unknown>) => (supabase.rpc as any)(name, args);

const fail = (error: { message?: string } | null, fallback: string): never => {
  throw new Error(error?.message || fallback);
};

export const validateInquiryImage = (file: File) => {
  if (!IMAGE_TYPES[file.type]) return "JPG, PNG, WEBP 이미지만 첨부할 수 있습니다.";
  if (file.size > MAX_IMAGE_BYTES) return "사진은 한 장당 5MB 이하만 첨부할 수 있습니다.";
  return null;
};

export const fetchFundingInquiries = async (
  fundingId: string,
  filter: InquiryFilter = "all",
  type: InquiryType | null = null,
  limit = 10,
  offset = 0,
): Promise<InquiryList> => {
  const { data, error } = await rpc("list_funding_inquiries", {
    p_funding_id: fundingId, p_filter: filter, p_type: type, p_limit: limit, p_offset: offset,
  });
  if (error) fail(error, "문의를 불러오지 못했습니다.");
  return data as InquiryList;
};

/** 비공개 버킷이라 열람 권한이 있는 사람에게만 서명 URL 이 발급된다(Storage 정책). */
export const signInquiryImages = async (paths: string[]): Promise<Record<string, string>> => {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from(INQUIRY_BUCKET).createSignedUrls(paths, 60 * 30);
  if (error || !data) return {};
  return Object.fromEntries(data.filter((item) => item.signedUrl && item.path).map((item) => [item.path as string, item.signedUrl]));
};

const removeImages = async (paths: string[]) => {
  if (paths.length) await supabase.storage.from(INQUIRY_BUCKET).remove(paths);
};

/** 사진은 본인 폴더(funding-inquiries/<uid>/...)에만 올라간다(Storage 정책). */
const uploadInquiryImages = async (files: File[]) => {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error("로그인이 필요합니다.");
  const paths: string[] = [];
  for (const file of files) {
    const invalid = validateInquiryImage(file);
    if (invalid) {
      await removeImages(paths);
      throw new Error(invalid);
    }
    const path = `${userId}/${crypto.randomUUID()}.${IMAGE_TYPES[file.type]}`;
    const { error } = await supabase.storage.from(INQUIRY_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      await removeImages(paths);
      throw new Error("사진을 업로드하지 못했습니다.");
    }
    paths.push(path);
  }
  return paths;
};

export const createFundingInquiry = async (fundingId: string, draft: InquiryDraft) => {
  if (draft.files.length > MAX_INQUIRY_IMAGES) throw new Error(`사진은 최대 ${MAX_INQUIRY_IMAGES}장까지 첨부할 수 있습니다.`);
  const uploaded = await uploadInquiryImages(draft.files);
  const { data, error } = await rpc("create_funding_product_inquiry", {
    p_funding_id: fundingId,
    p_inquiry_type: draft.inquiryType,
    p_title: draft.title,
    p_content: draft.content,
    p_image_paths: uploaded,
    p_is_private: draft.isPrivate,
  });
  if (error) {
    await removeImages(uploaded);
    fail(error, "문의를 등록하지 못했습니다.");
  }
  // 담당 제작자 SMS 작업을 바로 처리한다(실패해도 문의 등록에는 영향 없음, 서버가 중복 발송을 막는다).
  void supabase.functions.invoke("dispatch-notifications", { body: { fundingId } }).catch(() => undefined);
  return data as string;
};

export const updateMyFundingInquiry = async (inquiryId: string, draft: InquiryDraft) => {
  if (draft.keepPaths.length + draft.files.length > MAX_INQUIRY_IMAGES) {
    throw new Error(`사진은 최대 ${MAX_INQUIRY_IMAGES}장까지 첨부할 수 있습니다.`);
  }
  const uploaded = await uploadInquiryImages(draft.files);
  const { data, error } = await rpc("update_my_funding_inquiry", {
    p_inquiry_id: inquiryId,
    p_inquiry_type: draft.inquiryType,
    p_title: draft.title,
    p_content: draft.content,
    p_image_paths: [...draft.keepPaths, ...uploaded],
    p_is_private: draft.isPrivate,
  });
  if (error) {
    await removeImages(uploaded);
    fail(error, "문의를 수정하지 못했습니다.");
  }
  await removeImages((data ?? []) as string[]);
};

export const deleteMyFundingInquiry = async (inquiryId: string) => {
  const { data, error } = await rpc("delete_my_funding_inquiry", { p_inquiry_id: inquiryId });
  if (error) fail(error, "문의를 삭제하지 못했습니다.");
  await removeImages((data ?? []) as string[]);
};

export const answerFundingInquiry = async (inquiryId: string, content: string) => {
  const { data, error } = await rpc("answer_funding_inquiry", { p_inquiry_id: inquiryId, p_content: content });
  if (error) fail(error, "답변을 저장하지 못했습니다.");
  return data as { status: InquiryStatus; answer_role: AnswerRole; first_answer: boolean };
};

export const setFundingInquiryStatus = async (inquiryId: string, status: InquiryStatus) => {
  const { error } = await rpc("set_funding_inquiry_status", { p_inquiry_id: inquiryId, p_status: status });
  if (error) fail(error, "상태를 바꾸지 못했습니다.");
};

// 이전 버전 [문의] 탭에서 고객센터(cs_tickets)로 접수한 내 문의 — 읽기 전용으로 계속 보여준다.
export type LegacyFundingInquiry = {
  id: string;
  subject: string;
  content: string;
  status: "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
  created_at: string;
  resolved_at: string | null;
};

export const fetchMyLegacyFundingInquiries = async (fundingId: string): Promise<LegacyFundingInquiry[]> => {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return [];
  const { data, error } = await rpc("list_my_funding_inquiries", { p_funding_id: fundingId });
  if (error) return [];
  return (data ?? []) as LegacyFundingInquiry[];
};
