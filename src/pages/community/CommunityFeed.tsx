import { Header } from "@/components/Header";
import CommunityInsights from "@/components/community/CommunityInsights";

const CommunityFeed = () => {
  return (
    <div className="min-h-screen bg-[#f7f6f4]">
      <Header />
      <main className="mx-auto max-w-[1100px] px-4 pb-24 pt-20 sm:px-6 sm:pt-24">
        <section className="pb-8 pt-8 text-center sm:pb-12 sm:pt-12">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand">BRAND-ER PRESS</p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.03em] text-stone-950 sm:text-6xl">
            언론이 주목한 BRAND-ER
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
            AI로 의류 제작의 진입장벽을 낮추고, 아이디어가 실제 브랜드가 되는 과정을 만드는
            BRAND-ER의 이야기를 만나보세요.
          </p>
        </section>

        <CommunityInsights />
      </main>
    </div>
  );
};

export default CommunityFeed;
