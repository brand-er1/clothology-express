import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster"
import Index from './pages/Index';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import AuthGuard from './components/auth/AuthGuard';
import Kakao from './pages/Kakao';
import AuthCallback from './pages/AuthCallback';

function App() {
  const [isKakaoInitialized, setIsKakaoInitialized] = useState(false);

  useEffect(() => {
    // Kakao SDK 초기화 (JavaScript 키 사용)
    const kakaoApiKey = '65949909b86a9401ca9559ea3c184659'; // 여기에 JavaScript 키를 입력하세요
    if (kakaoApiKey && !isKakaoInitialized) {
      // Kakao SDK 초기화는 한 번만 실행되도록
      if (!window.Kakao.isInitialized()) {
        window.Kakao.init(kakaoApiKey);
        setIsKakaoInitialized(true);
        console.log('Kakao SDK initialized.');
      } else {
        console.log('Kakao SDK already initialized.');
      }
    }
  }, [isKakaoInitialized]);

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/profile" element={<AuthGuard><Profile /></AuthGuard>} />
          <Route path="/kakao" element={<Kakao />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </>
  );
}

export default App;
