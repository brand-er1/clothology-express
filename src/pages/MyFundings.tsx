import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import {
  cancelFundingParticipation,
  fetchMyFundingPaymentIntents,
  fetchMyFundingParticipations,
  fetchMyFundings,
} from "@/services/funding";
import type {
  Funding, FundingPaymentStatus, MyFundingParticipation, MyFundingPaymentIntent,
} from "@/types/funding";
import {
  ArrowRight, CalendarDays, Clock3, Loader2, PackageOpen, RotateCcw, Settings2,
  ShoppingBag, SquarePen, Users, WalletCards,
} from "lucide-react";

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
  cancelled: "bg-gray-100 text-gray-500 hover:bg-gray-100",
  failed: "bg-red-100 text-red-700 hover:bg-red-100",
};

const fundingStatusLabel: Record<Funding["status"], string> = {
  pending: "승인 대기",
  approved: "펀딩 진행 중",
  rejected: "수정 필요",
  closed: "펀딩 종료",
};

type ParticipationFilter = "all" | "paid" | "planned";

const MyFundings = () => {
  const [createdFundings, setCreatedFundings] = useState<Funding[]>([]);
  const [paidItems, setPaidItems] = useState<MyFundingParticipation[]>([]);
  const [plannedItems, setPlannedItems] = useState<MyFundingPaymentIntent[]>([]);
  const [participationFilter, setParticipationFilter] = useState<ParticipationFilter>("all");
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MyFundingParticipation | null>(null);

  const load = useCallback(async () => {
    try {
      const [created, participated, planned] = await Promise.all([
        fetchMyFundings(),
        fetchMyFundingParticipations(),
        fetchMyFundingPaymentIntents(),
      ]);
      setCreatedFundings(created);
      setPaidItems(participated);
      setPlannedItems(planned);
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
  const paidAmount = activePaidItems
    .filter((item) => item.payment_status === "paid" && item.status !== "cancelled")
    .reduce((sum, item) => sum + item.total_amount, 0);
  const plannedAmount = plannedItems.reduce((sum, item) => sum + item.total_amount, 0);

  const cancelParticipation = async () => {
    if (!selectedItem) return;
    setCancellingId(selectedItem.id);
    try {
      const result = await cancelFundingParticipation(selectedItem.id);
      setPaidItems((current) => current.map((item) => item.id === selectedItem.id
        ? { ...item, status: "cancelled", payment_status: "cancelled", payment_cancelled_at: new Date().toISOString() }
        : item));
      toast({
        title: result.refunded ? "펀딩 취소와 환불이 완료되었습니다" : "펀딩 참여를 취소했습니다",
        description: result.refunded ? "카카오페이 결제 금액이 전액 취소되었습니다." : "취소된 수량은 펀딩 달성 수량에서 제외됩니다.",
      });
    } catch (error) {
      toast({ title: "펀딩을 취소하지 못했습니다", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setCancellingId(null);
      setSelectedItem(null);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#f7f5f2]"><Header /><div className="flex min-h-screen items-center justify-center text-gray-500">
      <Loader2 className="mr-2 h-6 w-6 animate-spin text-brand" /> 내 펀딩을 불러오는 중입니다
    </div></div>
  );

  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 pb-24 pt-24">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">MY FUNDING</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">내 펀딩</h1>
            <p className="mt-3 text-gray-500">내가 만든 펀딩과 참여한 펀딩을 한곳에서 확인하세요.</p>
          </div>
          <Button asChild className="rounded-full bg-brand hover:bg-brand-dark"><Link to="/fundings">새 펀딩 둘러보기 <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </div>

        <Tabs defaultValue="created" className="mt-8">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-white p-1.5 shadow-sm md:w-[520px]">
            <TabsTrigger value="created" className="rounded-xl py-3 data-[state=active]:bg-brand data-[state=active]:text-white">
              내가 만든 펀딩 <span className="ml-2 opacity-70">{createdFundings.length}</span>
            </TabsTrigger>
            <TabsTrigger value="joined" className="rounded-xl py-3 data-[state=active]:bg-brand data-[state=active]:text-white">
              내가 참여한 펀딩 <span className="ml-2 opacity-70">{activePaidItems.length + plannedItems.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="created" className="mt-7">
            {createdFundings.length === 0 ? (
              <EmptyState title="아직 만든 펀딩이 없습니다" description="나만의 디자인으로 첫 펀딩을 만들어보세요." action="컬렉션 시작하기" to="/customize" />
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {createdFundings.map((funding) => {
                  const progress = Math.min(100, Math.round((funding.current_orders / funding.moq) * 100));
                  return (
                    <article key={funding.id} className="overflow-hidden rounded-[1.75rem] border bg-white">
                      <Link to={`/fundings/${funding.id}`} className="block aspect-[16/10] bg-stone-100 p-6">
                        <img src={funding.image_url} alt={funding.product_name} className="h-full w-full object-contain" />
                      </Link>
                      <div className="p-6">
                        <div className="flex items-center justify-between gap-3"><Badge variant="secondary">{fundingStatusLabel[funding.status]}</Badge><span className="text-xs text-gray-400">{new Date(funding.created_at).toLocaleDateString("ko-KR")}</span></div>
                        <Link to={`/fundings/${funding.id}`} className="mt-3 block text-xl font-bold hover:text-brand">{funding.product_name}</Link>
                        <div className="mt-5 flex items-end justify-between"><strong className="text-2xl text-brand">{progress}%</strong><span className="text-sm text-gray-500">{funding.current_orders} / {funding.moq}장</span></div>
                        <Progress value={progress} className="mt-2 h-2.5" />
                        <div className="mt-5 grid grid-cols-2 gap-2">
                          <Button asChild variant="outline" className="rounded-full"><Link to={`/fundings/${funding.id}/edit`}><SquarePen className="mr-2 h-4 w-4" />정보 수정</Link></Button>
                          <Button asChild className="rounded-full bg-brand hover:bg-brand-dark"><Link to={`/fundings/${funding.id}/manage`}><Settings2 className="mr-2 h-4 w-4" />참여자 관리</Link></Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="joined" className="mt-7">
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryCard icon={ShoppingBag} label="결제 완료" value={`${activePaidItems.filter((item) => item.payment_status === "paid").length}건`} />
              <SummaryCard icon={WalletCards} label="결제 금액" value={`${paidAmount.toLocaleString("ko-KR")}원`} />
              <SummaryCard icon={Clock3} label="결제 예정" value={`${plannedItems.length}건 · ${plannedAmount.toLocaleString("ko-KR")}원`} />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {([['all', '전체'], ['paid', '결제 내역'], ['planned', '결제 예정']] as const).map(([value, label]) => (
                <Button key={value} size="sm" variant={participationFilter === value ? "default" : "outline"}
                  onClick={() => setParticipationFilter(value)} className={participationFilter === value ? "rounded-full bg-brand hover:bg-brand-dark" : "rounded-full bg-white"}>{label}</Button>
              ))}
            </div>

            {activePaidItems.length + plannedItems.length === 0 ? (
              <EmptyState title="아직 참여한 펀딩이 없습니다" description="마음에 드는 디자인을 선택해 첫 펀딩에 참여해보세요." action="펀딩 보러 가기" to="/fundings" />
            ) : (
              <div className="mt-6 space-y-4">
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
          <AlertDialogDescription>{selectedItem?.payment_status === "paid" ? `${selectedItem.total_amount.toLocaleString("ko-KR")}원이 카카오페이로 전액 취소됩니다.` : "진행 중인 참여 내역이 취소됩니다."}</AlertDialogDescription>
        </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>계속 참여하기</AlertDialogCancel><AlertDialogAction onClick={cancelParticipation} className="bg-red-600 hover:bg-red-700">{selectedItem?.payment_status === "paid" ? "취소 및 환불" : "참여 취소"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const SummaryCard = ({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) => (
  <Card className="rounded-2xl"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-2xl bg-brand/10 p-3 text-brand"><Icon className="h-5 w-5" /></div><div><p className="text-sm text-gray-500">{label}</p><p className="text-xl font-bold">{value}</p></div></CardContent></Card>
);

const EmptyState = ({ title, description, action, to }: { title: string; description: string; action: string; to: string }) => (
  <div className="mt-6 rounded-[2rem] border bg-white px-6 py-20 text-center"><PackageOpen className="mx-auto h-12 w-12 text-brand/30" /><h2 className="mt-5 text-xl font-bold">{title}</h2><p className="mt-2 text-sm text-gray-500">{description}</p><Button asChild className="mt-6 rounded-full bg-brand hover:bg-brand-dark"><Link to={to}>{action}</Link></Button></div>
);

const PaidParticipationCard = ({ item, cancelling, onCancel }: { item: MyFundingParticipation; cancelling: boolean; onCancel: () => void }) => {
  const isCancelled = item.status === "cancelled" || ["cancelled", "failed"].includes(item.payment_status);
  const canCancel = item.status !== "fulfilled" && !isCancelled && item.payment_status !== "failed";
  return (
    <article className={`overflow-hidden rounded-[1.75rem] border bg-white ${isCancelled ? "opacity-65" : ""}`}><div className="grid md:grid-cols-[160px_1fr_auto]">
      <Link to={`/fundings/${item.funding_id}`} className="aspect-square bg-stone-100 p-5"><img src={item.image_url} alt={item.product_name} className="h-full w-full object-contain" /></Link>
      <div className="p-6"><div className="flex flex-wrap gap-2"><Badge className={paymentBadgeClass[item.payment_status]}>{paymentLabel[item.payment_status]}</Badge>{item.status === "fulfilled" && <Badge variant="secondary">제작 처리 완료</Badge>}</div>
        <Link to={`/fundings/${item.funding_id}`} className="mt-3 block text-xl font-bold hover:text-brand">{item.product_name}</Link>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500"><span>{item.selected_color} · {item.selected_size}</span><span>{item.quantity}장</span><strong className="text-gray-900">{item.total_amount.toLocaleString("ko-KR")}원</strong></div>
        <p className="mt-4 flex items-center text-xs text-gray-400"><CalendarDays className="mr-1.5 h-4 w-4" />{new Date(item.created_at).toLocaleString("ko-KR")} 결제 참여</p>
      </div>
      <div className="flex items-center border-t px-6 py-5 md:border-l md:border-t-0">{canCancel ? <Button variant="outline" className="rounded-full border-red-200 text-red-700 hover:bg-red-50" disabled={cancelling} onClick={onCancel}>{cancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}취소</Button> : <span className="text-sm text-gray-400">{item.status === "fulfilled" ? "처리 완료" : "취소된 참여"}</span>}</div>
    </div></article>
  );
};

const PlannedParticipationCard = ({ item }: { item: MyFundingPaymentIntent }) => (
  <article className="overflow-hidden rounded-[1.75rem] border border-amber-200 bg-white"><div className="grid md:grid-cols-[160px_1fr_auto]">
    <Link to={`/fundings/${item.funding_id}`} className="aspect-square bg-stone-100 p-5"><img src={item.image_url} alt={item.product_name} className="h-full w-full object-contain" /></Link>
    <div className="p-6"><Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100"><Clock3 className="mr-1.5 h-3.5 w-3.5" />샘플 확인 후 결제 예정</Badge>
      <Link to={`/fundings/${item.funding_id}`} className="mt-3 block text-xl font-bold hover:text-brand">{item.product_name}</Link>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500"><span>{item.selected_color} · {item.selected_size}</span><span>{item.quantity}장</span><strong className="text-gray-900">예정 금액 {item.total_amount.toLocaleString("ko-KR")}원</strong></div>
      <p className="mt-4 flex items-center text-xs text-gray-400"><CalendarDays className="mr-1.5 h-4 w-4" />{new Date(item.created_at).toLocaleString("ko-KR")} 등록</p>
      {item.sample_shared_at && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">판매자가 제작 샘플을 공유했습니다. 확인 후 결제할 수 있습니다.</p>}
    </div>
    <div className="flex items-center border-t px-6 py-5 md:border-l md:border-t-0"><Button asChild className="w-full rounded-full bg-brand hover:bg-brand-dark md:w-auto"><Link to={`/fundings/${item.funding_id}`}>{item.sample_shared_at ? "샘플 확인·결제" : "펀딩 확인"}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>
  </div></article>
);

export default MyFundings;
