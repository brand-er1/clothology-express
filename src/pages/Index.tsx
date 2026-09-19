import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight, Lightbulb, Sparkles, Calculator, Scissors, PackageCheck, Shirt, Users, WandSparkles } from "lucide-react";
import { Header } from "@/components/Header";
import { BrandMascot } from "@/components/BrandMascot";
import { BrandMark } from "@/components/BrandMark";
import { fetchApprovedFundings } from "@/services/funding";
import type { Funding } from "@/types/funding";
import { getAppPath } from "@/utils/appUrl";
import { portfolioProducts } from "@/data/portfolioProducts";

type CollectionItem = Pick<
  Funding,
  | "id"
  | "product_name"
  | "image_url"
  | "cloth_type"
  | "material"
  | "current_orders"
  | "moq"
  | "price"
>;

const fallbackCollection: CollectionItem[] = [
  {
    id: "preview-jacket",
    product_name: "Burgundy Sculpted Jacket",
    image_url: getAppPath("/lovable-uploads/jacket.png"),
    cloth_type: "아우터",
    material: "소프트 터치 우븐",
    current_orders: 14,
    moq: 20,
    price: 109000,
  },
  {
    id: "preview-knit",
    product_name: "Quiet Form Sweatshirt",
    image_url: getAppPath("/lovable-uploads/sweatshirt.png"),
    cloth_type: "스웻셔츠",
    material: "헤비 코튼",
    current_orders: 12,
    moq: 20,
    price: 89000,
  },
  {
    id: "preview-shirt",
    product_name: "Essential Long Sleeve",
    image_url: getAppPath("/lovable-uploads/long_sleeve.png"),
    cloth_type: "상의",
    material: "코튼 저지",
    current_orders: 9,
    moq: 20,
    price: 79000,
  },
  {
    id: "preview-pants",
    product_name: "Relaxed Wide Pants",
    image_url: getAppPath("/lovable-uploads/long_pants.png"),
    cloth_type: "하의",
    material: "코튼 블렌드",
    current_orders: 8,
    moq: 20,
    price: 79000,
  },
];

const startWays = [
  { title: "직접 디자인해서 펀딩", description: "아이디어를 AI와 함께 구체화하고, 펀딩으로 수요를 먼저 확인하세요.", to: "/customize", icon: WandSparkles },
  { title: "이미 있는 디자인으로 펀딩", description: "보유한 디자인을 기반으로 견적부터 펀딩 등록까지 빠르게 이어갑니다.", to: "/design-quote", icon: Shirt },
  { title: "단체복 빠른 제작", description: "동아리·팀·기업·행사에 필요한 단체복을 간편하게 제작하세요.", to: "/quick-group-wear", icon: Users },
  { title: "진행 중인 펀딩 둘러보기", description: "다른 창작자의 아이디어를 먼저 주문하고 실제 생산을 함께 만드세요.", to: "/fundings", icon: Sparkles },
];

const process = [
  { n: "01", title: "아이디어", text: "원하는 스타일과 제품을 정합니다.", icon: Lightbulb },
  { n: "02", title: "AI 디자인", text: "이미지를 만들고 디자인을 구체화합니다.", icon: Sparkles },
  { n: "03", title: "자동 견적", text: "원단과 사양에 맞춘 예상 제작비를 확인합니다.", icon: Calculator },
  { n: "04", title: "샘플 제작", text: "패턴과 샘플로 실제 완성도를 확인합니다.", icon: Scissors },
  { n: "05", title: "펀딩 · 생산", text: "목표 수량 달성 후 본생산과 배송을 진행합니다.", icon: PackageCheck },
];

const formatPrice = (price: number | null) =>
  price ? `${price.toLocaleString("ko-KR")}원` : "가격 준비 중";

