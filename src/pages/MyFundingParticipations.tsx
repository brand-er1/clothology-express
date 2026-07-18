import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { cancelFundingParticipation, fetchMyFundingParticipations } from "@/services/funding";
import type { FundingPaymentStatus, FundingParticipationStatus, MyFundingParticipation } from "@/types/funding";
import { ArrowRight, Loader2, PackageCheck, ReceiptText, RotateCcw, ShoppingBag, WalletCards } from "lucide-react";

const participationLabel: Record<FundingParticipationStatus, string> = {
  pledged: "참여 접수",
  confirmed: "참여 확정",
  fulfilled: "처리 완료",
  cancelled: "취소 완료",
};

const paymentLabel: Record<FundingPaymentStatus, string> = {
  unpaid: "기존 참여",
  ready: "결제 대기",
  paid: "결제 완료",
  cancelled: "결제 취소",
  failed: "결제 실패",
};

const paymentBadgeClass: Record<FundingPaymentStatus, string> = {
  unpaid: "bg-gray-100 text-gray-700 hover:bg-gray-100",
  ready: "bg-amber-100 text-amber-900 hover:bg-amber-100",
  paid: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  cancelled: "bg-red-100 text-red-800 hover:bg-red-100",
  failed: "bg-red-100 text-red-800 hover:bg-red-100",
};

const MyFundingParticipations = () => {
  const [items, setItems] = useState<MyFundingParticipation[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await fetchMyFundingParticipations());
    } catch (error) {
      console.error(error);
      toast({ title: "내 펀딩 참여 내역을 불러오지 못했습니다", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeItems = useMemo(
    () => items.filter((item) => item.status !== "cancelled" && !["ready", "failed", "cancelled"].includes(item.payment_status)),
    [items]
  );
  const totalQuantity = activeItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = activeItems.reduce((sum, item) => sum + item.total_amount, 0);

  const handleCancel = async (item: MyFundingParticipation) => {
    const message = item.payment_status === "paid"
      ? `${item.total_amount.toLocaleString("ko-KR")}원 결제를 취소하고 환불하시겠습니까?`
      : "이 펀딩 참여를 취소하시겠습니까?";
    if (!window.confirm(message)) return;

    setCancellingId(item.id);
    try {
      await cancelFundingParticipation(item.id);
      setItems((current) => current.map((currentItem) => currentItem.id === item.id
        ? { ...currentItem, status: "cancelled", payment_status: "cancelled", cancelled_at: new Date().toISOString() }
        : currentItem));
      toast({
        title: item.payment_status === "paid" ? "카카오페이 결제가 취소됐습니다" : "펀딩 참여가 취소됐습니다",
        description: item.payment_status === "paid" ? "카카오페이 환불 내역에서 확인할 수 있습니다." : undefined,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "참여를 취소하지 못했습니다",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 pb-24 pt-24">
        <div className="mb-8">
          <Badge variant="secondary">회원 전용</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">내 펀딩 참여</h1>
          <p className="mt-2 text-gray-500">내가 결제하고 참여한 펀딩과 진행 상태를 확인하거나 취소할 수 있습니다.</p>
        </div>

        <div className="mb-7 grid gap-4 sm:grid-cols-3">
          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-2xl bg-brand/10 p-3 text-brand"><ReceiptText className="h-6 w-6" /></div>
              <div><p className="text-sm text-gray-500">참여 펀딩</p><p className="text-2xl font-bold">{activeItems.length}건</p></div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-2xl bg-brand/10 p-3 text-brand"><ShoppingBag className="h-6 w-6" /></div>
              <div><p className="text-sm text-gray-500">참여 수량</p><p className="text-2xl font-bold">{totalQuantity}장</p></div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-2xl bg-[#FEE500]/30 p-3 text-[#5b5100]"><WalletCards className="h-6 w-6" /></div>
              <div><p className="text-sm text-gray-500">총 결제 금액</p><p className="text-2xl font-bold">{totalAmount.toLocaleString("ko-KR")}원</p></div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center text-gray-500">
            <Loader2 className="mr-2 h-6 w-6 animate-spin text-brand" /> 참여 내역을 불러오는 중입니다
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-white py-20 text-center">
            <PackageCheck className="mx-auto mb-4 h-10 w-10 text-brand/50" />
            <h2 className="text-lg font-semibold">아직 참여한 펀딩이 없습니다</h2>
            <p className="mt-2 text-sm text-gray-500">마음에 드는 디자인을 골라 펀딩에 참여해보세요.</p>
            <Button asChild className="mt-6 rounded-full bg-brand hover:bg-brand-dark">
              <Link to="/fundings">펀딩 둘러보기</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const canCancel = item.status !== "cancelled" && item.status !== "fulfilled" && item.payment_status !== "cancelled";
              return (
                <Card key={item.id} className={`overflow-hidden rounded-3xl ${item.status === "cancelled" ? "opacity-65" : ""}`}>
                  <CardContent className="grid gap-5 p-5 sm:grid-cols-[9rem_1fr_auto] sm:items-center">
                    <Link to={`/fundings/${item.funding_id}`} className="block aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100 p-2">
                      <img src={item.funding_image_url} alt={item.funding_name} className="h-full w-full object-contain" />
                    </Link>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={paymentBadgeClass[item.payment_status]}>{paymentLabel[item.payment_status]}</Badge>
                        <Badge variant="outline">{participationLabel[item.status]}</Badge>
                      </div>
                      <Link to={`/fundings/${item.funding_id}`} className="mt-3 inline-flex items-center text-xl font-bold hover:text-brand">
                        {item.funding_name}<ArrowRight className="ml-1.5 h-4 w-4" />
                      </Link>
                      <p className="mt-2 text-sm text-gray-500">
                        {item.selected_color} · {item.selected_size} · {item.quantity}장
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {new Date(item.created_at).toLocaleString("ko-KR")}
                        {item.paid_at ? ` · 결제 ${new Date(item.paid_at).toLocaleDateString("ko-KR")}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-stretch gap-2 sm:items-end">
                      <strong className="text-xl">{item.total_amount.toLocaleString("ko-KR")}원</strong>
                      {canCancel && (
                        <Button variant="outline" className="rounded-full" disabled={cancellingId === item.id} onClick={() => handleCancel(item)}>
                          {cancellingId === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                          {item.payment_status === "paid" ? "결제 취소·환불" : "참여 취소"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyFundingParticipations;
