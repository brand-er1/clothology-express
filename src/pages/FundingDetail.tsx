import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { fetchFunding, participateInFunding } from "@/services/funding";
import type { Funding } from "@/types/funding";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  SquarePen,
  Users,
} from "lucide-react";

const FundingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [funding, setFunding] = useState<Funding | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        const [{ data: sessionData }, fundingData] = await Promise.all([
          supabase.auth.getSession(),
          fetchFunding(id),
        ]);
        setCurrentUserId(sessionData.session?.user.id || null);
        setFunding(fundingData);

        const colors = fundingData.color_options?.length
          ? fundingData.color_options
          : [fundingData.color || "기본 색상"];
        const sizes = fundingData.size_options?.length
          ? fundingData.size_options
          : [fundingData.size || "FREE"];
        setSelectedColor(colors[0]);
        setSelectedSize(sizes[0]);
      } catch (error) {
        console.error(error);
        toast({
          title: "펀딩을 찾을 수 없습니다",
          description: "승인 전이거나 비공개된 펀딩일 수 있습니다.",
          variant: "destructive",
        });
        navigate("/fundings");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, navigate]);

  const colorOptions = useMemo(() => {
    if (!funding) return [];
    return funding.color_options?.length ? funding.color_options : [funding.color || "기본 색상"];
  }, [funding]);

  const sizeOptions = useMemo(() => {
    if (!funding) return [];
    return funding.size_options?.length ? funding.size_options : [funding.size || "FREE"];
  }, [funding]);

  const handleParticipate = async () => {
    if (!funding || !id) return;

    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      toast({ title: "로그인이 필요합니다", description: "로그인 후 펀딩에 참여할 수 있습니다." });
      navigate(`/auth?returnTo=${encodeURIComponent(`/fundings/${id}`)}`);
      return;
    }

    if (!selectedColor || !selectedSize) {
      toast({ title: "컬러와 사이즈를 선택해주세요", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await participateInFunding(id, selectedColor, selectedSize, quantity);
      setFunding({ ...funding, current_orders: funding.current_orders + quantity });
      toast({
        title: "펀딩 참여가 완료되었습니다",
        description: `${selectedColor} · ${selectedSize} · ${quantity}장으로 참여했습니다.`,
      });
      setQuantity(1);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.";
      toast({ title: "펀딩 참여에 실패했습니다", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

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
  const isCreator = currentUserId === funding.creator_id;
  const totalPrice = (funding.price || 0) * quantity;

  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 pb-24 pt-24">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link to="/fundings" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900">
            <ArrowLeft className="mr-1 h-4 w-4" /> 펀딩 목록
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {isPreview && (
              <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">작성자 미리보기 · 승인 전 비공개</Badge>
            )}
            {isCreator && (
              <>
                <Button asChild variant="outline" size="sm" className="rounded-full bg-white">
                  <Link to={`/fundings/${funding.id}/edit`}><SquarePen className="mr-1.5 h-4 w-4" /> 페이지 수정</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="rounded-full bg-white">
                  <Link to={`/fundings/${funding.id}/manage`}><Users className="mr-1.5 h-4 w-4" /> 참여자 관리</Link>
                </Button>
              </>
            )}
          </div>
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
            <p className="mt-5 line-clamp-4 whitespace-pre-wrap text-base leading-7 text-gray-600">
              {funding.description || "AI로 완성한 디자인입니다. 목표 수량을 달성하면 브랜더가 실제 의류로 제작합니다."}
            </p>

            <div className="mt-7 grid grid-cols-2 gap-y-5 rounded-2xl bg-gray-50 p-5 text-sm">
              <div><p className="text-gray-400">상품</p><p className="mt-1 font-semibold">{funding.cloth_type}</p></div>
              <div><p className="text-gray-400">소재</p><p className="mt-1 font-semibold">{funding.material}</p></div>
              <div><p className="text-gray-400">컬러</p><p className="mt-1 font-semibold">{colorOptions.length}종</p></div>
              <div><p className="text-gray-400">사이즈</p><p className="mt-1 font-semibold">{sizeOptions.length}종</p></div>
            </div>

            <div className="mt-7">
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

            <div className="mt-8 space-y-5 border-t pt-7">
              <div>
                <p className="mb-3 text-sm font-semibold">컬러 선택</p>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <Button key={color} type="button" size="sm" variant={selectedColor === color ? "default" : "outline"}
                      onClick={() => setSelectedColor(color)} className={selectedColor === color ? "bg-brand hover:bg-brand-dark" : ""}>
                      {color}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold">사이즈 선택</p>
                <div className="flex flex-wrap gap-2">
                  {sizeOptions.map((size) => (
                    <Button key={size} type="button" size="sm" variant={selectedSize === size ? "default" : "outline"}
                      onClick={() => setSelectedSize(size)} className={selectedSize === size ? "bg-brand hover:bg-brand-dark" : ""}>
                      {size}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">수량</span>
                <div className="flex items-center rounded-full border bg-white">
                  <Button type="button" size="icon" variant="ghost" className="rounded-full" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-10 text-center font-semibold">{quantity}</span>
                  <Button type="button" size="icon" variant="ghost" className="rounded-full" onClick={() => setQuantity(Math.min(99, quantity + 1))}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-end justify-between">
                <span className="text-sm text-gray-500">총 참여 금액</span>
                <strong className="text-2xl">{funding.price ? `${totalPrice.toLocaleString("ko-KR")}원` : "가격 준비 중"}</strong>
              </div>
              <Button disabled={isPreview || !funding.price || submitting} onClick={handleParticipate}
                className="h-14 w-full rounded-full bg-brand text-base hover:bg-brand-dark">
                {submitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                {isPreview ? "관리자 승인 대기 중" : currentUserId ? "선택한 옵션으로 펀딩 참여" : "로그인하고 펀딩 참여"}
              </Button>
              <p className="flex items-center justify-center text-xs text-gray-400">
                <ShieldCheck className="mr-1 h-4 w-4" /> 로그인한 회원만 참여할 수 있으며 목표 미달 시 제작되지 않습니다.
              </p>
            </div>
          </div>
        </div>

        <section className="mt-10 rounded-[2rem] border bg-white p-6 md:p-10">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">PRODUCT STORY</p>
          <h2 className="mt-3 text-2xl font-bold md:text-3xl">상품 상세 설명</h2>
          <div className="mt-6 whitespace-pre-wrap text-base leading-8 text-gray-600">
            {funding.description || "등록된 상세 설명이 없습니다."}
          </div>
        </section>

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
