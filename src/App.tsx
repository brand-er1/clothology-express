
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Auth from "@/pages/Auth";
import Profile from "@/pages/Profile";
import { AuthGuard } from "@/components/auth/AuthGuard";
import AuthCallback from "@/pages/AuthCallback";
import { WelcomeNotification } from "@/components/WelcomeNotification";
import { Header } from "@/components/Header";

const queryClient = new QueryClient();

function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <WelcomeNotification />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/profile"
            element={
              <AuthGuard>
                <Profile />
              </AuthGuard>
            }
          />
          <Route
            path="/"
            element={
              <AuthGuard>
                <div className="min-h-screen bg-gray-50">
                  <Header />
                  <main className="container mx-auto px-4 pt-20">
                    <div className="grid gap-8 mt-8">
                      <div className="bg-white rounded-lg shadow-md p-6">
                        <h1 className="text-2xl font-bold mb-4">환영합니다!</h1>
                        <p className="text-gray-600 mb-4">
                          BRAND-ER 맞춤 의류 플랫폼에 오신 것을 환영합니다. 좌측 메뉴에서 원하는 서비스를 선택해주세요.
                        </p>
                      </div>
                    </div>
                  </main>
                </div>
              </AuthGuard>
            }
          />
        </Routes>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
