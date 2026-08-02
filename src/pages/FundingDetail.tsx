import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FundingSizeGuide } from "@/components/funding/FundingSizeGuide";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { fetchFunding, getFundingErrorMessage, registerFundingPaymentIntent, startKakaoPayFunding } from "@/services/funding";
import { trackSiteEvent } from "@/lib/site-analytics";
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
  Clock3,
  SquarePen,
  Users,
  WalletCards,
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
  const [paymentError, setPaymentError] = useState("");
  const [intentSubmitting, setIntentSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        // 새 탭에서도 세션을 먼저 복원해야 승인 전 펀딩의 RLS 조회가
        // 작성자/관리자 권한으로 실행됩니다.
        const { data: sessionData } = await supabase.auth.getSession();
        const fundingData = await fetchFunding(id);
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

    if (!currentUserId) {
      toast({ title: "로그인이 필요합니다", description: "로그인 후 펀딩에 참여할 수 있습니다." });
      navigate(`/auth?returnTo=${encodeURIComponent(`/fundings/${id}`)}`);
      return;
    }

    if (!selectedColor || !selectedSize) {
      toast({ title: "컬러와 사이즈를 선택해주세요", variant: "destructive" });
      return;
    }

    setPaymentError("");
    setSubmitting(true);
    try {
      const payment = await startKakaoPayFunding(id, selectedColor, selectedSize, quantity);
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const redirectUrl = isMobile
        ? payment.next_redirect_app_url || payment.next_redirect_mobile_url || payment.next_redirect_pc_url
        : payment.next_redirect_pc_url || payment.next_redirect_mobile_url || payment.next_redirect_app_url;

      if (!redirectUrl) throw new Error("카카오페이 결제창을 열 수 없습니다.");

      void trackSiteEvent("funding_checkout_started", {
        funding_id: id,
        quantity,
      });

      if (window.top && window.top !== window.self) {
        window.top.location.href = redirectUrl;
      } else {
        window.location.assign(redirectUrl);
      }
    } catch (error) {
      console.error(error);
      const message = getFundingErrorMessage(error);

      if (message.includes("전화번호") || message.includes("배송지") || message.includes("마이페이지")) {
        toast({
          title: "연락처와 배송지를 먼저 입력해주세요",
          description: "저장하면 이 펀딩 페이지로 돌아와 결제를 진행할 수 있습니다.",
        });
        navigate(`/profile?returnTo=${encodeURIComponent(`/fundings/${id}`)}`);
        return;
      }

      setPaymentError(message);
      toast({ title: "펀딩 참여에 실패했습니다", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentIntent = async () => {
    if (!funding || !id) return;
    if (!currentUserId) {
      navigate(`/auth?returnTo=${encodeURIComponent(`/fundings/${id}`)}`);
      return;
    }
    if (!selectedColor || !selectedSize) {
      toast({ title: "컬러와 사이즈를 선택해주세요", variant: "destructive" });
      return;
    }

    setIntentSubmitting(true);
    try {
      await registerFundingPaymentIntent(id, selectedColor, selectedSize, quantity);
      toast({
        title: "결제 예정 등록이 완료되었습니다",
        description: "판매자가 샘플을 공유하면 확인 후 결제를 진행해주세요.",
      });
    } catch (error) {
      toast({ title: "결제 예정 등록에 실패했습니다", description: getFundingErrorMessage(error), variant: "destructive" });
    } finally {
      setIntentSubmitting(false);
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
  const loginReturnTo = `/auth?returnTo=${encodeURIComponent(`/fundings/${funding.id}`)}`;

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
              <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">관리자·작성자 미리보기 · 승인 전 비공개</Badge>
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
              {!isPreview && funding.price && !currentUserId ? (
                <Button asChild
                  className="h-14 w-full rounded-full bg-[#FEE500] text-base font-bold text-[#191919] hover:bg-[#f5dc00]">
                  <Link to={loginReturnTo}>
                    <WalletCards className="mr-2 h-5 w-5" /> 로그인하고 결제하기
                  </Link>
                </Button>
              ) : (
                <Button disabled={isPreview || !funding.price || submitting} onClick={handleParticipate}
                  className="h-14 w-full rounded-full bg-[#FEE500] text-base font-bold text-[#191919] hover:bg-[#f5dc00]">
                  {submitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  {!submitting && !isPreview && <WalletCards className="mr-2 h-5 w-5" />}
                  {isPreview ? "관리자 승인 대기 중" : submitting ? "결제창 여는 중" : "결제하기"}
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPreview || !funding.price || intentSubmitting}
                    className="h-14 w-full rounded-full border-brand text-base font-bold text-brand hover:bg-brand/5"
                  >
                    {intentSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Clock3 className="mr-2 h-5 w-5" />}
                    샘플 확인 후 결제 예정
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>결제 예정으로 등록하시겠습니까?</AlertDialogTitle>
                    <AlertDialogDescription className="leading-6">
                      이 제품은 한정판으로 제작됩니다. 준비된 수량이 모두 소진되면 재생산하지 않아,
                      결제 예정으로 등록했더라도 추후 결제가 불가능할 수 있습니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                    선택 옵션: {selectedColor} · {selectedSize} · {quantity}장
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-full">취소</AlertDialogCancel>
                    <AlertDialogAction onClick={handlePaymentIntent} className="rounded-full bg-brand hover:bg-brand-dark">
                      확인하고 등록하기
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {paymentError && (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
                  <p className="font-bold">테스트 결제를 시작하지 못했습니다</p>
                  <p className="mt-1 break-words">{paymentError}</p>
                </div>
              )}
              <p className="text-center text-xs font-medium text-amber-700">
                현재 모의결제 모드이며 실제 금액은 청구되지 않습니다.
              </p>
              <p className="flex items-center justify-center text-xs text-gray-400">
                <ShieldCheck className="mr-1 h-4 w-4" /> 결제 완료 수량만 반영되며, 내 펀딩에서 결제 취소·환불할 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        {(funding.sample_image_url || funding.sample_note) && (
          <section className="mt-10 overflow-hidden rounded-[2rem] border border-brand/20 bg-white p-6 md:p-10">
            <div className="grid items-center gap-8 md:grid-cols-[0.8fr_1.2fr]">
              {funding.sample_image_url && (
                <div className="overflow-hidden rounded-3xl bg-stone-100">
                  <img src={funding.sample_image_url} alt={`${funding.product_name} 제작 샘플`} className="aspect-square h-full w-full object-cover" />
                </div>
              )}
              <div>
                <Badge className="bg-brand/10 text-brand hover:bg-brand/10">판매자 샘플 공유</Badge>
                <h2 className="mt-4 text-2xl font-bold md:text-3xl">실제 제작 샘플을 확인하세요</h2>
                <p className="mt-4 whitespace-pre-wrap leading-7 text-gray-600">
                  {funding.sample_note || "판매자가 실제 제작된 샘플 이미지를 공유했습니다."}
                </p>
                {funding.sample_shared_at && (
                  <p className="mt-5 text-xs text-gray-400">공유일 {new Date(funding.sample_shared_at).toLocaleDateString("ko-KR")}</p>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="mt-10 rounded-[2rem] border bg-white p-6 md:p-10">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">PRODUCT STORY</p>
          <h2 className="mt-3 text-2xl font-bold md:text-3xl">상품 상세 설명</h2>
          <div className="mt-6 whitespace-pre-wrap text-base leading-8 text-gray-600">
            {funding.description || "등록된 상세 설명이 없습니다."}
          </div>
        </section>

        <div className="mt-10">
          <FundingSizeGuide
            measurements={funding.measurements}
            sizeOptions={sizeOptions}
          />
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
