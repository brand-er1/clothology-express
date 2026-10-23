// 매거진 "URL 로 기사 정보 불러오기" 공용 로직 (fetch-article-meta).
//
// - 기사 본문은 가져오지 않는다. 공개 메타데이터(og:title · og:description · og:image · 발행일 · 사이트명)만 읽는다.
// - 서버가 임의 주소로 요청을 보내는 기능이므로 SSRF 를 막는다: http(s)만, 기본 포트만, 내부 · 사설 주소 차단,
//   리다이렉트마다 다시 검사, 응답 크기 · 시간 제한.

export const MAX_HTML_BYTES = 1_500_000;
export const FETCH_TIMEOUT_MS = 8000;
export const MAX_REDIRECTS = 3;

export class ArticleMetaError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "ArticleMetaError";
  }
}

const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localhost", ".lan", ".home", ".corp", ".intranet"];

const isPrivateIpv4 = (host: string) => {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
};

const isPrivateIpv6 = (host: string) => {
  const value = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!value.includes(":")) return false;
  if (value === "::" || value === "::1") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(value) || /^fe[89ab][0-9a-f]:/.test(value)) return true;
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIpv4(mapped[1]) : false;
};

/** 외부 공개 웹 주소인지 검사하고 정규화한 URL 을 돌려준다. */
export const assertPublicUrl = (raw: string): URL => {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ArticleMetaError("올바른 기사 주소(URL)를 입력해주세요.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ArticleMetaError("http:// 또는 https:// 주소만 불러올 수 있습니다.");
  if (url.username || url.password) throw new ArticleMetaError("계정 정보가 포함된 주소는 사용할 수 없습니다.");
  if (url.port && !["80", "443"].includes(url.port)) throw new ArticleMetaError("기본 포트(80/443) 주소만 불러올 수 있습니다.");
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host === "localhost" || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new ArticleMetaError("내부 주소는 불러올 수 없습니다.");
  }
  if (isPrivateIpv4(host) || isPrivateIpv6(host)) throw new ArticleMetaError("내부 주소는 불러올 수 없습니다.");
  url.hash = "";
  return url;
};

/** DNS 결과가 사설 주소면 거부한다(DNS rebinding · 내부 호스트명 대응). 런타임이 DNS 조회를 지원하지 않으면 건너뛴다. */
export const assertResolvesPublic = async (host: string, resolve?: (host: string, type: "A" | "AAAA") => Promise<string[]>) => {
  if (!resolve) return;
  const results: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    try {
      results.push(...await resolve(host, type));
    } catch { /* 레코드 없음 */ }
  }
  if (results.some((ip) => isPrivateIpv4(ip) || isPrivateIpv6(ip))) throw new ArticleMetaError("내부 주소는 불러올 수 없습니다.");
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·", hellip: "…" };

export const decodeEntities = (value: string) =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (whole, name) => ENTITIES[name.toLowerCase()] ?? whole);

const clean = (value: string | null | undefined, max: number) => {
  if (!value) return null;
  const text = decodeEntities(value).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
};

/** `<meta property|name|itemprop="key" content="...">` (속성 순서 무관) */
const metaContent = (html: string, keys: string[]): string | null => {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const key of keys) {
    for (const tag of tags) {
      const name = tag.match(/\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
      if (name !== key) continue;
      const content = tag.match(/\bcontent\s*=\s*"([^"]*)"/i)?.[1] ?? tag.match(/\bcontent\s*=\s*'([^']*)'/i)?.[1];
      if (content && content.trim()) return content;
    }
  }
  return null;
};

/** 여러 표기(2026-10-20T09:00:00+09:00, 2026.10.20, 2026-10-20 09:00)를 YYYY-MM-DD 로 */
export const normalizeDate = (value: string | null): string | null => {
  if (!value) return null;
  const match = value.match(/(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

const jsonLdValue = (html: string, keys: string[]): string | null => {
  const blocks = html.match(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of blocks) {
    const body = block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
    try {
      const parsed = JSON.parse(body);
      const nodes = Array.isArray(parsed) ? parsed : parsed["@graph"] ?? [parsed];
      for (const node of nodes) for (const key of keys) {
        const value = node?.[key];
        if (typeof value === "string" && value.trim()) return value;
        if (key === "author" && value) {
          const author = Array.isArray(value) ? value[0] : value;
          if (typeof author?.name === "string") return author.name;
        }
      }
    } catch { /* JSON-LD 가 깨져 있으면 무시 */ }
  }
  return null;
};

export type ArticleMeta = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site_name: string | null;
  published_at: string | null;
  author: string | null;
  image_license_notice: string;
};

export const parseArticleMeta = (html: string, pageUrl: URL): ArticleMeta => {
  const head = html.slice(0, 400_000);
  const title = clean(
    metaContent(head, ["og:title", "twitter:title"]) ?? jsonLdValue(head, ["headline"]) ?? head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
    200,
  );
  const description = clean(metaContent(head, ["og:description", "description", "twitter:description"]) ?? jsonLdValue(head, ["description"]), 600);
  const imageRaw = metaContent(head, ["og:image", "og:image:url", "twitter:image"]);
  let image: string | null = null;
  if (imageRaw) {
    try {
      const resolved = new URL(decodeEntities(imageRaw.trim()), pageUrl);
      if (resolved.protocol === "https:" || resolved.protocol === "http:") image = resolved.toString();
    } catch { /* 잘못된 이미지 주소 */ }
  }
  const published = normalizeDate(
    metaContent(head, ["article:published_time", "og:article:published_time", "pubdate", "publishdate", "date", "dc.date", "datepublished"])
      ?? jsonLdValue(head, ["datePublished"])
      ?? head.match(/<time[^>]+datetime\s*=\s*["']([^"']+)["']/i)?.[1]
      ?? null,
  );
  return {
    url: pageUrl.toString(),
    title,
    description,
    image,
    site_name: clean(metaContent(head, ["og:site_name", "application-name"]) ?? jsonLdValue(head, ["publisher"]), 80),
    published_at: published,
    author: clean(metaContent(head, ["author", "article:author", "dable:author"]) ?? jsonLdValue(head, ["author"]), 80),
    image_license_notice: "기사 대표 이미지는 언론사에 저작권이 있습니다. 사용 허락을 확인하지 않았다면 BRAND-ER 자체 이미지를 업로드하세요.",
  };
};

/** Content-Type 헤더나 <meta charset> 으로 인코딩을 정해 디코딩한다(국내 언론사는 EUC-KR 이 남아 있다). */
export const decodeHtml = (bytes: Uint8Array, contentType: string | null) => {
  const fromHeader = contentType?.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1];
  const sniff = new TextDecoder("latin1").decode(bytes.slice(0, 4096));
  const fromMeta = sniff.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i)?.[1];
  const charset = (fromHeader ?? fromMeta ?? "utf-8").toLowerCase();
  try {
    return new TextDecoder(charset === "ks_c_5601-1987" ? "euc-kr" : charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
};

/** 크기 제한을 지키며 응답 본문을 읽는다. */
export const readLimited = async (response: Response, limit = MAX_HTML_BYTES) => {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(Math.min(size, limit));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk.subarray(0, Math.min(chunk.byteLength, out.byteLength - offset)), offset);
    offset += chunk.byteLength;
    if (offset >= out.byteLength) break;
  }
  return out;
};
