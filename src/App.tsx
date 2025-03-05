
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
import { toast } from './components/ui/use-toast';
import { supabase } from './lib/supabase';
import { WelcomeNotification } from './components/WelcomeNotification';
import { refreshSessionAfterSocialLogin, isInIframe } from './utils/authUtils';

// Kakao 타입 선언
declare global {
  interface Window {
    Kakao: any;
  }
}

function App() {
  const [isKakaoInitialized, setIsKakaoInitialized] = useState(false);
  const [isInIframeContext, setIsInIframeContext] = useState(false);

  useEffect(() => {
    // Check if we're in an iframe
    setIsInIframeContext(isInIframe());
    
    // Kakao SDK 스크립트 동적 로딩
    const script = document.createElement('script');
    script.src = 'https://developers.kakao.com/sdk/js/kakao.js';
    script.async = true;
    script.onload = () => {
      // Kakao SDK 초기화 (JavaScript 키 사용)
      const kakaoApiKey = '65949909b86a9401ca9559ea3c184659';
      if (kakaoApiKey && !isKakaoInitialized && window.Kakao) {
        // Kakao SDK 초기화는 한 번만 실행되도록
        if (!window.Kakao.isInitialized()) {
          window.Kakao.init(kakaoApiKey);
          setIsKakaoInitialized(true);
          console.log('Kakao SDK initialized.');
        } else {
          console.log('Kakao SDK already initialized.');
        }
      }
    };
    document.body.appendChild(script);

    // Check for stored session data on app load
    const checkStoredSession = async () => {
      await refreshSessionAfterSocialLogin();
    };
    
    checkStoredSession();

    // URL의 해시 파라미터 체크하여 에러 메시지 표시
    const checkForErrors = () => {
      // URL의 해시(#) 또는 쿼리 파라미터(?) 확인
      const url = new URL(window.location.href);
      const errorHashParams = new URLSearchParams(window.location.hash.substring(1));
      const errorQueryParams = url.searchParams;
      
      // 에러 파라미터 추출
      const errorHash = errorHashParams.get('error');
      const errorQuery = errorQueryParams.get('error');
      const errorDescriptionHash = errorHashParams.get('error_description');
      const errorDescriptionQuery = errorQueryParams.get('error_description');
      
      if (errorHash || errorQuery) {
        const errorDescription = errorDescriptionHash || errorDescriptionQuery || '알 수 없는 오류가 발생했습니다.';
        toast({
          title: "인증 오류",
          description: decodeURIComponent(errorDescription),
          variant: "destructive",
        });
        
        // 에러 파라미터 제거 (URL 정리)
        window.history.replaceState(null, '', window.location.pathname);
      }
    };
    
    checkForErrors();

    // Set up message listener for cross-domain iframe communication
    const handleMessage = async (event: MessageEvent) => {
      // Accept messages from any origin when in iframe
      if (isInIframeContext) {
        try {
          const message = event.data;
          if (message && message.type === 'SESSION_DATA' && message.data) {
            console.log("Received session data in iframe:", message.data);
            
            // Set the session using the received data
            const { error } = await supabase.auth.setSession({
              access_token: message.data.access_token,
              refresh_token: message.data.refresh_token
            });
            
            if (error) {
              console.error("Error setting session in iframe:", error);
            } else {
              console.log("Successfully set session in iframe");
              // Force a reload if needed
              window.location.href = window.location.origin;
            }
          }
        } catch (e) {
          console.error("Error processing message in iframe:", e);
        }
      }
    };
    
    window.addEventListener('message', handleMessage);

    return () => {
      document.body.removeChild(script);
      window.removeEventListener('message', handleMessage);
    };
  }, [isKakaoInitialized]);

  return (
    <>
      <BrowserRouter>
        <WelcomeNotification />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/profile" element={<AuthGuard><Profile /></AuthGuard>} />
          <Route path="/customize" element={<AuthGuard><Customize /></AuthGuard>} />
          <Route path="/orders" element={<AuthGuard><Orders /></AuthGuard>} />
          <Route path="/admin" element={<AuthGuard><Admin /></AuthGuard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </>
  );
}

export default App;
