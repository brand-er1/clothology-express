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
import { useIsMobile } from './hooks/use-mobile';

// Kakao 타입 선언
declare global {
  interface Window {
    Kakao: any;
  }
}

function App() {
  const [isKakaoInitialized, setIsKakaoInitialized] = useState(false);
  const [isInIframeContext, setIsInIframeContext] = useState(false);
  
  // 모바일 상태 확인
  const isMobile = useIsMobile();

  useEffect(() => {
    // Check if we're in an iframe
    const inIframe = isInIframe();
    setIsInIframeContext(inIframe);
    
    // iframe 상태를 콘솔에 기록
    console.log("App mounted in iframe:", inIframe, "Mobile:", isMobile);
    
    // iframe 내에서 실행 중인 경우 스타일 조정
    if (inIframe) {
      // iframe용 최적화 스타일 적용 (선택 사항)
      document.body.classList.add('in-iframe');
    }
    
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
    
    // URL 파라미터 체크
    const urlParams = new URLSearchParams(window.location.search);
    const isMobileParam = urlParams.get('isMobile');
    
    if (isMobileParam === 'true') {
      // URL 파라미터로 모바일 모드가 명시되었을 경우 처리
      document.body.classList.add('force-mobile');
      console.log("Forced mobile mode by URL parameter");
    }

    // 부모 창으로부터 메시지 수신 핸들러
    const handleParentMessage = async (event: MessageEvent) => {
      // iframe 내에서만 처리
      if (inIframe) {
        try {
          const message = event.data;
          
          // 인증 관련 메시지
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
          
          // 부모 창 크기 정보 메시지
          else if (message && message.type === 'PARENT_WINDOW_SIZE') {
            console.log("Received parent window size:", message);
            
            // 부모 창이 모바일 크기라면 모바일 최적화를 위한 클래스 추가
            if (message.isMobile) {
              document.body.classList.add('parent-is-mobile');
            } else {
              document.body.classList.remove('parent-is-mobile');
            }
          }
        } catch (e) {
          console.error("Error processing message in iframe:", e);
        }
      }
    };
    
    window.addEventListener('message', handleParentMessage);

    // 부모 창에 현재 상태 알림
    if (inIframe) {
      try {
        window.parent.postMessage({
          type: 'IFRAME_READY',
          isMobile: isMobile,
          userAgent: navigator.userAgent,
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight
        }, '*');
      } catch (e) {
        console.error("Error posting ready message:", e);
      }
    }

    return () => {
      document.body.removeChild(script);
      window.removeEventListener('message', handleParentMessage);
    };
  }, [isMobile]);

  return (
    <div className={isMobile ? 'mobile-view' : 'desktop-view'}>
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
    </div>
  );
}

export default App;
