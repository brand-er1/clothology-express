import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Newspaper } from "lucide-react";
import { Header } from "@/components/Header";
import { MagazineThumbnail } from "@/components/magazine/MagazineThumbnail";
import {
  formatMagazineDate, MAGAZINE_CATEGORIES, MAGAZINE_CATEGORY_LABEL, magazineArticlePath,
  type MagazineArticle, type MagazineCategory,
} from "@/data/magazineArticles";
import { fetchMagazineArticles } from "@/services/magazine";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { getAppUrl } from "@/utils/appUrl";
import { cn } from "@/lib/utils";

type Filter = "all" | MagazineCategory;

const isCategory = (value: string | null): value is MagazineCategory =>
  Boolean(value && (MAGAZINE_CATEGORIES as string[]).includes(value));

const Meta = ({ article }: { article: MagazineArticle }) => (
  <p className="text-[11px] font-semibold text-stone-500">
    <span className="text-brand">{MAGAZINE_CATEGORY_LABEL[article.category] ?? "언론 보도"}</span>
    {" · "}{article.publisher}{" · "}
    <time dateTime={article.publishedAt} className="font-display">{formatMagazineDate(article.publishedAt)}</time>
  </p>
);

const MagazineList = () => {
  const [params, setParams] = useSearchParams();
  const requested = params.get("category");
  const filter: Filter = isCategory(requested) ? requested : "all";
  const [articles, setArticles] = useState<MagazineArticle[] | null>(null);

  useEffect(() => {
    let active = true;
    void fetchMagazineArticles().then((rows) => { if (active) setArticles(rows); });
    return () => { active = false; };
  }, []);

  useDocumentMeta({
    title: filter === "all" ? "BRAND-ER 매거진 | 브랜드 소식 · 언론 보도" : `${MAGAZINE_CATEGORY_LABEL[filter]} | BRAND-ER 매거진`,
    description: "BRAND-ER NEWS, 언론 보도, 브랜드 스토리, 제작자 인터뷰, 패션 및 제조 인사이트를 한곳에서 확인하세요.",
    url: getAppUrl(filter === "all" ? "/magazine" : `/magazine?category=${filter}`),
  });

  const counts = useMemo(() => {
    const map = new Map<MagazineCategory, number>();
    (articles ?? []).forEach((article) => map.set(article.category, (map.get(article.category) ?? 0) + 1));
    return map;
  }, [articles]);
  const visible = (articles ?? []).filter((article) => filter === "all" || article.category === filter);
  const [lead, ...rest] = visible;

  const choose = (next: Filter) => {
    const nextParams = new URLSearchParams(params);
    if (next === "all") nextParams.delete("category"); else nextParams.set("category", next);
    setParams(nextParams, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f6f3ee]">
      <Header />
      <main className="mx-auto max-w-[1180px] px-4 pb-24 pt-24 sm:px-6 sm:pt-28">
        <header className="border-b border-stone-950 pb-6">
          <p className="eyebrow">BRAND-ER Magazine</p>
          <h1 className="mt-3 text-[2rem] font-semibold leading-tight tracking-[-0.04em] text-stone-950 sm:text-[2.75rem]">매거진</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">브랜드 소식과 언론 보도, 제작자의 이야기, 패션 제조 현장의 인사이트를 전합니다.</p>
        </header>

        <nav aria-label="매거진 카테고리" className="-mx-4 mt-5 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {(["all", ...MAGAZINE_CATEGORIES] as Filter[]).map((value) => {
            const count = value === "all" ? articles?.length : counts.get(value);
            return (
              <button key={value} type="button" onClick={() => choose(value)} aria-pressed={filter === value}
                className={cn("min-h-9 shrink-0 px-3.5 text-sm font-semibold transition",
                  filter === value ? "bg-[#211b1c] text-white" : "border border-black/10 bg-white/60 text-stone-600 hover:bg-white")}>
                {value === "all" ? "전체" : MAGAZINE_CATEGORY_LABEL[value]}
                {count !== undefined && <span className="ml-1 font-display text-[11px] opacity-70">{count}</span>}
              </button>
            );
          })}
        </nav>

        {articles === null ? (
          <div className="mt-10 grid gap-8 lg:grid-cols-2" aria-busy="true" aria-label="기사를 불러오는 중">
            <div className="aspect-[16/10] animate-pulse bg-stone-200" />
            <div className="grid gap-4"><div className="h-6 w-2/3 animate-pulse bg-stone-200" /><div className="h-4 w-1/2 animate-pulse bg-stone-200" /></div>
          </div>
        ) : visible.length === 0 ? (
          <section className="mt-10 border border-dashed border-stone-300 px-6 py-20 text-center">
            <Newspaper className="mx-auto h-8 w-8 text-brand/40" />
            <p className="mt-3 text-sm font-semibold text-stone-700">아직 이 카테고리의 기사가 없습니다.</p>
            <button type="button" onClick={() => choose("all")} className="mt-4 text-sm font-semibold text-brand underline-offset-4 hover:underline">전체 기사 보기</button>
          </section>
        ) : (
          <>
            <Link to={magazineArticlePath(lead.slug)} className="group mt-8 grid gap-6 border-b border-stone-300 pb-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:gap-10">
              <div className="overflow-hidden bg-stone-200">
                <MagazineThumbnail src={lead.thumbnail} publisher={lead.publisher} alt={`${lead.title} 대표 이미지`} eager className="img-zoom aspect-[16/10]" />
              </div>
              <div className="min-w-0">
                <Meta article={lead} />
                <h2 className="mt-3 text-2xl font-semibold leading-snug tracking-[-0.03em] text-stone-950 group-hover:text-brand sm:text-3xl">{lead.title}</h2>
                {lead.summary && <p className="mt-4 line-clamp-4 text-[15px] leading-7 text-stone-600">{lead.summary}</p>}
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-stone-800 group-hover:text-brand">자세히 보기 <ArrowUpRight className="h-4 w-4" /></span>
              </div>
            </Link>
            {rest.length > 0 && (
              <div className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((article) => (
                  <Link key={article.slug} to={magazineArticlePath(article.slug)} className="group block min-w-0">
                    <div className="overflow-hidden bg-stone-200">
                      <MagazineThumbnail src={article.thumbnail} publisher={article.publisher} alt={`${article.title} 이미지`} className="img-zoom aspect-[16/10]" />
                    </div>
                    <div className="mt-4"><Meta article={article} /></div>
                    <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-snug tracking-[-0.02em] text-stone-950 group-hover:text-brand">{article.title}</h3>
                    {article.summary && <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-500">{article.summary}</p>}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default MagazineList;
