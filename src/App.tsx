import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster"
import Index from './pages/Index';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import { AuthGuard } from './components/auth/AuthGuard';
import AuthCallback from './pages/AuthCallback';
import Customize from './pages/Customize';
import Orders from './pages/Orders';
import Admin from './pages/Admin';
import Fundings from './pages/Fundings';
import FundingDetail from './pages/FundingDetail';
import FundingEditor from './pages/FundingEditor';
import FundingManager from './pages/FundingManager';
import MyFundings from './pages/MyFundings';
import KakaoPayResult from './pages/KakaoPayResult';
import FabricSwatch from './pages/FabricSwatch';
import DesignQuote from './pages/DesignQuote';
import { supabase } from './lib/supabase';
import { WelcomeNotification } from './components/WelcomeNotification';
import { isInIframe } from './utils/authUtils';
import { getAppUrl, routerBasename } from './utils/appUrl';
import { useIsMobile } from './hooks/use-mobile';
import { Footer } from './components/Footer';
import { SiteVisitTracker } from './components/SiteVisitTracker';
import { VisitDataNotice } from './components/VisitDataNotice';
import VisitDataPolicy from './pages/VisitDataPolicy';

declare global {
  interface Window {
    Kakao?: {
      init: (key: string) => void;
      isInitialized: () => boolean;
    };
  }
}

function App() {
  const [isInIframeContext, setIsInIframeContext] = useState(false);
  const isMobile = useIsMobile();

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
      if (kakaoApiKey && window.Kakao && !window.Kakao.isInitialized()) {
        window.Kakao.init(kakaoApiKey);
      }
    };
    document.body.appendChild(script);

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('isMobile') === 'true') document.body.classList.add('force-mobile');

    const handleParentMessage = async (event: MessageEvent) => {
      if (!inIframe) return;
      try {
        const message = event.data;
        if (message && message.type === 'SESSION_DATA' && message.data) {
          const { error } = await supabase.auth.setSession({
            access_token: message.data.access_token,
            refresh_token: message.data.refresh_token
          });
          if (!error) window.location.href = getAppUrl();
        } else if (message && message.type === 'PARENT_WINDOW_SIZE') {
          document.body.classList.toggle('parent-is-mobile', Boolean(message.isMobile));
        }
      } catch (error) {
        console.error("Error processing message in iframe:", error);
      }
    };

    window.addEventListener('message', handleParentMessage);

    if (inIframe) {
      window.parent.postMessage({
        type: 'IFRAME_READY',
        isMobile,
        userAgent: navigator.userAgent,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight
      }, '*');
    }

    return () => {
      if (document.body.contains(script)) document.body.removeChild(script);
      window.removeEventListener('message', handleParentMessage);
    };
  }, [isMobile]);

  return (
    <div className={isMobile ? 'mobile-view' : 'desktop-view'}>
      <BrowserRouter basename={routerBasename}>
        <SiteVisitTracker />
        <VisitDataNotice />
        <WelcomeNotification />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/profile" element={<AuthGuard><Profile /></AuthGuard>} />
          <Route path="/customize" element={<AuthGuard requiredAccountType="seller"><Customize /></AuthGuard>} />
          <Route path="/design-quote" element={<AuthGuard requiredAccountType="seller"><DesignQuote /></AuthGuard>} />
          <Route path="/fundings" element={<Fundings />} />
          <Route path="/fundings/:id" element={<FundingDetail />} />
          <Route path="/fundings/:id/edit" element={<AuthGuard requiredAccountType="seller"><FundingEditor /></AuthGuard>} />
          <Route path="/fundings/:id/manage" element={<AuthGuard requiredAccountType="seller"><FundingManager /></AuthGuard>} />
          <Route path="/my-fundings" element={<AuthGuard><MyFundings /></AuthGuard>} />
          <Route path="/payments/kakaopay/:result" element={<KakaoPayResult />} />
          <Route path="/orders" element={<AuthGuard requiredAccountType="seller"><Orders /></AuthGuard>} />
          <Route path="/fabric-swatch" element={<AuthGuard><FabricSwatch /></AuthGuard>} />
          <Route path="/visit-data-policy" element={<VisitDataPolicy />} />
          <Route path="/admin/*" element={<AuthGuard><Admin /></AuthGuard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Footer />
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;
