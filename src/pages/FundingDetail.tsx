import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FundingSizeGuide } from "@/components/funding/FundingSizeGuide";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import {
  fetchFunding,
  getFundingErrorMessage,
  registerFundingPaymentIntent,
  startKakaoPayFunding,
} from "@/services/funding";
import { trackSiteEvent } from "@/lib/site-analytics";
import type { Funding } from "@/types/funding";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Loader2,
  Minus,
  PackageCheck,
  Plus,
  Scissors,
  ShieldCheck,
  SquarePen,
  Truck,
  Users,
  WalletCards,
} from "lucide-react";

const getCustomerDescription = (funding: Funding) => {
  const description = funding.description?.trim();
  if (description && !description.includes("디자인 특징:") && !description.includes("목표 인원이")) {
    return description;
  }

  const colors = funding.color_options?.length
    ? funding.color_options.join(", ")
    : funding.color || "시그니처";
  const colorCopy = colors === "기본 색상" ? "베이직 컬러" : `${colors} 컬러`;
  return `${funding.material} 소재와 ${colorCopy}로 완성한 ${funding.cloth_type}입니다. 선택받은 수량만큼 제작하는 BRAND-ER 리미티드 컬렉션으로 만나보세요.`;
};

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
          title: "상품을 찾을 수 없습니다",
          description: "판매 준비 중이거나 비공개된 컬렉션일 수 있습니다.",
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
      toast({ title: "로그인이 필요합니다", description: "로그인 후 상품을 주문할 수 있습니다." });
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

      void trackSiteEvent("funding_checkout_started", { funding_id: id, quantity });

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
          description: "저장하면 이 상품 페이지로 돌아와 결제를 진행할 수 있습니다.",
        });
        navigate(`/profile?returnTo=${encodeURIComponent(`/fundings/${id}`)}`);
        return;
      }

      setPaymentError(message);
      toast({ title: "주문을 시작하지 못했습니다", description: message, variant: "destructive" });
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
        title: "구매 예약이 완료되었습니다",
        description: "판매자가 샘플을 공유하면 확인 후 결제를 진행해주세요.",
      });
    } catch (error) {
      toast({ title: "구매 예약에 실패했습니다", description: getFundingErrorMessage(error), variant: "destructive" });
    } finally {
      setIntentSubmitting(false);
    }
  };

  if (loading || !funding) {
    return (
      <div className="min-h-screen bg-[#f3f1ed]">
        <Header />
        <div className="flex min-h-screen items-center justify-center text-sm text-stone-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-brand" /> 상품을 준비하고 있습니다
        </div>
      </div>
    );
  }

  const progress = Math.min(100, Math.round((funding.current_orders / funding.moq) * 100));
  const remaining = Math.max(0, funding.moq - funding.current_orders);
  const isPreview = funding.status !== "approved";
  const isCreator = currentUserId === funding.creator_id;
  const totalPrice = (funding.price || 0) * quantity;
  const loginReturnTo = `/auth?returnTo=${encodeURIComponent(`/fundings/${funding.id}`)}`;
  const customerDescription = getCustomerDescription(funding);

  const purchaseButton = !isPreview && funding.price && !currentUserId ? (
    <Button asChild className="h-14 w-full rounded-none bg-brand text-base font-bold text-white hover:bg-brand-dark">
      <Link to={loginReturnTo}>
        <WalletCards className="mr-2 h-5 w-5" /> 로그인하고 주문하기
      </Link>
    </Button>
  ) : (
    <Button
      disabled={isPreview || !funding.price || submitting}
      onClick={handleParticipate}
      className="h-14 w-full rounded-none bg-brand text-base font-bold text-white hover:bg-brand-dark"
    >
      {submitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
      {!submitting && !isPreview && <WalletCards className="mr-2 h-5 w-5" />}
      {isPreview ? "판매 승인 대기 중" : submitting ? "결제창 여는 중" : "이 상품 선주문하기"}
    </Button>
  );

  return (
    <div className="min-h-screen bg-[#f3f1ed] text-[#211b1c]">
      <Header />
      <main className="mx-auto max-w-[1440px] px-4 pb-32 pt-24 sm:px-8 lg:px-12 lg:pb-24 xl:px-16">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-5">
          <Link to="/fundings" className="inline-flex items-center text-xs font-bold uppercase tracking-[0.14em] text-stone-500 transition hover:text-brand">
            <ArrowLeft className="mr-2 h-4 w-4" /> Shop / {funding.cloth_type}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {isPreview && (
              <Badge className="rounded-none bg-amber-100 text-amber-900 hover:bg-amber-100">작성자 미리보기 · 판매 전</Badge>
            )}
            {isCreator && (
              <>
                <Button asChild variant="outline" size="sm" className="rounded-none bg-transparent">
                  <Link to={`/fundings/${funding.id}/edit`}><SquarePen className="mr-1.5 h-4 w-4" /> 상품 수정</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="rounded-none bg-transparent">
                  <Link to={`/fundings/${funding.id}/manage`}><Users className="mr-1.5 h-4 w-4" /> 주문 관리</Link>
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)] lg:gap-12 xl:gap-16">
          <section className="overflow-hidden bg-[#e7e4df]">
            <div className="relative aspect-[4/5] sm:aspect-square lg:aspect-[4/5]">
              <img src={funding.image_url} alt={funding.product_name} className="h-full w-full object-contain p-5 sm:p-10 lg:p-12" />
              <span className="absolute left-4 top-4 bg-[#f3f1ed]/90 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand backdrop-blur-sm sm:left-6 sm:top-6">
                Limited pre-order
              </span>
            </div>
          </section>

          <aside className="lg:sticky lg:top-28" data-mascot-safezone>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">BRAND-ER / {funding.cloth_type}</p>
            <h1 className="mt-4 font-serif text-4xl font-normal leading-[1.02] tracking-[-0.045em] sm:text-5xl xl:text-6xl">
              {funding.product_name}
            </h1>
            <p className="mt-5 text-sm leading-7 text-stone-600">{customerDescription}</p>
            <p className="mt-7 text-2xl font-bold tracking-tight">
              {funding.price ? `${funding.price.toLocaleString("ko-KR")}원` : "가격 준비 중"}
            </p>

            <div className="mt-8 border-y border-black/10 py-5">
              <div className="flex items-start justify-between gap-4 text-sm">
                <div>
                  <p className="font-bold text-[#211b1c]">
                    {remaining > 0 ? `제작 확정까지 ${remaining}장의 주문이 더 필요해요` : "제작이 확정된 컬렉션입니다"}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">선택받은 수량만큼 제작하는 리미티드 오더</p>
                </div>
                <span className="shrink-0 text-xs font-bold text-brand">{funding.current_orders}/{funding.moq}</span>
              </div>
              <div className="mt-4 h-1 overflow-hidden bg-black/10">
                <div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="mt-7 space-y-6">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-bold">COLOR</p>
                  <span className="text-xs text-stone-500">{selectedColor}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {colorOptions.map((color) => (
                    <Button
                      key={color}
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedColor(color)}
                      className={`h-11 rounded-none ${selectedColor === color ? "border-brand bg-brand/5 text-brand" : "border-black/15 bg-transparent text-stone-600 hover:bg-black/5"}`}
                    >
                      {color}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-bold">SIZE</p>
                  <a href="#size-guide" className="text-xs text-stone-500 underline underline-offset-4 hover:text-brand">사이즈 가이드</a>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {sizeOptions.map((size) => (
                    <Button
                      key={size}
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedSize(size)}
                      className={`h-11 rounded-none ${selectedSize === size ? "border-brand bg-brand/5 text-brand" : "border-black/15 bg-transparent text-stone-600 hover:bg-black/5"}`}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border-y border-black/10 py-4">
                <span className="text-sm font-bold">QUANTITY</span>
                <div className="flex items-center border border-black/15 bg-white/40">
                  <Button type="button" size="icon" variant="ghost" className="h-10 w-10 rounded-none" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="수량 줄이기">
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-10 text-center text-sm font-bold">{quantity}</span>
                  <Button type="button" size="icon" variant="ghost" className="h-10 w-10 rounded-none" onClick={() => setQuantity(Math.min(99, quantity + 1))} aria-label="수량 늘리기">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-end justify-between">
                <span className="text-sm text-stone-500">총 주문 금액</span>
                <strong className="text-2xl">{funding.price ? `${totalPrice.toLocaleString("ko-KR")}원` : "가격 준비 중"}</strong>
              </div>

              {purchaseButton}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPreview || !funding.price || intentSubmitting}
                    className="h-12 w-full rounded-none border-black/20 bg-transparent text-sm font-bold text-[#211b1c] hover:bg-black/5"
                  >
                    {intentSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock3 className="mr-2 h-4 w-4" />}
                    샘플 확인 후 구매 예약
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-none border-black/10 bg-[#f3f1ed]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>구매 예약을 등록할까요?</AlertDialogTitle>
                    <AlertDialogDescription className="leading-6">
                      이 제품은 주문 수량만큼만 한정 제작됩니다. 준비된 수량이 모두 소진되면 재생산하지 않아,
                      구매 예약 후에도 결제가 불가능할 수 있습니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="border border-black/10 bg-white/50 px-4 py-3 text-sm font-medium">
                    선택 옵션: {selectedColor} · {selectedSize} · {quantity}장
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-none">취소</AlertDialogCancel>
                    <AlertDialogAction onClick={handlePaymentIntent} className="rounded-none bg-brand hover:bg-brand-dark">
                      확인하고 예약하기
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {paymentError && (
                <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
                  <p className="font-bold">테스트 결제를 시작하지 못했습니다</p>
                  <p className="mt-1 break-words">{paymentError}</p>
                </div>
              )}
              <p className="text-center text-[11px] font-medium text-amber-700">현재 모의결제 모드이며 실제 금액은 청구되지 않습니다.</p>
              <p className="flex items-center justify-center text-[11px] text-stone-400">
                <ShieldCheck className="mr-1 h-3.5 w-3.5" /> 결제 완료 수량만 반영되며 주문 내역에서 취소·환불할 수 있습니다.
              </p>
            </div>
          </aside>
        </div>

        <section className="mt-16 grid border-y border-black/10 sm:grid-cols-3">
          {[
            [Scissors, "국내 제작", "원단 컨택부터 봉제까지 브랜더가 관리"],
            [PackageCheck, "샘플 검수", "본생산 전 핏과 완성도를 먼저 확인"],
            [Truck, "안전한 배송", "생산 완료 후 검수와 포장을 거쳐 발송"],
          ].map(([Icon, title, text], index) => {
            const FeatureIcon = Icon as typeof Scissors;
            return (
              <div key={title as string} className={`flex gap-4 px-5 py-7 sm:px-7 ${index > 0 ? "border-t border-black/10 sm:border-l sm:border-t-0" : ""}`}>
                <FeatureIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <div>
                  <p className="text-sm font-bold">{title as string}</p>
                  <p className="mt-1 text-xs leading-5 text-stone-500">{text as string}</p>
                </div>
              </div>
            );
          })}
        </section>

        {(funding.sample_image_url || funding.sample_note) && (
          <section className="mt-16 grid overflow-hidden bg-[#e7e4df] md:grid-cols-2">
            {funding.sample_image_url && (
              <div className="overflow-hidden">
                <img src={funding.sample_image_url} alt={`${funding.product_name} 제작 샘플`} className="aspect-[4/3] h-full w-full object-cover" />
              </div>
            )}
            <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Sample archive</p>
              <h2 className="mt-4 font-serif text-3xl font-normal sm:text-4xl">실제 제작 샘플</h2>
              <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-stone-600">
                {funding.sample_note || "판매자가 실제 제작된 샘플 이미지를 공유했습니다."}
              </p>
              {funding.sample_shared_at && (
                <p className="mt-6 text-xs text-stone-400">공유일 {new Date(funding.sample_shared_at).toLocaleDateString("ko-KR")}</p>
              )}
            </div>
          </section>
        )}

        <section className="mt-20 grid gap-8 border-t border-black/10 pt-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">Product story</p>
            <h2 className="mt-4 font-serif text-4xl font-normal tracking-[-0.035em] sm:text-5xl">옷에 담긴 이야기</h2>
          </div>
          <div>
            <p className="whitespace-pre-wrap text-base leading-8 text-stone-600 sm:text-lg sm:leading-9">{customerDescription}</p>
            <dl className="mt-9 border-t border-black/10 text-sm">
              {[
                ["CATEGORY", funding.cloth_type],
                ["MATERIAL", funding.material],
                ["COLOR", colorOptions.join(", ")],
                ["ORDER WINDOW", `${funding.funding_days}일`],
              ].map(([term, value]) => (
                <div key={term} className="grid grid-cols-[9rem_1fr] border-b border-black/10 py-4">
                  <dt className="text-xs font-bold tracking-[0.12em] text-stone-400">{term}</dt>
                  <dd className="font-semibold text-[#211b1c]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <div id="size-guide" className="mt-16 scroll-mt-24">
          <FundingSizeGuide measurements={funding.measurements} sizeOptions={sizeOptions} />
        </div>

        <section className="mt-20 border-t border-black/10 pt-10">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">How it is made</p>
          <h2 className="mt-4 font-serif text-4xl font-normal tracking-[-0.035em]">선택이 옷이 되는 과정</h2>
          <div className="mt-9 grid gap-px overflow-hidden bg-black/10 md:grid-cols-3">
            {[
              ["01", "선주문", `최소 ${funding.moq}장의 주문이 모이면 제작을 확정합니다.`],
              ["02", "샘플 검수", "원단과 핏, 봉제 완성도를 본생산 전에 확인합니다."],
              ["03", "생산과 배송", "필요한 수량만 생산한 뒤 검수·포장해 보내드립니다."],
            ].map(([number, title, text]) => (
              <div key={number} className="bg-[#f3f1ed] p-7 sm:p-9">
                <CheckCircle2 className="mb-12 h-5 w-5 text-brand" />
                <p className="text-xs font-bold tracking-[0.16em] text-stone-400">{number}</p>
                <h3 className="mt-3 text-lg font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-stone-500">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-[#f3f1ed]/95 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-24">
            <p className="text-[10px] text-stone-400">TOTAL</p>
            <p className="text-sm font-bold">{funding.price ? `${totalPrice.toLocaleString("ko-KR")}원` : "준비 중"}</p>
          </div>
          <div className="flex-1">{purchaseButton}</div>
        </div>
      </div>
    </div>
  );
};

export default FundingDetail;
