import { ArrowUpRight } from "lucide-react";

type PressArticle = {
  title: string;
  summary: string;
  image: string;
  source: string;
  date: string;
  href: string;
};

const pressArticles: PressArticle[] = [
  {
    title: "“18세부터 시작된 창업 도전”… BRAND-ER 김하성 대표, AI로 패션 산업의 문턱을 낮추다",
    summary:
      "구매대행과 의류 쇼핑몰 운영 경험에서 발견한 제작 현장의 문제를 AI 기반 의류 프로모션 플랫폼으로 해결해 온 김하성 대표의 창업 이야기입니다.",
    image: "https://cdn.newsfinder.co.kr/news/thumbnail/202606/220437_225168_1236_v150.jpg",
    source: "뉴스파인더",
    date: "2026.06.06",
    href: "http://www.newsfinder.co.kr/news/articleView.html?idxno=220437",
  },
  {
    title: "AI 의류 프로모션 기업 브랜더, 라사라·루아트 패션학교와 협력 확대",
    summary:
      "패션 교육기관과의 협력을 통해 학생들의 졸업작품 제작과 브랜드 론칭을 지원하고, 신진 디자이너의 생산 진입장벽을 낮추는 BRAND-ER의 행보를 소개합니다.",
    image: "https://cdn.gokorea.kr/news/thumbnail/202606/870763_147910_389_v150.jpg",
    source: "공감신문",
    date: "2026.06.30",
    href: "https://www.gokorea.kr/news/articleView.html?idxno=870763",
  },
  {
    title: "디큐베이터, ‘DeXplore 글로벌 청년 창업 아이디어 경진대회’ 성료…우수팀 사업화 지원",
    summary:
      "대학생 창업팀 11개 팀이 참여한 글로벌 청년 창업 아이디어 경진대회의 수상 결과와 후속 사업화 지원 계획을 다룬 기사로, BRAND-ER가 수상팀으로 소개됐습니다.",
    image: "https://www.thevaluenews.co.kr/data/cheditor4/2502/bbed3bf147bcaac8670b45d4acc6ad4716634ce2.png",
    source: "더밸류뉴스",
    date: "2025.02.06",
    href: "https://www.thevaluenews.co.kr/news/view.php?idx=188400",
  },
  {
    title: "브랜더(BRAND-ER), AI 기반 의류 디자인·자동견적·상표분석으로 패션 창업 혁신",
    summary:
      "디자인 생성부터 제작 견적과 상표 분석까지 한곳에서 제공하는 BRAND-ER의 서비스를 소개하며, AI 자동견적 시스템의 특허 출원을 준비 중인 소식을 전합니다.",
    image: "https://cdn.newsfinder.co.kr/news/thumbnail/202608/221368_226384_5731_v150.jpg",
    source: "뉴스파인더",
    date: "2026.08.02",
    href: "http://www.newsfinder.co.kr/news/articleView.html?idxno=221368",
  },
];

const CommunityInsights = () => {
  return (
    <section className="border-t-2 border-stone-950 pb-8 pt-5 sm:pt-7">
      <div className="mb-8 flex items-end justify-between gap-5 border-b border-stone-300 pb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-brand">MEDIA COVERAGE</p>
          <h2 className="mt-2 font-serif text-2xl font-bold tracking-[-0.04em] text-stone-950 sm:text-3xl">
            BRAND-ER NEWS
          </h2>
        </div>
        <p className="hidden text-xs font-medium text-stone-500 sm:block">기사 카드를 누르면 원문으로 이동합니다.</p>
      </div>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 md:gap-7">
        {pressArticles.map((article, index) => (
          <a
            key={article.href}
            href={article.href}
            target="_blank"
            rel="noreferrer"
            className="group block"
          >
            <div className="overflow-hidden rounded-[1.75rem] bg-stone-200 shadow-sm">
              <img
                src={article.image}
                alt={`${article.source} 기사 이미지`}
                className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                loading={index === 0 ? "eager" : "lazy"}
              />
            </div>

            <div className="px-1 pt-5">
              <div className="flex items-center gap-2 text-[11px] font-bold text-stone-500">
                <span className="text-brand">{article.source}</span>
                <span className="text-stone-300">|</span>
                <span>{article.date}</span>
              </div>
              <h3 className="mt-3 font-serif text-2xl font-bold leading-[1.32] tracking-[-0.035em] text-stone-950 group-hover:text-brand sm:text-[1.7rem]">
                {article.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-stone-600">{article.summary}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-extrabold text-stone-950 transition group-hover:text-brand">
                기사 원문 보기 <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
          </a>
        ))}
      </div>

      <p className="mt-12 border-t border-stone-200 pt-4 text-[11px] leading-5 text-stone-400">
        기사 이미지와 내용의 저작권은 각 언론사에 있으며, 제목과 요약을 누르면 해당 언론사의 원문으로 이동합니다.
      </p>
    </section>
  );
};

export default CommunityInsights;
