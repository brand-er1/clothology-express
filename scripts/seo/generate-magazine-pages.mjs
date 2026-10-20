// 빌드 후 실행: 매거진 기사별 정적 HTML(dist/magazine/<slug>.html)을 만든다.
// dist/index.html(SPA 셸)을 복사해 title · description · canonical · Open Graph · 구조화 데이터만 바꾸므로
// JS 를 실행하지 않는 검색엔진·SNS 크롤러도 기사 메타데이터를 읽고, 브라우저에서는 그대로 SPA 상세페이지가 뜬다.
// 대상은 src/data/magazine-articles.json(정적 시드) 기사다. 관리자 페이지에서 새로 등록한 기사는
// 404.html SPA 폴백으로 열리고 메타데이터는 화면에서 설정된다(useDocumentMeta).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dist = path.join(root, 'dist');
const indexPath = path.join(dist, 'index.html');
if (!existsSync(indexPath)) {
  console.warn('dist/index.html not found — skipping magazine SEO pages.');
  process.exit(0);
}

const base = 'https://brand-er1.github.io/clothology-express';
const articles = JSON.parse(readFileSync(path.join(root, 'src/data/magazine-articles.json'), 'utf8'));
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const json = (v) => JSON.stringify(v).replaceAll('<', '\\u003c');
const shell = readFileSync(indexPath, 'utf8');

const setMeta = (html, attr, key, value) => {
  const tag = `<meta ${attr}="${key}" content="${esc(value)}" />`;
  const pattern = new RegExp(`<meta\\s+${attr}="${key.replace(/[:]/g, '\\$&')}"[^>]*>`);
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
};

mkdirSync(path.join(dist, 'magazine'), { recursive: true });
const urls = [];
for (const article of articles) {
  const url = `${base}/magazine/${article.slug}`;
  const title = `${article.title} | BRAND-ER 매거진`;
  const description = article.summary || `${article.publisher} ${article.publishedAt} 보도`;
  let html = shell;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = html.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(url)}" />`);
  html = setMeta(html, 'name', 'description', description);
  html = setMeta(html, 'property', 'og:type', 'article');
  html = setMeta(html, 'property', 'og:title', title);
  html = setMeta(html, 'property', 'og:description', description);
  html = setMeta(html, 'property', 'og:url', url);
  if (article.thumbnail) html = setMeta(html, 'property', 'og:image', article.thumbnail);
  html = setMeta(html, 'property', 'article:published_time', article.publishedAt);
  html = setMeta(html, 'name', 'twitter:card', article.thumbnail ? 'summary_large_image' : 'summary');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description,
    datePublished: article.publishedAt,
    ...(article.thumbnail ? { image: [article.thumbnail] } : {}),
    mainEntityOfPage: url,
    publisher: { '@type': 'Organization', name: article.publisher },
    ...(article.externalUrl ? { isBasedOn: article.externalUrl } : {}),
    about: { '@id': 'https://brand-er.store/#organization' },
  };
  html = html.replace('</head>', `    <script type="application/ld+json">${json(ld)}</script>\n  </head>`);
  // 크롤러용 초기 본문: 요약과 원문 링크만 넣는다(원문 전문 복제 금지). React 가 마운트되면 교체된다.
  const body = `<main style="max-width:960px;margin:auto;padding:32px;font-family:system-ui,sans-serif;line-height:1.8"><p>BRAND-ER 매거진 · ${esc(article.publisher)} · ${esc(article.publishedAt.replaceAll('-', '.'))}</p><h1>${esc(article.title)}</h1><p>${esc(description)}</p>${article.externalUrl ? `<p><a href="${esc(article.externalUrl)}" rel="noopener">원문 기사 보기</a></p>` : ''}</main>`;
  html = html.replace(/<div id="root">[\s\S]*?<\/div>\s*(?=<script|<\/body>)/, `<div id="root">${body}</div>\n    `);
  writeFileSync(path.join(dist, 'magazine', `${article.slug}.html`), html);
  urls.push(url);
}

const sitemapPath = path.join(dist, 'sitemap.xml');
if (existsSync(sitemapPath)) {
  const sitemap = readFileSync(sitemapPath, 'utf8');
  const extra = urls.filter((u) => !sitemap.includes(`<loc>${u}</loc>`)).map((u) => `  <url><loc>${u}</loc></url>`).join('\n');
  if (extra) writeFileSync(sitemapPath, sitemap.replace('</urlset>', `${extra}\n</urlset>`));
}
console.log(`Generated ${urls.length} magazine SEO pages.`);
