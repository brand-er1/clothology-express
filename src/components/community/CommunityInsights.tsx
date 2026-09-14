import { ArrowUpRight } from "lucide-react";
import { getAppPath } from "@/utils/appUrl";

type Story = {
  kicker: string;
  title: string;
  dek: string;
  image: string;
  source: string;
  date: string;
  href?: string;
};

const leadStory: Story = {
  kicker: "MANUFACTURING · AI",
  title: "패션 제조 AI 매칭, 브랜드와 봉제공장을 데이터로 잇는다",
  dek: "작업지시서와 생산 데이터를 기반으로 브랜드와 제조기업을 연결하는 AI·DX 공급망이 본격화되고 있습니다. BRAND-ER는 이 흐름을 ‘디자인 → 수요검증 → 생산연결’ 관점에서 짚었습니다.",
  image: "/lovable-uploads/jacket.png",
  source: "한국섬유신문",
  date: "2026.08.05",
  href: "https://ktnews.com/news/articleView.html?idxno=147512",
};

const topStories: Story[] = [
  {
    kicker: "INDUSTRY",
    title: "국내 패션 제조, OEM에서 ODM으로 바뀌어야 하는 이유",
    dek: "단순 임가공을 넘어 기획·개발·샘플 역량까지 갖춘 제조 파트너의 중요성이 커지고 있습니다.",
    image: "/lovable-uploads/short_sleeve.png",
    source: "패션비즈",
    date: "2026.05",
    href: "https://fashionbiz.co.kr/article/226071",
  },
  {
    kicker: "PHYSICAL AI",
    title: "로봇이 옷 만드는 시대, 패션 공급망의 기준이 바뀐다",
    dek: "인건비보다 속도·품질·재고 회전·공급망 안정성이 생산지 선택의 핵심 기준으로 이동하고 있습니다.",
    image: "/lovable-uploads/sweatshirt.png",
    source: "한국섬유신문",
    date: "2026.07.14",
    href: "https://ktnews.com/news/articleView.html?idxno=147180",
  },
];

const briefStories: Story[] = [
  {
    kicker: "BRAND-ER GUIDE",
    title: "옷 1벌만 제작하기 어려운 이유",
    dek: "패턴, 샘플, 재단 준비와 봉제 세팅처럼 수량과 무관하게 먼저 발생하는 고정 공정이 있기 때문입니다.",
    image: "/lovable-uploads/long_sleeve.png",
    source: "BRAND-ER 제작 노트",
    date: "2026.09.14",
  },
  {
    kicker: "COST GUIDE",
    title: "후드티 30장, 실제 제작비는 어디서 결정될까?",
    dek: "원단·봉제뿐 아니라 패턴, 샘플, 부자재, 프린팅, 워싱 등 초기 개발비와 수량비가 함께 반영됩니다.",
    image: "/lovable-uploads/sweatshirt.png",
    source: "BRAND-ER 견적 노트",
    date: "2026.09.14",
  },
  {
    kicker: "FABRIC",
    title: "16수·20수·30수와 GSM, 티셔츠 원단 보는 법",
    dek: "실의 굵기만으로 두께를 판단하지 말고 편직 방식과 제곱미터당 중량까지 함께 봐야 합니다.",
    image: "/lovable-uploads/short_sleeve.png",
    source: "BRAND-ER 원단 노트",
    date: "2026.09.14",
  },
  {
    kicker: "FASHION AI",
    title: "섬유패션 제조 AX, 디자인부터 AI 봉제까지",
    dek: "가상 직물설계, 패션 AI 디자인, 지능형 제직과 AI 봉제 자율제조가 실제 산업 현장에 소개되고 있습니다.",
    image: "/lovable-uploads/long_pants.png",
    source: "한국섬유신문",
    date: "2026.08.18",
    href: "https://ktnews.com/news/articleView.html?idxno=147780",
  },
];

