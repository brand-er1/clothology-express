import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronDown, ChevronRight, Clock3, Download, PackageCheck, ShoppingBag, Users, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DataTable, EmptyState, ErrorBanner, FilterChips, KpiCard, LoadingBlock, Notice, PageHeader, Pager, Panel, SearchInput, StatusBadge, Td,
} from "@/components/admin/shell/ui";
import { ReasonDialog, type ReasonDialogState } from "@/components/admin/shell/ReasonDialog";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { ProductionSummaryPanel } from "@/components/buyers/ProductionSummaryPanel";
import { adminRpc } from "@/services/adminApi";
import { num, won } from "@/lib/admin/format";
import type { Tone } from "@/lib/admin/format";
import {
  BUYER_STATUS_FILTERS, buildBuyerWorkbook, buyerExportFileName, formatKstDate, paymentStatusLabel, productionFromCells,
  shippingStatusLabel, sortSizes, type BuyerRow, type BuyerStatusFilter, type BuyerSummary, type ProductionCell,
} from "@/lib/buyer-management";
import { exportFileDate } from "@/lib/order-export";
import { downloadXlsx } from "@/lib/xlsx";
import { OrderSheet } from "./OrdersPage";

const PAGE = 50;
const ALL = "all";

type FilterOptions = {
  brands: { id: string; name: string }[];
  creators: { id: string; name: string; brand_ids: string[] }[];
  fundings: { id: string; name: string; brand_id: string | null; creator_id: string; size_options: string[]; color_options: string[]; orders: number }[];
};

type BuyerListResult = {
  total: number;
  rows: BuyerRow[];
  ids: string[];
  summary: BuyerSummary & { matrix: ProductionCell[] };
  options: { sizes: string[]; colors: string[] };
};

type ExportResult = { rows: BuyerRow[]; count: number; label: string };

const STATUS_TONE: Record<BuyerRow["status_group"], Tone> = { paid: "green", pending: "amber", cancelled: "neutral" };

