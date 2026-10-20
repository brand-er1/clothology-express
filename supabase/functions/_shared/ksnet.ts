// KSNET KSPay 인증결제(단건) 어댑터.
//
// 흐름: 서버가 결제창 form 을 만들어 내려준다 → 결제창은 카드 **인증까지만** 하고
// sndReply(ksnet-return)로 POST 한다 → ksnet-return 이 `recv_post.jsp` 로 **우리 DB 금액**을
// 실어 승인을 건다. 결제창 리턴을 위조해도 승인 금액은 서버가 정하므로 돈이 움직이지 않는다.
//
// 플리트소프트 LinkPay 가 운영 중인 KSPay 연동을 그대로 옮겼다.

const KSPAY_JS_URL = "https://kspay.ksnet.to/store/KSPayWebV1.4/js/kspay_web_ssl.js";
/** 모바일 결제창. `KSPayWebV1.4` 는 PC 전용이라 모바일에서는 이 주소로 직접 제출한다. */
const KSPAY_MOBILE_URL = "https://kspay.ksnet.to/store/KSPayMobileV1.4/KSPayPWeb.jsp";
/** 거래확정(승인) 엔드포인트. */
const CONFIRM_URL = "https://kspay.ksnet.to/store/KSPayWebV1.4/web_host/recv_post.jsp";
/**
 * 취소 API 주소. 기본은 운영이다 — 환경변수가 빠진 채 배포됐을 때 조용히 시험 서버로
 * 가는 것보다, 시험을 깜빡했을 때 실패가 보이는 쪽이 낫다.
 */
const API_BASE = (Deno.env.get("KSNET_API_BASE") ?? "https://pay.ksnet.co.kr").replace(/\/+$/, "");

/** 신용카드(+ 결제창 안의 간편결제). 10자리 비트 문자열이고 첫 자리가 신용카드다. */
const PAY_METHOD_CARD = "1000000000";

/** KSPay 최소 결제금액. 이보다 적으면 결제창에서 거절된다. */
export const KSNET_MIN_AMOUNT = 1000;

/** `sndReply` 는 100자까지만 받는다. 넘으면 결제창이 복귀 주소를 잘라 결과가 사라진다. */
const MAX_REPLY_URL_LENGTH = 100;

export const getKsnetMid = () => {
  const mid = Deno.env.get("KSNET_MID")?.trim();
  if (!mid) throw new Error("KSNET 상점아이디(KSNET_MID)가 설정되지 않았습니다.");
  return mid;
};

/** 결제창이 인증 결과를 POST 할 주소. 로컬에서는 SUPABASE_URL 이 도커 내부 주소라 따로 받는다. */
export const getKsnetReturnUrl = () =>
  Deno.env.get("KSNET_RETURN_URL") ?? `${Deno.env.get("SUPABASE_URL") ?? ""}/functions/v1/ksnet-return`;

// ── 참여 ID ↔ 복귀 URL 키 ──────────────────────────────────────────────
//
// 결제창은 우리가 보낸 필드(sndOrdernumber 포함)를 돌려주지 않는다. 그래서 참여 ID 를
// 복귀 URL 쿼리에 싣는데, UUID(36자)를 그대로 실으면 운영 주소에서 100자를 넘는다.
// 16바이트를 base64url(22자)로 줄인다. 추측 불가능한 값이라는 성질은 그대로다.

