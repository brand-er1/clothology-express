import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { cancelFundingParticipation, fetchMyFundingParticipations } from "@/services/funding";
import type { FundingPaymentStatus, MyFundingParticipation } from "@/types/funding";
import { ArrowRight, CalendarDays, Loader2, PackageOpen, RotateCcw, WalletCards } from "lucide-react";

const paymentLabel: Record<FundingPaymentStatus, string> = {
  unpaid: "기존 무결제 참여",
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

const MyFundings = () => {
  const [items, setItems] = useState<MyFundingParticipation[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MyFundingParticipation | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await fetchMyFundingParticipations());
    } catch (error) {
      console.error(error);
      toast({
        title: "펀딩 참여 내역을 불러오지 못했습니다",
        description: "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeCount = useMemo(
    () => items.filter((item) =>
      item.status !== "cancelled" && !["ready", "cancelled", "failed"].includes(item.payment_status)
    ).length,
    [items]
  );
  const paidAmount = useMemo(
    () => items
      .filter((item) => item.payment_status === "paid" && item.status !== "cancelled")
      .reduce((sum, item) => sum + item.total_amount, 0),
    [items]
  );

  const cancelParticipation = async () => {
    if (!selectedItem) return;
    setCancellingId(selectedItem.id);
    try {
      const result = await cancelFundingParticipation(selectedItem.id);
      setItems((current) => current.map((item) => item.id === selectedItem.id
        ? {
            ...item,
            status: "cancelled",
            payment_status: "cancelled",
            payment_cancelled_at: new Date().toISOString(),
          }
        : item));
      toast({
        title: result.refunded ? "펀딩 취소와 환불이 완료되었습니다" : "펀딩 참여를 취소했습니다",
        description: result.refunded
          ? "카카오페이 결제 금액이 전액 취소되었습니다."
          : "취소된 수량은 펀딩 달성 수량에서 제외됩니다.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "펀딩을 취소하지 못했습니다",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setCancellingId(null);
      setSelectedItem(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f5f2]">
        <Header />
        <div className="flex min-h-screen items-center justify-center text-gray-500">
          <Loader2 className="mr-2 h-6 w-6 animate-spin text-brand" /> 참여 내역을 불러오는 중입니다
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 pb-24 pt-24">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">MY FUNDING</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">내 펀딩 참여 내역</h1>
            <p className="mt-3 text-gray-500">결제한 펀딩의 옵션과 진행 상태를 확인하고 직접 취소·환불할 수 있습니다.</p>
          </div>
          <Button asChild className="rounded-full bg-brand hover:bg-brand-dark">
            <Link to="/fundings">새 펀딩 둘러보기 <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-2xl bg-brand/10 p-3 text-brand"><PackageOpen className="h-6 w-6" /></div>
              <div><p className="text-sm text-gray-500">진행 중인 참여</p><p className="text-2xl font-bold">{activeCount}건</p></div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-2xl bg-[#FEE500]/40 p-3 text-[#493f00]"><WalletCards className="h-6 w-6" /></div>
              <div><p className="text-sm text-gray-500">현재 결제 금액</p><p className="text-2xl font-bold">{paidAmount.toLocaleString("ko-KR")}원</p></div>
            </CardContent>
          </Card>
        </div>

        {items.length === 0 ? (
          <div className="mt-8 rounded-[2rem] border bg-white px-6 py-24 text-center">
            <PackageOpen className="mx-auto h-12 w-12 text-brand/30" />
            <h2 className="mt-5 text-xl font-bold">아직 참여한 펀딩이 없습니다</h2>
            <p className="mt-2 text-sm text-gray-500">마음에 드는 디자인을 선택해 첫 펀딩에 참여해보세요.</p>
            <Button asChild className="mt-6 rounded-full bg-brand hover:bg-brand-dark">
              <Link to="/fundings">펀딩 보러 가기</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {items.map((item) => {
              const isCancelled = item.status === "cancelled" || ["cancelled", "failed"].includes(item.payment_status);
              const canCancel = item.status !== "fulfilled"
                && !isCancelled
                && item.payment_status !== "failed";

              return (
                <article key={item.id} className={`overflow-hidden rounded-[1.75rem] border bg-white ${isCancelled ? "opacity-65" : ""}`}>
                  <div className="grid md:grid-cols-[180px_1fr_auto]">
                    <Link to={`/fundings/${item.funding_id}`} className="aspect-square bg-stone-100 p-5 md:aspect-auto">
                      <img src={item.image_url} alt={item.product_name} className="h-full w-full object-contain" />
                    </Link>

                    <div className="p-6 md:p-7">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={paymentBadgeClass[item.payment_status]}>{paymentLabel[item.payment_status]}</Badge>
                        {item.status === "fulfilled" && <Badge variant="secondary">제작 처리 완료</Badge>}
                      </div>
                      <Link to={`/fundings/${item.funding_id}`} className="mt-3 block text-xl font-bold hover:text-brand md:text-2xl">
                        {item.product_name}
                      </Link>
                      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
                        <span>{item.selected_color} · {item.selected_size}</span>
                        <span>{item.quantity}장</span>
                        <strong className="text-gray-900">{item.total_amount.toLocaleString("ko-KR")}원</strong>
                      </div>
                      <p className="mt-4 flex items-center text-xs text-gray-400">
                        <CalendarDays className="mr-1.5 h-4 w-4" /> {new Date(item.created_at).toLocaleString("ko-KR")} 참여
                      </p>
                    </div>

                    <div className="flex items-center border-t px-6 py-5 md:border-l md:border-t-0 md:px-7">
                      {canCancel ? (
                        <Button
                          variant="outline"
                          className="w-full rounded-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 md:w-auto"
                          disabled={cancellingId === item.id}
                          onClick={() => setSelectedItem(item)}
                        >
                          {cancellingId === item.id
                            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            : <RotateCcw className="mr-2 h-4 w-4" />}
                          펀딩 취소
                        </Button>
                      ) : (
                        <span className="text-sm text-gray-400">
                          {item.status === "fulfilled" ? "처리 완료로 취소 불가" : "취소된 참여입니다"}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <AlertDialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>펀딩 참여를 취소할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedItem?.payment_status === "paid"
                ? `${selectedItem.total_amount.toLocaleString("ko-KR")}원이 카카오페이로 전액 취소되며, 참여 수량도 펀딩 현황에서 차감됩니다.`
                : "진행 중인 결제가 종료되고 참여 내역이 취소 처리됩니다."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>계속 참여하기</AlertDialogCancel>
            <AlertDialogAction
              onClick={cancelParticipation}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {selectedItem?.payment_status === "paid" ? "취소 및 환불" : "참여 취소"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MyFundings;
