import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import {
  DataTable, EmptyState, ErrorBanner, FilterChips, LoadingBlock, MappedBadge, PageHeader, Pager, Panel, SearchInput, StatusBadge, Td,
} from "@/components/admin/shell/ui";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { dateTime, PAYMENT_STATUS, REFUND_STATUS, won } from "@/lib/admin/format";
import { exportFileDate } from "@/lib/order-export";
import { buildSellerOrderSheet, cancelStatusLabel, sellerFileName } from "@/lib/seller-export";
import { downloadXlsx } from "@/lib/xlsx";
import { PRODUCTION_STAGE_LABEL, SHIPPING_STATUS_LABEL, type ProductionStage, type ShippingStatus } from "@/types/funding";
import {
  exportSellerOrders, fetchSellerOrders, fetchSellerProducts,
  type SellerOrderFilter, type SellerOrderStatus, type SellerPaymentType,
} from "@/services/seller";

const PAGE_SIZE = 30;

const STATUS_OPTIONS: { value: SellerOrderStatus; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "paid", label: "결제 완료" },
  { value: "pending", label: "결제 대기" },
  { value: "preparing", label: "배송 준비" },
  { value: "shipped", label: "배송중" },
  { value: "delivered", label: "배송 완료" },
  { value: "refund_requested", label: "환불 요청" },
  { value: "cancelled", label: "취소 · 환불" },
  { value: "failed", label: "결제 실패" },
];

