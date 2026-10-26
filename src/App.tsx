import { useState, useEffect, Suspense, type ReactNode } from 'react';
import { lazyWithReload } from './lib/lazyWithReload';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { ErrorBoundary, PageErrorFallback } from './components/ErrorBoundary';
import { Toaster } from "@/components/ui/toaster"
import Index from './pages/Index';
import NotFound from './pages/NotFound';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import { AuthGuard } from './components/auth/AuthGuard';
import AuthCallback from './pages/AuthCallback';
import Customize from './pages/Customize';
import Orders from './pages/Orders';
import Fundings from './pages/Fundings';
import FundingDetail from './pages/FundingDetail';
import FundingEditor from './pages/FundingEditor';
import FundingManager from './pages/FundingManager';
import FundingBuyers from './pages/FundingBuyers';
import FundingColorStudio from './pages/FundingColorStudio';
import MyFundings from './pages/MyFundings';
import KakaoPayResult from './pages/KakaoPayResult';
import KsnetPayResult from './pages/KsnetPayResult';
import FabricSwatch from './pages/FabricSwatch';
import DesignQuote from './pages/DesignQuote';
import Closet from './pages/Closet';
import Portfolio from './pages/Portfolio';
import QuickGroupWear from './pages/QuickGroupWear';
import { supabase } from './lib/supabase';
import { claimGuestSession } from './services/designs';
import { toast } from '@/components/ui/use-toast';
import { WelcomeNotification } from './components/WelcomeNotification';
import { isInIframe } from './utils/authUtils';
import { getAppUrl, routerBasename } from './utils/appUrl';
import { useIsMobile } from './hooks/use-mobile';
import { useDisableImageCapture } from './hooks/useDisableImageCapture';
import { Footer } from './components/Footer';
import { BrandGuide } from './components/guide/BrandGuide';
import { MascotProvider } from './components/guide/MascotContext';
import { TutorialProvider } from './components/guide/TutorialContext';
import { TutorialOverlay } from './components/guide/TutorialOverlay';
import { SiteVisitTracker } from './components/SiteVisitTracker';
import { VisitDataNotice } from './components/VisitDataNotice';
import VisitDataPolicy from './pages/VisitDataPolicy';
import { BottomNav, BOTTOM_NAV_SPACER_CLASSNAME } from './components/BottomNav';
import { KakaoCommunityWidget } from './components/KakaoCommunityWidget';
import CommunityFeed from './pages/community/CommunityFeed';
import CommunityCreatePost from './pages/community/CommunityCreatePost';
import CommunityPostDetail from './pages/community/CommunityPostDetail';
import CommunityProfile from './pages/community/CommunityProfile';
import CommunityNotifications from './pages/community/CommunityNotifications';
import MyBrand from './pages/MyBrand';
import BrandProfile from './pages/BrandProfile';
import DetailPageStudio from './pages/DetailPageStudio';
import FundingDetailPageLauncher from './pages/FundingDetailPageLauncher';
import { getFundingDetailHref } from './lib/funding-success-stories';
import MagazineArticle from './pages/MagazineArticle';
import MagazineList from './pages/MagazineList';

// 관리자 콘솔은 별도 번들로 분리해 일반 사용자에게 내려가는 코드를 늘리지 않는다.
const AdminApp = lazyWithReload(() => import('./pages/admin/AdminApp'));
const SellerApp = lazyWithReload(() => import('./pages/seller/SellerApp'));

/** 관리자 · 판매자 콘솔 코드를 받는 동안 빈 화면 대신 진행 표시를 보여준다. */
const ConsoleLoading = ({ label }: { label: string }) => (
  <div role="status" className="flex min-h-screen items-center justify-center gap-2 bg-[#f6f3ef] text-sm text-stone-500">
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-[#741b2b]" aria-hidden />{label}
  </div>
);

// 한 화면의 렌더링 오류가 사이트 전체 장애로 번지지 않게 막는다. 다른 주소로 이동하면 자동으로 풀린다.
const RouteErrorBoundary = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  return (
    <ErrorBoundary scope="route" resetKey={location.pathname} fallback={() => <PageErrorFallback onRetry={() => window.location.reload()} />}>
      {children}
    </ErrorBoundary>
  );
};

