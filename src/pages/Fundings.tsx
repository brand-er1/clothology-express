import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchApprovedFundings, fetchMyFundings } from "@/services/funding";
import { supabase } from "@/lib/supabase";
import type { Funding, FundingStatus } from "@/types/funding";
import { ArrowRight, Clock3, Loader2, PackageCheck, Sparkles } from "lucide-react";

const statusLabel: Record<FundingStatus, string> = {
  pending: "승인 대기",
  approved: "펀딩 중",
  rejected: "수정 필요",
  closed: "종료",
};

const FundingCards = ({ fundings, isMine = false }: { fundings: Funding[]; isMine?: boolean }) => {
  if (!fundings.length) {
    return (
      <div className="rounded-3xl border border-dashed bg-white py-20 text-center">
        <Sparkles className="mx-auto mb-4 h-10 w-10 text-brand/50" />
        <h3 className="text-lg font-semibold">아직 등록된 펀딩이 없습니다</h3>
        <p className="mt-2 text-sm text-gray-500">AI로 디자인을 만들면 펀딩 페이지까지 자동으로 완성됩니다.</p>
        <Button asChild className="mt-6 bg-brand hover:bg-brand-dark">
          <Link to="/customize">첫 디자인 만들기</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {fundings.map((funding) => {
        const progress = Math.min(100, Math.round((funding.current_orders / funding.moq) * 100));
        return (
          <Link key={funding.id} to={`/fundings/${funding.id}`} className="group">
            <Card className="h-full overflow-hidden rounded-3xl border-gray-200 bg-white transition duration-300 hover:-translate-y-1 hover:shadow-xl">
              <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
                <img
                  src={funding.image_url}
                  alt={funding.product_name}
                  className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.03]"
                />
                {isMine && (
                  <Badge className="absolute left-4 top-4 bg-white text-gray-800 hover:bg-white">
                    {statusLabel[funding.status]}
                  </Badge>
                )}
              </div>
              <CardContent className="p-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                  {funding.cloth_type} · MOQ {funding.moq}장
                </p>
                <h3 className="line-clamp-1 text-xl font-bold text-gray-950">{funding.product_name}</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                  <span className="rounded-full bg-stone-100 px-2.5 py-1">컬러 {funding.color_options?.length || 1}종</span>
                  <span className="rounded-full bg-stone-100 px-2.5 py-1">사이즈 {funding.size_options?.length || 1}종</span>
                </div>
                <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-gray-500">
                  {funding.description || "AI로 만든 디자인을 실제 제품으로 만나보세요."}
                </p>
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-brand">{progress}% 달성</span>
                    <span className="text-gray-500">{funding.current_orders}/{funding.moq}장</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
                <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm">
                  <span className="font-bold text-gray-950">
                    {funding.price ? `${funding.price.toLocaleString("ko-KR")}원` : "가격 준비 중"}
                  </span>
                  <span className="flex items-center text-gray-500">
                    상세보기 <ArrowRight className="ml-1 h-4 w-4" />
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
};

const Fundings = () => {
  const [approved, setApproved] = useState<Funding[]>([]);
  const [mine, setMine] = useState<Funding[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const signedIn = Boolean(data.session?.user);
        setIsAuthenticated(signedIn);
        const [approvedData, myData] = await Promise.all([
          fetchApprovedFundings(),
          signedIn ? fetchMyFundings() : Promise.resolve([]),
        ]);
        setApproved(approvedData);
        setMine(myData);
      } catch (error) {
        console.error("Failed to load fundings:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      <Header />
      <main className="pb-20 pt-16">
        <section className="border-b border-black/5 bg-[#201819] text-white">
          <div className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-3xl">
              <div className="mb-5 flex items-center gap-2 text-sm font-medium text-white/70">
                <PackageCheck className="h-4 w-4" />
                수요가 확인된 디자인만 생산합니다
              </div>
              <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
                아이디어가 제품이 되는
                <br />브랜더 펀딩
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-white/65 md:text-lg">
                AI로 만든 디자인에 먼저 주문이 모이면 브랜더가 원단 컨택부터 생산과 배송까지 책임집니다.
              </p>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-12">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-gray-500">
              <Loader2 className="mr-2 h-6 w-6 animate-spin text-brand" /> 펀딩을 불러오는 중입니다
            </div>
          ) : (
            <Tabs defaultValue="open" className="space-y-8">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <TabsList className="h-11 rounded-full bg-white p-1 shadow-sm">
                  <TabsTrigger value="open" className="rounded-full px-5">진행 중인 펀딩</TabsTrigger>
                  {isAuthenticated && (
                    <TabsTrigger value="mine" className="rounded-full px-5">내가 만든 펀딩</TabsTrigger>
                  )}
                </TabsList>
                <Button asChild className="rounded-full bg-brand hover:bg-brand-dark">
                  <Link to="/customize">AI 디자인으로 펀딩 만들기</Link>
                </Button>
              </div>
              <TabsContent value="open"><FundingCards fundings={approved} /></TabsContent>
              {isAuthenticated && (
                <TabsContent value="mine">
                  <div className="mb-5 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <Clock3 className="h-4 w-4 shrink-0" /> 승인 대기 중인 펀딩은 작성자와 관리자에게만 보입니다.
                  </div>
                  <FundingCards fundings={mine} isMine />
                </TabsContent>
              )}
            </Tabs>
          )}
        </section>
      </main>
    </div>
  );
};

export default Fundings;
