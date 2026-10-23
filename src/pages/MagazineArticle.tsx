import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, ExternalLink } from "lucide-react";
import { Header } from "@/components/Header";
import { MagazineThumbnail } from "@/components/magazine/MagazineThumbnail";
import {
  formatMagazineDate,
  MAGAZINE_CATEGORY_LABEL,
  magazineArticlePath,
  pickRelatedArticles,
  type MagazineArticle as Article,
} from "@/data/magazineArticles";
import { fetchMagazineArticle, fetchMagazineArticles } from "@/services/magazine";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { getAppUrl } from "@/utils/appUrl";

const MAGAZINE_LIST_PATH = "/magazine";

type State = { status: "loading" } | { status: "missing" } | { status: "ready"; article: Article };

const BackToList = ({ className = "" }: { className?: string }) => (
  <Link
    to={MAGAZINE_LIST_PATH}
    className={`inline-flex items-center justify-center gap-2 border border-stone-950 px-5 py-3 text-sm font-semibold text-stone-950 transition-colors hover:border-brand hover:text-brand ${className}`}
  >
    <ArrowLeft className="h-4 w-4" /> 매거진 목록으로
  </Link>
);

const OriginalLink = ({ article, className = "" }: { article: Article; className?: string }) =>
  article.externalUrl ? (
    <a
      href={article.externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#5b1522] ${className}`}
    >
      원문 기사 보기 <ExternalLink className="h-4 w-4" />
    </a>
  ) : null;

const MagazineArticlePage = () => {
  const { slug = "" } = useParams();
  const [state, setState] = useState<State>({ status: "loading" });
  const [related, setRelated] = useState<Article[]>([]);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    window.scrollTo(0, 0);
    const articleRequest = fetchMagazineArticle(slug);
    void articleRequest.then((article) => {
      if (active) setState(article ? { status: "ready", article } : { status: "missing" });
    });
    // 관련 기사: 같은 카테고리를 먼저, 그다음 최신순
    void Promise.all([articleRequest, fetchMagazineArticles()]).then(([article, rows]) => {
      if (!active) return;
      setRelated(article ? pickRelatedArticles(article, rows) : rows.filter((row) => row.slug !== slug).slice(0, 3));
    });
    return () => { active = false; };
  }, [slug]);

  const article = state.status === "ready" ? state.article : null;
  const category = article ? MAGAZINE_CATEGORY_LABEL[article.category] ?? "언론 보도" : "";
  const isPress = article?.category === "press";
  const paragraphs = (article?.body ?? "").split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);

  useDocumentMeta(
    article
      ? {
          title: article.seoTitle || `${article.title} | BRAND-ER 매거진`,
          description: article.seoDescription || article.summary || `${article.publisher} ${formatMagazineDate(article.publishedAt)} 보도. BRAND-ER 뉴스룸에서 요약을 확인하세요.`,
          image: article.thumbnail,
          url: getAppUrl(magazineArticlePath(article.slug)),
          type: "article",
          publishedTime: article.publishedAt,
        }
      : state.status === "missing"
        ? { title: "기사를 찾을 수 없습니다 | BRAND-ER 매거진" }
        : null,
  );

  return (
    <div className="min-h-screen bg-[#f6f3ee]">
      <Header />
      <main className="mx-auto max-w-[1100px] px-4 pb-24 pt-20 sm:px-6 sm:pt-24">
        <nav aria-label="현재 위치" className="flex items-center gap-2 pt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500 sm:pt-12">
          <Link to={MAGAZINE_LIST_PATH} className="transition-colors hover:text-brand">Magazine</Link>
          <span className="text-stone-300">/</span>
          <span className="text-brand">{article ? category : "Newsroom"}</span>
        </nav>

        {state.status === "loading" && (
          <div className="pt-8" aria-busy="true" aria-label="기사를 불러오는 중">
            <div className="h-4 w-40 animate-pulse bg-stone-200" />
            <div className="mt-6 h-12 w-4/5 animate-pulse bg-stone-200" />
            <div className="mt-10 aspect-[16/9] w-full animate-pulse bg-stone-200" />
          </div>
        )}

        {state.status === "missing" && (
          <section className="border-t border-stone-950 py-20 text-center">
            <p className="eyebrow">Newsroom</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-stone-950">기사를 찾을 수 없습니다</h1>
            <p className="mt-3 text-sm text-stone-500">삭제되었거나 비공개로 전환된 기사입니다.</p>
            <BackToList className="mt-8" />
          </section>
        )}

        {article && (
          <article>
            <header className="border-b border-stone-300 pb-8 pt-6 sm:pb-10">
              <p className="eyebrow">BRAND-ER Newsroom</p>
              <h1 className="mt-4 max-w-4xl text-[1.85rem] font-semibold leading-[1.28] tracking-[-0.04em] text-stone-950 sm:text-[2.6rem] lg:text-[3rem]">
                {article.title}
              </h1>
              <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-stone-600">
                <span className="rounded-full border border-brand/30 bg-brand/5 px-2.5 py-0.5 text-[11px] font-semibold text-brand">{category}</span>
                <span className="font-semibold text-stone-950">{article.publisher}</span>
                {article.authorName && <span className="text-stone-500">{article.authorName}</span>}
                <span className="text-stone-300">|</span>
                <time dateTime={article.publishedAt} className="font-display">{formatMagazineDate(article.publishedAt)}</time>
              </div>
            </header>

            <figure className="mt-8 sm:mt-10">
              <div className="overflow-hidden bg-stone-200">
                <MagazineThumbnail
                  src={article.thumbnail}
                  publisher={article.publisher}
                  alt={`${article.publisher} 보도 대표 이미지`}
                  eager
                  className="aspect-[16/10] sm:aspect-[16/9]"
                />
              </div>
              <figcaption className="mt-2 text-[11px] text-stone-400">
                이미지 출처: {article.thumbnailCredit || article.publisher}
              </figcaption>
            </figure>

            <div className="mt-10 grid gap-12 lg:mt-14 lg:grid-cols-12 lg:gap-10">
              <div className="lg:col-span-8">
                <section>
                  <h2 className="eyebrow">Summary</h2>
                  <p className="mt-4 text-lg leading-[1.85] tracking-[-0.01em] text-stone-800 sm:text-xl">{article.summary}</p>
                </section>

                {article.keyPoints.length > 0 && (
                  <section className="mt-12 border-t border-stone-300 pt-8">
                    <h2 className="eyebrow">Key points</h2>
                    <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-stone-950">기사 주요 내용</p>
                    <ol className="mt-6 space-y-5">
                      {article.keyPoints.map((point, index) => (
                        <li key={index} className="grid grid-cols-[2.5rem_1fr] gap-3">
                          <span className="font-display text-sm font-semibold text-brand">{String(index + 1).padStart(2, "0")}</span>
                          <p className="text-[15px] leading-7 text-stone-700">{point}</p>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                {paragraphs.length > 0 && (
                  <section className="mt-12 border-t border-stone-300 pt-8">
                    <h2 className="sr-only">본문</h2>
                    <div className="space-y-6 text-[16px] leading-[1.95] tracking-[-0.01em] text-stone-800">
                      {paragraphs.map((paragraph, index) => <p key={index} className="whitespace-pre-line">{paragraph}</p>)}
                    </div>
                  </section>
                )}

                {article.brandHighlight && (
                  <section className="mt-12 border-l-2 border-brand bg-white px-6 py-7 sm:px-8">
                    <h2 className="eyebrow">Why it matters for BRAND-ER</h2>
                    <p className="mt-4 whitespace-pre-line text-base font-medium leading-8 text-stone-900">{article.brandHighlight}</p>
                  </section>
                )}

                <section className="mt-12 border-t border-stone-300 pt-6 text-xs leading-6 text-stone-500">
                  <p>
                    출처: {article.publisher} · {formatMagazineDate(article.publishedAt)}
                    {article.externalUrl && (
                      <>
                        {" · "}
                        <a href={article.externalUrl} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-4 hover:text-brand">
                          {article.externalUrl}
                        </a>
                      </>
                    )}
                  </p>
                  {isPress && (
                    <p className="mt-1">
                      본 페이지는 원문을 복제하지 않고 BRAND-ER가 핵심 내용을 요약·재구성했습니다. 기사 본문과 이미지의 저작권은 {article.publisher}에 있으며, 전체 기사는 원문에서 확인해 주세요.
                    </p>
                  )}
                </section>
              </div>

              <aside className="lg:col-span-4">
                <div className="lg:sticky lg:top-28">
                  <dl className="divide-y divide-stone-200 border-y border-stone-950 text-sm">
                    <div className="flex justify-between gap-4 py-3"><dt className="text-stone-500">{isPress ? "언론사" : "출처"}</dt><dd className="text-right font-semibold text-stone-950">{article.publisher}</dd></div>
                    {article.authorName && <div className="flex justify-between gap-4 py-3"><dt className="text-stone-500">작성</dt><dd className="text-right font-semibold text-stone-950">{article.authorName}</dd></div>}
                    <div className="flex justify-between gap-4 py-3"><dt className="text-stone-500">{isPress ? "발행일" : "게시일"}</dt><dd className="font-display font-semibold text-stone-950">{formatMagazineDate(article.publishedAt)}</dd></div>
                    <div className="flex justify-between gap-4 py-3"><dt className="text-stone-500">분류</dt><dd className="font-semibold text-brand">{category}</dd></div>
                  </dl>
                  <div className="mt-6 grid gap-3">
                    <OriginalLink article={article} />
                    <BackToList />
                  </div>
                </div>
              </aside>
            </div>
          </article>
        )}

        {state.status !== "loading" && related.length > 0 && (
          <section className="mt-20 border-t border-stone-950 pt-6">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-stone-950 sm:text-2xl">관련 기사</h2>
              <Link to={MAGAZINE_LIST_PATH} className="link-draw text-sm font-semibold text-stone-700 hover:text-brand">전체 보기</Link>
            </div>
            <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <Link key={item.slug} to={magazineArticlePath(item.slug)} className="group block">
                  <div className="overflow-hidden bg-stone-200">
                    <MagazineThumbnail src={item.thumbnail} publisher={item.publisher} alt={`${item.publisher} 기사 이미지`} className="img-zoom aspect-[16/10]" />
                  </div>
                  <p className="mt-4 text-[11px] font-semibold text-stone-500">
                    <span className="text-brand">{MAGAZINE_CATEGORY_LABEL[item.category] ?? item.publisher}</span> · {item.publisher} · <time dateTime={item.publishedAt}>{formatMagazineDate(item.publishedAt)}</time>
                  </p>
                  <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-snug tracking-[-0.02em] text-stone-950 group-hover:text-brand">{item.title}</h3>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-stone-700 group-hover:text-brand">자세히 보기 <ArrowUpRight className="h-3.5 w-3.5" /></span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default MagazineArticlePage;
