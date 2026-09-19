import { useMemo, useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Header } from "@/components/Header";

type Article = {
  id: string;
  category: string;
  title: string;
  summary: string;
  body: string;
  source?: string;
  sourceUrl?: string;
  published?: string;
  tag: string;
};

const articles: Article[] = [
  {
    id: "why-one-piece-is-hard",
    category: "의류 제작 상식",
    title: "옷 1벌만 제작하기 어려운 이유",
    summary: "의류는 원단만 있으면 바로 만들어지는 제품이 아닙니다. 패턴, 재단, 봉제, 부자재 세팅까지 생산 전 준비비가 먼저 발생합니다.",
    body: "의류 제작에는 디자인을 실제 옷의 구조로 바꾸는 패턴 작업, 원단과 부자재 수급, 재단 준비, 봉제 세팅이 필요합니다. 이 비용은 1벌을 만들든 30벌을 만들든 상당 부분 동일하게 발생합니다. 그래서 1벌 제작은 장당 비용이 매우 높아지고, 일정 수량 이상에서 고정비가 분산되며 현실적인 단가가 만들어집니다. BRAND-ER는 이런 진입장벽을 낮추기 위해 소량 제작과 프리오더 방식으로 수요를 먼저 확인하는 구조를 사용합니다.",
    tag: "MOQ · 소량생산",
  },
  {
    id: "moq-guide",
    category: "의류 제작 상식",
    title: "MOQ란? 첫 생산 수량을 정할 때 꼭 알아야 할 기준",
    summary: "MOQ는 Minimum Order Quantity의 약자로, 공장이 한 번에 생산을 진행할 수 있는 최소 주문 수량입니다.",
    body: "MOQ는 공장마다, 제품마다 다릅니다. 단순 티셔츠는 비교적 낮고 니트, 데님, 아우터처럼 공정이 복잡한 제품은 더 높은 MOQ가 요구될 수 있습니다. 초보 브랜드라면 무조건 최저 단가를 노리기보다 실제 판매 가능한 수량을 먼저 추정하고, 샘플과 프리오더를 통해 적정 생산량을 검증하는 것이 중요합니다.",
    tag: "MOQ",
  },
  {
    id: "sample-pattern",
    category: "제작 과정",
    title: "샘플과 패턴비는 왜 따로 발생할까?",
    summary: "샘플은 완성품을 미리 만드는 단계이고, 패턴은 그 옷을 반복해서 만들기 위한 설계도에 가깝습니다.",
    body: "디자인 이미지만으로는 실제 옷을 생산할 수 없습니다. 치수와 곡선, 봉제 위치가 정리된 패턴이 필요하고, 그 패턴을 바탕으로 샘플을 제작해 핏과 원단의 움직임을 확인합니다. 첫 샘플에서 문제가 발견되면 패턴 수정과 재샘플이 진행됩니다. 이 단계가 본생산 불량과 대량 손실을 줄이는 핵심 과정입니다.",
    tag: "패턴 · 샘플",
  },
  {
    id: "fabric-count-gsm",
    category: "원단 콘텐츠",
    title: "16수·20수·30수와 GSM, 무엇을 봐야 할까?",
    summary: "원단의 두께와 촉감은 단순히 ‘몇 수’만으로 결정되지 않습니다. 실의 굵기와 원단 중량을 함께 봐야 합니다.",
    body: "일반적으로 면 원사의 숫자가 낮을수록 실이 굵고, 숫자가 높을수록 가늘어집니다. 하지만 실제 티셔츠의 두께감은 편직 방식과 GSM(제곱미터당 중량)의 영향을 함께 받습니다. 여름용 티셔츠라면 통기성과 중량, 헤비웨이트 티셔츠라면 형태 유지력과 촉감을 같이 비교하는 것이 좋습니다.",
    tag: "원단 · GSM",
  },
  {
    id: "hoodie-cost",
    category: "비용/견적",
    title: "후드티 30장 만들면 실제로 어떤 비용이 발생할까?",
    summary: "장당 봉제비 외에도 원단, 부자재, 패턴, 샘플, 프린팅 또는 자수비가 합쳐져 최종 제작비가 만들어집니다.",
    body: "견적을 볼 때 장당 생산단가만 비교하면 실제 예산과 차이가 생길 수 있습니다. 초기에는 패턴·샘플처럼 한 번 발생하는 개발비가 있고, 본생산에서는 원단·봉제·부자재·가공비가 수량만큼 발생합니다. 프린팅은 판비가 추가될 수 있고 자수 역시 별도의 세팅비가 필요합니다. 따라서 총예산은 ‘초기 개발비 + 장당 생산비 × 수량 + 후가공비’ 구조로 보는 것이 정확합니다.",
    tag: "견적",
  },
  {
    id: "brand-start",
    category: "브랜드 창업",
    title: "첫 의류 브랜드, 재고부터 만들지 말아야 하는 이유",
    summary: "브랜드 초기에 가장 큰 위험은 디자인보다 재고입니다. 판매 데이터가 없을수록 수요를 먼저 검증해야 합니다.",
    body: "처음부터 많은 수량을 생산하면 장당 단가는 내려가지만 판매되지 않은 재고가 현금을 묶어버립니다. 초기 브랜드는 제품 이미지와 샘플을 먼저 공개하고 구매 의향, 예약 주문, 프리오더 데이터를 확인한 뒤 생산량을 정하는 편이 안전합니다. BRAND-ER의 펀딩 구조도 같은 원리로, 고객 반응을 생산 이전에 확인하는 데 초점을 맞춥니다.",
    tag: "브랜드 창업 · 프리오더",
  },
  {
    id: "fit-guide",
    category: "디자인 콘텐츠",
    title: "레귤러핏·세미오버·오버핏은 무엇이 다를까?",
    summary: "핏은 단순히 한 사이즈 크게 만드는 문제가 아니라 어깨, 가슴, 총장, 암홀의 비율을 함께 설계하는 작업입니다.",
    body: "레귤러핏은 신체 치수에 비교적 가까운 균형을 갖고, 세미오버핏은 어깨와 품에 여유를 주되 과도하게 늘리지 않습니다. 오버핏은 드롭 숄더, 넓은 품, 길어진 소매 등 실루엣 전체를 다시 설계합니다. 원하는 핏을 만들 때는 ‘평소 XL 입으니 XXL로 제작’보다 기준 샘플의 실측을 제공하는 것이 훨씬 정확합니다.",
    tag: "핏 · 디자인",
  },
  {
    id: "sample-failure",
    category: "제작 실패 사례",
    title: "샘플 없이 바로 생산하면 생길 수 있는 문제",
    summary: "화면에서 완벽한 디자인도 실제 원단과 봉제에서는 전혀 다른 결과가 나올 수 있습니다.",
    body: "프린팅 위치가 생각보다 내려가거나, 원단 수축으로 총장이 달라지고, 넥라인이 늘어나거나, 봉제 후 실루엣이 무너지는 문제가 발생할 수 있습니다. 본생산 전 샘플은 단순 확인용이 아니라 생산 기준을 고정하는 단계입니다. 특히 처음 거래하는 공장이나 처음 쓰는 원단이라면 샘플을 생략하지 않는 것이 좋습니다.",
    tag: "실패 사례",
  },
  {
    id: "korea-manufacturing-2025",
    category: "패션 업계 정보",
    title: "국내 의류 제조업체 81%가 5인 미만…소량생산이 어려운 구조적 이유",
    summary: "2025년 국내 의류제조업 실태조사에서는 국내 의류 제조 사업체의 81.3%가 5인 미만 사업장으로 나타났습니다.",
    body: "한국패션협회 조사 결과 국내 의류 제조업은 소규모 사업장이 대부분이고, 개발과 소량생산을 담당하는 샘플실·패턴실 비중은 전체의 3% 수준에 불과했습니다. BRAND-ER 관점에서 보면 신생 브랜드가 패턴실, 샘플실, 봉제공장을 각각 찾아 연결해야 하는 이유가 바로 이런 분절된 생산 구조에 있습니다. 여러 공정을 하나의 제작 흐름으로 연결하는 것이 소량생산의 핵심 과제입니다.",
    source: "한국섬유신문 · 한국패션협회 2025년 국내 의류제조업 실태조사",
    sourceUrl: "https://www.ktnews.com/news/articleView.html?idxno=144338",
    published: "2026.02.27",
    tag: "산업 리포트 · 국내 생산",
  },
  {
    id: "manufacturing-ai",
    category: "패션 업계 정보",
    title: "패션 제조도 AI 시대로…핵심은 소량·다품종·빠른 생산",
    summary: "자동 재단, AI 생산계획, 디지털 품질검사 등 제조 AI가 패션 공급망의 기준을 바꾸고 있습니다.",
    body: "최근 패션 제조 경쟁력은 단순히 인건비가 저렴한 생산지를 찾는 것에서 속도, 품질, 재고회전, 공급망 안정성을 함께 최적화하는 방향으로 이동하고 있습니다. 한국섬유신문은 국내 제조업의 현실적인 방향으로 소량 다품종과 빠른 리오더, 고품질 단납기 생산을 위한 제조 AI 전환을 짚었습니다. 이는 AI 디자인과 수요 검증, 생산 연결을 결합하려는 BRAND-ER의 방향과도 맞닿아 있습니다.",
    source: "한국섬유신문 · ‘로봇이 옷 만드는 시대’ 피지컬 AI, 패션 공급망 다시 짠다",
    sourceUrl: "https://m.ktnews.com/news/articleView.html?idxno=147180",
    published: "2026.07.14",
    tag: "AI · 공급망",
  },
  {
    id: "oem-odm",
    category: "패션 업계 정보",
    title: "OEM에서 ODM으로, 패션 제조사가 바뀌고 있다",
    summary: "단순 봉제 생산을 넘어 원단 소싱, 개발, 디자인까지 함께 제공하는 제조 파트너의 중요성이 커지고 있습니다.",
    body: "OEM은 브랜드가 정한 설계와 사양에 맞춰 생산하는 역할이 중심이고, ODM은 제조사가 제품 개발과 디자인 영역까지 더 깊게 관여합니다. 패션비즈가 소개한 국내 제조 현장에서도 OEM에서 ODM으로의 구조 전환이 주요 과제로 언급됩니다. 신생 브랜드 입장에서는 공장 하나를 찾는 것보다 원단·패턴·샘플·생산을 통합 관리할 수 있는 파트너를 확보하는 것이 훨씬 중요해지고 있습니다.",
    source: "패션비즈 · K-제조 현주소 인터뷰",
    sourceUrl: "https://fashionbiz.co.kr/article/226071",
    published: "2026.05",
    tag: "OEM · ODM",
  },
  {
    id: "inventory-warning",
    category: "패션 업계 정보",
    title: "패션에서 재고가 중요한 이유, 생산보다 ‘회전’이 먼저다",
    summary: "생산량이 늘어도 판매 속도가 따라오지 않으면 재고 부담이 빠르게 커질 수 있습니다.",
    body: "한국섬유신문은 2026년 6월 산업지표를 분석하며 일부 섬유·패션 품목의 생산과 재고 흐름을 함께 짚었습니다. 브랜드 운영에서 중요한 것은 많이 만드는 것이 아니라 얼마나 빠르게 판매되고 다시 생산되는지입니다. 그래서 초기 브랜드일수록 대량생산보다 작은 수량으로 시작해 반응을 보고 리오더하는 구조가 현금흐름에 유리합니다.",
    source: "한국섬유신문 · ‘소비는 회복세인데…’ 의류 생산·재고 지표",
    sourceUrl: "https://ktnews.com/news/articleView.html?idxno=147442",
    published: "2026.07.31",
    tag: "재고 · 생산",
  },
];

