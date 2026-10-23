import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { ArrowUpRight, Building2, Loader2, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ErrorBoundary, PageErrorFallback } from "@/components/ErrorBoundary";
import { Forbidden, LoadingBlock } from "@/components/admin/shell/ui";
import { cn } from "@/lib/utils";
import { fetchMyBrand } from "@/services/brand";
import { PAYMENT } from "@/services/payment";
import type { BrandWithCreator } from "@/types/brand";
import { SELLER_NAV, SellerContext } from "./sellerContext";

const DashboardPage = lazy(() => import("./DashboardPage"));
const ProductsPage = lazy(() => import("./ProductsPage"));
const FundingsPage = lazy(() => import("./FundingsPage"));
const OrdersPage = lazy(() => import("./OrdersPage"));
const ReviewsPage = lazy(() => import("./ReviewsPage"));
const InquiriesPage = lazy(() => import("./InquiriesPage"));
const SettlementsPage = lazy(() => import("./SettlementsPage"));
const BrandPage = lazy(() => import("./BrandPage"));

const SidebarNav = ({ onNavigate }: { onNavigate?: () => void }) => (
  <nav className="grid gap-0.5" aria-label="판매자 메뉴">
    {SELLER_NAV.map(({ path, label, icon: Icon }) => (
      <NavLink key={path} to={path ? `/seller/${path}` : "/seller"} end={!path} onClick={onNavigate}
        className={({ isActive }) => cn(
          "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition",
          isActive ? "bg-[#741b2b] text-white shadow-sm" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
        )}>
        <Icon className="h-4 w-4 shrink-0" />{label}
      </NavLink>
    ))}
  </nav>
);

const BrandMark = ({ brand }: { brand: BrandWithCreator | null }) => (
  <Link to="/seller" className="flex min-w-0 items-center gap-2 px-3">
    {brand?.brand_logo_url
      ? <img src={brand.brand_logo_url} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-stone-200" />
      : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#741b2b] text-sm font-black text-white">B</span>}
    <span className="min-w-0 leading-tight">
      <span className="block truncate text-sm font-black tracking-[-0.02em] text-stone-950">{brand?.brand_name ?? "BRAND-ER"}</span>
      <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Seller Center</span>
    </span>
  </Link>
);

/** 결제가 실운영이 아닐 때 판매자에게 매출 기준을 알린다. */
const PaymentModeBanner = () => {
  if (PAYMENT.mode === "live") return null;
  const text = PAYMENT.mode === "disabled"
    ? "온라인 결제 오픈 전입니다. 상품·펀딩·리뷰·문의 관리는 그대로 이용할 수 있으며, 매출과 정산은 실결제 주문만 집계됩니다."
    : PAYMENT.mode === "test"
      ? "PG 테스트 결제 환경입니다. 이 환경의 주문은 실제 운영 결제가 아닙니다."
      : "모의결제(개발) 환경입니다. 모의결제 주문은 매출 · 결제 완료 금액 · 정산에 포함되지 않습니다.";
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12px] font-semibold text-amber-800 sm:px-6">{text}</div>
  );
};

const NeedsBrand = () => (
  <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#741b2b]/10"><Building2 className="h-5 w-5 text-[#741b2b]" /></span>
    <h2 className="mt-4 text-lg font-extrabold">먼저 내 브랜드를 등록해주세요</h2>
    <p className="mt-2 text-sm leading-6 text-stone-500">
      판매자 센터는 기존 제작자 프로필 · 브랜드와 연결됩니다. 별도 계정을 만들 필요 없이 지금 계정으로 브랜드를 등록하면 바로 이용할 수 있습니다.
    </p>
    <Link to="/my-brand?returnTo=/seller" className="mt-6 inline-flex rounded-xl bg-[#741b2b] px-4 py-2.5 text-sm font-bold text-white">내 브랜드 등록하기</Link>
  </div>
);