const BuyersPage = () => {
  const [params, setParams] = useSearchParams();
  const brandId = params.get("brand");
  const creatorId = params.get("creator");
  const fundingId = params.get("funding");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<BuyerStatusFilter>("all");
  const [size, setSize] = useState(ALL);
  const [color, setColor] = useState(ALL);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const [exportDialog, setExportDialog] = useState<ReasonDialogState>(null);

  const options = useAdminQuery(() => adminRpc<FilterOptions>("admin_buyer_filter_options"), []);
  const filterArgs = {
    p_brand_id: brandId, p_creator_id: creatorId, p_funding_id: fundingId,
    p_search: search || null, p_status: status, p_size: size === ALL ? null : size, p_color: color === ALL ? null : color,
  };
  const { data, loading, error, reload } = useAdminQuery(
    () => adminRpc<BuyerListResult>("admin_list_buyers", { ...filterArgs, p_limit: PAGE, p_offset: page * PAGE }),
    [brandId, creatorId, fundingId, search, status, size, color, page],
  );

  const brands = options.data?.brands ?? [];
  const creators = useMemo(
    () => (options.data?.creators ?? []).filter((creator) => !brandId || creator.brand_ids.includes(brandId)),
    [options.data, brandId],
  );
  const fundings = useMemo(
    () => (options.data?.fundings ?? []).filter((funding) => (!brandId || funding.brand_id === brandId) && (!creatorId || funding.creator_id === creatorId)),
    [options.data, brandId, creatorId],
  );
  const brand = brands.find((item) => item.id === brandId);
  const creator = options.data?.creators.find((item) => item.id === creatorId);
  const funding = options.data?.fundings.find((item) => item.id === fundingId);
  const scopeLabel = funding?.name ?? creator?.name ?? brand?.name ?? null;

  const sizeOrder = useMemo(() => funding?.size_options ?? [], [funding]);
  const colorOrder = useMemo(() => funding?.color_options ?? [], [funding]);
  const production = useMemo(() => productionFromCells(data?.summary.matrix ?? [], sizeOrder, colorOrder), [data, sizeOrder, colorOrder]);
  const sizeOptions = useMemo(() => sortSizes(data?.options.sizes ?? [], sizeOrder), [data, sizeOrder]);
  const colorOptions = data?.options.colors ?? [];

  const rows = data?.rows ?? [];
  const pageAllSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const allFilteredSelected = Boolean(data?.ids.length) && data!.ids.every((id) => selected.has(id));
  const filterActive = Boolean(search) || status !== "all" || size !== ALL || color !== ALL;

  const resetPage = () => setPage(0);
  // 상위 범위를 바꾸면 하위 범위와 옵션 필터를 초기화한다: 전체 → 브랜드 → 제작자 → 펀딩
  const setScope = (next: { brand?: string | null; creator?: string | null; funding?: string | null }) => {
    const merged = { brand: brandId, creator: creatorId, funding: fundingId, ...next };
    const query: Record<string, string> = {};
    if (merged.brand) query.brand = merged.brand;
    if (merged.creator) query.creator = merged.creator;
    if (merged.funding) query.funding = merged.funding;
    setParams(query);
    setSize(ALL);
    setColor(ALL);
    resetPage();
  };

  const toggle = (id: string, checked: boolean) => setSelected((current) => {
    const next = new Set(current);
    if (checked) next.add(id); else next.delete(id);
    return next;
  });
  const togglePage = () => setSelected((current) => {
    const next = new Set(current);
    rows.forEach((row) => (pageAllSelected ? next.delete(row.id) : next.add(row.id)));
    return next;
  });

  type ExportKind = "filtered" | "selected" | "scope" | "all";
  const openExport = (kind: ExportKind) => {
    const titles: Record<ExportKind, string> = {
      filtered: `현재 검색/필터 결과 ${num(data?.total ?? 0)}건`,
      selected: `선택한 ${num(selected.size)}건`,
      scope: `${scopeLabel ?? "선택 범위"} 구매자 전체`,
      all: "전체 구매자",
    };
    const args = {
      filtered: { ...filterArgs, p_ids: null },
      selected: { p_ids: Array.from(selected) },
      scope: { p_brand_id: brandId, p_creator_id: creatorId, p_funding_id: fundingId, p_ids: null },
      all: { p_ids: null },
    }[kind];
    const fileLabel = kind === "all" ? "전체" : scopeLabel ?? (kind === "selected" ? "선택" : "전체");
    setExportDialog({
      title: "구매자 엑셀 다운로드",
      description: <>{titles[kind]}가 「구매자 목록」과 「생산수량 요약」 시트로 저장됩니다. 이름·연락처·이메일·주소 등 개인정보가 포함되며 다운로드 기록이 Audit Log 에 남습니다.</>,
      confirmLabel: "다운로드",
      reasonLabel: "다운로드 사유",
      placeholder: "예: 출고 준비용 수령인 목록 전달",
      successMessage: "엑셀 파일을 저장했습니다",
      onConfirm: async (reason) => {
        const result = await adminRpc<ExportResult>("admin_export_buyers", { ...args, p_scope: kind, p_reason: reason });
        if (!result.rows?.length) throw new Error("다운로드할 구매자가 없습니다.");
        downloadXlsx(buyerExportFileName(fileLabel, exportFileDate()), buildBuyerWorkbook(result.rows, sizeOrder, colorOrder));
        return { warning: `${num(result.count)}건을 내보냈습니다.${result.count >= 20000 ? " (최대 20,000건)" : ""}` };
      },
    });
  };

  const summary = data?.summary;
  const optionsReady = Boolean(options.data);

  return (
    <div>
      <PageHeader
        eyebrow="Buyers"
        title="구매자 관리"
        description="전체 → 브랜드 → 제작자 → 펀딩 순으로 범위를 좁혀 구매자를 조회하고 엑셀로 내려받습니다. 개인정보 열람 권한(orders.pii)이 필요합니다."
        actions={(
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm"><Download className="mr-1.5 h-3.5 w-3.5" />Excel 다운로드<ChevronDown className="ml-1 h-3.5 w-3.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>다운로드 범위</DropdownMenuLabel>
              <DropdownMenuItem disabled={!data?.total} onSelect={() => openExport("filtered")}>현재 검색/필터 결과 ({num(data?.total ?? 0)}건)</DropdownMenuItem>
              <DropdownMenuItem disabled={selected.size === 0} onSelect={() => openExport("selected")}>선택한 구매자 ({num(selected.size)}건)</DropdownMenuItem>
              {scopeLabel && (
                <DropdownMenuItem onSelect={() => openExport("scope")}>
                  {funding ? "이 펀딩" : creator ? "이 제작자" : "이 브랜드"} 구매자 전체 · {scopeLabel}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => openExport("all")}>전체 구매자</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <Panel className="mb-4" title="조회 범위" description="상위 범위를 바꾸면 하위 선택과 사이즈/컬러 필터가 초기화됩니다.">
        {options.error && <div className="mb-3"><ErrorBanner message={options.error} onRetry={options.reload} /></div>}
        <nav aria-label="조회 범위 경로" className="mb-3 flex flex-wrap items-center gap-1 text-xs font-bold text-stone-500">
          <button type="button" className="rounded px-1 hover:text-stone-900" onClick={() => setScope({ brand: null, creator: null, funding: null })}>전체 구매자</button>
          {brand && <><ChevronRight className="h-3 w-3" /><button type="button" className="rounded px-1 hover:text-stone-900" onClick={() => setScope({ creator: null, funding: null })}>{brand.name}</button></>}
          {creator && <><ChevronRight className="h-3 w-3" /><button type="button" className="rounded px-1 hover:text-stone-900" onClick={() => setScope({ funding: null })}>{creator.name}</button></>}
          {funding && <><ChevronRight className="h-3 w-3" /><span className="px-1 text-stone-900">{funding.name}</span></>}
        </nav>
        <div className="grid gap-2 sm:grid-cols-3">
          <Select disabled={!optionsReady} value={brandId ?? ALL} onValueChange={(value) => setScope({ brand: value === ALL ? null : value, creator: null, funding: null })}>
            <SelectTrigger className="h-9 rounded-xl" aria-label="브랜드"><SelectValue placeholder="브랜드" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>전체 브랜드</SelectItem>
              {brands.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select disabled={!optionsReady} value={creatorId ?? ALL} onValueChange={(value) => setScope({ creator: value === ALL ? null : value, funding: null })}>
            <SelectTrigger className="h-9 rounded-xl" aria-label="제작자"><SelectValue placeholder="제작자" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>전체 제작자</SelectItem>
              {creators.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select disabled={!optionsReady} value={fundingId ?? ALL} onValueChange={(value) => setScope({ funding: value === ALL ? null : value })}>
            <SelectTrigger className="h-9 rounded-xl" aria-label="펀딩"><SelectValue placeholder="펀딩" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>전체 펀딩</SelectItem>
              {fundings.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} ({num(item.orders)}건)</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Panel>

      {error && <div className="mb-4"><ErrorBanner message={error} onRetry={reload} /></div>}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="총 구매자 수" value={summary ? `${num(summary.buyers)}명` : "-"} hint="취소/환불 제외" icon={Users} emphasis />
        <KpiCard label="총 주문 건수" value={summary ? `${num(summary.orders)}건` : "-"} icon={ShoppingBag} />
        <KpiCard label="총 구매 수량" value={summary ? `${num(summary.quantity)}장` : "-"} hint="결제 완료 기준" icon={PackageCheck} />
        <KpiCard label="결제 완료" value={summary ? `${num(summary.paid)}건` : "-"} icon={CheckCircle2} />
        <KpiCard label="결제 대기" value={summary ? `${num(summary.pending)}건` : "-"} icon={Clock3} />
        <KpiCard label="취소/환불" value={summary ? `${num(summary.cancelled)}건` : "-"} icon={XCircle} />
      </div>

      <Panel className="mb-4" title="옵션별 생산 수량" description="현재 범위·검색·필터 결과 중 결제 완료 · 미취소 주문 기준">
        {loading && !data ? <LoadingBlock /> : <ProductionSummaryPanel summary={production} />}
      </Panel>

      <Panel bodyClassName="p-0" title={
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <SearchInput value={search} onChange={(value) => { setSearch(value); resetPage(); }} placeholder="구매자명, 연락처, 주문번호" />
            <div className="grid grid-cols-2 gap-2 lg:w-80">
              <Select value={size} onValueChange={(value) => { setSize(value); resetPage(); }}>
                <SelectTrigger className="h-9 rounded-xl" aria-label="사이즈"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>전체 사이즈</SelectItem>
                  {sizeOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={color} onValueChange={(value) => { setColor(value); resetPage(); }}>
                <SelectTrigger className="h-9 rounded-xl" aria-label="컬러/옵션"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>전체 컬러/옵션</SelectItem>
                  {colorOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <FilterChips value={status} onChange={(value) => { setStatus(value); resetPage(); }} options={BUYER_STATUS_FILTERS} />
          <div className="flex flex-wrap items-center gap-2 text-xs font-normal">
            <span className="font-bold text-stone-700">선택 {num(selected.size)}건</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!data?.ids.length || allFilteredSelected}
              onClick={() => setSelected((current) => new Set([...current, ...(data?.ids ?? [])]))}>
              전체 선택{data ? ` (${num(data.total)}건)` : ""}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={selected.size === 0} onClick={() => setSelected(new Set())}>선택 해제</Button>
            <Button size="sm" className="h-7 text-xs" disabled={selected.size === 0} onClick={() => openExport("selected")}>
              <Download className="mr-1 h-3 w-3" />선택 {num(selected.size)}건 → Excel 다운로드
            </Button>
            {filterActive && <span className="text-stone-400">검색/필터 적용 중</span>}
          </div>
        </div>
      }>
        {selected.size > 0 && filterActive && !allFilteredSelected && (
          <div className="px-4 pt-3"><Notice tone="stone">선택은 필터를 바꿔도 유지됩니다. 현재 목록에 보이지 않는 선택 항목도 다운로드에 포함됩니다.</Notice></div>
        )}
        {loading && !data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="구매자가 없습니다" description="범위나 검색·필터 조건을 바꿔보세요." /> : (
          <DataTable minWidth={1320} head={[
            <Checkbox key="all" checked={pageAllSelected} onCheckedChange={togglePage} aria-label="이 페이지 전체 선택" />,
            "주문번호", "구매자명", "연락처", "펀딩 · 브랜드", "제작자", "옵션/컬러", "사이즈", "수량", "결제금액", "결제상태", "주문일", "배송상태",
          ]}>
            {rows.map((row) => (
              <tr key={row.id} className="cursor-pointer hover:bg-stone-50" onClick={() => setOpenOrder(row.id)}>
                <Td>
                  <span onClick={(event) => event.stopPropagation()}>
                    <Checkbox checked={selected.has(row.id)} onCheckedChange={(checked) => toggle(row.id, checked === true)} aria-label={`${row.buyer_name ?? "구매자"} 선택`} />
                  </span>
                </Td>
                <Td className="whitespace-nowrap font-mono text-[11px]">{row.order_number ?? row.id.slice(0, 8)}</Td>
                <Td className="whitespace-nowrap font-semibold">{row.buyer_name}</Td>
                <Td className="whitespace-nowrap text-xs tabular-nums">{row.buyer_phone ?? "-"}</Td>
                <Td className="text-xs"><p className="max-w-[200px] truncate font-semibold">{row.funding_name}</p><p className="text-stone-400">{row.brand_name ?? "-"}</p></Td>
                <Td className="whitespace-nowrap text-xs">{row.creator_name ?? "-"}</Td>
                <Td className="whitespace-nowrap text-xs">{row.color ?? "-"}</Td>
                <Td className="whitespace-nowrap text-xs">{row.size ?? "-"}</Td>
                <Td className="tabular-nums">{num(row.quantity)}</Td>
                <Td className="whitespace-nowrap font-bold tabular-nums">{row.total_amount != null ? won(row.total_amount) : "-"}</Td>
                <Td><StatusBadge tone={STATUS_TONE[row.status_group]}>{paymentStatusLabel(row)}</StatusBadge></Td>
                <Td className="whitespace-nowrap text-xs">{formatKstDate(row.ordered_at) || "-"}</Td>
                <Td className="whitespace-nowrap text-xs">{shippingStatusLabel(row)}</Td>
              </tr>
            ))}
          </DataTable>
        )}
        <Pager page={page} pageSize={PAGE} total={data?.total ?? 0} onPage={setPage} />
      </Panel>

      <OrderSheet orderId={openOrder} onClose={() => setOpenOrder(null)} onChanged={reload} />
      <ReasonDialog state={exportDialog} onClose={() => setExportDialog(null)} />
    </div>
  );
};

export default BuyersPage;
