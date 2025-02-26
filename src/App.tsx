
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Index from "./pages/Index";
import Customize from "./pages/Customize";
import Orders from "./pages/Orders";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

export interface UserInfo {
  userId?: string;
  userName?: string;
  [key: string]: any;
}

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    checkAuth();
  }, []);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" />;
  return <>{children}</>;
};

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

    if (Object.keys(urlUserInfo).length > 0) {
      setUserInfo(urlUserInfo);
    }

    // 인증 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          setUserInfo({
            userId: session.user.id,
            userName: session.user.user_metadata.username,
            ...session.user,
          });
        } else {
          setUserInfo({});
        }
      }
    );

    return () => {
      subscription.unsubscribe();
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
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/customize"
              element={
                <ProtectedRoute>
                  <Customize userInfo={userInfo} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <Orders userInfo={userInfo} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <Admin userInfo={userInfo} />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
