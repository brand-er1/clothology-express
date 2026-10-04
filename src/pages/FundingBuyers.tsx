import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { FundingManageTabs } from "@/components/funding/FundingManageTabs";
import { ProductionSummaryPanel } from "@/components/buyers/ProductionSummaryPanel";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import {
  BUYER_STATUS_FILTERS, EMPTY_BUYER_FILTER, buildBuyerWorkbook, buildProductionSummary, buyerExportFileName,
  filterBuyers, formatKstDate, paymentStatusLabel, shippingStatusLabel, sortSizes, summarizeBuyers,
  type BuyerFilter, type BuyerRow,
} from "@/lib/buyer-management";
import { exportFileDate } from "@/lib/order-export";
import { downloadXlsx } from "@/lib/xlsx";
import { cn } from "@/lib/utils";
import {
  BuyerAccessError, exportFundingBuyers, fetchFundingBuyers,
  type BuyerExportScope, type FundingBuyersResult,
} from "@/services/fundingBuyers";
import {
  ArrowLeft, CheckCircle2, Clock3, Download, FileSpreadsheet, Loader2, Lock, PackageCheck, RotateCcw,
  Search, ShoppingBag, Users, XCircle,
} from "lucide-react";

const PAGE_SIZE = 20;

const STATUS_TONE: Record<BuyerRow["status_group"], string> = {
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  cancelled: "bg-stone-100 text-stone-500 ring-stone-200",
};

const PaymentBadge = ({ row }: { row: BuyerRow }) => (
  <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset", STATUS_TONE[row.status_group])}>
    {paymentStatusLabel(row)}
  </span>
);

type PendingExport = { scope: BuyerExportScope; ids: string[] | null; count: number; title: string };