// /admin 에서는 서비스용 푸터·하단 내비·가이드 위젯 등을 숨기고 관리자 레이아웃만 보여준다.
// 예전 '펀딩 성공 상세보기' 중간 페이지. 성공 정보 · 구매자 리뷰 · 제작 과정이 펀딩 상세로 합쳐져
// 기존 링크는 해당 펀딩의 구매자 리뷰 탭으로 바로 보낸다.
const SuccessStoryRedirect = () => {
  const { fundingId } = useParams<{ fundingId: string }>();
  return <Navigate to={fundingId ? getFundingDetailHref(fundingId, 'reviews') : '/fundings'} replace />;
};

const PublicChrome = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  // 관리자 콘솔 · 판매자 센터는 자체 사이드바를 쓰므로 공개 사이트의 푸터 · 하단 탭 · 위젯을 숨긴다.
  if (['/admin', '/seller'].some((base) => pathname === base || pathname.startsWith(`${base}/`))) return null;
  return <>{children}</>;
};

declare global {
  interface Window { Kakao?: { init: (key: string) => void; isInitialized: () => boolean; }; }
}

function App() {
  const [isInIframeContext, setIsInIframeContext] = useState(false);
  const isMobile = useIsMobile();
  useDisableImageCapture();

  useEffect(() => {
    const inIframe = isInIframe();
    setIsInIframeContext(inIframe);
    console.log("App mounted in iframe:", inIframe, "Mobile:", isMobile);
    if (inIframe) document.body.classList.add('in-iframe');
    const script = document.createElement('script');
    script.src = 'https://developers.kakao.com/sdk/js/kakao.js';
    script.async = true;
    script.onload = () => {
      const kakaoApiKey = '65949909b86a9401ca9559ea3c184659';
      if (kakaoApiKey && window.Kakao && !window.Kakao.isInitialized()) window.Kakao.init(kakaoApiKey);
    };
    document.body.appendChild(script);
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('isMobile') === 'true') document.body.classList.add('force-mobile');
    const handleParentMessage = async (event: MessageEvent) => {
      if (!inIframe) return;
      try {
        const message = event.data;
        if (message && message.type === 'SESSION_DATA' && message.data) {
          const { error } = await supabase.auth.setSession({ access_token: message.data.access_token, refresh_token: message.data.refresh_token });
          if (!error) window.location.href = getAppUrl();
        } else if (message && message.type === 'PARENT_WINDOW_SIZE') {
          document.body.classList.toggle('parent-is-mobile', Boolean(message.isMobile));
        }
      } catch (error) { console.error("Error processing message in iframe:", error); }
    };
    window.addEventListener('message', handleParentMessage);
    if (inIframe) window.parent.postMessage({ type: 'IFRAME_READY', isMobile, userAgent: navigator.userAgent, windowWidth: window.innerWidth, windowHeight: window.innerHeight }, '*');
    return () => {
      if (document.body.contains(script)) document.body.removeChild(script);
      window.removeEventListener('message', handleParentMessage);
    };
  }, [isMobile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_IN') return;
      void claimGuestSession().then((result) => {
        if (result && result.designs > 0) toast({ title: '기존 작업물을 계정으로 옮겼어요', description: `디자인 ${result.designs}개를 이어서 확인할 수 있어요.` });
      });
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className={`${isMobile ? 'mobile-view' : 'desktop-view'} ${BOTTOM_NAV_SPACER_CLASSNAME}`}>
      <BrowserRouter basename={routerBasename}>
        <MascotProvider><TutorialProvider>
          <SiteVisitTracker /><PublicChrome><VisitDataNotice /><WelcomeNotification /></PublicChrome>
          <RouteErrorBoundary><Routes>
            <Route path="/" element={<Index />} />
            <Route path="/index.html" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/profile" element={<AuthGuard><Profile /></AuthGuard>} />
            <Route path="/my-brand" element={<AuthGuard requiredAccountType="seller"><MyBrand /></AuthGuard>} />
            <Route path="/brands/:brandId" element={<BrandProfile />} />
            <Route path="/customize" element={<Customize />} />
            <Route path="/design-quote" element={<DesignQuote />} />
            <Route path="/estimate" element={<DesignQuote />} />
            <Route path="/closet" element={<Closet />} />
            <Route path="/outfits" element={<Navigate to="/closet" replace />} />
            <Route path="/outfits/:id" element={<Navigate to="/closet" replace />} />
            <Route path="/my-outfits" element={<Navigate to="/closet" replace />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/quick-group-wear" element={<QuickGroupWear />} />
            <Route path="/magazine" element={<MagazineList />} />
            <Route path="/magazine/:slug" element={<MagazineArticle />} />
            <Route path="/fundings" element={<Fundings />} />
            <Route path="/fundings/:id" element={<FundingDetail />} />
            <Route path="/success-stories/:fundingId" element={<SuccessStoryRedirect />} />
            <Route path="/fundings/:id/edit" element={<AuthGuard requiredAccountType="seller"><FundingEditor /></AuthGuard>} />
            <Route path="/fundings/:id/detail-page" element={<AuthGuard requiredAccountType="seller"><FundingDetailPageLauncher /></AuthGuard>} />
            <Route path="/detail-pages/:pageId" element={<AuthGuard><DetailPageStudio /></AuthGuard>} />
            <Route path="/fundings/:id/manage" element={<AuthGuard requiredAccountType="seller"><FundingManager /></AuthGuard>} />
            <Route path="/fundings/:id/buyers" element={<AuthGuard requiredAccountType="seller"><FundingBuyers /></AuthGuard>} />
            <Route path="/fundings/:id/colors" element={<AuthGuard><FundingColorStudio /></AuthGuard>} />
            <Route path="/my-fundings" element={<AuthGuard><MyFundings /></AuthGuard>} />
            <Route path="/payments/kakaopay/:result" element={<KakaoPayResult />} />
            <Route path="/payments/ksnet/result" element={<KsnetPayResult />} />
            <Route path="/orders" element={<AuthGuard requiredAccountType="seller"><Orders /></AuthGuard>} />
            <Route path="/fabric-swatch" element={<AuthGuard><FabricSwatch /></AuthGuard>} />
            <Route path="/community" element={<CommunityFeed />} />
            <Route path="/community/new" element={<AuthGuard><CommunityCreatePost /></AuthGuard>} />
            <Route path="/community/notifications" element={<AuthGuard><CommunityNotifications /></AuthGuard>} />
            <Route path="/community/profile/:userId" element={<CommunityProfile />} />
            <Route path="/community/:postId" element={<CommunityPostDetail />} />
            <Route path="/visit-data-policy" element={<VisitDataPolicy />} />
            <Route path="/seller/*" element={<AuthGuard requiredAccountType="seller"><Suspense fallback={<ConsoleLoading label="판매자 센터를 불러오는 중..." />}><SellerApp /></Suspense></AuthGuard>} />
            <Route path="/admin/*" element={<AuthGuard><Suspense fallback={<ConsoleLoading label="관리자 화면을 불러오는 중..." />}><AdminApp /></Suspense></AuthGuard>} />
            <Route path="*" element={<NotFound />} />
          </Routes></RouteErrorBoundary>
          <PublicChrome><Footer /><BrandGuide /><TutorialOverlay /><BottomNav /><KakaoCommunityWidget /></PublicChrome>
        </TutorialProvider></MascotProvider>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;
