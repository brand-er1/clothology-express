import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import {
  formatMagazineDate,
  MAGAZINE_CATEGORY_LABEL,
  magazineArticlePath,
  type MagazineArticle,
} from "@/data/magazineArticles";
import { fetchMagazineArticles } from "@/services/magazine";
import { MagazineThumbnail } from "@/components/magazine/MagazineThumbnail";

const LoadingGrid = () => (
  <div className="grid gap-10 sm:grid-cols-2 md:gap-8 lg:grid-cols-12" aria-busy="true" aria-label="기사를 불러오는 중">
    {[0, 1, 2].map((index) => (
      <div key={index} className={index === 0 ? "sm:col-span-2 lg:col-span-6 lg:row-span-3" : "lg:col-span-6"}>
        <div className={`animate-pulse bg-stone-200 ${index === 0 ? "aspect-[4/3]" : "aspect-[16/10]"}`} />
        <div className="mt-5 h-3 w-1/3 animate-pulse bg-stone-200" />
        <div className="mt-3 h-5 w-5/6 animate-pulse bg-stone-200" />
      </div>
    ))}
  </div>
);

const CommunityInsights = () => {
  const [articles, setArticles] = useState<MagazineArticle[] | null>(null);

  useEffect(() => {
    let active = true;
    void fetchMagazineArticles().then((rows) => { if (active) setArticles(rows); });
    return () => { active = false; };
  }, []);

  return (
    <section className="border-t border-stone-950 pb-8 pt-5 sm:pt-7">
      <div className="mb-8 flex items-end justify-between gap-5 border-b border-stone-300 pb-4">
        <div>
          <p className="eyebrow">Media coverage</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-stone-950 sm:text-3xl">
            BRAND-ER NEWS
          </h2>
        </div>
        <p className="hidden text-xs font-medium text-stone-500 sm:block">기사를 누르면 BRAND-ER 뉴스룸 요약과 원문 링크를 볼 수 있습니다.</p>
      </div>

      {!articles ? <LoadingGrid /> : (
        /* Magazine layout: the lead story takes half the width, the rest run as a narrower column. */
        <div className="grid gap-10 sm:grid-cols-2 md:gap-8 lg:grid-cols-12">
          {articles.map((article, index) => (
            <Link
              key={article.slug}
              to={magazineArticlePath(article.slug)}
              className={`group block ${index === 0 ? "sm:col-span-2 lg:col-span-6 lg:row-span-3" : "lg:col-span-6 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-6"}`}
            >
              <div className="overflow-hidden bg-stone-200">
                <MagazineThumbnail
                  src={article.thumbnail}
                  publisher={article.publisher}
                  alt={`${article.publisher} 기사 이미지`}
                  eager={index === 0}
                  className={`img-zoom ${index === 0 ? "aspect-[4/3]" : "aspect-[16/10] lg:aspect-[4/3]"}`}
                />
              </div>

              <div className={index === 0 ? "pt-6" : "pt-5 lg:pt-0"}>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-stone-500">
                  <span className="rounded-full border border-brand/30 bg-brand/5 px-2 py-0.5 text-[10px] font-semibold text-brand">
                    {MAGAZINE_CATEGORY_LABEL[article.category] ?? "언론보도"}
                  </span>
                  <span className="text-brand">{article.publisher}</span>
                  <span className="text-stone-300">|</span>
                  <time dateTime={article.publishedAt}>{formatMagazineDate(article.publishedAt)}</time>
                </div>
                <h3 className={`mt-3 font-semibold tracking-[-0.035em] text-stone-950 transition-colors group-hover:text-brand ${index === 0 ? "line-clamp-3 text-2xl leading-[1.3] sm:text-[2.1rem]" : "line-clamp-3 text-xl leading-[1.35] lg:text-lg"}`}>
                  {article.title}
                </h3>
                <p className={`mt-3 text-sm leading-6 text-stone-600 ${index === 0 ? "" : "lg:line-clamp-2"}`}>{article.summary}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-stone-950 px-4 py-2 text-sm font-semibold text-stone-950 transition-colors group-hover:border-brand group-hover:bg-brand group-hover:text-white">
                  자세히 보기 <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-12 border-t border-stone-200 pt-4 text-[11px] leading-5 text-stone-400">
        기사 이미지와 내용의 저작권은 각 언론사에 있습니다. BRAND-ER 뉴스룸은 기사를 자체적으로 요약해 소개하며, 전체 기사는 각 상세페이지의 ‘원문 기사 보기’로 확인할 수 있습니다.
      </p>
    </section>
  );
};

export default CommunityInsights;