const FundingBuyers = () => {
  const { id } = useParams();
  const [data, setData] = useState<FundingBuyersResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BuyerFilter>(EMPTY_BUYER_FILTER);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pendingExport, setPendingExport] = useState<PendingExport | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      setData(await fetchFundingBuyers(id));
      setDenied(null);
    } catch (error) {
      if (error instanceof BuyerAccessError) setDenied(error.message);
      else setLoadError(error instanceof Error ? error.message : "구매자 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const sizeOrder = useMemo(() => data?.funding.size_options ?? [], [data]);
  const colorOrder = useMemo(() => data?.funding.color_options ?? [], [data]);

  const sizeOptions = useMemo(
    () => sortSizes(Array.from(new Set(rows.map((row) => row.size).filter((size): size is string => Boolean(size)))), sizeOrder),
    [rows, sizeOrder],
  );
  const colorOptions = useMemo(() => {
    const colors = Array.from(new Set(rows.map((row) => row.color).filter((color): color is string => Boolean(color))));
    return colors.sort((a, b) => {
      const ia = colorOrder.indexOf(a);
      const ib = colorOrder.indexOf(b);
      return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib) || a.localeCompare(b, "ko-KR");
    });
  }, [rows, colorOrder]);

  const summary = useMemo(() => summarizeBuyers(rows), [rows]);
  const production = useMemo(() => buildProductionSummary(rows, sizeOrder, colorOrder), [rows, sizeOrder, colorOrder]);
  const filtered = useMemo(() => filterBuyers(rows, filter), [rows, filter]);
  const filterActive = filter.status !== "all" || filter.size !== "all" || filter.color !== "all" || filter.search.trim() !== "";

  useEffect(() => { setPage(1); }, [filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selectedRows = useMemo(() => rows.filter((row) => selected.has(row.id)), [rows, selected]);
  const selectedBuyerCount = new Set(selectedRows.map((row) => row.participant_id)).size;
  const allFilteredSelected = filtered.length > 0 && filtered.every((row) => selected.has(row.id));

  const toggleRow = (rowId: string, checked: boolean) => setSelected((current) => {
    const next = new Set(current);
    if (checked) next.add(rowId); else next.delete(rowId);
    return next;
  });
  const selectAllFiltered = () => setSelected((current) => new Set([...current, ...filtered.map((row) => row.id)]));
  const clearSelection = () => setSelected(new Set());
  const toggleAllFiltered = () => (allFilteredSelected
    ? setSelected((current) => { const next = new Set(current); filtered.forEach((row) => next.delete(row.id)); return next; })
    : selectAllFiltered());

  const updateFilter = <K extends keyof BuyerFilter>(key: K, value: BuyerFilter[K]) => setFilter((current) => ({ ...current, [key]: value }));

  const requestExport = (scope: BuyerExportScope) => {
    if (scope === "selected") {
      setPendingExport({ scope, ids: selectedRows.map((row) => row.id), count: selectedRows.length, title: `선택한 ${selectedRows.length}건` });
    } else if (scope === "filtered" && filterActive) {
      setPendingExport({ scope, ids: filtered.map((row) => row.id), count: filtered.length, title: `현재 필터 결과 ${filtered.length}건` });
    } else {
      setPendingExport({ scope: "all", ids: null, count: rows.length, title: `전체 ${rows.length}건` });
    }
  };

  // 화면 목록을 그대로 쓰지 않고, 서버에서 권한을 다시 확인한 뒤 받은 데이터로 엑셀을 만든다.
  const runExport = async () => {
    if (!id || !pendingExport || !data) return;
    setExporting(true);
    try {
      const result = await exportFundingBuyers(id, pendingExport.ids, pendingExport.scope);
      if (result.rows.length === 0) {
        toast({ title: "다운로드할 구매자가 없습니다", variant: "destructive" });
        return;
      }
      downloadXlsx(
        buyerExportFileName(result.funding?.product_name || data.funding.product_name, exportFileDate()),
        buildBuyerWorkbook(result.rows, sizeOrder, colorOrder),
      );
      toast({ title: "엑셀 파일을 저장했습니다", description: `구매자 목록 ${result.count}건 · 생산수량 요약 시트 포함` });
      setPendingExport(null);
    } catch (error) {
      if (error instanceof BuyerAccessError) setDenied(error.message);
      toast({ title: "엑셀 파일을 만들지 못했습니다", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#f7f5f2]">
        <Header />
        <div className="flex min-h-screen items-center justify-center text-gray-500">
          <Loader2 className="mr-2 h-6 w-6 animate-spin text-brand" /> 구매자 정보를 불러오는 중입니다
        </div>
      </div>
    );
  }

  if (denied || !data) {
    return (
      <div className="min-h-screen bg-[#f7f5f2]">
        <Header />
        <main className="container mx-auto flex min-h-screen max-w-lg items-center px-4">
          <Card className="w-full rounded-lg text-center">
            <CardContent className="p-8">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10">
                {denied ? <Lock className="h-5 w-5 text-brand" /> : <XCircle className="h-5 w-5 text-brand" />}
              </span>
              <h1 className="mt-4 text-xl font-bold">{denied ? "구매자 정보를 볼 수 없습니다" : "구매자 목록을 불러오지 못했습니다"}</h1>
              <p className="mt-2 text-sm text-gray-500">
                {denied ? "구매자 정보는 펀딩을 개설한 제작자 본인과 관리자만 확인할 수 있습니다." : loadError}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {!denied && <Button variant="outline" className="rounded-full" onClick={() => void load()}>다시 시도</Button>}
                <Button asChild className="rounded-full bg-brand hover:bg-brand-dark"><Link to="/my-fundings">내 펀딩으로</Link></Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const { funding } = data;
  const kpis = [
    { label: "총 구매자 수", value: `${summary.buyers.toLocaleString("ko-KR")}명`, hint: "취소/환불 제외", icon: Users },
    { label: "총 주문 건수", value: `${summary.orders.toLocaleString("ko-KR")}건`, hint: "전체 상태 포함", icon: ShoppingBag },
    { label: "총 구매 수량", value: `${summary.quantity.toLocaleString("ko-KR")}장`, hint: "결제 완료 기준", icon: PackageCheck },
    { label: "결제 완료", value: `${summary.paid.toLocaleString("ko-KR")}건`, icon: CheckCircle2 },
    { label: "결제 대기", value: `${summary.pending.toLocaleString("ko-KR")}건`, icon: Clock3 },
    { label: "취소/환불", value: `${summary.cancelled.toLocaleString("ko-KR")}건`, icon: XCircle },
  ];

  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 pb-16 pt-20 sm:pt-24 md:pb-24">
        <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="min-w-0">
            <Link to="/my-fundings" className="mb-5 inline-flex items-center text-sm text-gray-500 hover:text-gray-900">
              <ArrowLeft className="mr-1 h-4 w-4" /> 내 펀딩으로 돌아가기
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="shrink-0">{data.access === "admin" ? "관리자 열람" : "개설자 전용"}</Badge>
              <span className="text-sm text-gray-500">이름·연락처·주소 등 개인정보는 생산·배송 목적 외 사용을 금지합니다.</span>
            </div>
            <h1 className="mt-3 break-words text-2xl font-bold tracking-[-0.03em] md:text-4xl">{funding.product_name}</h1>
            <p className="mt-2 text-gray-500">구매자 관리{funding.brand_name ? ` · ${funding.brand_name}` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2 self-start md:self-auto">
            <Button variant="outline" className="rounded-full bg-white" disabled={rows.length === 0} onClick={() => requestExport("all")}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" /> 전체 다운로드
            </Button>
            <Button className="rounded-full bg-brand hover:bg-brand-dark" disabled={filtered.length === 0} onClick={() => requestExport("filtered")}>
              <Download className="mr-1.5 h-4 w-4" /> Excel 다운로드
            </Button>
          </div>
        </div>

        <FundingManageTabs fundingId={funding.id} className="mb-6" />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {kpis.map(({ label, value, hint, icon: Icon }) => (
            <Card key={label} className="rounded-lg">
              <CardContent className="flex min-w-0 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-500">{label}</p>
                  <Icon className="h-4 w-4 shrink-0 text-brand" />
                </div>
                <p className="mt-2 truncate text-xl font-bold tabular-nums md:text-2xl">{value}</p>
                {hint && <p className="mt-0.5 truncate text-[11px] text-gray-400">{hint}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-5 rounded-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">옵션별 생산 수량</CardTitle>
            <p className="text-sm text-gray-500">결제 완료 · 미취소 주문 기준입니다. 엑셀의 「생산수량 요약」 시트에도 함께 저장됩니다.</p>
          </CardHeader>
          <CardContent><ProductionSummaryPanel summary={production} /></CardContent>
        </Card>

        <Card className="mt-5 overflow-hidden rounded-lg">
          <CardHeader className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>구매자 목록</CardTitle>
              <span className="text-sm text-gray-500">
                {filterActive ? `필터 결과 ${filtered.length.toLocaleString("ko-KR")}건 / 전체 ${rows.length.toLocaleString("ko-KR")}건` : `전체 ${rows.length.toLocaleString("ko-KR")}건`}
              </span>
            </div>
            <div className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="상태 필터">
              {BUYER_STATUS_FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={filter.status === option.value}
                  onClick={() => updateFilter("status", option.value)}
                  className={cn(
                    "min-h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold transition",
                    filter.status === option.value ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={filter.search}
                  onChange={(event) => updateFilter("search", event.target.value)}
                  placeholder="구매자명, 연락처, 주문번호 검색"
                  aria-label="구매자 검색"
                  className="h-10 pl-9"
                />
              </div>
              <Select value={filter.size} onValueChange={(value) => updateFilter("size", value)}>
                <SelectTrigger className="h-10" aria-label="사이즈"><SelectValue placeholder="사이즈" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 사이즈</SelectItem>
                  {sizeOptions.map((size) => <SelectItem key={size} value={size}>{size}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filter.color} onValueChange={(value) => updateFilter("color", value)}>
                <SelectTrigger className="h-10" aria-label="컬러/옵션"><SelectValue placeholder="컬러/옵션" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 컬러/옵션</SelectItem>
                  {colorOptions.map((color) => <SelectItem key={color} value={color}>{color}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="ghost" className="h-10" disabled={!filterActive} onClick={() => setFilter(EMPTY_BUYER_FILTER)}>
                <RotateCcw className="mr-1.5 h-4 w-4" /> 초기화
              </Button>
            </div>
            <div className="flex flex-col gap-2 rounded-xl bg-stone-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">
                  선택 {selectedRows.length.toLocaleString("ko-KR")}건
                  {selectedRows.length > 0 && <span className="font-normal text-gray-500"> (구매자 {selectedBuyerCount}명)</span>}
                </span>
                <Button size="sm" variant="outline" className="h-8 bg-white" disabled={filtered.length === 0 || allFilteredSelected} onClick={selectAllFiltered}>
                  전체 선택
                </Button>
                <Button size="sm" variant="outline" className="h-8 bg-white" disabled={selected.size === 0} onClick={clearSelection}>
                  선택 해제
                </Button>
              </div>
              <Button size="sm" className="h-9 rounded-full bg-brand hover:bg-brand-dark" disabled={selectedRows.length === 0} onClick={() => requestExport("selected")}>
                <Download className="mr-1.5 h-4 w-4" /> 선택 {selectedRows.length}건 → Excel 다운로드
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <div className="py-20 text-center text-sm text-gray-500">
                <PackageCheck className="mx-auto mb-4 h-10 w-10 text-brand/40" />
                아직 구매자가 없습니다.
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center text-sm text-gray-500">검색·필터 조건에 맞는 구매자가 없습니다.</div>
            ) : (
              <>
                {/* 스마트폰: 주문별 카드 */}
                <div className="space-y-3 md:hidden">
                  {paged.map((row) => (
                    <article key={row.id} className={cn("rounded-xl border bg-white p-4 text-sm", selected.has(row.id) && "border-brand ring-1 ring-brand/30", row.status_group === "cancelled" && "opacity-60")}>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selected.has(row.id)}
                          onCheckedChange={(checked) => toggleRow(row.id, checked === true)}
                          aria-label={`${row.buyer_name ?? "구매자"} 선택`}
                          className="mt-1 h-5 w-5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-base font-bold">{row.buyer_name}</p>
                              <p className="text-wrap-anywhere font-mono text-xs text-gray-400">{row.order_number || "-"}</p>
                            </div>
                            <PaymentBadge row={row} />
                          </div>
                          <dl className="mt-3 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t pt-3 text-[13px] leading-5">
                            <dt className="text-gray-400">연락처</dt>
                            <dd>{row.buyer_phone ? <a href={`tel:${row.buyer_phone}`} className="font-semibold text-brand">{row.buyer_phone}</a> : "-"}</dd>
                            <dt className="text-gray-400">옵션</dt>
                            <dd className="font-semibold">{row.color ?? "-"} · {row.size ?? "-"} · {row.quantity}장</dd>
                            <dt className="text-gray-400">결제금액</dt>
                            <dd className="font-semibold tabular-nums">{row.total_amount != null ? `${row.total_amount.toLocaleString("ko-KR")}원` : "-"}</dd>
                            <dt className="text-gray-400">주문일</dt>
                            <dd>{formatKstDate(row.ordered_at) || "-"}</dd>
                            <dt className="text-gray-400">배송상태</dt>
                            <dd>{shippingStatusLabel(row)}</dd>
                          </dl>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {/* 태블릿·데스크톱: 표(좁은 화면은 가로 스크롤) */}
                <div className="hidden overflow-x-auto rounded-xl border md:block">
                  <Table className="min-w-[1040px] [&_th]:whitespace-nowrap">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAllFiltered} aria-label="현재 필터 결과 전체 선택" />
                        </TableHead>
                        <TableHead>주문번호</TableHead>
                        <TableHead>구매자명</TableHead>
                        <TableHead>연락처</TableHead>
                        <TableHead>옵션/컬러</TableHead>
                        <TableHead>사이즈</TableHead>
                        <TableHead className="text-right">수량</TableHead>
                        <TableHead className="text-right">결제금액</TableHead>
                        <TableHead>결제상태</TableHead>
                        <TableHead>주문일</TableHead>
                        <TableHead>배송상태</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.map((row) => (
                        <TableRow key={row.id} data-state={selected.has(row.id) ? "selected" : undefined} className={row.status_group === "cancelled" ? "opacity-60" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={selected.has(row.id)}
                              onCheckedChange={(checked) => toggleRow(row.id, checked === true)}
                              aria-label={`${row.buyer_name ?? "구매자"} 선택`}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-xs">{row.order_number || "-"}</TableCell>
                          <TableCell className="whitespace-nowrap font-medium">{row.buyer_name}</TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums">{row.buyer_phone || "-"}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.color ?? "-"}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.size ?? "-"}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.quantity}</TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">{row.total_amount != null ? `${row.total_amount.toLocaleString("ko-KR")}원` : "-"}</TableCell>
                          <TableCell><PaymentBadge row={row} /></TableCell>
                          <TableCell className="whitespace-nowrap">{formatKstDate(row.ordered_at) || "-"}</TableCell>
                          <TableCell className="whitespace-nowrap">{shippingStatusLabel(row)}</TableCell>
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
      </main>

      <AlertDialog open={!!pendingExport} onOpenChange={(open) => { if (!open && !exporting) setPendingExport(null); }}>
        <AlertDialogContent className="max-w-lg rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>개인정보가 포함된 파일입니다</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingExport?.title}의 구매자 정보가 「구매자 목록」 시트로, 컬러·사이즈별 수량이 「생산수량 요약」 시트로 저장됩니다.
              이름·연락처·이메일·배송 주소가 포함되므로 생산·포장·배송 업무 외에는 사용하지 말고, 업무가 끝나면 안전하게 폐기해주세요.
              다운로드 기록은 서버에 남습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={exporting}>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand hover:bg-brand-dark"
              disabled={exporting}
              onClick={(event) => { event.preventDefault(); void runExport(); }}
            >
              {exporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              동의하고 Excel 다운로드
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FundingBuyers;
