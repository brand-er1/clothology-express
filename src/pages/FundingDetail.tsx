import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import { fetchFunding } from "@/services/funding";
import type { Funding } from "@/types/funding";
import { ArrowLeft, CalendarDays, CheckCircle2, Loader2, Package, ShieldCheck } from "lucide-react";

const FundingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [funding, setFunding] = useState<Funding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchFunding(id)
      .then(setFunding)
      .catch((error) => {
        console.error(error);
        toast({ title: "펀딩을 찾을 수 없습니다", description: "승인 전이거나 비공개된 펀딩일 수 있습니다.", variant: "destructive" });
        navigate("/fundings");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading || !funding) {
    return (
      <div className="min-h-screen bg-[#f7f5f2]">
        <Header />
        <div className="flex min-h-screen items-center justify-center text-gray-500">
          <Loader2 className="mr-2 h-6 w-6 animate-spin text-brand" /> 펀딩을 불러오는 중입니다
        </div>
      </div>
    );
  }

  const progress = Math.min(100, Math.round((funding.current_orders / funding.moq) * 100));
  const isPreview = funding.status !== "approved";

  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 pb-24 pt-24">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/fundings" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900">
            <ArrowLeft className="mr-1 h-4 w-4" /> 펀딩 목록
          </Link>
          {isPreview && (
            <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">작성자 미리보기 · 승인 전 비공개</Badge>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="overflow-hidden rounded-[2rem] border bg-white">
            <div className="aspect-square bg-stone-100 p-6 md:p-10">
              <img src={funding.image_url} alt={funding.product_name} className="h-full w-full object-contain" />
            </div>
          </div>

          <div className="flex flex-col rounded-[2rem] border bg-white p-6 md:p-10">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">BRAND-ER PRE-ORDER</p>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-950 md:text-5xl">{funding.product_name}</h1>
            <p className="mt-5 whitespace-pre-wrap text-base leading-7 text-gray-600">
              {funding.description || "AI로 완성한 디자인입니다. 목표 수량을 달성하면 브랜더가 실제 의류로 제작합니다."}
            </p>

            <div className="mt-8 grid grid-cols-2 gap-y-5 rounded-2xl bg-gray-50 p-5 text-sm">
              <div><p className="text-gray-400">상품</p><p className="mt-1 font-semibold">{funding.cloth_type}</p></div>
              <div><p className="text-gray-400">색상</p><p className="mt-1 font-semibold">{funding.color || "미선택"}</p></div>
              <div><p className="text-gray-400">소재</p><p className="mt-1 font-semibold">{funding.material}</p></div>
              <div><p className="text-gray-400">사이즈</p><p className="mt-1 font-semibold">{funding.size}</p></div>
            </div>

            <div className="mt-8">
              <div className="mb-3 flex items-end justify-between">
                <div><strong className="text-3xl text-brand">{progress}%</strong><span className="ml-2 text-sm text-gray-500">달성</span></div>
                <span className="text-sm text-gray-500">{funding.current_orders} / {funding.moq}장</span>
              </div>
              <Progress value={progress} className="h-3" />
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
                <span className="flex items-center"><Package className="mr-1.5 h-4 w-4" /> MOQ {funding.moq}장</span>
                <span className="flex items-center"><CalendarDays className="mr-1.5 h-4 w-4" /> {funding.funding_days}일 진행</span>
              </div>
            </div>

            <div className="mt-auto pt-10">
              <div className="mb-5 flex items-end justify-between border-t pt-6">
                <span className="text-sm text-gray-500">펀딩 판매가</span>
                <strong className="text-2xl">{funding.price ? `${funding.price.toLocaleString("ko-KR")}원` : "가격 준비 중"}</strong>
              </div>
              <Button disabled={isPreview || !funding.price} className="h-14 w-full rounded-full bg-brand text-base hover:bg-brand-dark">
                {isPreview ? "관리자 승인 대기 중" : "펀딩 참여하기"}
              </Button>
              <p className="mt-3 flex items-center justify-center text-xs text-gray-400">
                <ShieldCheck className="mr-1 h-4 w-4" /> 목표 수량 미달 시 제작되지 않습니다.
              </p>
            </div>
          </div>
        </div>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            ["01", "AI 디자인", "아이디어와 키워드로 의류 이미지를 만듭니다."],
            ["02", "수요 검증", `최소 ${funding.moq}장의 선주문이 모이면 제작을 시작합니다.`],
            ["03", "브랜더 생산", "원단 컨택, 패턴, 샘플, 생산과 배송까지 책임집니다."],
          ].map(([number, title, text]) => (
            <div key={number} className="rounded-3xl border bg-white p-6">
              <CheckCircle2 className="mb-6 h-6 w-6 text-brand" />
              <p className="text-xs font-bold text-gray-400">{number}</p>
              <h3 className="mt-2 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500">{text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
};

export default FundingDetail;
