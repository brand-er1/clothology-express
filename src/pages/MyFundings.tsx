import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { useMascotPageContext } from "@/components/guide/MascotContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressLine } from "@/components/funding/FundingProductCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  cancelFundingParticipation,
  deleteFunding,
  fetchMyFundingPaymentIntents,
  fetchMyFundingParticipations,
  fetchMyFundings,
  fetchSellerFundingDashboard,
  fetchSellerDashboardTotals,
} from "@/services/funding";
import type {
  Funding, FundingPaymentStatus, MyFundingParticipation, MyFundingPaymentIntent,
  SellerFundingDashboardRow, SellerDashboardTotals,
} from "@/types/funding";
import { PRODUCTION_STAGE_LABEL } from "@/types/funding";
import {
  ArrowRight, CalendarDays, Clock3, Loader2, PackageOpen, RotateCcw, Settings2,
  ShoppingBag, SquarePen, Trash2, TrendingUp, Truck, Users, WalletCards,
} from "lucide-react";

const EMPTY_SELLER_TOTALS: SellerDashboardTotals = {
  total_expected_revenue: 0,
  total_participants: 0,
  total_quantity: 0,
  avg_funding_rate: 0,
};

const paymentLabel: Record<FundingPaymentStatus, string> = {
  unpaid: "참여 접수",
  ready: "결제 진행 중",
  paid: "결제 완료",
  cancelled: "결제 취소",
  failed: "결제 실패",
};

const paymentBadgeClass: Record<FundingPaymentStatus, string> = {
  unpaid: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  ready: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  paid: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  cancelled: "bg-gray-100 text-stone-500 hover:bg-gray-100",
  failed: "bg-red-100 text-red-700 hover:bg-red-100",
};

const fundingStatusLabel: Record<Funding["status"], string> = {
  draft: "준비 중",
  pending: "승인 대기",
  approved: "펀딩 진행 중",
  rejected: "수정 필요",
  closed: "펀딩 종료",
};

type ParticipationFilter = "all" | "paid" | "planned";
type CreatedFundingFilter = "all" | "preparing" | "pending" | "approved" | "closed";

