import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import {
  fetchFunding,
  fetchFundingParticipants,
  updateFundingParticipationStatus,
} from "@/services/funding";
import type { Funding, FundingParticipation, FundingParticipationStatus } from "@/types/funding";
import { ArrowLeft, Loader2, PackageCheck, ShoppingBag, Users, WalletCards } from "lucide-react";

const statusLabel: Record<FundingParticipationStatus, string> = {
  pledged: "참여 접수",
  confirmed: "참여 확정",
  cancelled: "취소",
  fulfilled: "처리 완료",
};

const paymentLabel: Record<FundingParticipation["payment_status"], string> = {
  unpaid: "기존 참여",
  ready: "결제 중",
  paid: "결제 완료",
  cancelled: "환불 완료",
  failed: "결제 실패",
};

const FundingManager = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [funding, setFunding] = useState<Funding | null>(null);
  const [participants, setParticipants] = useState<FundingParticipation[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [fundingData, participantData] = await Promise.all([
        fetchFunding(id),
        fetchFundingParticipants(id),
      ]);
      setFunding(fundingData);
      setParticipants(participantData);
    } catch (error) {
      console.error(error);
      toast({
        title: "참여자 관리 페이지를 열 수 없습니다",
        description: "펀딩 개설자와 관리자만 접근할 수 있습니다.",
        variant: "destructive",
      });
      navigate("/fundings");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const activeParticipants = useMemo(
    () => participants.filter((item) =>
      item.status !== "cancelled" && !["ready", "cancelled", "failed"].includes(item.payment_status)
    ),
    [participants]
  );
  const totalQuantity = activeParticipants.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = activeParticipants.reduce((sum, item) => sum + item.total_amount, 0);
  const progress = funding ? Math.min(100, Math.round((funding.current_orders / funding.moq) * 100)) : 0;

  const optionSummary = useMemo(() => {
    const summary = new Map<string, number>();
    activeParticipants.forEach((item) => {
      const key = `${item.selected_color} · ${item.selected_size}`;
      summary.set(key, (summary.get(key) || 0) + item.quantity);
    });
    return Array.from(summary.entries()).sort((a, b) => b[1] - a[1]);
  }, [activeParticipants]);

  const changeStatus = async (participationId: string, status: FundingParticipationStatus) => {
    setUpdatingId(participationId);
    try {
      await updateFundingParticipationStatus(participationId, status);
      setParticipants((current) =>
        current.map((item) => item.id === participationId ? { ...item, status } : item)
      );
      if (funding) {
        const item = participants.find((participant) => participant.id === participationId);
        if (item) {
          const wasCancelled = item.status === "cancelled";
          const isCancelled = status === "cancelled";
          const delta = wasCancelled === isCancelled ? 0 : isCancelled ? -item.quantity : item.quantity;
          setFunding({ ...funding, current_orders: Math.max(0, funding.current_orders + delta) });
        }
      }
      toast({ title: "참여 상태를 변경했습니다", description: statusLabel[status] });
    } catch (error) {
      console.error(error);
      toast({ title: "상태를 변경하지 못했습니다", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading || !funding) {
    return (
      <div className="min-h-screen bg-[#f7f5f2]">
        <Header />
        <div className="flex min-h-screen items-center justify-center text-gray-500">
          <Loader2 className="mr-2 h-6 w-6 animate-spin text-brand" /> 참여자 정보를 불러오는 중입니다
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 pb-24 pt-24">
        <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Link to={`/fundings/${funding.id}`} className="mb-5 inline-flex items-center text-sm text-gray-500 hover:text-gray-900">
              <ArrowLeft className="mr-1 h-4 w-4" /> 펀딩 상세로 돌아가기
            </Link>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">개설자 전용</Badge>
              <span className="text-sm text-gray-500">참여자 정보는 개설자와 관리자만 볼 수 있습니다.</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{funding.product_name}</h1>
            <p className="mt-2 text-gray-500">펀딩 참여자 관리</p>
          </div>
          <Button asChild variant="outline" className="rounded-full bg-white">
            <Link to={`/fundings/${funding.id}/edit`}>펀딩 정보 수정</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-2xl bg-brand/10 p-3 text-brand"><Users className="h-6 w-6" /></div>
              <div><p className="text-sm text-gray-500">참여 건수</p><p className="text-2xl font-bold">{activeParticipants.length}건</p></div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-2xl bg-brand/10 p-3 text-brand"><ShoppingBag className="h-6 w-6" /></div>
              <div><p className="text-sm text-gray-500">총 참여 수량</p><p className="text-2xl font-bold">{totalQuantity}장</p></div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-2xl bg-brand/10 p-3 text-brand"><WalletCards className="h-6 w-6" /></div>
              <div><p className="text-sm text-gray-500">총 참여 금액</p><p className="text-2xl font-bold">{totalAmount.toLocaleString("ko-KR")}원</p></div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-5 rounded-2xl">
          <CardContent className="p-6">
            <div className="mb-3 flex items-end justify-between">
              <div><strong className="text-3xl text-brand">{progress}%</strong><span className="ml-2 text-sm text-gray-500">달성</span></div>
              <span className="text-sm text-gray-500">{funding.current_orders} / {funding.moq}장</span>
            </div>
            <Progress value={progress} className="h-3" />
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.32fr]">
          <Card className="overflow-hidden rounded-2xl">
            <CardHeader><CardTitle>참여자 목록</CardTitle></CardHeader>
            <CardContent>
              {participants.length === 0 ? (
                <div className="py-20 text-center text-sm text-gray-500">
                  <PackageCheck className="mx-auto mb-4 h-10 w-10 text-brand/40" />
                  아직 펀딩 참여자가 없습니다.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>참여자</TableHead>
                        <TableHead>연락처</TableHead>
                        <TableHead>선택 옵션</TableHead>
                        <TableHead>수량</TableHead>
                        <TableHead>금액</TableHead>
                        <TableHead>결제</TableHead>
                        <TableHead>참여일</TableHead>
                        <TableHead className="min-w-36">상태</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {participants.map((item) => (
                        <TableRow key={item.id} className={item.status === "cancelled" ? "opacity-50" : ""}>
                          <TableCell className="font-medium">{item.participant_name}</TableCell>
                          <TableCell>{item.phone_number || "-"}</TableCell>
                          <TableCell>{item.selected_color} · {item.selected_size}</TableCell>
                          <TableCell>{item.quantity}장</TableCell>
                          <TableCell>{item.total_amount.toLocaleString("ko-KR")}원</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={item.payment_status === "paid" ? "bg-emerald-100 text-emerald-800" : ""}>
                              {paymentLabel[item.payment_status]}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(item.created_at).toLocaleDateString("ko-KR")}</TableCell>
                          <TableCell>
                            <Select value={item.status} disabled={updatingId === item.id || ["ready", "failed", "cancelled"].includes(item.payment_status)}
                              onValueChange={(value) => changeStatus(item.id, value as FundingParticipationStatus)}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pledged">참여 접수</SelectItem>
                                <SelectItem value="confirmed">참여 확정</SelectItem>
                                <SelectItem value="fulfilled">처리 완료</SelectItem>
                                <SelectItem value="cancelled">취소</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="h-fit rounded-2xl">
            <CardHeader><CardTitle className="text-lg">옵션별 수량</CardTitle></CardHeader>
            <CardContent>
              {optionSummary.length === 0 ? (
                <p className="text-sm text-gray-500">집계할 참여 내역이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {optionSummary.map(([option, count]) => (
                    <div key={option} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-sm">
                      <span>{option}</span><strong>{count}장</strong>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default FundingManager;