const Index = () => {
  const [approvedFundings, setApprovedFundings] = useState<Funding[]>([]);

  useEffect(() => {
    let active = true;

    fetchApprovedFundings()
      .then((fundings) => {
        if (active) setApprovedFundings(fundings);
      })
      .catch((error) => {
        console.error("Failed to load homepage collection:", error);
      });

    return (
    <div className="min-h-screen bg-[#f4f1ec] text-[#171313]">
      <Header />
      <main className="pt-16 sm:pt-[72px]">
        <section className="relative overflow-hidden border-b border-black/10 bg-[#e8e1d9]">
          <div className="mx-auto grid min-h-[650px] max-w-[1440px] lg:grid-cols-[0.9fr_1.1fr]">
            <div className="relative z-10 flex flex-col justify-center px-6 py-16 sm:px-10 lg:px-14 xl:px-16">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand">FROM IDEAS TO WEARABLES · BRAND-ER</p>
              <h1 className="mt-6 text-[clamp(3.3rem,6.5vw,6.8rem)] font-extrabold leading-[0.94] tracking-[-0.055em]">아이디어가<br/>옷이 되는<br/><span className="text-brand">가장 쉬운 방법.</span></h1>
              <p className="mt-7 max-w-lg text-base leading-8 text-stone-600 sm:text-lg">디자인부터 원단, 샘플, 생산까지.<br/>BRAND-ER가 의류 제작의 전 과정을 연결합니다.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/customize" className="inline-flex h-14 items-center bg-brand px-7 text-sm font-bold text-white transition hover:bg-brand-dark">내 옷 제작하기 <ArrowRight className="ml-2 h-4 w-4"/></Link>
                <Link to="/fundings" className="inline-flex h-14 items-center border border-black/25 bg-white/40 px-7 text-sm font-bold">펀딩 둘러보기</Link>
              </div>
            </div>
            <div className="relative min-h-[500px] overflow-hidden bg-[#d7cec5] lg:min-h-[650px]">
              <img src={getAppPath("/brand-er-hero-editorial-v2.webp")} alt="BRAND-ER 의류 제작 스튜디오" className="absolute inset-0 h-full w-full object-cover"/>
              <div className="absolute inset-0 bg-gradient-to-r from-[#e8e1d9]/30 via-transparent to-transparent"/>
              <div className="absolute bottom-7 right-7 border border-white/40 bg-black/45 px-5 py-4 text-white backdrop-blur">
                <p className="text-[10px] uppercase tracking-[.22em] text-white/60">WEAR YOUR STORY</p>
                <p className="mt-1 text-lg font-semibold">아이디어만 있어도 시작할 수 있습니다.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-[#fbfaf7]">
          <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12 xl:px-16">
            <div className="grid gap-7 sm:grid-cols-5">
              {process.map((item, i) => { const Icon=item.icon; return <div key={item.n} className="relative">
                <div className="flex items-center gap-3"><Icon className="h-6 w-6 text-brand"/><span className="text-[10px] font-bold tracking-[.2em] text-stone-400">{item.n}</span></div>
                <h3 className="mt-4 text-lg font-bold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-stone-500">{item.text}</p>
                {i<4 && <ArrowRight className="absolute -right-4 top-3 hidden h-4 w-4 text-stone-300 sm:block"/>}
              </div>})}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
          <div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-brand">START YOUR BRAND</p><h2 className="mt-3 text-4xl font-extrabold tracking-[-.04em] sm:text-6xl">어떤 방식으로 시작하시나요?</h2><p className="mt-4 text-stone-500">당신의 상황에 맞는 방법으로 지금 바로 시작해보세요.</p></div></div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {startWays.map((way,i)=>{const Icon=way.icon; const images=["/lovable-uploads/short_sleeve.png","/lovable-uploads/jacket.png","/lovable-uploads/sweatshirt.png","/lovable-uploads/long_pants.png"]; return <Link key={way.title} to={way.to} className="group overflow-hidden border border-black/10 bg-white">
              <div className="relative aspect-[4/3] overflow-hidden bg-[#ddd7d0]"><img src={getAppPath(images[i])} alt="" className="h-full w-full object-contain p-7 transition duration-500 group-hover:scale-105"/><Icon className="absolute left-4 top-4 h-7 w-7 text-brand"/></div>
              <div className="p-5"><h3 className="text-lg font-bold">{way.title}</h3><p className="mt-2 min-h-[48px] text-sm leading-6 text-stone-500">{way.description}</p><ArrowRight className="mt-5 h-4 w-4 transition group-hover:translate-x-1"/></div>
            </Link>})}
          </div>
        </section>

        <section className="border-y border-black/10 bg-[#ebe7e1]">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
            <div className="flex items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-brand">LIVE FUNDING</p><h2 className="mt-3 text-4xl font-extrabold tracking-[-.04em] sm:text-6xl">지금 진행 중인 펀딩</h2><p className="mt-4 text-stone-500">BRAND-ER에서 실제 옷이 만들어지고 있습니다.</p></div><Link to="/fundings" className="hidden text-sm font-bold sm:inline-flex">전체 펀딩 보기 <ArrowRight className="ml-2 h-4 w-4"/></Link></div>
            <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {collection.map((item)=>{const pct=Math.round((item.current_orders/item.moq)*100); const detail=item.id.startsWith("preview-")?"/fundings":`/fundings/${item.id}`; return <Link key={item.id} to={detail} className="group bg-[#f8f6f2]">
                <div className="relative aspect-[4/5] overflow-hidden bg-[#d8d3cd]"><img src={item.image_url} alt={item.product_name} className="h-full w-full object-contain p-5 transition duration-500 group-hover:scale-105"/><span className="absolute left-3 top-3 bg-brand px-3 py-1.5 text-[10px] font-bold text-white">펀딩중</span></div>
                <div className="p-4"><h3 className="truncate font-bold">{item.product_name}</h3><p className="mt-1 text-sm text-stone-500">{formatPrice(item.price)}</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-stone-200"><div className="h-full bg-brand" style={{width:`${Math.min(pct,100)}%`}}/></div><div className="mt-2 flex justify-between text-xs"><b className="text-brand">{pct}%</b><span className="text-stone-500">{item.current_orders}명 참여</span></div></div>
              </Link>})}
            </div>
          </div>
        </section>

        <section className="bg-[#f8f6f2]">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-brand">WHY BRAND-ER</p><h2 className="mt-3 text-4xl font-extrabold tracking-[-.04em] sm:text-6xl">옷을 만드는 복잡한 과정을 하나로.</h2>
            <div className="mt-10 grid gap-px overflow-hidden border border-black/10 bg-black/10 sm:grid-cols-5">
              {[["AI 가상피팅","완성될 옷을 미리 확인"],["자동 견적","복잡한 제작 비용을 간단하게"],["다양한 원단","원하는 소재를 한곳에서"],["소량 생산","20~100장 제작 지원"],["펀딩 시스템","수요를 먼저 확인하고 생산"]].map(([a,b])=><div key={a} className="bg-[#f8f6f2] p-6 sm:min-h-[170px]"><h3 className="text-lg font-bold">{a}</h3><p className="mt-3 text-sm leading-6 text-stone-500">{b}</p></div>)}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#2a1016] text-white">
          <div className="absolute inset-0 opacity-30"><img src={getAppPath("/brand-er-hero-editorial-v2.webp")} alt="" className="h-full w-full object-cover"/></div><div className="absolute inset-0 bg-[#240d13]/75"/>
          <div className="relative mx-auto flex max-w-[1440px] flex-col items-center px-5 py-24 text-center sm:py-32">
            <p className="text-xs font-bold uppercase tracking-[.25em] text-[#d9a6b1]">YOUR IDEA, YOUR CLOTHES</p><h2 className="mt-5 text-4xl font-extrabold sm:text-6xl">만들고 싶은 옷이 있으신가요?</h2><p className="mt-5 text-white/65">디자인 지식이 없어도, 누구나 시작할 수 있습니다.</p>
            <Link to="/customize" className="mt-8 inline-flex h-14 items-center rounded-full bg-white px-8 text-sm font-bold text-[#241a1b]">지금 제작 시작하기 <ChevronRight className="ml-2 h-4 w-4"/></Link>
          </div>
        </section>
      </main>
    </div>
  );

