
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster"
import Index from './pages/Index';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import { AuthGuard } from './components/auth/AuthGuard';
import AuthCallback from './pages/AuthCallback';
import { toast } from './components/ui/use-toast';
import { supabase } from "@/lib/supabase";
import { ProfileInfoModal } from './components/auth/ProfileInfoModal';

// Kakao 타입 선언
declare global {
  interface Window {
    Kakao: any;
  }
}

function App() {
  const [isKakaoInitialized, setIsKakaoInitialized] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 사용자 프로필 정보 확인 함수
  const checkUserProfileInfo = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('height, weight, gender, phone_number')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error("프로필 정보 확인 오류:", error);
      return false;
    }
    
    // 키와 몸무게가 있으면 정보가 충분하다고 판단
    return !!(data.height && data.weight);
  };

  useEffect(() => {
    // 로그인 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // 로그인 이벤트 발생 시
        if (event === 'SIGNED_IN' && session?.user) {
          const userId = session.user.id;
          setCurrentUserId(userId);
          
          // 프로필 정보 확인
          const hasProfileInfo = await checkUserProfileInfo(userId);
          
          // 소셜 로그인이고 프로필 정보가 없을 경우 모달 표시
          if (
            session.user.app_metadata.provider &&
            ['google', 'kakao', 'linkedin_oidc'].includes(session.user.app_metadata.provider) &&
            !hasProfileInfo
          ) {
            setIsProfileModalOpen(true);
          }
        } else if (event === 'SIGNED_OUT') {
          setCurrentUserId(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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

    return () => {
      document.body.removeChild(script);
    };
  }, [isKakaoInitialized]);

  const handleCloseProfileModal = () => {
    setIsProfileModalOpen(false);
  };

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/profile" element={<AuthGuard><Profile /></AuthGuard>} />
        </Routes>
      </BrowserRouter>
      <Toaster />
      
      {isProfileModalOpen && currentUserId && (
        <ProfileInfoModal 
          isOpen={isProfileModalOpen} 
          onClose={handleCloseProfileModal} 
          userId={currentUserId}
        />
      )}
    </>
  );
}

export default App;
