import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "결제 처리 중 오류가 발생했습니다.";

export const getSupabaseClients = async (req: Request): Promise<{
  user: User;
  userClient: ReturnType<typeof createClient>;
  serviceClient: ReturnType<typeof createClient>;
}> => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authorization = req.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Supabase 결제 환경 설정이 누락되었습니다.");
  }

  if (!authorization) {
    throw new Error("로그인이 필요합니다.");
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const token = authorization.replace(/^Bearer\s+/i, "");
  const { data, error } = await userClient.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("로그인 정보가 만료되었습니다. 다시 로그인해주세요.");
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return { user: data.user, userClient, serviceClient };
};

export const callKakaoPay = async (path: string, body: Record<string, unknown>) => {
  const secretKey = Deno.env.get("KAKAOPAY_SECRET_KEY");
  if (!secretKey) {
    throw new Error("카카오페이 Secret Key가 설정되지 않았습니다.");
  }

  const response = await fetch(`https://open-api.kakaopay.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `SECRET_KEY ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error_message || payload?.msg || payload?.message;
    throw new Error(message || "카카오페이 요청에 실패했습니다.");
  }

  return payload;
};

export const getKakaoPayCid = () => {
  const cid = Deno.env.get("KAKAOPAY_CID");
  if (!cid) {
    throw new Error("카카오페이 가맹점 CID가 설정되지 않았습니다.");
  }
  return cid;
};

export const getReturnOrigin = (req: Request, requestedUrl?: string) => {
  const configuredUrl = Deno.env.get("APP_URL");
  const requestOrigin = req.headers.get("Origin");
  const requestedReturnUrl = requestedUrl ? new URL(requestedUrl) : null;
  const configuredReturnUrl = configuredUrl ? new URL(configuredUrl) : null;
  const candidate = requestedReturnUrl?.origin === requestOrigin
    ? requestedReturnUrl
    : configuredReturnUrl || (requestOrigin ? new URL(requestOrigin) : null);

  if (!candidate) {
    throw new Error("결제 후 돌아갈 사이트 주소가 설정되지 않았습니다.");
  }

  const isLocal = candidate.hostname === "localhost" || candidate.hostname === "127.0.0.1";
  if (candidate.protocol !== "https:" && !(isLocal && candidate.protocol === "http:")) {
    throw new Error("안전한 결제 복귀 주소가 아닙니다.");
  }

  const basePath = candidate.pathname === "/" ? "" : candidate.pathname.replace(/\/+$/, "");
  return `${candidate.origin}${basePath}`;
};
