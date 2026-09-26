import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { ColorOrderSummary } from "@/components/funding/ColorOrderSummary";
import { buildOrderSheet, buildQuantitySheet, exportFileDate, type OrderExportRow } from "@/lib/order-export";
import { downloadBlob, downloadXlsx, safeFileName } from "@/lib/xlsx";
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
  cancelFundingParticipantByCreator,
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
  Trash2, Truck, Users, WalletCards,
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
  const [participantToCancel, setParticipantToCancel] = useState<FundingParticipation | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellingParticipantId, setCancellingParticipantId] = useState<string | null>(null);

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

  const toExportRow = (item: FundingParticipation): OrderExportRow => ({
    orderNumber: item.order_number,
    orderedAt: item.created_at,
    paidAt: item.payment_approved_at,
    productName: funding?.product_name ?? null,
    color: item.selected_color,
    size: item.selected_size,
    quantity: item.quantity,
    unitPrice: item.unit_price,
    totalAmount: item.total_amount,
    paymentType: item.payment_type,
    paymentProvider: item.payment_provider,
    paymentStatus: item.payment_status,
    orderStatus: item.status,
    ordererName: item.orderer_name || item.participant_name,
    ordererPhone: item.orderer_phone || item.phone_number,
    ordererEmail: item.orderer_email,
    recipientName: item.recipient_name,
    recipientPhone: item.recipient_phone,
    postalCode: item.postal_code,
    address: item.shipping_address || item.address,
    addressDetail: item.shipping_address_detail,
    deliveryMessage: item.delivery_message,
    productionStage: item.production_stage,
    shippingStatus: item.shipping_status,
    trackingNumber: item.tracking_number,
  });

  // 엑셀(.xlsx): [주문 목록(현재 필터)] + [컬러·사이즈별 생산 수량(전체 유효 주문)]
  const downloadOrdersExcel = () => {
    try {
      downloadXlsx(`${safeFileName(funding?.product_name || "펀딩")}_참여자목록_${exportFileDate()}.xlsx`, [
        buildOrderSheet(filteredParticipants.map(toExportRow), false),
        buildQuantitySheet(participants.map(toExportRow), funding?.size_options ?? [], funding?.color_options ?? []),
      ]);
    } catch (error) {
      toast({ title: "엑셀 파일을 만들지 못했습니다", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    }
  };

  const downloadOrdersCsv = () => {
    const sheet = buildOrderSheet(filteredParticipants.map(toExportRow), false);
    const csv = sheet.rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    downloadBlob(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
      `${safeFileName(funding?.product_name || "펀딩")}_참여자목록_${exportFileDate()}.csv`,
    );
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

  const cancelParticipant = async () => {
    if (!participantToCancel) return;
    const reason = cancellationReason.trim();
    if (reason.length < 2) return;

    setCancellingParticipantId(participantToCancel.id);
    try {
      const result = await cancelFundingParticipantByCreator(participantToCancel.id, reason);
      const wasCounted = participantToCancel.status !== "cancelled"
        && ["unpaid", "paid"].includes(participantToCancel.payment_status);

      setParticipants((current) => current.map((item) => item.id === participantToCancel.id
        ? {
            ...item,
            status: "cancelled",
            payment_status: "cancelled",
            payment_cancelled_at: new Date().toISOString(),
          }
        : item));
      if (wasCounted) {
        setFunding((current) => current ? {
          ...current,
          current_orders: Math.max(0, current.current_orders - participantToCancel.quantity),
        } : current);
      }

      const isMockPayment = participantToCancel.payment_type === "MOCK";
      toast({
        title: "참여자를 취소 처리했습니다",
        description: result.refunded
          ? "카카오페이 결제를 전액 환불하고 구매자에게 사이트 알림을 보냈습니다."
          : isMockPayment
            ? "모의결제 참여를 취소하고 구매자에게 사이트 알림을 보냈습니다. 실제 환불은 발생하지 않습니다."
            : "참여를 취소하고 구매자에게 사이트 알림을 보냈습니다.",
      });
      setParticipantToCancel(null);
      setCancellationReason("");
    } catch (error) {
      toast({
        title: "참여자를 취소하지 못했습니다",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setCancellingParticipantId(null);
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


  // Order controls shared by the desktop table and the mobile order cards.
  const renderStatusSelect = (item: FundingParticipation) => (
    item.status === "cancelled" ? (
      <Badge variant="secondary">취소</Badge>
    ) :
    <Select
      value={item.status}
      disabled={updatingId === item.id || ["ready", "cancelled", "failed"].includes(item.payment_status)}
      onValueChange={(value) => changeStatus(item.id, value as FundingParticipationStatus)}>
      <SelectTrigger className="h-9" aria-label="주문상태"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="pledged">참여 접수</SelectItem>
        <SelectItem value="confirmed">참여 확정</SelectItem>
        <SelectItem value="fulfilled">처리 완료</SelectItem>
      </SelectContent>
    </Select>
  );

  const renderCancellationButton = (item: FundingParticipation) => {
    const cannotCancel = item.status === "cancelled"
      || item.status === "fulfilled"
      || ["cancelled", "failed"].includes(item.payment_status);

    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="min-h-10 w-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
        disabled={cannotCancel || cancellingParticipantId === item.id}
        onClick={() => {
          setParticipantToCancel(item);
          setCancellationReason("");
        }}
      >
        {cancellingParticipantId === item.id
          ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          : <Trash2 className="mr-1.5 h-4 w-4" />}
        {item.status === "cancelled" ? "취소 완료" : item.status === "fulfilled" ? "처리 완료" : "참여자 삭제"}
      </Button>
    );
  };

  const renderStageSelect = (item: FundingParticipation) => (
    <Select
      value={item.production_stage}
      disabled={updatingFulfillmentId === item.id || item.status === "cancelled"}
      onValueChange={(value) => changeFulfillment(item, { productionStage: value as ProductionStage })}
    >
      <SelectTrigger className="h-9" aria-label="제작 진행"><SelectValue /></SelectTrigger>
      <SelectContent>
        {PRODUCTION_STAGE_ORDER.map((stage) => (
          <SelectItem key={stage} value={stage}>{PRODUCTION_STAGE_LABEL[stage]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const renderShippingControls = (item: FundingParticipation) => (
    <div className="space-y-1.5">
      <Badge variant="outline" className="gap-1"><Truck className="h-3 w-3" />{SHIPPING_STATUS_LABEL[item.shipping_status]}</Badge>
      <Input
        value={trackingDrafts[item.id] ?? item.tracking_number ?? ""}
        onChange={(event) => setTrackingDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
        placeholder="송장번호 입력"
        aria-label="송장번호"
        className="h-8 text-xs"
        disabled={item.status === "cancelled"}
      />
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 min-h-11 flex-1 text-xs md:min-h-10"
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
          className="h-7 min-h-11 flex-1 bg-brand text-xs hover:bg-brand-dark md:min-h-10"
          disabled={updatingFulfillmentId === item.id || item.status === "cancelled"}
          onClick={() => changeFulfillment(item, { shippingStatus: "delivered", productionStage: "delivered" })}
        >
          배송완료
        </Button>
      </div>
    </div>
  );

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
      <main className="container mx-auto max-w-7xl px-4 pb-16 pt-20 sm:pt-24 md:pb-24">
        <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Link to={`/fundings/${funding.id}`} className="mb-5 inline-flex items-center text-sm text-gray-500 hover:text-gray-900">
              <ArrowLeft className="mr-1 h-4 w-4" /> 펀딩 상세로 돌아가기
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="shrink-0">개설자 전용</Badge>
              <span className="text-sm text-gray-500">참여자 정보는 개설자와 관리자만 볼 수 있습니다.</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-[-0.03em] md:text-4xl">{funding.product_name}</h1>
            <p className="mt-2 text-gray-500">펀딩 참여자 관리</p>
          </div>
          <Button asChild variant="outline" className="self-start rounded-full bg-white md:self-auto">
            <Link to={`/fundings/${funding.id}/edit`}>펀딩 정보 수정</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-lg">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-lg bg-brand/10 p-3 text-brand"><Users className="h-6 w-6" /></div>
              <div><p className="text-sm text-gray-500">참여 건수</p><p className="text-2xl font-bold">{activeParticipants.length}건</p></div>
            </CardContent>
          </Card>
          <Card className="rounded-lg">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-lg bg-brand/10 p-3 text-brand"><ShoppingBag className="h-6 w-6" /></div>
              <div><p className="text-sm text-gray-500">총 참여 수량</p><p className="text-2xl font-bold">{totalQuantity}장</p></div>
            </CardContent>
          </Card>
          <Card className="rounded-lg">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-lg bg-brand/10 p-3 text-brand"><WalletCards className="h-6 w-6" /></div>
              <div><p className="text-sm text-gray-500">총 참여 금액</p><p className="text-2xl font-bold">{totalAmount.toLocaleString("ko-KR")}원</p></div>
            </CardContent>
          </Card>
          <Card className="rounded-lg border-brand/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-lg bg-amber-100 p-3 text-amber-800"><Clock3 className="h-6 w-6" /></div>
              <div><p className="text-sm text-gray-500">결제 예정자</p><p className="text-2xl font-bold">{paymentIntents.length}명</p><p className="text-xs text-gray-400">예정 수량 {intendedQuantity}장</p></div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-5 rounded-lg border-brand/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ImagePlus className="h-5 w-5 text-brand" /> 제작 샘플 공유</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-[0.45fr_1fr]">
            <div className="overflow-hidden rounded-lg border bg-stone-50">
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

        <Card className="mt-5 rounded-lg">
          <CardContent className="p-6">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <strong className="text-3xl text-brand">{progress}%</strong><span className="ml-2 text-sm text-gray-500">달성</span>
                {funding.success_at && (
                  <Badge className="ml-3 bg-emerald-600 align-middle hover:bg-emerald-600">
                    🎉 {funding.funding_status === "production" ? "제작 진행 중" : "펀딩 성공"} · {new Date(funding.success_at).toLocaleDateString("ko-KR")}
                  </Badge>
                )}
              </div>
              <span className="text-sm text-gray-500">{funding.current_orders} / {funding.moq}장</span>
            </div>
            <Progress value={progress} className="h-3" />
          </CardContent>
        </Card>

        <Card className="mt-5 rounded-lg">
          <CardContent className="grid gap-5 p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <p className="text-sm font-bold">컬러별 주문 수량</p>
              <p className="mt-1 text-xs text-gray-500">결제 완료 기준 · 생산 발주 시 컬러별 수량으로 사용하세요.</p>
              <ColorOrderSummary fundingId={funding.id} className="mt-3" />
            </div>
            <div className="min-w-0 rounded-xl bg-stone-50 p-4">
              <p className="text-sm font-bold">컬러 옵션 · 컬러별 상품 이미지</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">진행 중인 펀딩에도 컬러를 추가하고 AI 로 컬러별 이미지(앞/뒤)를 만들 수 있어요. 승인한 이미지는 펀딩 상단 슬라이드와 상세페이지 컬러 섹션에 바로 반영됩니다.</p>
              <Button asChild variant="outline" size="sm" className="mt-3 rounded-full bg-white">
                <Link to={`/fundings/${funding.id}/colors?returnTo=${encodeURIComponent(`/fundings/${funding.id}/manage`)}`}>컬러 · AI 이미지 관리</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.32fr]">
          <Card className="overflow-hidden rounded-lg">
            <CardHeader className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>참여자·배송 관리</CardTitle>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-full" disabled={filteredParticipants.length === 0}>
                      <Download className="mr-1.5 h-4 w-4" /> 엑셀 다운로드
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-lg">
                    <AlertDialogHeader>
                      <AlertDialogTitle>개인정보가 포함된 파일입니다</AlertDialogTitle>
                      <AlertDialogDescription>
                        현재 목록 {filteredParticipants.length}건(검색·필터 적용)과 컬러·사이즈별 생산 수량표가 엑셀(.xlsx) 파일로 저장됩니다.
                        파일에는 주문자·수령인 이름, 연락처, 배송 주소 등 개인정보가 포함되니 생산·배송 업무 목적 외에는 사용하지 말고, 안전하게 보관·폐기해주세요.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction onClick={downloadOrdersCsv} className="border border-input bg-background text-foreground hover:bg-stone-100">
                        CSV로 받기
                      </AlertDialogAction>
                      <AlertDialogAction onClick={downloadOrdersExcel} className="bg-brand hover:bg-brand-dark">
                        동의하고 엑셀 다운로드
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
                  {/* Phones: one card per order instead of a 12-column table. */}
                  <div className="space-y-3 md:hidden">
                    {pagedParticipants.map((item) => (
                      <article key={item.id} className={`rounded-xl border bg-white p-4 text-sm ${item.status === "cancelled" ? "opacity-50" : ""}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-base font-bold">{item.orderer_name || item.participant_name}</p>
                            <p className="text-wrap-anywhere font-mono text-xs text-gray-400">{item.order_number || "-"}</p>
                          </div>
                          <Badge variant={item.payment_type === "MOCK" ? "secondary" : "default"} className="shrink-0">
                            {item.payment_type === "MOCK" ? "모의결제" : "실제결제"}
                          </Badge>
                        </div>
                        <dl className="mt-3 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t pt-3 text-[13px] leading-5">
                          <dt className="text-gray-400">옵션</dt>
                          <dd className="font-semibold">{item.selected_color} · {item.selected_size} · {item.quantity}장</dd>
                          <dt className="text-gray-400">금액</dt>
                          <dd className="font-semibold">{item.total_amount.toLocaleString("ko-KR")}원</dd>
                          <dt className="text-gray-400">연락처</dt>
                          <dd className="text-wrap-anywhere">
                            <a href={`tel:${item.orderer_phone || item.phone_number || ""}`} className="font-semibold text-brand">{item.orderer_phone || item.phone_number || "-"}</a>
                            {item.orderer_email && <span className="block text-xs text-gray-400">{item.orderer_email}</span>}
                          </dd>
                          <dt className="text-gray-400">수령인</dt>
                          <dd className="text-wrap-anywhere">{item.recipient_name || "-"} {item.recipient_phone && <span className="text-gray-500">({item.recipient_phone})</span>}</dd>
                          <dt className="text-gray-400">배송지</dt>
                          <dd className="text-wrap-anywhere">
                            [{item.postal_code || "-"}] {item.shipping_address || item.address || "-"} {item.shipping_address_detail || ""}
                            {item.delivery_message && <span className="mt-0.5 block text-xs text-gray-400">메모: {item.delivery_message}</span>}
                          </dd>
                          <dt className="text-gray-400">참여일</dt>
                          <dd>{new Date(item.created_at).toLocaleDateString("ko-KR")}</dd>
                        </dl>
                        <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
                          <div className="min-w-0 space-y-1"><p className="text-xs font-semibold text-gray-500">주문상태</p>{renderStatusSelect(item)}</div>
                          <div className="min-w-0 space-y-1"><p className="text-xs font-semibold text-gray-500">제작 진행</p>{renderStageSelect(item)}</div>
                        </div>
                        <div className="mt-3">{renderShippingControls(item)}</div>
                        <div className="mt-2">{renderCancellationButton(item)}</div>
                      </article>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto rounded-xl border md:block">
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
                          <TableHead className="min-w-32">관리</TableHead>
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
                              {renderStatusSelect(item)}
                            </TableCell>
                            <TableCell>
                              {renderStageSelect(item)}
                            </TableCell>
                            <TableCell>
                              {renderShippingControls(item)}
                            </TableCell>
                            <TableCell>
                              {renderCancellationButton(item)}
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

          <Card className="h-fit rounded-lg">
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

        <Card className="mt-6 overflow-hidden rounded-lg">
          <CardHeader>
            <CardTitle>샘플 확인 후 결제 예정자</CardTitle>
            <p className="text-sm text-gray-500">결제 예정 등록은 실제 결제가 아니며 펀딩 달성 수량에는 포함되지 않습니다.</p>
          </CardHeader>
          <CardContent>
            {paymentIntents.length === 0 ? (
              <div className="py-14 text-center text-sm text-gray-500"><Clock3 className="mx-auto mb-3 h-9 w-9 text-brand/40" />아직 결제 예정자가 없습니다.</div>
            ) : (
              <>
              <ul className="space-y-2 md:hidden">
                {paymentIntents.map((item) => (
                  <li key={item.id} className="rounded-xl border px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 font-bold">{item.participant_name}</span>
                      <span className="shrink-0 text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString("ko-KR")}</span>
                    </div>
                    <p className="mt-1 text-gray-600">{item.selected_color} · {item.selected_size} · {item.quantity}장</p>
                    {item.phone_number && <a href={`tel:${item.phone_number}`} className="mt-1 inline-block font-semibold text-brand">{item.phone_number}</a>}
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto rounded-xl border md:block">
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
              </>
            )}
          </CardContent>
        </Card>
      </main>

      <AlertDialog
        open={!!participantToCancel}
        onOpenChange={(open) => {
          if (!open && !cancellingParticipantId) {
            setParticipantToCancel(null);
            setCancellationReason("");
          }
        }}
      >
        <AlertDialogContent className="max-w-lg rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>이 참여자를 취소 처리할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {participantToCancel?.orderer_name || participantToCancel?.participant_name}님의 참여가 취소되고,
              실제 카카오페이 결제라면 전액 환불됩니다. 구매자에게 사유가 포함된 사이트 알림을 즉시 보냅니다.
              주문 기록은 분쟁 대응을 위해 삭제하지 않고 취소 상태로 보존합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="participant-cancellation-reason" className="text-sm font-semibold text-gray-800">
              취소 사유 <span className="text-red-600">*</span>
            </label>
            <Textarea
              id="participant-cancellation-reason"
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value.slice(0, 500))}
              placeholder="구매자에게 전달할 취소 사유를 입력해주세요."
              className="min-h-28 resize-y"
              disabled={!!cancellingParticipantId}
            />
            <p className="text-right text-xs text-gray-400">{cancellationReason.length}/500</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!cancellingParticipantId}>유지하기</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={!!cancellingParticipantId || cancellationReason.trim().length < 2}
              onClick={(event) => {
                event.preventDefault();
                void cancelParticipant();
              }}
            >
              {cancellingParticipantId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              취소·환불 및 알림
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FundingManager;
