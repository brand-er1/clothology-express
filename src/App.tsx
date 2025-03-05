
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

// Kakao 타입 선언
declare global {
  interface Window {
    Kakao: any;
  }
}

function App() {
  const [isKakaoInitialized, setIsKakaoInitialized] = useState(false);

  useEffect(() => {
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

    // URL hash parameters에서 세션 정보 추출 (OAuth 리다이렉트 처리)
    const handleHashParams = async () => {
      if (window.location.hash && window.location.hash.includes('access_token')) {
        try {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            console.log("Hash parameters found, setting session");
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (error) {
              console.error("Error setting session from hash params:", error);
              toast({
                title: "인증 오류",
                description: error.message,
                variant: "destructive",
              });
            } else {
              console.log("Session set successfully from hash parameters");
              // 세션 설정 후 URL hash 제거 및 홈으로 리다이렉트
              window.history.replaceState(null, '', '/');
              
              // 부모 창이 있으면 부모 창에 로그인 성공 알림 (팝업에서 호출된 경우)
              if (window.opener) {
                window.opener.postMessage({ type: 'AUTH_COMPLETE', success: true }, window.location.origin);
                window.close();
              }
            }
          }
        } catch (error) {
          console.error("Error handling hash params:", error);
        }
      }
    };
    
    handleHashParams();

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
        
        // 부모 창이 있으면 부모 창에 로그인 실패 알림 (팝업에서 호출된 경우)
        if (window.opener) {
          window.opener.postMessage({ type: 'AUTH_COMPLETE', success: false }, window.location.origin);
          window.close();
        }
      }
    };
    
    checkForErrors();
    
    // 소셜 로그인 팝업에서 메시지 수신 처리
    const handleMessage = async (event: MessageEvent) => {
      // 같은 출처(origin)에서 온 메시지만 처리
      if (event.origin !== window.location.origin) return;
      
      // AUTH_COMPLETE 메시지 처리
      if (event.data.type === 'AUTH_COMPLETE') {
        if (event.data.success) {
          // 로그인 성공 처리
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            toast({
              title: "로그인 성공!",
              description: "환영합니다.",
            });
          }
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
      <WelcomeNotification />
      <Toaster />
    </>
  );
}

export default App;
