import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  ArticleMetaError, assertPublicUrl, assertResolvesPublic, decodeHtml, FETCH_TIMEOUT_MS, MAX_REDIRECTS, parseArticleMeta, readLimited,
} from "../_shared/article-meta.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/**
 * 매거진 관리자 전용: 기사 URL 의 공개 메타데이터(제목 · 요약 · 발행일 · 언론사 · 대표 이미지 주소)를 읽어 온다.
 * 결과는 관리자 화면 폼에 채워질 뿐 저장하지 않는다. 기사 본문은 가져오지 않는다.
 * 권한: content.manage (can_manage_magazine RPC 로 서버에서 확인).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) throw new ArticleMetaError("로그인이 필요합니다.", 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_magazine");
    if (permissionError || allowed !== true) throw new ArticleMetaError("매거진 관리 권한(content.manage)이 필요합니다.", 403);

    const body = await req.json().catch(() => ({}));
    let url = assertPublicUrl(String(body?.url ?? ""));
    const resolve = typeof Deno.resolveDns === "function"
      ? (host: string, type: "A" | "AAAA") => Deno.resolveDns(host, type)
      : undefined;

    let response: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      await assertResolvesPublic(url.hostname, resolve);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        response = await fetch(url, {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; BRAND-ER-MagazineBot/1.0; +https://brand-er.store)",
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "ko-KR,ko;q=0.9",
          },
        });
      } catch {
        throw new ArticleMetaError("기사 페이지에 연결하지 못했습니다. 주소를 확인하거나 직접 입력해주세요.", 502);
      } finally {
        clearTimeout(timer);
      }
      if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
        url = assertPublicUrl(new URL(response.headers.get("location")!, url).toString());
        await response.body?.cancel();
        continue;
      }
      break;
    }
    if (!response || (response.status >= 300 && response.status < 400)) throw new ArticleMetaError("리다이렉트가 너무 많습니다.", 502);
    if (!response.ok) throw new ArticleMetaError(`기사 페이지가 응답하지 않습니다 (HTTP ${response.status}).`, 502);
    const contentType = response.headers.get("content-type");
    if (contentType && !/html|xml/i.test(contentType)) throw new ArticleMetaError("HTML 기사 페이지가 아닙니다.", 422);

    const html = decodeHtml(await readLimited(response), contentType);
    const meta = parseArticleMeta(html, url);
    if (!meta.title) throw new ArticleMetaError("기사 제목을 찾지 못했습니다. 직접 입력해주세요.", 422);
    return json(meta);
  } catch (error) {
    if (error instanceof ArticleMetaError) return json({ error: error.message }, error.status);
    console.error("fetch-article-meta", error);
    return json({ error: "기사 정보를 불러오지 못했습니다." }, 500);
  }
});