const StoryMeta = ({ story }: { story: Story }) => (
  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-stone-500">
    <span>{story.source}</span><span className="text-stone-300">|</span><span>{story.date}</span>
    {story.href && <span className="ml-auto inline-flex items-center gap-1 font-bold text-brand">원문 보기 <ArrowUpRight className="h-3 w-3" /></span>}
  </div>
);

const CommunityInsights = () => {
  return (
    <section className="mt-8 border-y border-stone-300 bg-[#fbfaf7] py-7 sm:py-9">
      <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-stone-900 pb-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-brand">BRAND-ER EDITORIAL</p>
          <h2 className="mt-1 font-serif text-2xl font-bold tracking-[-0.04em] text-stone-950 sm:text-3xl">의류 제작과 패션 산업을 읽다</h2>
        </div>
        <p className="hidden max-w-sm text-right text-xs leading-5 text-stone-500 sm:block">BRAND-ER가 직접 정리한 제작 정보와 패션 업계 주요 기사를 함께 소개합니다.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.55fr_0.9fr]">
        <a href={leadStory.href} target="_blank" rel="noreferrer" className="group block border-b border-stone-300 pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
          <div className="overflow-hidden bg-stone-200">
            <img src={getAppPath(leadStory.image)} alt={leadStory.title} className="aspect-[16/9] w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
          </div>
          <p className="mt-4 text-[10px] font-black tracking-[0.2em] text-brand">{leadStory.kicker}</p>
          <h3 className="mt-2 font-serif text-2xl font-bold leading-[1.18] tracking-[-0.035em] text-stone-950 sm:text-4xl">{leadStory.title}</h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600 sm:text-base sm:leading-7">{leadStory.dek}</p>
          <StoryMeta story={leadStory} />
        </a>

        <div className="divide-y divide-stone-300">
          {topStories.map((story) => (
            <a key={story.title} href={story.href} target="_blank" rel="noreferrer" className="group grid grid-cols-[1fr_120px] gap-4 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_160px]">
              <div>
                <p className="text-[9px] font-black tracking-[0.18em] text-brand">{story.kicker}</p>
                <h3 className="mt-1.5 font-serif text-lg font-bold leading-snug tracking-[-0.025em] text-stone-950 group-hover:underline sm:text-xl">{story.title}</h3>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-stone-600 sm:text-sm">{story.dek}</p>
                <StoryMeta story={story} />
              </div>
              <img src={getAppPath(story.image)} alt={story.title} className="aspect-[4/3] h-full max-h-36 w-full object-cover bg-stone-200" />
            </a>
          ))}
        </div>
      </div>

      <div className="mt-7 grid gap-5 border-t border-stone-300 pt-6 sm:grid-cols-2 lg:grid-cols-4">
        {briefStories.map((story) => {
          const content = (
            <>
              <div className="overflow-hidden bg-stone-200"><img src={getAppPath(story.image)} alt={story.title} className="aspect-[3/2] w-full object-cover transition duration-500 group-hover:scale-[1.03]" /></div>
              <p className="mt-3 text-[9px] font-black tracking-[0.18em] text-brand">{story.kicker}</p>
              <h3 className="mt-1.5 font-serif text-lg font-bold leading-snug tracking-[-0.025em] text-stone-950 group-hover:underline">{story.title}</h3>
              <p className="mt-2 line-clamp-3 text-xs leading-5 text-stone-600">{story.dek}</p>
              <StoryMeta story={story} />
            </>
          );
          return story.href ? (
            <a key={story.title} href={story.href} target="_blank" rel="noreferrer" className="group block">{content}</a>
          ) : (
            <article key={story.title} className="group block">{content}</article>
          );
        })}
      </div>

      <p className="mt-6 border-t border-stone-200 pt-4 text-[11px] leading-5 text-stone-400">외부 기사 내용은 원문을 복제하지 않고 핵심 내용을 BRAND-ER 관점에서 요약했습니다. 외부 기사에는 원 출처와 원문 링크를 함께 표시합니다.</p>
    </section>
  );
};

export default CommunityInsights;
