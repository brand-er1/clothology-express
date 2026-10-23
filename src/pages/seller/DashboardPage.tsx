import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck, CalendarCheck2, Download, Flag, MessageCircleQuestion, PackageCheck, ReceiptText, RotateCcw, ShoppingBag, Star,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import {
  DataTable, EmptyState, ErrorBanner, FilterChips, KpiCard, LoadingBlock, MappedBadge, Notice, PageHeader, Panel, Td,
} from "@/components/admin/shell/ui";
import { RankBars, TrendChart } from "@/components/admin/shell/TrendChart";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { FUNDING_PHASE, num, pct, won } from "@/lib/admin/format";
import { exportFileDate } from "@/lib/order-export";
import { buildSalesWorkbook, sellerFileName } from "@/lib/seller-export";
import { downloadXlsx } from "@/lib/xlsx";
import { fetchSellerDashboard, type Granularity } from "@/services/seller";

const GRANULARITY: { value: Granularity; label: string }[] = [
  { value: "day", label: "일별 (30일)" },
  { value: "week", label: "주별 (12주)" },
  { value: "month", label: "월별 (12개월)" },
];

const DashboardPage = () => {
  const [granularity, setGranularity] = useState<Granularity>("day");
  const { data, loading, error, reload } = useAdminQuery(() => fetchSellerDashboard(granularity), [granularity]);

  const downloadSales = () => {
    if (!data) return;
    downloadXlsx(sellerFileName("판매데이터", exportFileDate()), buildSalesWorkbook(data));
    toast({ title: "판매 데이터를 저장했습니다", description: "상품별 · 기간별 · 브랜드별 시트 (실결제 기준, 모의결제 별도 열)" });
  };

  const k = data?.kpis;
  const totals = data?.series.reduce(
    (acc, point) => ({ real: acc.real + point.real_amount, orders: acc.orders + point.orders, mock: acc.mock + point.mock_amount }),
    { real: 0, orders: 0, mock: 0 },
  );

  return (
    <div>
      <PageHeader
        eyebrow="Seller dashboard"
        title="대시보드"
        description="모든 금액은 실결제 기준이며 모의결제는 매출 · 결제 · 정산에서 제외해 따로 표시합니다."
        actions={<Button variant="outline" size="sm" onClick={downloadSales} disabled={!data}><Download className="mr-1.5 h-4 w-4" />판매 데이터 엑셀</Button>}
      />
      {error && <div className="mb-4"><ErrorBanner message={error} onRetry={reload} /></div>}
      {loading && !data ? <LoadingBlock /> : !k ? null : (
        <div className="grid gap-5">
          <section aria-label="매출 · 정산" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KpiCard emphasis label="총 판매금액" value={won(k.total_sales)} hint="실결제 승인 누계 (환불 포함)" icon={WalletCards} />
            <KpiCard label="실제 결제 완료 금액" value={won(k.paid_amount)} hint={`환불 ${won(k.refunded_amount)} 제외`} icon={BadgeCheck} />
            <KpiCard label="정산 예정 금액" value={won(k.settlement_scheduled)} hint={`정산서 미생성 실결제 ${won(k.unsettled_paid_amount)}`} icon={CalendarCheck2} />
            <KpiCard label="정산 완료 금액" value={won(k.settlement_completed)} icon={ReceiptText} />
          </section>

          <section aria-label="운영 현황" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard label="진행 중인 펀딩" value={num(k.active_fundings)} hint={`승인 대기 ${num(k.pending_fundings)}`} icon={Flag} />
            <KpiCard label="종료된 펀딩" value={num(k.ended_fundings)} hint={`전체 ${num(k.total_fundings)}`} icon={PackageCheck} />
            <KpiCard label="전체 주문 수" value={num(k.total_orders)} hint={`결제 유지 ${num(k.active_orders)} · ${num(k.paid_quantity)}장`} icon={ShoppingBag} />
            <KpiCard label="취소 · 환불" value={`${num(k.cancelled_orders)} / ${num(k.refunded_orders)}`} hint={`처리 중 환불 요청 ${num(k.open_refund_requests)}`} icon={RotateCcw} />
            <KpiCard label="평균 고객 평점" value={k.review_count ? `★ ${Number(k.average_rating).toFixed(1)}` : "-"} hint={`리뷰 ${num(k.review_count)}개`} icon={Star} />
            <KpiCard label="신규 · 미답변 리뷰" value={`${num(k.new_reviews_7d)} / ${num(k.unanswered_reviews)}`} hint="최근 7일 / 답변 대기" icon={MessageCircleQuestion} />
          </section>

          {(k.mock_amount > 0 || k.pending_inquiries > 0 || k.unanswered_reviews > 0) && (
            <div className="grid gap-2 md:grid-cols-2">
              {k.mock_amount > 0 && (
                <Notice>모의결제 주문 {num(k.mock_orders)}건 · {won(k.mock_amount)} 은 실제 입금이 없어 매출 · 결제 완료 · 정산 금액에 포함하지 않았습니다.</Notice>
              )}
              {(k.pending_inquiries > 0 || k.unanswered_reviews > 0) && (
                <Notice tone="blue">
                  답변 대기: 고객 문의 <Link className="font-bold underline" to="/seller/inquiries">{num(k.pending_inquiries)}건</Link> ·
                  리뷰 <Link className="font-bold underline" to="/seller/reviews?reply=unanswered">{num(k.unanswered_reviews)}건</Link>
                </Notice>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <FilterChips<Granularity> value={granularity} onChange={setGranularity} options={GRANULARITY} />
            {totals && (
              <p className="text-xs text-stone-500">
                기간 {data?.range.from} ~ {data?.range.to} · 실결제 {won(totals.real)} · 주문 {num(totals.orders)}건
                {totals.mock > 0 && ` · 모의결제 ${won(totals.mock)} (제외)`}
              </p>
            )}
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title="실결제 매출 추이" description="결제 승인일(KST) 기준 · 모의결제 제외">
              <TrendChart data={data.series} dataKey="real_amount" label="실결제 매출" money />
            </Panel>
            <Panel title="주문 수 추이" description="실결제 승인 건수">
              <TrendChart data={data.series} dataKey="orders" label="주문" kind="bar" />
            </Panel>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Panel title="상품별 판매 현황" bodyClassName="p-0" actions={<Link to="/seller/products" className="text-xs font-bold text-[#741b2b]">상품 관리</Link>}>
              {data.products.length === 0 ? (
                <EmptyState title="아직 등록한 상품이 없습니다" description="디자인 견적에서 첫 펀딩 상품을 등록해보세요." />
              ) : (
                <DataTable minWidth={760} head={["상품", "상태", "판매량", "실결제 매출", "목표 달성", "평점"]}>
                  {data.products.map((p) => (
                    <tr key={p.funding_id} className="hover:bg-stone-50">
                      <Td>
                        <div className="flex min-w-0 items-center gap-2.5">
                          {p.image_url && <img src={p.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-stone-200" loading="lazy" />}
                          <div className="min-w-0">
                            <p className="max-w-[220px] truncate font-semibold">{p.product_name}</p>
                            <p className="text-[11px] text-stone-400">{p.brand_name ?? "-"}</p>
                          </div>
                        </div>
                      </Td>
                      <Td><MappedBadge map={FUNDING_PHASE} value={p.phase} /></Td>
                      <Td className="tabular-nums">{num(p.paid_quantity)}장 <span className="text-[11px] text-stone-400">({num(p.orders)}건)</span></Td>
                      <Td className="tabular-nums">
                        <p className="font-bold">{won(p.real_amount)}</p>
                        {p.mock_amount > 0 && <p className="text-[11px] text-amber-700">모의 {won(p.mock_amount)} 제외</p>}
                      </Td>
                      <Td className="tabular-nums">{pct(p.progress, 0)} <span className="text-[11px] text-stone-400">{num(p.current_orders)}/{num(p.moq)}</span></Td>
                      <Td className="tabular-nums">{p.review_count ? `★ ${Number(p.average_rating).toFixed(1)} (${p.review_count})` : "-"}</Td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </Panel>
            <Panel title="브랜드별 판매" description="실결제 매출">
              {data.brands.length === 0 ? <EmptyState title="데이터가 없습니다" /> : (
                <RankBars
                  rows={data.brands.map((b) => ({ name: b.brand_name, value: b.real_amount, sub: `${num(b.paid_quantity)}장 · 펀딩 ${b.fundings}개` }))}
                  valueLabel={won}
                />
              )}
            </Panel>
          </div>

          {data.products.some((p) => p.real_amount > 0) && (
            <Panel title="상품별 매출 추이" description="실결제 매출 상위 4개 상품 · 기간 단위는 위 선택과 같습니다">
              <div className="grid gap-5 md:grid-cols-2">
                {data.products.filter((p) => p.real_amount > 0).slice(0, 4).map((p) => (
                  <div key={p.funding_id} className="min-w-0">
                    <p className="mb-1 truncate text-xs font-bold text-stone-600">{p.product_name}</p>
                    <TrendChart data={p.series} dataKey="real_amount" label={p.product_name} money height={160} />
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
