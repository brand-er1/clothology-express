/**
 * SMS / 알림톡 발송 서비스 레이어 (발송 업체 교체 가능 구조)
 *
 *   dispatch-notifications → sendFundingSuccessSMS() → SmsProvider(send) → 발송 업체 API
 *
 * 업체는 SMS_PROVIDER Secret 으로 고른다. 키/시크릿은 Supabase Secrets 에만 저장하고
 * 코드·GitHub·프론트엔드에는 두지 않는다.
 *
 *   SMS_PROVIDER        solapi | mock | mock_fail | (미설정 = 미연동)
 *   SMS_API_KEY         발송 업체 API Key            (solapi)
 *   SMS_API_SECRET      발송 업체 API Secret         (solapi)
 *   SMS_SENDER_NUMBER   사전 등록된 발신번호(숫자만)  (solapi)
 *   SMS_KAKAO_PF_ID                          (선택) 카카오 알림톡 발신 프로필 ID
 *   SMS_KAKAO_TEMPLATE_FUNDING_SUCCESS       (선택) 제작자용 펀딩 성공 알림톡 템플릿 ID
 *   SMS_KAKAO_TEMPLATE_FUNDING_SUCCESS_PARTICIPANT (선택) 참여자용 템플릿 ID
 *
 * 새 업체(NHN Cloud, 알리고 등)는 SmsProvider 를 구현해 createSmsProvider 에 추가하면 된다.
 */

export type SmsMessage = {
  to: string;
  text: string;
  subject?: string;
  /** 알림톡 템플릿 ID. 공급자가 알림톡을 지원하고 발신 프로필이 설정된 경우에만 사용(실패 시 문자 대체발송). */
  kakaoTemplateId?: string;
};

export type SmsSendResult =
  | { ok: true; provider: string; messageId: string | null; channel: "sms" | "alimtalk" }
  | { ok: false; provider: string; error: string };

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<SmsSendResult>;
}

type Env = { get(key: string): string | undefined };

const denoEnv: Env = { get: (key) => Deno.env.get(key) };

export const normalizeKrPhone = (value: string | null | undefined): string | null => {
  if (!value) return null;
  let digits = value.replace(/[^0-9]/g, "");
  if (digits.startsWith("82") && digits.length >= 11) digits = `0${digits.slice(2).replace(/^0+/, "")}`;
  return /^(010[0-9]{8}|01[16789][0-9]{7,8})$/.test(digits) ? digits : null;
};

export const maskPhone = (phone: string) => (phone.length < 8 ? phone : `${phone.slice(0, 3)}-****-${phone.slice(-4)}`);

// ---------------------------------------------------------------------------
// 메시지 템플릿
// ---------------------------------------------------------------------------

export type FundingSuccessSmsInput = {
  fundingName: string;
  targetQuantity: number;
  quantity: number;
  participants: number;
};

const clipName = (name: string) => (name.length > 40 ? `${name.slice(0, 39)}…` : name);

export const buildFundingSuccessCreatorText = ({ fundingName, targetQuantity, quantity, participants }: FundingSuccessSmsInput) =>
  [
    "[BRAND-ER]",
    "축하드립니다!",
    `"${clipName(fundingName)}" 펀딩이 목표 수량 ${targetQuantity}장을 달성했습니다.`,
    `현재 ${participants}명/${quantity}장 참여가 완료되었습니다.`,
    "BRAND-ER에서 펀딩 현황을 확인하고 제작을 준비해주세요.",
    "brand-er.store",
  ].join("\n");

export const buildFundingSuccessParticipantText = ({ fundingName }: Pick<FundingSuccessSmsInput, "fundingName">) =>
  [
    "[BRAND-ER]",
    `참여하신 "${clipName(fundingName)}" 펀딩이 목표 수량을 달성했습니다.`,
    "이제 제작이 진행될 예정입니다.",
    "제작 진행 상황은 BRAND-ER에서 확인하실 수 있습니다.",
    "brand-er.store",
  ].join("\n");

// ---------------------------------------------------------------------------
// 공급자 구현
// ---------------------------------------------------------------------------

const toHex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

export const solapiSignature = async (apiSecret: string, date: string, salt: string) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(apiSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(date + salt)));
};