export const encodeParticipationKey = (uuid: string) => {
  const bytes = uuid.replace(/-/g, "").match(/../g)!.map((hex) => parseInt(hex, 16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const decodeParticipationKey = (key: string): string | null => {
  if (!/^[A-Za-z0-9_-]{22}$/.test(key)) return null;
  const binary = atob(key.replace(/-/g, "+").replace(/_/g, "/") + "==");
  const hex = [...binary].map((char) => char.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// ── 결제창 ────────────────────────────────────────────────────────────

export type KspayForm = {
  scriptUrl: string;
  /** 모바일 결제창 주소. PC 와 경로가 다르다. */
  submitUrl: string;
  fields: Record<string, string>;
};

/**
 * 결제창에 넘길 form 필드. 전부 브라우저에 노출되므로 비밀을 넣지 않는다.
 * 금액을 브라우저에서 고쳐도 승인은 서버가 DB 금액으로 건다.
 */
export const buildKspayForm = (input: {
  participationId: string;
  itemName: string;
  amount: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
}): KspayForm => {
  const replyUrl = `${getKsnetReturnUrl()}?o=${encodeParticipationKey(input.participationId)}`;
  if (replyUrl.length > MAX_REPLY_URL_LENGTH) {
    throw new Error(`KSNET 복귀 주소가 ${MAX_REPLY_URL_LENGTH}자를 넘습니다. KSNET_RETURN_URL 을 확인해주세요.`);
  }

  return {
    scriptUrl: KSPAY_JS_URL,
    submitUrl: KSPAY_MOBILE_URL,
    fields: {
      sndPaymethod: PAY_METHOD_CARD,
      sndStoreid: getKsnetMid(),
      sndOrdernumber: input.participationId,
      sndGoodname: input.itemName.slice(0, 50),
      sndAmount: String(input.amount),
      sndOrdername: input.buyerName.slice(0, 50),
      sndEmail: input.buyerEmail.slice(0, 50),
      sndMobile: input.buyerPhone.replace(/\D/g, "").slice(0, 12),
      sndReply: replyUrl,
      sndShowcard: "C",
      sndCurrencytype: "WON",
      sndInstallmenttype: "ALL(0:2:3:4:5:6:7:8:9:10:11:12)",
      sndInteresttype: "NONE",
      iframeYn: "N", // 팝업. 레이어는 모바일에서 스크롤이 갇힌다
      sndGoodType: "1", // 실물
      sndCharSet: "UTF-8",
    },
  };
};

// ── 인증 결과 ─────────────────────────────────────────────────────────
//
// 결제창이 sndReply 로 POST 하는 필드는 reCommConId · reCommType · reHash · reEncData ·
// reCnclType 뿐이다. 승인에 쓰는 건 reCommConId, 사용자가 취소했는지는 reCnclType === "1".

export type KsnetAuthResult = {
  commConId: string;
  cancelled: boolean;
  participationId: string;
};

const TOKEN = /^[A-Za-z0-9_-]{1,128}$/;

export const parseKsnetAuthResult = (raw: string, requestUrl: string): KsnetAuthResult | null => {
  const body = new URLSearchParams(raw);
  const commConId = body.get("reCommConId") ?? "";
  if (commConId && !TOKEN.test(commConId)) return null;

  const cancelled = body.get("reCnclType") === "1";
  if (!commConId && !cancelled) return null;

  const participationId = decodeParticipationKey(new URL(requestUrl).searchParams.get("o") ?? "");
  if (!participationId) return null;

  return { commConId, cancelled, participationId };
};

// ── 승인 (거래확정) ───────────────────────────────────────────────────

export type KsnetApproval = {
  approved: boolean;
  /** KSNET 거래번호. 취소할 때 쓴다. */
  tid: string;
  amount: number;
  authNo: string;
  message: string;
  /** KSNET 이 알려준 가맹점 주문번호(= 우리가 보낸 sndOrdernumber). */
  orderNo: string;
};

/** 응답 필드 순서. KSNET 에 이 순서로 달라고 요청하고 그대로 받는다. */
const RPARAMS = "authyn`trno`trddt`trdtm`amt`authno`msg1`msg2`ordno`isscd`aqucd`result";

/**
 * 승인 요청. `amount` 는 **우리 DB 금액**이다 — 결제창이 돌려준 값이 아니다.
 * 응답은 EUC-KR backtick 구분 문자열이고 첫 토큰은 구분자라 버린다.
 */
export const confirmKsnetTransaction = async (commConId: string, amount: number): Promise<KsnetApproval> => {
  const response = await fetch(CONFIRM_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      sndCommConId: commConId,
      sndActionType: "1",
      sndAmount: String(amount),
      sndRpyParams: RPARAMS,
    }),
  });
  if (!response.ok) throw new Error(`KSNET 승인 요청 실패 (HTTP ${response.status})`);

  // UTF-8 로 읽으면 한글 메시지가 깨지고 구분자까지 어긋난다.
  const text = new TextDecoder("euc-kr").decode(await response.arrayBuffer());
  const tokens = text.split("`");
  const names = RPARAMS.split("`");
  if (tokens.length <= names.length) throw new Error("KSNET 승인 응답을 해석하지 못했습니다.");

  const fields: Record<string, string> = {};
  names.forEach((name, index) => (fields[name] = tokens[index + 1] ?? ""));

  return {
    approved: fields.authyn === "O",
    tid: fields.trno ?? "",
    amount: Number((fields.amt ?? "").replace(/,/g, "")),
    authNo: fields.authno ?? "",
    message: [fields.msg1, fields.msg2].filter(Boolean).join(" ").trim(),
    orderNo: fields.ordno ?? "",
  };
};

// ── 취소 ──────────────────────────────────────────────────────────────

/**
 * 취소 API 인증 헤더. 규격은 `pgapi base64(상점아이디:인증키)` 다
 * (KStA → PG 상점정보 → 하단 pgapi 항목). base64 부분만 넣어도 스킴을 붙여준다.
 */
const getKsnetAuthHeader = () => {
  const raw = (Deno.env.get("KSNET_AUTH_HEADER") ?? "").trim();
  if (!raw) throw new Error("KSNET 취소 인증키(KSNET_AUTH_HEADER)가 설정되지 않았습니다.");
  return /^pgapi\s/i.test(raw) ? raw : `pgapi ${raw}`;
};

/**
 * 전액 취소.
 *
 * 성공(`A0200` + `0000`)이 아니면 전부 실패로 던진다. 특히 `P10Q`(취소거절)를 성공으로
 * 삼지 않는다 — 취소 가능 기간 초과에도 나오는 코드라, 성공으로 삼으면 돈은 그대로인데
 * 화면에 "환불 완료"가 뜬다. 조회 API 가 없어 구분할 수 없으니 상태를 바꾸지 않는 쪽이 안전하다.
 */
export const cancelKsnetPayment = async (tid: string): Promise<void> => {
  const authorization = getKsnetAuthHeader();
  const response = await fetch(`${API_BASE}/kspay/webfep/api/v1/card/cancel`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization },
    body: JSON.stringify({
      mid: getKsnetMid(),
      payload: "",
      cancelType: "FULL",
      orgTradeKeyType: "TID",
      orgTradeKey: tid,
    }),
  });

  const json = (await response.json().catch(() => ({}))) as {
    aid?: string;
    code?: string;
    message?: string;
    data?: { respCode?: string; respMessage?: string };
  };
  const respCode = json.data?.respCode ?? "";
  if (json.code === "A0200" && respCode === "0000") return;

  // 봉투 단계 실패(A0403 등)는 respCode 가 없다. code·message·aid 를 남겨야 KSNET 에 사유를 물을 수 있다.
  console.error("ksnet cancel failed", {
    tid,
    aid: json.aid ?? "",
    code: json.code ?? "",
    respCode,
    message: json.data?.respMessage || json.message || "",
  });
  throw new Error(
    respCode === "P10Q"
      ? "KSNET 이 결제 취소를 거절했습니다. KStA 에서 거래 상태를 확인해주세요."
      : `KSNET 결제 취소에 실패했습니다. (${json.code ?? `HTTP ${response.status}`})`,
  );
};
