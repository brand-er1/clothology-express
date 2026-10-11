import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const faq = JSON.parse(readFileSync(path.join(root, 'src/data/production-faq.json'), 'utf8'));
const base = 'https://brand-er1.github.io/clothology-express';
const esc = (s) => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const json = (v) => JSON.stringify(v).replaceAll('<','\\u003c');
const organization = { '@type':'Organization', '@id':'https://brand-er.store/#organization', name:'브랜더 BRAND-ER', alternateName:['브랜더','BRAND-ER'], url:'https://brand-er.store/', telephone:'+82-70-4708-3015' };
const pages = [
 {slug:'services',title:'소량 의류 제작·AI 디자인 서비스',description:faq[0].answer,items:[0,1,2,8,10,11]},
 {slug:'faq',title:'의류 제작 자주 묻는 질문',description:'소량 의류 제작의 최소 수량, 샘플 기간, 견적 준비, 생산 과정과 AI 디자인에 대한 브랜더의 답변입니다.',items:faq.map((_,i)=>i)},
 {slug:'cost',title:'소량 의류 제작 비용·견적 준비',description:'원단비, 패턴·샘플비, 봉제 공임, 프린팅과 라벨 비용 등 의류 제작 견적을 확인하는 방법입니다.',items:[3,4,2,8]},
 {slug:'process',title:'의류 샘플 제작 기간·본생산 과정',description:'의류 제작 상담부터 샘플 확인, 사양 확정, 본생산과 배송까지의 과정과 일정 확인 방법입니다.',items:[5,6,7,10,11]},
 {slug:'printing',title:'실크스크린·전사 프린팅 방식 비교',description:'실크스크린과 전사의 차이, 원단·수량·디자인에 따른 선택 기준과 프린팅 견적 준비 사항입니다.',items:[9,3,4]}
];
const css='*{box-sizing:border-box}body{margin:0;background:#f5f2ed;color:#211b1c;font-family:system-ui,-apple-system,"Malgun Gothic",sans-serif;line-height:1.85}header,main,footer{max-width:960px;margin:auto;padding:24px}header{border-bottom:1px solid #d6cfca}a{color:#75283f;text-underline-offset:4px}nav{display:flex;flex-wrap:wrap;gap:12px 24px;margin:20px 0}h1{font-size:clamp(28px,6vw,44px);line-height:1.3;letter-spacing:-.03em}h2{font-size:20px;line-height:1.5}section{padding:24px 0;border-bottom:1px solid #d6cfca}p{max-width:76ch}footer{font-size:13px;color:#665a5c}a:focus-visible{outline:3px solid #75283f;outline-offset:5px}.brand{font-size:24px;font-weight:800;text-decoration:none}.cta{display:inline-block;padding:12px 22px;background:#75283f;color:white;text-decoration:none}';
const nav = pages.map(p=>`<a href="${p.slug}.html">${esc(p.title)}</a>`).join('');
mkdirSync(path.join(root,'public/guides'),{recursive:true});
for (const p of pages) {
 const url=`${base}/guides/${p.slug}.html`;
 const graph=[organization,{'@type':'WebPage','@id':url+'#page',url,name:p.title+' | 브랜더 BRAND-ER',description:p.description,inLanguage:'ko-KR',publisher:{'@id':organization['@id']}},{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'브랜더',item:base+'/'},{'@type':'ListItem',position:2,name:p.title,item:url}]}];
 if(p.slug==='services') for(const name of ['AI 의류 디자인','의류 샘플 제작','소량 의류 생산','단체복 제작','의류 프리오더 운영'])graph.push({'@type':'Service',name,provider:{'@id':organization['@id']},url});
 const sections=p.items.map(i=>`<section><h2>${esc(faq[i].question)}</h2><p>${esc(faq[i].answer)}</p></section>`).join('\n');
 writeFileSync(path.join(root,`public/guides/${p.slug}.html`),`<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title)} | 브랜더 BRAND-ER</title><meta name="description" content="${esc(p.description)}"><meta name="robots" content="index,follow"><link rel="canonical" href="${url}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(p.title)} | 브랜더 BRAND-ER"><meta property="og:description" content="${esc(p.description)}"><meta property="og:url" content="${url}"><meta property="og:locale" content="ko_KR"><style>${css}</style><script type="application/ld+json">${json({'@context':'https://schema.org','@graph':graph})}</script></head><body><header><a class="brand" href="../index.html">BRAND-ER</a><nav aria-label="제작 안내">${nav}</nav></header><main><h1>${esc(p.title)}</h1><p>${esc(p.description)}</p>${sections}<p>구체적인 제작 조건과 견적은 상담을 통해 확인해 주세요.</p><a class="cta" href="../design-quote">제작 견적 상담 시작하기</a> <a href="../portfolio">실제 제작 포트폴리오 보기</a></main><footer>브랜더(BRAND-ER) · 대표자 김하성 · 사업자등록번호 704-04-03387<br>고객센터 <a href="tel:+827047083015">070-4708-3015</a> · <a href="https://brand-er.store/" target="_top">브랜더 공식 홈페이지</a></footer></body></html>\n`);
}
writeFileSync(path.join(root,'public/sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p=>`  <url><loc>${base}/guides/${p.slug}.html</loc></url>`).join('\n')}\n</urlset>\n`);
// The repository-level robots.txt is a useful reference, but GitHub Pages only
// honors robots.txt at the HOST root, which this project does not control.
writeFileSync(path.join(root,'public/robots.txt'),`# Project reference only: crawler rules must be served at the host root.\nUser-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
const initial=`<main style="max-width:960px;margin:auto;padding:32px;font-family:system-ui,sans-serif;line-height:1.8"><h1>브랜더 BRAND-ER · AI 의류 디자인 및 소량 의류 제작</h1><p>${esc(faq[0].answer)}</p><h2>의류 제작 안내</h2><nav>${pages.map(p=>`<p><a href="%BASE_URL%guides/${p.slug}.html">${esc(p.title)}</a></p>`).join('')}</nav>${[2,3,5,10].map(i=>`<details><summary>${esc(faq[i].question)}</summary><p>${esc(faq[i].answer)}</p></details>`).join('')}</main>`;
const indexPath=path.join(root,'index.html');
let index=readFileSync(indexPath,'utf8');
index=index.replace(/<div id="root">[\s\S]*?<\/div>/,`<div id="root">${initial}</div>`);
index=index.replace(/\s*<script id="brand-er-organization"[\s\S]*?<\/script>/,'');
index=index.replace('</head>',`    <script id="brand-er-organization" type="application/ld+json">${json({'@context':'https://schema.org',...organization})}</script>\n  </head>`);
writeFileSync(indexPath,index);
console.log('Generated 5 public HTML guides, sitemap and initial homepage content.');