/** Solapi(구 CoolSMS) v4 — https://developers.solapi.com (HMAC-SHA256 인증, 90byte 초과 시 LMS 자동) */
export class SolapiProvider implements SmsProvider {
  readonly name = "solapi";
  constructor(
    private readonly config: { apiKey: string; apiSecret: string; sender: string; kakaoPfId?: string },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: SmsMessage): Promise<SmsSendResult> {
    const date = new Date().toISOString();
    const salt = crypto.randomUUID().replace(/-/g, "");
    const signature = await solapiSignature(this.config.apiSecret, date, salt);
    const useAlimtalk = Boolean(this.config.kakaoPfId && message.kakaoTemplateId);
    const body = {
      message: {
        to: message.to,
        from: this.config.sender,
        text: message.text,
        ...(message.subject && !useAlimtalk ? { subject: message.subject } : {}),
        ...(useAlimtalk
          ? { kakaoOptions: { pfId: this.config.kakaoPfId, templateId: message.kakaoTemplateId, disableSms: false } }
          : {}),
      },
    };
    try {
      const response = await this.fetchImpl("https://api.solapi.com/messages/v4/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `HMAC-SHA256 apiKey=${this.config.apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) {
        return { ok: false, provider: this.name, error: `HTTP ${response.status} ${String(data.errorCode ?? "")} ${String(data.errorMessage ?? "")}`.trim() };
      }
      const statusCode = String(data.statusCode ?? "2000");
      // 2000 = 접수 성공. 그 외 코드는 발송 실패로 기록한다.
      if (statusCode !== "2000") {
        return { ok: false, provider: this.name, error: `${statusCode} ${String(data.statusMessage ?? "")}`.trim() };
      }
      return { ok: true, provider: this.name, messageId: (data.messageId as string) ?? (data.groupId as string) ?? null, channel: useAlimtalk ? "alimtalk" : "sms" };
    } catch (error) {
      return { ok: false, provider: this.name, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

/** 개발/스테이징용: 실제로 보내지 않고 성공(mock) 또는 실패(mock_fail)로 기록한다. */
export class MockSmsProvider implements SmsProvider {
  readonly sent: SmsMessage[] = [];
  constructor(readonly name: "mock" | "mock_fail" = "mock") {}
  send(message: SmsMessage): Promise<SmsSendResult> {
    this.sent.push(message);
    if (this.name === "mock_fail") return Promise.resolve({ ok: false, provider: this.name, error: "모의 발송 실패(SMS_PROVIDER=mock_fail)" });
    return Promise.resolve({ ok: true, provider: this.name, messageId: `mock-${crypto.randomUUID()}`, channel: "sms" });
  }
}

/** 업체 미연동: 발송하지 않고 실패로 기록 → 연동 후 관리자 재발송 */
export class UnconfiguredSmsProvider implements SmsProvider {
  readonly name = "none";
  constructor(private readonly reason: string) {}
  send(): Promise<SmsSendResult> {
    return Promise.resolve({ ok: false, provider: this.name, error: this.reason });
  }
}

export const createSmsProvider = (env: Env = denoEnv): SmsProvider => {
  const provider = (env.get("SMS_PROVIDER") ?? "").trim().toLowerCase();
  if (provider === "mock" || provider === "mock_fail") return new MockSmsProvider(provider);
  if (provider === "solapi" || provider === "coolsms") {
    const apiKey = env.get("SMS_API_KEY")?.trim();
    const apiSecret = env.get("SMS_API_SECRET")?.trim();
    const sender = (env.get("SMS_SENDER_NUMBER") ?? "").replace(/[^0-9]/g, "");
    if (!apiKey || !apiSecret || !sender) {
      return new UnconfiguredSmsProvider("SMS 발송 설정 누락(SMS_API_KEY / SMS_API_SECRET / SMS_SENDER_NUMBER)");
    }
    return new SolapiProvider({ apiKey, apiSecret, sender, kakaoPfId: env.get("SMS_KAKAO_PF_ID")?.trim() || undefined });
  }
  return new UnconfiguredSmsProvider(provider ? `지원하지 않는 SMS_PROVIDER: ${provider}` : "SMS 발송 업체 미연동(SMS_PROVIDER 미설정)");
};

// ---------------------------------------------------------------------------
// 서비스 함수
// ---------------------------------------------------------------------------

export async function sendFundingSuccessSMS(
  provider: SmsProvider,
  input: FundingSuccessSmsInput & { to: string; recipientRole?: "creator" | "participant" },
  env: Env = denoEnv,
): Promise<SmsSendResult> {
  const to = normalizeKrPhone(input.to);
  if (!to) return { ok: false, provider: provider.name, error: "휴대폰 번호 형식 오류" };
  const participant = input.recipientRole === "participant";
  return provider.send({
    to,
    subject: participant ? "[BRAND-ER] 참여 펀딩 성공" : "[BRAND-ER] 펀딩 성공",
    text: participant ? buildFundingSuccessParticipantText(input) : buildFundingSuccessCreatorText(input),
    kakaoTemplateId: (participant
      ? env.get("SMS_KAKAO_TEMPLATE_FUNDING_SUCCESS_PARTICIPANT")
      : env.get("SMS_KAKAO_TEMPLATE_FUNDING_SUCCESS"))?.trim() || undefined,
  });
}
