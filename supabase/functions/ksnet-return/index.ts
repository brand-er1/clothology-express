import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { parseKsnetAuthResult } from "../_shared/ksnet.ts";
import { processKsnetReturn } from "../_shared/ksnet-payment.ts";
import { dispatchNotificationsSafely } from "../_shared/notificationDispatch.ts";

// KSPay 결제창이 카드 인증을 끝내고 **브라우저가 POST 로 돌아오는** 곳(sndReply).
//
// JWT 검증을 끈다(config.toml). KSPay 는 Supabase JWT 를 모른다.
// 그래서 여기서 믿는 건 두 가지뿐이다: 추측 불가능한 참여 ID, 그리고 우리가 DB 금액으로
// 직접 건 KSNET 승인 응답. 결제창이 보낸 값으로 결제를 확정하지 않는다.
//
// PC 에서는 여기가 팝업 안이다. 부모 창을 결과 화면으로 옮기고 팝업은 닫는다.

const resultUrl = (participationId?: string) => {
  const base = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "");
  const query = participationId ? `?participationId=${encodeURIComponent(participationId)}` : "";
  return `${base}/payments/ksnet/result${query}`;
};

const handoff = (url: string) => {
  const safe = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return new Response(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${safe}">
<title>결제 처리 중</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;padding:40px;text-align:center;color:#57534e">
<p>결제 결과를 확인하고 있습니다…</p>
<script>
(function () {
  var url = ${JSON.stringify(url)};
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.location.replace(url);
      window.close();
      return;
    }
  } catch (e) { /* 다른 출처면 opener 접근이 막힌다. 아래로 떨어진다 */ }
  location.replace(url);
})();
</script>
</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return handoff(resultUrl());

  const auth = parseKsnetAuthResult(await req.text(), req.url);
  if (!auth) {
    console.error("ksnet-return: 알아볼 수 없는 요청");
    return handoff(resultUrl());
  }

  try {
    const db = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const fundingId = await processKsnetReturn(db, auth);
    if (fundingId) await dispatchNotificationsSafely(db, { fundingId });
    return handoff(resultUrl(auth.participationId));
  } catch (error) {
    // 500 을 주면 구매자가 흰 화면을 본다. 결과 화면이 DB 상태를 그대로 보여준다.
    console.error("ksnet-return", error);
    return handoff(resultUrl(auth.participationId));
  }
});
