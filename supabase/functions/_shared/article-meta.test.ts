// 매거진 기사 메타데이터 파서 · 주소 검사 단위 테스트 (외부 요청 없음)
// 실행: deno test --no-lock --allow-net=jsr.io supabase/functions/_shared/article-meta.test.ts

import { assertEquals, assertRejects, assertThrows } from "jsr:@std/assert@1";
import {
  ArticleMetaError, assertPublicUrl, assertResolvesPublic, decodeHtml, normalizeDate, parseArticleMeta,
} from "./article-meta.ts";

Deno.test("blocks internal and non-web addresses", () => {
  for (const url of [
    "http://localhost/a", "http://127.0.0.1/", "http://10.0.0.5/", "http://192.168.1.1/", "http://172.20.0.1/",
    "http://169.254.169.254/latest/meta-data", "http://[::1]/", "http://metadata.google.internal/", "ftp://example.com/",
    "https://user:pw@example.com/", "https://example.com:8443/", "http://intranet/", "file:///etc/passwd",
  ]) {
    assertThrows(() => assertPublicUrl(url), ArticleMetaError);
  }
  assertEquals(assertPublicUrl("https://youtuberworld.co.kr/View.aspx?No=4253327#top").toString(), "https://youtuberworld.co.kr/View.aspx?No=4253327");
});

Deno.test("rejects hosts that resolve to private addresses", async () => {
  await assertRejects(() => assertResolvesPublic("evil.example", async (_h, type) => (type === "A" ? ["10.1.2.3"] : [])), ArticleMetaError);
  await assertResolvesPublic("news.example", async (_h, type) => (type === "A" ? ["203.0.113.10"] : []));
});

Deno.test("parses Korean news meta tags in any attribute order", () => {
  const html = `<!doctype html><html><head>
    <title>사이트 제목 - 유튜버월드</title>
    <meta content="브랜더, AI로 의류 제작 문턱을 낮추다 &amp; 펀딩까지" property="og:title">
    <meta property="og:description" content="  AI 디자인부터
      소량 생산까지 &quot;한 번에&quot;  ">
    <meta property="og:image" content="/news/photo/202610/4253327.jpg">
    <meta property="og:site_name" content="유튜버월드">
    <meta property="article:published_time" content="2026-10-21T09:30:00+09:00">
    <meta name="author" content="홍길동 기자">
  </head><body>본문</body></html>`;
  const meta = parseArticleMeta(html, new URL("https://youtuberworld.co.kr/View.aspx?No=4253327"));
  assertEquals(meta.title, "브랜더, AI로 의류 제작 문턱을 낮추다 & 펀딩까지");
  assertEquals(meta.description, 'AI 디자인부터 소량 생산까지 "한 번에"');
  assertEquals(meta.image, "https://youtuberworld.co.kr/news/photo/202610/4253327.jpg");
  assertEquals(meta.site_name, "유튜버월드");
  assertEquals(meta.published_at, "2026-10-21");
  assertEquals(meta.author, "홍길동 기자");
});

Deno.test("falls back to JSON-LD and <title>", () => {
  const html = `<head><title>제목만 있는 기사</title><script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2026.10.19 14:02","author":{"name":"김기자"}}</script></head>`;
  const meta = parseArticleMeta(html, new URL("https://news.example/a"));
  assertEquals(meta.title, "제목만 있는 기사");
  assertEquals(meta.published_at, "2026-10-19");
  assertEquals(meta.author, "김기자");
  assertEquals(meta.image, null);
});

Deno.test("normalizes dates", () => {
  assertEquals(normalizeDate("2026년 10월 2일"), "2026-10-02");
  assertEquals(normalizeDate("2026-13-01"), null);
  assertEquals(normalizeDate("어제"), null);
});

Deno.test("decodes EUC-KR pages", () => {
  // "브랜더" in EUC-KR
  const bytes = new Uint8Array([0x3c, 0x74, 0x69, 0x74, 0x6c, 0x65, 0x3e, 0xba, 0xea, 0xb7, 0xa3, 0xb4, 0xf5, 0x3c, 0x2f, 0x74, 0x69, 0x74, 0x6c, 0x65, 0x3e]);
  assertEquals(decodeHtml(bytes, "text/html; charset=euc-kr"), "<title>브랜더</title>");
});
