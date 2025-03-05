
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster"
import Index from './pages/Index';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import { AuthGuard } from './components/auth/AuthGuard';
import AuthCallback from './pages/AuthCallback';

// Kakao 타입 선언
declare global {
  interface Window {
    Kakao: any;
  }
}

// Hash 파라미터 처리를 위한 컴포넌트
function AuthRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // 해시 파라미터가 있고 현재 path가 root인 경우에만 리다이렉트
    if (location.pathname === '/' && location.hash && location.hash.includes('access_token')) {
      console.log('Redirecting hash parameters to auth callback');
      navigate('/auth/callback' + location.hash, { replace: true });
    }
  }, [location, navigate]);

  return null;
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

    return () => {
      document.body.removeChild(script);
    };
  }, [isKakaoInitialized]);

  return (
    <>
      <BrowserRouter>
        <AuthRedirect />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/profile" element={<AuthGuard><Profile /></AuthGuard>} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </>
  );
}

export default App;
