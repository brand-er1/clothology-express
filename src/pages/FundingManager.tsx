import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import {
  fetchFunding,
  fetchFundingParticipants,
  fetchFundingPaymentIntents,
  uploadAndShareFundingSample,
  updateFundingParticipationStatus,
  updateFundingOrderFulfillment,
} from "@/services/funding";
import type {
  Funding, FundingParticipation, FundingParticipationStatus, FundingPaymentIntent,
  ProductionStage, ShippingStatus,
} from "@/types/funding";
import { PRODUCTION_STAGE_LABEL, PRODUCTION_STAGE_ORDER, SHIPPING_STATUS_LABEL } from "@/types/funding";
import {
  ArrowLeft, Clock3, Download, ImagePlus, Loader2, PackageCheck, Search, ShoppingBag,
  Truck, Users, WalletCards,
} from "lucide-react";

const statusLabel: Record<FundingParticipationStatus, string> = {
  pledged: "참여 접수",
  confirmed: "참여 확정",
  cancelled: "취소",
  fulfilled: "처리 완료",
};

const PAGE_SIZE = 10;

const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const FundingManager = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [funding, setFunding] = useState<Funding | null>(null);
  const [participants, setParticipants] = useState<FundingParticipation[]>([]);
  const [paymentIntents, setPaymentIntents] = useState<FundingPaymentIntent[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [sampleNote, setSampleNote] = useState("");
  const [sharingSample, setSharingSample] = useState(false);
  const [updatingFulfillmentId, setUpdatingFulfillmentId] = useState<string | null>(null);
  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | FundingParticipationStatus>("all");
  const [shippingStatusFilter, setShippingStatusFilter] = useState<"all" | ShippingStatus>("all");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [fundingData, participantData, intentData] = await Promise.all([
        fetchFunding(id),
        fetchFundingParticipants(id),
        fetchFundingPaymentIntents(id),
      ]);
      setFunding(fundingData);
      setParticipants(participantData);
      setPaymentIntents(intentData);
      setSampleNote(fundingData.sample_note || "");
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
  const intendedQuantity = paymentIntents.reduce((sum, item) => sum + item.quantity, 0);

  const optionSummary = useMemo(() => {
    const summary = new Map<string, number>();
    activeParticipants.forEach((item) => {
      const key = `${item.selected_color} · ${item.selected_size}`;
      summary.set(key, (summary.get(key) || 0) + item.quantity);
    });
    return Array.from(summary.entries()).sort((a, b) => b[1] - a[1]);
  }, [activeParticipants]);

  const sizeOptions = useMemo(
    () => Array.from(new Set(participants.map((item) => item.selected_size))).sort(),
    [participants]
  );

  const filteredParticipants = useMemo(() => {
    const keyword = searchTerm.trim().toLocaleLowerCase("ko-KR");
    return participants.filter((item) => {
      const matchesKeyword =
        !keyword ||
        [item.participant_name, item.order_number, item.orderer_name, item.recipient_name]
          .some((value) => value?.toLocaleLowerCase("ko-KR").includes(keyword));
      const matchesSize = sizeFilter === "all" || item.selected_size === sizeFilter;
      const matchesOrderStatus = orderStatusFilter === "all" || item.status === orderStatusFilter;
      const matchesShippingStatus = shippingStatusFilter === "all" || item.shipping_status === shippingStatusFilter;
      return matchesKeyword && matchesSize && matchesOrderStatus && matchesShippingStatus;
    });
  }, [participants, searchTerm, sizeFilter, orderStatusFilter, shippingStatusFilter]);

  useEffect(() => { setPage(1); }, [searchTerm, sizeFilter, orderStatusFilter, shippingStatusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredParticipants.length / PAGE_SIZE));
  const pagedParticipants = filteredParticipants.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const changeFulfillment = async (
    item: FundingParticipation,
    updates: { productionStage?: ProductionStage; shippingStatus?: ShippingStatus; trackingNumber?: string }
  ) => {
    setUpdatingFulfillmentId(item.id);
    try {
      await updateFundingOrderFulfillment(item.id, updates);
      setParticipants((current) =>
        current.map((participant) =>
          participant.id === item.id
            ? {
                ...participant,
                production_stage: updates.productionStage ?? participant.production_stage,
                shipping_status: updates.shippingStatus ?? participant.shipping_status,
                tracking_number: updates.trackingNumber ?? participant.tracking_number,
                status: updates.productionStage === "delivered" ? "fulfilled" : participant.status,
              }
            : participant
        )
      );
      toast({ title: "주문 진행 상태를 저장했습니다" });
    } catch (error) {
      toast({
        title: "주문 진행 상태를 변경하지 못했습니다",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setUpdatingFulfillmentId(null);
    }
  };

  const downloadOrdersCsv = () => {
    const headers = [
      "주문번호", "주문자", "연락처", "상품", "컬러", "사이즈", "수량", "금액",
      "수령인", "수령인 연락처", "우편번호", "주소", "상세주소", "배송메모",
    ];
    const rows = filteredParticipants.map((item) => [
      item.order_number,
      item.orderer_name || item.participant_name,
      item.orderer_phone || item.phone_number,
      funding?.product_name,
      item.selected_color,
      item.selected_size,
      item.quantity,
      item.total_amount,
      item.recipient_name,
      item.recipient_phone,
      item.postal_code,
      item.shipping_address || item.address,
      item.shipping_address_detail,
      item.delivery_message,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${funding?.product_name || "펀딩"}_주문목록_${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

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

  const shareSample = async () => {
    if (!id || !sampleFile) {
      toast({ title: "공유할 샘플 이미지를 선택해주세요", variant: "destructive" });
      return;
    }
    setSharingSample(true);
    try {
      const uploaded = await uploadAndShareFundingSample(id, sampleFile, sampleNote);
      setFunding((current) => current ? {
        ...current,
        sample_image_url: uploaded.imageUrl,
        sample_image_path: uploaded.imagePath,
        sample_note: sampleNote,
        sample_shared_at: new Date().toISOString(),
      } : current);
      setSampleFile(null);
      toast({ title: "제작 샘플을 공유했습니다", description: "펀딩 상세 페이지에서 구매자가 확인할 수 있습니다." });
    } catch (error) {
      console.error(error);
      toast({ title: "샘플을 공유하지 못했습니다", variant: "destructive" });
    } finally {
      setSharingSample(false);
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
            <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.03em] md:text-4xl">{funding.product_name}</h1>
            <p className="mt-2 text-gray-500">펀딩 참여자 관리</p>
          </div>
          <Button asChild variant="outline" className="rounded-full bg-white">
            <Link to={`/fundings/${funding.id}/edit`}>펀딩 정보 수정</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
          <Card className="rounded-2xl border-brand/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-800"><Clock3 className="h-6 w-6" /></div>
              <div><p className="text-sm text-gray-500">결제 예정자</p><p className="text-2xl font-bold">{paymentIntents.length}명</p><p className="text-xs text-gray-400">예정 수량 {intendedQuantity}장</p></div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-5 rounded-2xl border-brand/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ImagePlus className="h-5 w-5 text-brand" /> 제작 샘플 공유</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-[0.45fr_1fr]">
            <div className="overflow-hidden rounded-2xl border bg-stone-50">
              {funding.sample_image_url ? (
                <img src={funding.sample_image_url} alt="현재 공유 중인 제작 샘플" className="aspect-square h-full w-full object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center text-center text-sm text-gray-400">아직 공유한<br />샘플이 없습니다</div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="sample-image" className="mb-2 block text-sm font-semibold">샘플 이미지</label>
                <Input id="sample-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setSampleFile(event.target.files?.[0] || null)} />
                <p className="mt-2 text-xs text-gray-400">JPG, PNG, WEBP · 최대 10MB</p>
              </div>
              <div>
                <label htmlFor="sample-note" className="mb-2 block text-sm font-semibold">구매자에게 전할 샘플 설명</label>
                <Textarea id="sample-note" value={sampleNote} onChange={(event) => setSampleNote(event.target.value)} rows={5}
                  placeholder="실제 원단 색상, 핏, 수정 사항과 결제 안내를 작성해주세요." />
              </div>
              <Button onClick={shareSample} disabled={!sampleFile || sharingSample} className="rounded-full bg-brand hover:bg-brand-dark">
                {sharingSample && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 구매자에게 샘플 공유하기
              </Button>
            </div>
          </CardContent>
        </Card>

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
            <CardHeader className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle>참여자·배송 관리</CardTitle>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-full" disabled={filteredParticipants.length === 0}>
                      <Download className="mr-1.5 h-4 w-4" /> 주문 CSV 다운로드
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>개인정보가 포함된 파일입니다</AlertDialogTitle>
                      <AlertDialogDescription>
                        다운로드하는 CSV에는 주문자·수령인 이름, 연락처, 배송 주소 등 개인정보가 포함됩니다.
                        생산·배송 업무 목적 외에는 사용하지 말고, 안전하게 보관·폐기해주세요.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction onClick={downloadOrdersCsv} className="bg-brand hover:bg-brand-dark">
                        동의하고 다운로드
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="이름 또는 주문번호 검색"
                    className="h-10 pl-9"
                  />
                </div>
                <Select value={sizeFilter} onValueChange={setSizeFilter}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="사이즈" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 사이즈</SelectItem>
                    {sizeOptions.map((size) => <SelectItem key={size} value={size}>{size}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={orderStatusFilter} onValueChange={(value) => setOrderStatusFilter(value as typeof orderStatusFilter)}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="주문상태" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 주문상태</SelectItem>
                    {(Object.keys(statusLabel) as FundingParticipationStatus[]).map((status) => (
                      <SelectItem key={status} value={status}>{statusLabel[status]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={shippingStatusFilter} onValueChange={(value) => setShippingStatusFilter(value as typeof shippingStatusFilter)}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="배송상태" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 배송상태</SelectItem>
                    {(Object.keys(SHIPPING_STATUS_LABEL) as ShippingStatus[]).map((status) => (
                      <SelectItem key={status} value={status}>{SHIPPING_STATUS_LABEL[status]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {participants.length === 0 ? (
                <div className="py-20 text-center text-sm text-gray-500">
                  <PackageCheck className="mx-auto mb-4 h-10 w-10 text-brand/40" />
                  아직 펀딩 참여자가 없습니다.
                </div>
              ) : filteredParticipants.length === 0 ? (
                <div className="py-20 text-center text-sm text-gray-500">검색·필터 조건에 맞는 주문이 없습니다.</div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>주문번호</TableHead>
                          <TableHead>주문자</TableHead>
                          <TableHead>연락처</TableHead>
                          <TableHead className="min-w-56">배송지</TableHead>
                          <TableHead>옵션</TableHead>
                          <TableHead>수량</TableHead>
                          <TableHead>금액</TableHead>
                          <TableHead>결제유형</TableHead>
                          <TableHead>참여일</TableHead>
                          <TableHead className="min-w-36">주문상태</TableHead>
                          <TableHead className="min-w-40">제작 진행</TableHead>
                          <TableHead className="min-w-56">배송</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedParticipants.map((item) => (
                          <TableRow key={item.id} className={item.status === "cancelled" ? "opacity-50" : ""}>
                            <TableCell className="font-mono text-xs">{item.order_number || "-"}</TableCell>
                            <TableCell className="font-medium">
                              {item.orderer_name || item.participant_name}
                              <p className="text-xs text-gray-400">수령인 {item.recipient_name || "-"}</p>
                            </TableCell>
                            <TableCell>
                              {item.orderer_phone || item.phone_number || "-"}
                              <p className="text-xs text-gray-400">{item.orderer_email || ""}</p>
                            </TableCell>
                            <TableCell className="whitespace-normal leading-6">
                              [{item.postal_code || "-"}] {item.shipping_address || item.address || "-"} {item.shipping_address_detail || ""}
                              {item.delivery_message && <p className="mt-1 text-xs text-gray-400">메모: {item.delivery_message}</p>}
                            </TableCell>
                            <TableCell>{item.selected_color} · {item.selected_size}</TableCell>
                            <TableCell>{item.quantity}장</TableCell>
                            <TableCell>{item.total_amount.toLocaleString("ko-KR")}원</TableCell>
                            <TableCell>
                              <Badge variant={item.payment_type === "MOCK" ? "secondary" : "default"}>
                                {item.payment_type === "MOCK" ? "모의결제" : "실제결제"}
                              </Badge>
                            </TableCell>
                            <TableCell>{new Date(item.created_at).toLocaleDateString("ko-KR")}</TableCell>
                            <TableCell>
                              <Select
                                value={item.status}
                                disabled={updatingId === item.id || ["ready", "cancelled", "failed"].includes(item.payment_status)}
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
                            <TableCell>
                              <Select
                                value={item.production_stage}
                                disabled={updatingFulfillmentId === item.id || item.status === "cancelled"}
                                onValueChange={(value) => changeFulfillment(item, { productionStage: value as ProductionStage })}
                              >
                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {PRODUCTION_STAGE_ORDER.map((stage) => (
                                    <SelectItem key={stage} value={stage}>{PRODUCTION_STAGE_LABEL[stage]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1.5">
                                <Badge variant="outline" className="gap-1"><Truck className="h-3 w-3" />{SHIPPING_STATUS_LABEL[item.shipping_status]}</Badge>
                                <Input
                                  value={trackingDrafts[item.id] ?? item.tracking_number ?? ""}
                                  onChange={(event) => setTrackingDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                                  placeholder="송장번호 입력"
                                  className="h-8 text-xs"
                                  disabled={item.status === "cancelled"}
                                />
                                <div className="flex gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 flex-1 text-xs"
                                    disabled={updatingFulfillmentId === item.id || item.status === "cancelled"}
                                    onClick={() => changeFulfillment(item, {
                                      shippingStatus: "shipped",
                                      trackingNumber: trackingDrafts[item.id] ?? item.tracking_number ?? undefined,
                                    })}
                                  >
                                    발송 처리
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-7 flex-1 bg-brand text-xs hover:bg-brand-dark"
                                    disabled={updatingFulfillmentId === item.id || item.status === "cancelled"}
                                    onClick={() => changeFulfillment(item, { shippingStatus: "delivered", productionStage: "delivered" })}
                                  >
                                    배송완료
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>이전</Button>
                      <span className="text-sm text-gray-500">{page} / {totalPages}</span>
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>다음</Button>
                    </div>
                  )}
                </>
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

        <Card className="mt-6 overflow-hidden rounded-2xl">
          <CardHeader>
            <CardTitle>샘플 확인 후 결제 예정자</CardTitle>
            <p className="text-sm text-gray-500">결제 예정 등록은 실제 결제가 아니며 펀딩 달성 수량에는 포함되지 않습니다.</p>
          </CardHeader>
          <CardContent>
            {paymentIntents.length === 0 ? (
              <div className="py-14 text-center text-sm text-gray-500"><Clock3 className="mx-auto mb-3 h-9 w-9 text-brand/40" />아직 결제 예정자가 없습니다.</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader><TableRow><TableHead>예정자</TableHead><TableHead>연락처</TableHead><TableHead>선택 옵션</TableHead><TableHead>예정 수량</TableHead><TableHead>등록일</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {paymentIntents.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.participant_name}</TableCell>
                        <TableCell>{item.phone_number || "-"}</TableCell>
                        <TableCell>{item.selected_color} · {item.selected_size}</TableCell>
                        <TableCell>{item.quantity}장</TableCell>
                        <TableCell>{new Date(item.created_at).toLocaleDateString("ko-KR")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default FundingManager;