const OrdersPage = () => {
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<SellerOrderFilter>({
    fundingId: params.get("funding"), search: "", status: "all", paymentType: "all",
  });
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [confirmExport, setConfirmExport] = useState(false);
  useEffect(() => setPage(0), [filter]);

  const products = useAdminQuery(fetchSellerProducts, []);
  const { data, loading, error, reload } = useAdminQuery(() => fetchSellerOrders(filter, PAGE_SIZE, page * PAGE_SIZE), [filter, page]);
  const rows = data?.rows ?? [];
  const productName = useMemo(
    () => products.data?.find((p) => p.id === filter.fundingId)?.product_name,
    [products.data, filter.fundingId],
  );

  const update = (patch: Partial<SellerOrderFilter>) => {
    setFilter((current) => ({ ...current, ...patch }));
    if ("fundingId" in patch) {
      const next = new URLSearchParams(params);
      if (patch.fundingId) next.set("funding", patch.fundingId); else next.delete("funding");
      setParams(next, { replace: true });
    }
  };

  const runExport = async () => {
    setExporting(true);
    try {
      const result = await exportSellerOrders(filter);
      downloadXlsx(sellerFileName(productName ? `${productName}_주문` : "주문목록", exportFileDate()), [buildSellerOrderSheet(result.rows)]);
      toast({ title: "주문 엑셀을 저장했습니다", description: `${result.count}건 · 다운로드 기록이 남았습니다.` });
      setConfirmExport(false);
    } catch (exportError) {
      toast({ title: "엑셀을 만들지 못했습니다", description: exportError instanceof Error ? exportError.message : undefined, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Orders" title="주문 관리"
        description="내 브랜드 주문만 표시됩니다. 목록의 이름 · 연락처는 가려지며 배송에 필요한 정보는 엑셀 다운로드로만 받을 수 있습니다."
        actions={<Button size="sm" variant="outline" onClick={() => setConfirmExport(true)} disabled={!data?.total}><Download className="mr-1.5 h-4 w-4" />엑셀 다운로드</Button>}
      />
      <Panel bodyClassName="p-0" title={
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput value={filter.search} onChange={(search) => update({ search })} placeholder="주문번호 · 구매자 · 연락처 뒷자리" />
            <Select value={filter.fundingId ?? "all"} onValueChange={(value) => update({ fundingId: value === "all" ? null : value })}>
              <SelectTrigger className="h-9 w-full rounded-xl text-sm sm:w-60"><SelectValue placeholder="전체 상품" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상품</SelectItem>
                {(products.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <FilterChips<SellerPaymentType> value={filter.paymentType} onChange={(paymentType) => update({ paymentType })} options={[
              { value: "all", label: "결제 전체" }, { value: "real", label: "실결제" }, { value: "mock", label: "모의결제", count: data?.counts.mock },
            ]} />
          </div>
          <FilterChips<SellerOrderStatus> value={filter.status} onChange={(status) => update({ status })} options={STATUS_OPTIONS.map((option) => ({
            ...option,
            count: option.value === "all" ? data?.counts.all : option.value === "paid" ? data?.counts.paid
              : option.value === "pending" ? data?.counts.pending : option.value === "cancelled" ? data?.counts.cancelled : undefined,
          }))} />
        </div>
      }>
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="주문이 없습니다" /> : (
          <>
            <DataTable minWidth={1180} head={["주문번호 · 주문일", "상품 · 옵션", "수량 · 금액", "결제", "제작", "배송", "취소 · 환불", "구매자"]}>
              {rows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-stone-50">
                  <Td>
                    <p className="font-mono text-xs font-semibold">{row.order_number ?? "-"}</p>
                    <p className="text-[11px] text-stone-400">{dateTime(row.ordered_at)}</p>
                  </Td>
                  <Td>
                    <p className="max-w-[200px] truncate text-xs font-semibold">{row.funding_name}</p>
                    <p className="text-[11px] text-stone-500">{row.color ?? "-"} / {row.size ?? "-"}</p>
                  </Td>
                  <Td className="whitespace-nowrap text-xs tabular-nums">{row.quantity}장 · <b>{won(row.total_amount)}</b></Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <MappedBadge map={PAYMENT_STATUS} value={row.payment_status} />
                      {row.is_mock ? <StatusBadge tone="amber">모의결제 · 매출 제외</StatusBadge> : row.payment_provider !== "none" && <StatusBadge tone="neutral">실결제</StatusBadge>}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-xs">{PRODUCTION_STAGE_LABEL[row.production_stage as ProductionStage] ?? row.production_stage ?? "-"}</Td>
                  <Td className="whitespace-nowrap text-xs">
                    {row.status_group === "paid" ? SHIPPING_STATUS_LABEL[row.shipping_status as ShippingStatus] ?? "-" : "-"}
                    {row.tracking_number && <p className="font-mono text-[11px] text-stone-400">{row.courier ?? ""} {row.tracking_number}</p>}
                  </Td>
                  <Td className="text-xs">
                    {row.refund_request_status && !row.is_cancelled
                      ? <MappedBadge map={REFUND_STATUS} value={row.refund_request_status} />
                      : <span className={row.is_cancelled ? "font-semibold text-rose-600" : "text-stone-400"}>{cancelStatusLabel(row)}</span>}
                    {row.cancellation_reason && <p className="mt-0.5 max-w-[160px] truncate text-[11px] text-stone-400" title={row.cancellation_reason}>{row.cancellation_reason}</p>}
                  </Td>
                  <Td className="whitespace-nowrap text-xs">
                    <p className="font-semibold">{row.buyer_name ?? "-"}</p>
                    <p className="text-[11px] text-stone-400">{row.buyer_phone_masked ?? ""}</p>
                  </Td>
                </tr>
              ))}
            </DataTable>
            <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </Panel>
      <p className="mt-3 text-xs text-stone-500">
        취소 · 환불은 결제 상태와 함께 처리되어야 하므로 이 화면에서 바로 바꾸지 않습니다. 참여 취소와 배송 정보 입력은 펀딩별
        <Link to="/seller/fundings" className="mx-1 font-semibold text-[#741b2b] underline-offset-2 hover:underline">참여 · 배송 처리</Link>
        화면에서 진행하며, 실결제 취소는 PG 환불 결과를 확인한 뒤에만 반영됩니다.
      </p>

      <AlertDialog open={confirmExport} onOpenChange={(open) => !exporting && setConfirmExport(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#741b2b]" />개인정보가 포함된 파일입니다</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              현재 조건({productName ?? "전체 상품"} · {STATUS_OPTIONS.find((o) => o.value === filter.status)?.label})의 주문 {data?.total ?? 0}건을 내려받습니다.
              배송 처리 목적으로만 사용하고 외부에 공유하지 마세요. 다운로드 기록은 BRAND-ER 에 저장되며, 취소 · 환불 주문의 연락처와 주소는 포함되지 않습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={exporting}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void runExport(); }} disabled={exporting} className="bg-[#741b2b] hover:bg-[#5c1522]">
              {exporting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}동의하고 다운로드
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrdersPage;