const SellerLayout = ({ brand, children }: { brand: BrandWithCreator | null; children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const current = SELLER_NAV.find(({ path }) => (path ? location.pathname.startsWith(`/seller/${path}`) : location.pathname.replace(/\/$/, "") === "/seller"));

  return (
    <div className="min-h-screen bg-[#f6f3ef] text-stone-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-stone-200/80 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-stone-100"><BrandMark brand={brand} /></div>
        <div className="flex-1 overflow-y-auto px-3 py-4"><SidebarNav /></div>
        <div className="grid gap-0.5 border-t border-stone-100 p-3 text-xs text-stone-500">
          {brand && <Link to={`/brands/${brand.id}`} className="flex items-center gap-1 rounded-lg px-2 py-1.5 font-semibold hover:bg-stone-100">공개 브랜드 페이지 <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
          <Link to="/" className="flex items-center gap-1 rounded-lg px-2 py-1.5 font-semibold hover:bg-stone-100">BRAND-ER 홈으로 <ArrowUpRight className="h-3.5 w-3.5" /></Link>
        </div>
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 overflow-y-auto p-0">
          <SheetTitle className="sr-only">판매자 메뉴</SheetTitle>
          <div className="flex h-16 items-center border-b border-stone-100"><BrandMark brand={brand} /></div>
          <div className="px-3 py-4"><SidebarNav onNavigate={() => setOpen(false)} /></div>
          <div className="border-t border-stone-100 p-3 text-xs"><Link to="/" className="font-semibold text-stone-500">BRAND-ER 홈으로</Link></div>
        </SheetContent>
      </Sheet>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-stone-200/80 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" className="rounded-lg p-2 hover:bg-stone-100 lg:hidden" onClick={() => setOpen(true)} aria-label="메뉴 열기"><Menu className="h-5 w-5" /></button>
            <span className="truncate text-sm font-extrabold text-stone-900">{current?.label ?? "판매자 센터"}</span>
          </div>
          <Link to="/" className="text-xs font-semibold text-stone-500 hover:text-stone-900">서비스 화면</Link>
        </header>
        <PaymentModeBanner />
        {/* 태블릿 · 모바일: 메뉴를 가로 탭으로도 노출 */}
        <div className="border-b border-stone-200/80 bg-white lg:hidden">
          <div className="flex gap-1 overflow-x-auto px-3 py-2">
            {SELLER_NAV.map(({ path, label }) => (
              <NavLink key={path} to={path ? `/seller/${path}` : "/seller"} end={!path}
                className={({ isActive }) => cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-bold",
                  isActive ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600")}>
                {label}
              </NavLink>
            ))}
          </div>
        </div>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
};

const SellerApp = () => {
  const location = useLocation();
  const [brand, setBrand] = useState<BrandWithCreator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadBrand = useCallback(async () => {
    try {
      setBrand(await fetchMyBrand());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "브랜드 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reloadBrand(); }, [reloadBrand]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f6f3ef] text-sm text-stone-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />판매자 정보를 확인하는 중...</div>;
  }

  const onBrandPage = location.pathname.startsWith("/seller/brand");
  return (
    <SellerContext.Provider value={{ brand, reloadBrand }}>
      <SellerLayout brand={brand}>
        {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        {!brand && !onBrandPage ? <NeedsBrand /> : (
          <ErrorBoundary scope="seller" resetKey={location.pathname} fallback={(reset) => <PageErrorFallback onRetry={reset} />}>
            <Suspense fallback={<LoadingBlock />}>
              <Routes>
                <Route index element={<DashboardPage />} />
                <Route path="products" element={<ProductsPage />} />
                <Route path="fundings" element={<FundingsPage />} />
                <Route path="orders" element={<OrdersPage />} />
                <Route path="reviews" element={<ReviewsPage />} />
                <Route path="inquiries" element={<InquiriesPage />} />
                <Route path="settlements" element={<SettlementsPage />} />
                <Route path="brand" element={<BrandPage />} />
                <Route path="*" element={<Forbidden permission="존재하지 않는 메뉴" />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        )}
      </SellerLayout>
    </SellerContext.Provider>
  );
};

export default SellerApp;
