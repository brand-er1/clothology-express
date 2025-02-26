
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import Index from "./pages/Index";
import Customize from "./pages/Customize";
import Orders from "./pages/Orders";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

// 사용자 정보 타입 정의
export interface UserInfo {
  userId?: string;
  userName?: string;
  [key: string]: any; // 추가 데이터를 위한 인덱스 시그니처
}

const queryClient = new QueryClient();

const App = () => {
  const [userInfo, setUserInfo] = useState<UserInfo>({});

  useEffect(() => {
    // URL 파라미터에서 사용자 정보 확인
    const params = new URLSearchParams(window.location.search);
    const urlUserInfo: UserInfo = {};
    params.forEach((value, key) => {
      if (key.startsWith('user')) {
        urlUserInfo[key] = value;
      }
    });

    // URL에서 가져온 정보가 있다면 설정
    if (Object.keys(urlUserInfo).length > 0) {
      setUserInfo(urlUserInfo);
    }

    // postMessage 리스너 설정
    const handleMessage = (event: MessageEvent) => {
      // 신뢰할 수 있는 도메인인지 확인 (실제 도메인으로 변경 필요)
      const trustedDomains = ['http://localhost:3000', 'https://your-parent-domain.com'];
      if (!trustedDomains.includes(event.origin)) {
        console.warn('Untrusted domain:', event.origin);
        return;
      }

      // USER_INFO 타입의 메시지 처리
      if (event.data.type === 'USER_INFO') {
        setUserInfo(event.data.data);
      }
    };

    window.addEventListener('message', handleMessage);

    // 부모 창에 준비되었다고 알림
    window.parent.postMessage({ type: 'IFRAME_READY' }, '*');

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route 
              path="/customize" 
              element={<Customize userInfo={userInfo} />} 
            />
            <Route 
              path="/orders" 
              element={<Orders userInfo={userInfo} />} 
            />
            <Route 
              path="/admin" 
              element={<Admin userInfo={userInfo} />} 
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
