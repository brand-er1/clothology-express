import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import {
  formatMagazineDate,
  magazineArticles,
  sortMagazineArticles,
  type MagazineArticle,
} from "@/data/magazineArticles";

/** 외부 기사는 새 탭, 내부 콘텐츠는 라우터 이동. */
const ArticleLink = ({ article, className, children }: { article: MagazineArticle; className: string; children: ReactNode }) =>
  article.type === "external" ? (
    <a href={article.externalUrl} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <Link to={article.externalUrl} className={className}>
      {children}
    </Link>
  );

const sortedArticles = sortMagazineArticles(magazineArticles);

/** 썸네일 로드 실패 시 언론사명이 들어간 브랜드 톤 플레이스홀더로 대체한다. */
const ArticleThumbnail = ({ article, lead }: { article: MagazineArticle; lead: boolean }) => {
  const [failed, setFailed] = useState(!article.thumbnail);
  const ratio = lead ? "aspect-[4/3]" : "aspect-[16/10] lg:aspect-[4/3]";

  if (failed) {
    return (
      <div className={`flex w-full items-center justify-center bg-brand/10 ${ratio}`} aria-hidden="true">
        <span className="text-sm font-semibold tracking-[-0.02em] text-brand">{article.publisher}</span>
      </div>
    );
  }

  return (
    <img
      src={article.thumbnail}
      alt={`${article.publisher} 기사 이미지`}
      className={`img-zoom w-full object-cover ${ratio}`}
      loading={lead ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
};

const CommunityInsights = () => {
  return (
    <section className="border-t border-stone-950 pb-8 pt-5 sm:pt-7">
      <div className="mb-8 flex items-end justify-between gap-5 border-b border-stone-300 pb-4">
        <div>
          <p className="eyebrow">Media coverage</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-stone-950 sm:text-3xl">
            BRAND-ER NEWS
          </h2>
        </div>
        <p className="hidden text-xs font-medium text-stone-500 sm:block">기사 카드를 누르면 원문으로 이동합니다.</p>
      </div>

      {/* Magazine layout: the lead story takes half the width, the rest run as a narrower column. */}
      <div className="grid gap-10 sm:grid-cols-2 md:gap-8 lg:grid-cols-12">
        {sortedArticles.map((article, index) => (
          <ArticleLink
            key={article.externalUrl}
            article={article}
            className={`group block ${index === 0 ? "sm:col-span-2 lg:col-span-6 lg:row-span-3" : "lg:col-span-6 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-6"}`}
          >
            <div className="overflow-hidden bg-stone-200">
              <ArticleThumbnail article={article} lead={index === 0} />
            </div>

            <div className={index === 0 ? "pt-6" : "pt-5 lg:pt-0"}>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-stone-500">
                {article.type === "external" && (
                  <span className="rounded-full border border-brand/30 bg-brand/5 px-2 py-0.5 text-[10px] font-semibold text-brand">
                    언론보도
                  </span>
                )}
                <span className="text-brand">{article.publisher}</span>
                <span className="text-stone-300">|</span>
                <time dateTime={article.publishedAt}>{formatMagazineDate(article.publishedAt)}</time>
              </div>
              <h3 className={`mt-3 font-semibold tracking-[-0.035em] text-stone-950 transition-colors group-hover:text-brand ${index === 0 ? "line-clamp-3 text-2xl leading-[1.3] sm:text-[2.1rem]" : "line-clamp-3 text-xl leading-[1.35] lg:text-lg"}`}>
                {article.title}
              </h3>
              <p className={`mt-3 text-sm leading-6 text-stone-600 ${index === 0 ? "" : "lg:line-clamp-2"}`}>{article.summary}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-stone-950 px-4 py-2 text-sm font-semibold text-stone-950 transition-colors group-hover:border-brand group-hover:bg-brand group-hover:text-white">
                {article.type === "external" ? "기사 보러가기" : "자세히 보기"} <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
          </ArticleLink>
        ))}
      </div>

      <p className="mt-12 border-t border-stone-200 pt-4 text-[11px] leading-5 text-stone-400">
        기사 이미지와 내용의 저작권은 각 언론사에 있으며, 제목과 요약을 누르면 해당 언론사의 원문으로 이동합니다.
      </p>
    </section>
  );
};

export default CommunityInsights;