const MyFundings = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "joined" ? "joined" : "created";
  const [createdFundings, setCreatedFundings] = useState<Funding[]>([]);
  const [sellerDashboard, setSellerDashboard] = useState<Map<string, SellerFundingDashboardRow>>(new Map());
  const [sellerTotals, setSellerTotals] = useState<SellerDashboardTotals>(EMPTY_SELLER_TOTALS);
  const [paidItems, setPaidItems] = useState<MyFundingParticipation[]>([]);
  const [plannedItems, setPlannedItems] = useState<MyFundingPaymentIntent[]>([]);
  const [participationFilter, setParticipationFilter] = useState<ParticipationFilter>("all");
  const [createdFilter, setCreatedFilter] = useState<CreatedFundingFilter>("all");
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MyFundingParticipation | null>(null);
  const [deletingFundingId, setDeletingFundingId] = useState<string | null>(null);
  const [fundingToDelete, setFundingToDelete] = useState<Funding | null>(null);
  const [fundingDeleteReason, setFundingDeleteReason] = useState("");

  const load = useCallback(async () => {
    try {
      const [created, participated, planned, dashboardRows, totals] = await Promise.all([
        fetchMyFundings(),
        fetchMyFundingParticipations(),
        fetchMyFundingPaymentIntents(),
        fetchSellerFundingDashboard(),
        fetchSellerDashboardTotals(),
      ]);
      setCreatedFundings(created);
      setPaidItems(participated);
      setPlannedItems(planned);
      setSellerDashboard(new Map(dashboardRows.map((row) => [row.funding_id, row])));
      setSellerTotals(totals);
    } catch (error) {
      console.error(error);
      toast({ title: "내 펀딩 내역을 불러오지 못했습니다", description: "잠시 후 다시 시도해주세요.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activePaidItems = useMemo(
    () => paidItems.filter((item) => item.payment_status !== "ready"),
    [paidItems],
  );

  useMascotPageContext({
    page: "my-fundings",
    myFundingsSummary: loading
      ? undefined
      : {
          plannedCount: plannedItems.length,
          needsRevisionCount: createdFundings.filter((funding) => funding.status === "rejected").length,
        },
  });
  const paidAmount = activePaidItems
    .filter((item) => item.payment_status === "paid" && item.status !== "cancelled")
    .reduce((sum, item) => sum + item.total_amount, 0);
  const plannedAmount = plannedItems.reduce((sum, item) => sum + item.total_amount, 0);
  const visibleCreatedFundings = createdFundings.filter((funding) => {
    if (createdFilter === "all") return true;
    if (createdFilter === "preparing") return funding.status === "draft" || funding.status === "rejected";
    return funding.status === createdFilter;
  });

  const cancelParticipation = async () => {
    if (!selectedItem) return;
    setCancellingId(selectedItem.id);
    try {
      const result = await cancelFundingParticipation(selectedItem.id);
      setPaidItems((current) => current.map((item) => item.id === selectedItem.id
        ? { ...item, status: "cancelled", payment_status: "cancelled", payment_cancelled_at: new Date().toISOString() }
        : item));
      const isMock = selectedItem.payment_type === "MOCK";
      toast({
        title: result.refunded ? "펀딩 취소가 완료되었습니다" : "펀딩 참여를 취소했습니다",
        description: result.refunded
          ? isMock
            ? "모의결제 참여가 취소되었습니다. 실제 환불은 발생하지 않습니다."
            : "카카오페이 결제 금액이 전액 취소되었습니다."
          : "취소된 수량은 펀딩 달성 수량에서 제외됩니다.",
      });
    } catch (error) {
      toast({ title: "펀딩을 취소하지 못했습니다", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setCancellingId(null);
      setSelectedItem(null);
    }
  };

  const removeFunding = async () => {
    if (!fundingToDelete) return;
    const reason = fundingDeleteReason.trim();
    if (reason.length < 2) return;

    setDeletingFundingId(fundingToDelete.id);
    try {
      const result = await deleteFunding(fundingToDelete.id, reason);
      setCreatedFundings((current) => current.filter((funding) => funding.id !== fundingToDelete.id));
      toast({
        title: "펀딩을 삭제했습니다",
        description: result.warnings?.length
          ? "관련 회원에게 사이트 알림을 보냈습니다. 펀딩은 삭제됐지만 일부 이미지 정리가 완료되지 않았습니다."
          : "관련 회원에게 사이트 알림을 보내고 펀딩과 전용 이미지를 삭제했습니다.",
      });
    } catch (error) {
      toast({
        title: "펀딩을 삭제하지 못했습니다",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setDeletingFundingId(null);
      setFundingToDelete(null);
      setFundingDeleteReason("");
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#f6f3ee]"><Header /><div className="flex min-h-screen items-center justify-center text-stone-500">
      <Loader2 className="mr-2 h-6 w-6 animate-spin text-brand" /> 내 펀딩을 불러오는 중입니다
    </div></div>
  );

  return (
    <div className="min-h-screen bg-[#f6f3ee]">
      <Header />
      <main className="page-shell max-w-[1280px] pb-16 pt-20 sm:pt-28 md:pb-24">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="eyebrow">My funding</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] md:text-5xl">내 펀딩</h1>
            <p className="mt-3 text-stone-500">내가 만든 펀딩과 참여한 펀딩을 한곳에서 확인하세요.</p>
          </div>
          <Link to="/fundings" className="cta-text self-start md:self-auto"><span className="link-draw">새 펀딩 둘러보기</span> <ArrowRight className="h-4 w-4" /></Link>
        </div>

        <Tabs defaultValue={initialTab} className="mt-10">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-none border-b border-black/10 bg-transparent p-0 md:flex md:justify-start md:gap-8">
            <TabsTrigger
              value="created"
              className="-mb-px min-h-12 whitespace-normal rounded-none border-b-2 border-transparent px-0 py-3 text-sm font-medium text-stone-500 data-[state=active]:border-brand data-[state=active]:bg-transparent data-[state=active]:text-[#211b1c] data-[state=active]:shadow-none sm:text-base"
              data-tutorial="myf-created-tab"
            >
              내가 만든 펀딩 <sup className="ml-1 font-display text-[10px] text-brand">{createdFundings.length}</sup>
            </TabsTrigger>
            <TabsTrigger
              value="joined"
              className="-mb-px min-h-12 whitespace-normal rounded-none border-b-2 border-transparent px-0 py-3 text-sm font-medium text-stone-500 data-[state=active]:border-brand data-[state=active]:bg-transparent data-[state=active]:text-[#211b1c] data-[state=active]:shadow-none sm:text-base"
              data-tutorial="myf-joined-tab"
            >
              내가 참여한 펀딩 <sup className="ml-1 font-display text-[10px] text-brand">{activePaidItems.length + plannedItems.length}</sup>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="created" className="mt-10">
            {createdFundings.length > 0 && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-8 xl:grid-cols-4">
                <SummaryCard icon={WalletCards} label="총 예상매출" value={`${sellerTotals.total_expected_revenue.toLocaleString("ko-KR")}원`} />
                <SummaryCard icon={Users} label="총 참여자 수" value={`${sellerTotals.total_participants.toLocaleString("ko-KR")}명`} />
                <SummaryCard icon={ShoppingBag} label="총 판매수량" value={`${sellerTotals.total_quantity.toLocaleString("ko-KR")}장`} />
                <SummaryCard icon={TrendingUp} label="평균 펀딩 달성률" value={`${sellerTotals.avg_funding_rate}%`} />
              </div>
            )}
            {createdFundings.length > 0 && (
              <div className="mt-12 flex max-w-full gap-6 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {([
                  ["all", "전체"],
                  ["preparing", "준비 중"],
                  ["pending", "승인 대기"],
                  ["approved", "진행 중"],
                  ["closed", "종료"],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={createdFilter === value}
                    onClick={() => setCreatedFilter(value)} className={`min-h-10 shrink-0 border-b px-0.5 text-sm transition-colors duration-300 ${createdFilter === value ? "border-brand font-semibold text-[#211b1c]" : "border-transparent text-stone-500 hover:text-[#211b1c]"}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {createdFundings.length === 0 ? (
              <EmptyState title="아직 만든 펀딩이 없습니다" description="나만의 디자인으로 첫 펀딩을 만들어보세요." action="컬렉션 시작하기" to="/customize" />
            ) : (
              <div className="mt-8 grid gap-x-8 gap-y-14 md:grid-cols-2">
                {visibleCreatedFundings.map((funding) => {
                  const progress = Math.min(100, Math.round((funding.current_orders / funding.moq) * 100));
                  const dashboardRow = sellerDashboard.get(funding.id);
                  return (
                    <article key={funding.id} className="min-w-0">
                      <Link to={`/fundings/${funding.id}`} className="group block aspect-[16/10] overflow-hidden bg-[#ebe7e1] p-6">
                        <img src={funding.image_url} alt={funding.product_name} className="img-zoom h-full w-full object-contain mix-blend-multiply" />
                      </Link>
                      <div className="pt-5">
                        <div className="flex items-center justify-between gap-3"><Badge variant="secondary">{fundingStatusLabel[funding.status]}</Badge><span className="font-display text-xs text-stone-400">{new Date(funding.created_at).toLocaleDateString("ko-KR")}</span></div>
                        <Link to={`/fundings/${funding.id}`} className="text-wrap-anywhere mt-3 block text-xl font-semibold tracking-[-0.02em] transition-colors hover:text-brand">{funding.product_name}</Link>
                        <ProgressLine current={funding.current_orders} target={funding.moq} size="md" className="mt-5" caption={`${funding.current_orders} / ${funding.moq}장 · 달성 ${progress}%`} />
                        {dashboardRow && (
                          <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-black/10 py-3 text-xs [&>div]:min-w-0 [&_dd]:text-wrap-anywhere">
                            <div><dt className="text-stone-400">참여자</dt><dd className="mt-0.5 font-display text-sm font-semibold text-stone-900">{dashboardRow.participant_count}명</dd></div>
                            <div><dt className="text-stone-400">예상매출</dt><dd className="mt-0.5 font-display text-sm font-semibold text-stone-900">{dashboardRow.expected_revenue.toLocaleString("ko-KR")}원</dd></div>
                            <div><dt className="text-stone-400">종료일</dt><dd className="mt-0.5 font-display text-sm font-semibold text-stone-900">{dashboardRow.end_date ? new Date(dashboardRow.end_date).toLocaleDateString("ko-KR") : "미정"}</dd></div>
                          </dl>
                        )}
                        <div className="mt-5 grid grid-cols-2 gap-2">
                          <Button asChild variant="outline"><Link to={`/fundings/${funding.id}/edit`}><SquarePen className="mr-2 h-4 w-4" />정보 수정</Link></Button>
                          <Button asChild className="bg-brand hover:bg-brand-dark"><Link to={`/fundings/${funding.id}/manage`}><Settings2 className="mr-2 h-4 w-4" />참여자 관리</Link></Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="col-span-2 text-red-700 hover:bg-red-50 hover:text-red-800"
                            disabled={deletingFundingId === funding.id}
                            onClick={() => {
                              setFundingToDelete(funding);
                              setFundingDeleteReason("");
                            }}
                          >
                            {deletingFundingId === funding.id
                              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              : <Trash2 className="mr-2 h-4 w-4" />}
                            펀딩 삭제
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {visibleCreatedFundings.length === 0 && (
                  <div className="col-span-full border-t border-black/10 py-14 text-sm text-stone-500">해당 상태의 펀딩이 없습니다.</div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="joined" className="mt-10">
            <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
              <SummaryCard icon={ShoppingBag} label="결제 완료" value={`${activePaidItems.filter((item) => item.payment_status === "paid").length}건`} />
              <SummaryCard icon={WalletCards} label="결제 금액" value={`${paidAmount.toLocaleString("ko-KR")}원`} />
              <SummaryCard icon={Clock3} label="결제 예정" value={`${plannedItems.length}건 · ${plannedAmount.toLocaleString("ko-KR")}원`} />
            </div>
            <div className="mt-12 flex flex-wrap gap-6">
              {([['all', '전체'], ['paid', '결제 내역'], ['planned', '결제 예정']] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={participationFilter === value}
                  onClick={() => setParticipationFilter(value)} className={`min-h-10 border-b px-0.5 text-sm transition-colors duration-300 ${participationFilter === value ? "border-brand font-semibold text-[#211b1c]" : "border-transparent text-stone-500 hover:text-[#211b1c]"}`}>{label}</button>
              ))}
            </div>

            {activePaidItems.length + plannedItems.length === 0 ? (
              <EmptyState title="아직 참여한 펀딩이 없습니다" description="마음에 드는 디자인을 선택해 첫 펀딩에 참여해보세요." action="펀딩 보러 가기" to="/fundings" />
            ) : (
              <div className="mt-6 border-b border-black/10">
                {participationFilter !== "planned" && activePaidItems.map((item) => (
                  <PaidParticipationCard key={`paid-${item.id}`} item={item} cancelling={cancellingId === item.id} onCancel={() => setSelectedItem(item)} />
                ))}
                {participationFilter !== "paid" && plannedItems.map((item) => <PlannedParticipationCard key={`planned-${item.id}`} item={item} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <AlertDialogContent className="rounded-2xl"><AlertDialogHeader><AlertDialogTitle>펀딩 참여를 취소할까요?</AlertDialogTitle>
          <AlertDialogDescription>{selectedItem?.payment_status === "paid" ? (selectedItem.payment_type === "MOCK" ? `${selectedItem.total_amount.toLocaleString("ko-KR")}원 상당의 모의결제 참여가 취소됩니다. (실제 환불 없음)` : `${selectedItem.total_amount.toLocaleString("ko-KR")}원이 카카오페이로 전액 취소됩니다.`) : "진행 중인 참여 내역이 취소됩니다."}</AlertDialogDescription>
        </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>계속 참여하기</AlertDialogCancel><AlertDialogAction onClick={cancelParticipation} className="bg-red-600 hover:bg-red-700">{selectedItem?.payment_status === "paid" ? "취소 및 환불" : "참여 취소"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!fundingToDelete}
        onOpenChange={(open) => {
          if (!open && !deletingFundingId) setFundingToDelete(null);
          if (!open && !deletingFundingId) setFundingDeleteReason("");
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>이 펀딩을 영구 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block font-medium text-stone-800">{fundingToDelete?.product_name}</span>
              <span className="block">
                펀딩 정보, 결제 예정 내역, 취소된 참여 내역과 전용 샘플 이미지가 함께 삭제되며 복구할 수 없습니다.
                진행 중인 결제나 참여자가 있으면 고객 보호를 위해 삭제가 제한됩니다.
                관련 참여자와 결제 예정자에게는 아래 사유가 포함된 사이트 알림이 발송됩니다.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="funding-delete-reason" className="text-sm font-semibold text-stone-800">
              삭제 사유 <span className="text-red-600">*</span>
            </label>
            <Textarea
              id="funding-delete-reason"
              value={fundingDeleteReason}
              onChange={(event) => setFundingDeleteReason(event.target.value.slice(0, 500))}
              placeholder="관련 회원에게 전달할 삭제 사유를 입력해주세요."
              className="min-h-28 resize-y"
              disabled={!!deletingFundingId}
            />
            <p className="text-right text-xs text-stone-400">{fundingDeleteReason.length}/500</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingFundingId}>펀딩 유지하기</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={!!deletingFundingId || fundingDeleteReason.trim().length < 2}
              onClick={(event) => {
                event.preventDefault();
                void removeFunding();
              }}
            >
              {deletingFundingId
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Trash2 className="mr-2 h-4 w-4" />}
              영구 삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Dashboard figure: label + number on a hairline, no card chrome.
const SummaryCard = ({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) => (
  <div className="min-w-0 border-t border-black/15 pt-4"><p className="flex items-center gap-1.5 text-xs text-stone-500"><Icon className="h-3.5 w-3.5 text-brand" strokeWidth={1.8} />{label}</p><p className="text-wrap-anywhere mt-2 font-display text-xl font-semibold tracking-[-0.03em] sm:text-2xl">{value}</p></div>
);

const EmptyState = ({ title, description, action, to }: { title: string; description: string; action: string; to: string }) => (
  <div className="mt-8 border-t border-black/10 py-16 sm:py-20"><PackageOpen className="h-10 w-10 text-brand/30" strokeWidth={1.5} /><h2 className="mt-5 text-xl font-semibold tracking-[-0.03em] sm:text-2xl">{title}</h2><p className="mt-2 text-sm text-stone-500">{description}</p><Link to={to} className="cta-primary mt-7">{action} <ArrowRight className="h-4 w-4" /></Link></div>
);

// Phones: compact thumbnail beside the order text, actions in a full-width row underneath.
// md+: the original image | details | action columns.
const PARTICIPATION_CARD_GRID = "grid grid-cols-[88px_minmax(0,1fr)] md:grid-cols-[160px_minmax(0,1fr)_auto]";
const PARTICIPATION_CARD_IMAGE = "mt-5 block aspect-square self-start bg-[#ebe7e1] p-2 md:my-5 md:p-4 [&_img]:mix-blend-multiply";
const PARTICIPATION_CARD_ACTIONS = "col-span-2 flex items-center pb-5 md:col-span-1 md:px-2 md:py-5";

const PaidParticipationCard = ({ item, cancelling, onCancel }: { item: MyFundingParticipation; cancelling: boolean; onCancel: () => void }) => {
  const isCancelled = item.status === "cancelled" || ["cancelled", "failed"].includes(item.payment_status);
  const canCancel = item.status !== "fulfilled" && !isCancelled && item.payment_status !== "failed";
  const fundingRate = item.funding_moq > 0 ? Math.round((item.funding_current_orders / item.funding_moq) * 100) : 0;
  return (
    <article className={`border-t border-black/10 ${isCancelled ? "opacity-65" : ""}`}><div className={PARTICIPATION_CARD_GRID}>
      <Link to={`/fundings/${item.funding_id}`} className={PARTICIPATION_CARD_IMAGE}><img src={item.image_url} alt={item.product_name} className="h-full w-full object-contain" /></Link>
      <div className="min-w-0 p-4 md:px-8 md:py-6"><div className="flex flex-wrap gap-2">
          <Badge className={paymentBadgeClass[item.payment_status]}>{paymentLabel[item.payment_status]}</Badge>
          <Badge variant={item.payment_type === "MOCK" ? "secondary" : "default"}>{item.payment_type === "MOCK" ? "모의결제" : "실제결제"}</Badge>
          {item.status === "fulfilled" && <Badge variant="secondary">제작 처리 완료</Badge>}
        </div>
        <Link to={`/fundings/${item.funding_id}`} className="text-wrap-anywhere mt-3 block text-lg font-bold leading-snug hover:text-brand md:text-xl">{item.product_name}</Link>
        <p className="text-wrap-anywhere mt-1 font-mono text-xs text-stone-400">주문번호 {item.order_number || item.id.slice(0, 8)}</p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500 md:gap-x-6"><span>{item.selected_color} · {item.selected_size}</span><span>{item.quantity}장</span><strong className="text-stone-900">{item.total_amount.toLocaleString("ko-KR")}원</strong></div>
        {!isCancelled && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="gap-1"><Truck className="h-3 w-3" />{PRODUCTION_STAGE_LABEL[item.production_stage]}</Badge>
            <span className="text-stone-400">펀딩 진행률 {fundingRate}%</span>
          </div>
        )}
        {(item.shipping_address || item.address) && (
          <p className="text-wrap-anywhere mt-3 text-xs leading-5 text-stone-400">
            배송지 [{item.postal_code || "-"}] {item.shipping_address || item.address} {item.shipping_address_detail || ""}
            {item.tracking_number && <span className="ml-2 font-semibold text-stone-600">송장 {item.tracking_number}</span>}
          </p>
        )}
        <p className="mt-4 flex items-center text-xs text-stone-400"><CalendarDays className="mr-1.5 h-4 w-4" />{new Date(item.created_at).toLocaleString("ko-KR")} 참여</p>
      </div>
      <div className={PARTICIPATION_CARD_ACTIONS}>{canCancel ? <Button variant="outline" className="w-full border-red-200 text-red-700 hover:bg-red-50 md:w-auto" disabled={cancelling} onClick={onCancel}>{cancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}취소</Button> : <span className="text-sm text-stone-400">{item.status === "fulfilled" ? "처리 완료" : "취소된 참여"}</span>}</div>
    </div></article>
  );
};

const PlannedParticipationCard = ({ item }: { item: MyFundingPaymentIntent }) => (
  <article className="border-t border-black/10"><div className={PARTICIPATION_CARD_GRID}>
    <Link to={`/fundings/${item.funding_id}`} className={PARTICIPATION_CARD_IMAGE}><img src={item.image_url} alt={item.product_name} className="h-full w-full object-contain" /></Link>
    <div className="min-w-0 p-4 md:px-8 md:py-6"><Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100"><Clock3 className="mr-1.5 h-3.5 w-3.5" />샘플 확인 후 결제 예정</Badge>
      <Link to={`/fundings/${item.funding_id}`} className="text-wrap-anywhere mt-3 block text-lg font-bold leading-snug hover:text-brand md:text-xl">{item.product_name}</Link>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 md:gap-x-6 text-sm text-stone-500"><span>{item.selected_color} · {item.selected_size}</span><span>{item.quantity}장</span><strong className="text-stone-900">예정 금액 {item.total_amount.toLocaleString("ko-KR")}원</strong></div>
      <p className="mt-4 flex items-center text-xs text-stone-400"><CalendarDays className="mr-1.5 h-4 w-4" />{new Date(item.created_at).toLocaleString("ko-KR")} 등록</p>
      {item.sample_shared_at && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">판매자가 제작 샘플을 공유했습니다. 확인 후 결제할 수 있습니다.</p>}
    </div>
    <div className={PARTICIPATION_CARD_ACTIONS}><Button asChild className="w-full bg-brand hover:bg-brand-dark md:w-auto"><Link to={`/fundings/${item.funding_id}`}>{item.sample_shared_at ? "샘플 확인·결제" : "펀딩 확인"}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>
  </div></article>
);

export default MyFundings;