const categories = ["전체", ...Array.from(new Set(articles.map((article) => article.category)))];

export default function Magazine() {
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [openArticle, setOpenArticle] = useState<Article | null>(null);

  const filtered = useMemo(
    () => selectedCategory === "전체" ? articles : articles.filter((article) => article.category === selectedCategory),
    [selectedCategory],
  );

  return (
    <div className="min-h-screen bg-[#f3f0eb] text-[#211b1c]">
      <Header />
      <main className="pt-16 sm:pt-[72px]">
        <section className="border-b border-black/10 bg-[#24191b] px-5 py-16 text-white sm:px-8 sm:py-24">
          <div className="mx-auto max-w-[1320px]">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#d8a8b2]">BRAND-ER MAGAZINE</p>
            <h1 className="mt-4 max-w-4xl text-5xl font-extrabold leading-[0.95] tracking-[-0.03em] sm:text-7xl">옷을 만들기 전에<br />알아야 할 것들.</h1>
            <p className="mt-7 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">의류 제작, 원단, 견적, 브랜드 창업과 패션 제조 산업을 BRAND-ER의 시선으로 정리합니다. 외부 자료를 참고한 콘텐츠는 원문 출처를 함께 표시합니다.</p>
          </div>
        </section>

        <section className="sticky top-16 z-20 border-b border-black/10 bg-[#f3f0eb]/95 px-4 py-4 backdrop-blur sm:top-[72px] sm:px-8">
          <div className="mx-auto flex max-w-[1320px] gap-2 overflow-x-auto pb-1">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${selectedCategory === category ? "bg-[#7b2638] text-white" : "border border-black/10 bg-white text-stone-600 hover:border-[#7b2638]/40"}`}
              >
                {category}
              </button>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1320px] px-4 py-12 sm:px-8 sm:py-16">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((article, index) => (
              <article key={article.id} className="group flex min-h-[330px] flex-col border border-black/10 bg-white p-6 transition hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(40,25,28,0.08)] sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7b2638]">{article.category}</span>
                  <span className="text-2xl text-stone-300">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h2 className="mt-6 text-2xl font-bold leading-tight tracking-[-0.03em] sm:text-3xl">{article.title}</h2>
                <p className="mt-4 text-sm leading-6 text-stone-600">{article.summary}</p>
                <div className="mt-auto pt-8">
                  <p className="mb-4 text-[11px] font-semibold text-stone-400">{article.tag}</p>
                  <button onClick={() => setOpenArticle(article)} className="inline-flex items-center text-sm font-bold text-[#7b2638]">읽어보기 <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" /></button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-black/10 bg-white px-5 py-12 sm:px-8">
          <div className="mx-auto max-w-[1320px] sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7b2638]">FROM CONTENT TO PRODUCTION</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.03em]">알아봤다면, 이제 직접 만들어보세요.</h2>
            </div>
            <a href="./customize" className="mt-6 inline-flex items-center bg-[#7b2638] px-6 py-4 text-sm font-bold text-white sm:mt-0">AI로 옷 디자인하기 <ArrowRight className="ml-2 h-4 w-4" /></a>
          </div>
        </section>
      </main>

      {openArticle && (
        <div className="fixed inset-0 z-[80] flex items-end bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6" onClick={() => setOpenArticle(null)}>
          <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-[#fbfaf8] p-6 shadow-2xl sm:max-w-3xl sm:rounded-3xl sm:p-10" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7b2638]">{openArticle.category}</span>
              <button onClick={() => setOpenArticle(null)} className="rounded-full border border-black/10 px-3 py-1 text-xs font-bold text-stone-500">닫기</button>
            </div>
            <h2 className="mt-5 text-4xl font-extrabold leading-tight tracking-[-0.03em]">{openArticle.title}</h2>
            <p className="mt-7 whitespace-pre-line text-[15px] leading-8 text-stone-700">{openArticle.body}</p>
            {openArticle.source && openArticle.sourceUrl && (
              <div className="mt-8 border-t border-black/10 pt-6">
                <p className="text-xs font-bold text-stone-500">참고 출처 {openArticle.published ? `· ${openArticle.published}` : ""}</p>
                <a href={openArticle.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center text-sm font-semibold text-[#7b2638] underline underline-offset-4">{openArticle.source} <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a>
                <p className="mt-3 text-xs leading-5 text-stone-400">본 콘텐츠는 원문을 복제하지 않고 BRAND-ER가 핵심 내용을 요약·재구성했습니다.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
