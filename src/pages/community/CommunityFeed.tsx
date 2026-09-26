import { Header } from "@/components/Header";
import CommunityInsights from "@/components/community/CommunityInsights";

const CommunityFeed = () => {
  return (
    <div className="min-h-screen bg-[#f6f3ee]">
      <Header />
      <main className="mx-auto max-w-[1100px] px-4 pb-24 pt-20 sm:px-6 sm:pt-24">
        <section className="grid gap-6 pb-10 pt-8 sm:pb-14 sm:pt-12 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <p className="eyebrow">BRAND-ER press</p>
            <h1 className="display-hero mt-4 text-stone-950">
              언론이 주목한
              <br />
              BRAND-ER<span className="text-brand">.</span>
            </h1>
          </div>
          <p className="max-w-md text-sm leading-7 text-stone-600 sm:text-base lg:col-span-4">
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
